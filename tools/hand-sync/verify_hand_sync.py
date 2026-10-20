"""
Verify saved .blend: measured tip from evaluated Pen mesh vs interaction target.
"""
import argparse
import json
import math
import sys
from pathlib import Path

from hand_sync_geometry import (
    camera_projection_px,
    evaluated_pen_tip_world,
    evaluated_probe_world,
    load_json,
    pen_target_world_m,
    reference_game_resolution,
    screen_plane_frame,
    signed_plane_distance_m,
    tip_local_in_pen_m,
)


def parse_args(argv):
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    p = argparse.ArgumentParser()
    p.add_argument("--job", required=True)
    p.add_argument("--blend", required=True)
    p.add_argument("--out", required=True)
    return p.parse_args(argv)


def scale_to_reference(px_err, render_h, ref_h=1920):
    return px_err * (ref_h / render_h)


def main():
    import bpy
    import mathutils

    args = parse_args(sys.argv)
    job = load_json(Path(args.job))
    bundle = Path(job["bundleDir"])
    interaction = load_json(bundle / "interaction.json")
    scene_config = load_json(bundle / "scene-config.json")
    layout = interaction["layout"]
    frames = interaction["frames"]
    game_w, game_h = reference_game_resolution(layout)
    render_w = bpy.context.scene.render.resolution_x if False else int(job.get("resolution", [270, 480])[0])
    render_h = int(job.get("resolution", [270, 480])[1])

    bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend)))
    scene = bpy.context.scene
    render_w, render_h = scene.render.resolution_x, scene.render.resolution_y
    pen = bpy.data.objects.get("Pen")
    probe = bpy.data.objects.get("ProbeTip")
    screen = bpy.data.objects.get("ScreenProxy")
    marker = bpy.data.objects.get("PenTipMarker")
    if not pen or not screen:
        print("VERIFY_FAIL missing Pen or ScreenProxy")
        sys.exit(2)

    max_px_1080 = float(job.get("projectionMaxPxAt1080", 2.0))
    p95_limit = float(job.get("projectionP95PxAt1080", 1.0))
    contact_tol_m = float(job.get("contactDistanceMaxM", 0.0005))

    per_frame = []
    errors = []
    depsgraph = bpy.context.evaluated_depsgraph_get()

    for idx, frame in enumerate(frames, start=1):
        scene.frame_set(idx)
        depsgraph.update()
        target = pen_target_world_m(frame, layout)
        tip = evaluated_pen_tip_world(depsgraph, pen, scene_config)
        probe_w = evaluated_probe_world(depsgraph, probe) if probe else tip
        plane_o, plane_n = screen_plane_frame(depsgraph, screen)
        signed_m = signed_plane_distance_m(tip, plane_o, plane_n)
        target_px = camera_projection_px(scene, target, render_w, render_h)
        tip_px = camera_projection_px(scene, tip, render_w, render_h)
        cam_err = None
        if target_px and tip_px:
            cam_err = math.hypot(tip_px[0] - target_px[0], tip_px[1] - target_px[1])
            cam_err_1080 = scale_to_reference(cam_err, render_h)
        else:
            cam_err_1080 = float("inf")

        marker_tip = None
        if marker:
            marker_tip = tuple((evaluated_pen_tip_world(depsgraph, pen, scene_config)))

        row = {
            "localFrameIndex": frame["frameIndex"],
            "sourceFrameIndex": frame.get("sourceFrameIndex"),
            "actionId": frame.get("actionId"),
            "contact": frame.get("contact"),
            "expectedTipWorldM": list(target),
            "measuredTipWorldM": list(tip),
            "probeWorldM": list(probe_w),
            "cameraProjectionErrorPxAtRenderRes": cam_err,
            "cameraProjectionErrorPxAt1080Ref": cam_err_1080,
            "signedPlaneDistanceM": signed_m,
        }
        per_frame.append(row)

        if cam_err_1080 > max_px_1080:
            errors.append(
                {
                    "code": "CAMERA_PROJECTION_EXCEEDED",
                    "frameIndex": frame["frameIndex"],
                    "message": f"{cam_err_1080:.4f}px > {max_px_1080}",
                }
            )
        if frame.get("contact") and abs(signed_m) > contact_tol_m:
            errors.append(
                {
                    "code": "CONTACT_PLANE_DISTANCE",
                    "frameIndex": frame["frameIndex"],
                    "message": f"|signed|={abs(signed_m):.6f}m > {contact_tol_m}",
                }
            )

    errs1080 = [r["cameraProjectionErrorPxAt1080Ref"] for r in per_frame if math.isfinite(r["cameraProjectionErrorPxAt1080Ref"])]
    sorted_errs = sorted(errs1080)
    p95 = sorted_errs[int(math.ceil(0.95 * len(sorted_errs))) - 1] if sorted_errs else float("inf")
    max_row = max(per_frame, key=lambda r: r["cameraProjectionErrorPxAt1080Ref"])

    target_motion = []
    for i in range(1, len(per_frame)):
        a = per_frame[i - 1]["expectedTipWorldM"]
        b = per_frame[i]["expectedTipWorldM"]
        target_motion.append(math.dist(a, b))
    tip_motion = []
    for i in range(1, len(per_frame)):
        tip_motion.append(math.dist(per_frame[i - 1]["measuredTipWorldM"], per_frame[i]["measuredTipWorldM"]))

    if max(target_motion) > 1e-5 and max(tip_motion) < 1e-6:
        errors.append({"code": "PEN_TIP_FROZEN", "message": "input expects motion but measured tip static"})

    checks = [
        {
            "id": "camera-projection-1080",
            "status": "PASS" if p95 <= p95_limit and max_row["cameraProjectionErrorPxAt1080Ref"] <= max_px_1080 else "FAIL",
            "metrics": {"p95PxAt1080Ref": p95, "maxPxAt1080Ref": max_row["cameraProjectionErrorPxAt1080Ref"]},
        },
        {
            "id": "contact-plane-distance",
            "status": "FAIL" if any(e["code"] == "CONTACT_PLANE_DISTANCE" for e in errors) else "PASS",
        },
    ]
    overall = "PASS" if not errors and all(c["status"] == "PASS" for c in checks) else "FAIL"

    report = {
        "schema": "melo.hand-sync.report/0.2",
        "technicalStatus": overall,
        "motionReview": "REVIEW_REQUIRED",
        "appearanceReview": "REVIEW_REQUIRED",
        "checks": checks,
        "perFrame": per_frame,
        "errors": errors,
        "referenceResolution": {"width": game_w, "height": game_h},
        "renderResolution": {"width": render_w, "height": render_h},
    }
    Path(args.out).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"VERIFY_{overall} p95_1080={p95:.4f} max={max_row['cameraProjectionErrorPxAt1080Ref']:.4f}")
    sys.exit(0 if overall == "PASS" else 1)


if __name__ == "__main__":
    main()
