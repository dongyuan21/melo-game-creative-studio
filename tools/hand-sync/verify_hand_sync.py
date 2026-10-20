"""
Verify saved .blend: mesh tip vs interaction target, body clearance, anchor validity.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

from hand_sync_geometry import (
    anchor_vs_mesh_tip_delta_m,
    camera_projection_px,
    evaluated_pen_tip_world,
    evaluated_probe_world,
    load_json,
    pen_body_clearance_m,
    pen_target_world_m,
    reference_game_resolution,
    screen_plane_frame,
    signed_plane_distance_m,
    tip_local_in_pen_m,
)
from screen_load import load_frame_for_blender_frame, sha256_file


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

    args = parse_args(sys.argv)
    job = load_json(Path(args.job))
    bundle = Path(job["bundleDir"])
    blend_path = Path(args.blend)
    interaction = load_json(bundle / "interaction.json")
    scene_config = load_json(bundle / "scene-config.json")
    layout = interaction["layout"]
    frames = interaction["frames"]
    game_w, game_h = reference_game_resolution(layout)
    manifest = None
    manifest_path = bundle / "screen-manifest.json"
    if manifest_path.is_file():
        manifest = load_json(manifest_path)

    bpy.ops.wm.open_mainfile(filepath=str(blend_path))
    scene = bpy.context.scene
    render_w, render_h = scene.render.resolution_x, scene.render.resolution_y
    pen = bpy.data.objects.get("Pen")
    probe = bpy.data.objects.get("ProbeTip")
    screen = bpy.data.objects.get("ScreenProxy")
    if not pen or not screen:
        print("VERIFY_FAIL missing Pen or ScreenProxy")
        sys.exit(2)

    max_px_1080 = float(job.get("projectionMaxPxAt1080", 2.0))
    p95_limit = float(job.get("projectionP95PxAt1080", 1.0))
    contact_tol_m = float(job.get("contactDistanceMaxM", 0.0005))
    tip_mesh_r = float(scene_config.get("penTipMeshRadiusM", 0.0015))
    anchor_tol_m = float(job.get("anchorMeshMaxDeltaM", tip_mesh_r + 0.0003))
    body_clearance_min_m = float(job.get("bodyClearanceMinM", -0.0005))

    per_frame = []
    errors = []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    screen_identity_errors = []

    for idx, frame in enumerate(frames, start=1):
        scene.frame_set(idx)
        depsgraph.update()
        if manifest:
            try:
                load_frame_for_blender_frame(idx, manifest, bundle)
            except (FileNotFoundError, ValueError) as exc:
                screen_identity_errors.append(str(exc))
                errors.append(
                    {"code": "SCREEN_FRAME_IDENTITY", "frameIndex": frame["frameIndex"], "message": str(exc)}
                )
        target = pen_target_world_m(frame, layout)
        tip = evaluated_pen_tip_world(depsgraph, pen, scene_config)
        probe_w = evaluated_probe_world(depsgraph, probe) if probe else tip
        plane_o, plane_n = screen_plane_frame(depsgraph, screen)
        signed_m = signed_plane_distance_m(tip, plane_o, plane_n)
        body_min = pen_body_clearance_m(depsgraph, pen, plane_o, plane_n)
        anchor_delta = anchor_vs_mesh_tip_delta_m(depsgraph, pen, scene_config)
        target_px = camera_projection_px(scene, target, render_w, render_h)
        tip_px = camera_projection_px(scene, tip, render_w, render_h)
        cam_err = None
        if target_px and tip_px:
            cam_err = math.hypot(tip_px[0] - target_px[0], tip_px[1] - target_px[1])
            cam_err_1080 = scale_to_reference(cam_err, render_h)
        else:
            cam_err_1080 = float("inf")

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
            "bodyClearanceMinSignedM": body_min,
            "anchorMeshDeltaM": anchor_delta,
            "bcsTouchProjectionPx": list(target_px) if target_px else None,
            "measuredTipProjectionPx": list(tip_px) if tip_px else None,
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
        if anchor_delta is not None and anchor_delta > anchor_tol_m:
            errors.append(
                {
                    "code": "ANCHOR_MESH_MISMATCH",
                    "frameIndex": frame["frameIndex"],
                    "message": f"anchor delta {anchor_delta:.6f}m > {anchor_tol_m}",
                }
            )
        if body_min is not None and body_min < body_clearance_min_m:
            errors.append(
                {
                    "code": "BODY_CLEARANCE",
                    "frameIndex": frame["frameIndex"],
                    "message": f"body min signed {body_min:.6f}m < {body_clearance_min_m}",
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

    contact_frames = [r for r in per_frame if r.get("contact")]
    body_vals = [r["bodyClearanceMinSignedM"] for r in per_frame if r["bodyClearanceMinSignedM"] is not None]
    worst_body = min(body_vals) if body_vals else None

    checks = [
        {
            "id": "rigid-tip-alignment",
            "status": "PASS" if p95 <= p95_limit and max_row["cameraProjectionErrorPxAt1080Ref"] <= max_px_1080 else "FAIL",
            "metrics": {"p95PxAt1080Ref": p95, "maxPxAt1080Ref": max_row["cameraProjectionErrorPxAt1080Ref"]},
        },
        {
            "id": "anchor-validity",
            "status": "FAIL" if any(e["code"] == "ANCHOR_MESH_MISMATCH" for e in errors) else "PASS",
        },
        {
            "id": "contact-plane",
            "status": "FAIL" if any(e["code"] == "CONTACT_PLANE_DISTANCE" for e in errors) else "PASS",
        },
        {
            "id": "body-clearance",
            "status": "FAIL" if any(e["code"] == "BODY_CLEARANCE" for e in errors) else "PASS",
            "metrics": {"worstMinSignedM": worst_body},
        },
        {
            "id": "screen-registration",
            "status": "NOT_RUN" if not manifest else ("FAIL" if screen_identity_errors else "PASS"),
        },
        {
            "id": "screen-frame-identity",
            "status": "NOT_RUN" if not manifest else ("FAIL" if screen_identity_errors else "PASS"),
        },
        {
            "id": "camera-projection-1080",
            "status": "PASS" if p95 <= p95_limit and max_row["cameraProjectionErrorPxAt1080Ref"] <= max_px_1080 else "FAIL",
        },
    ]
    geometry_ok = all(
        c["status"] == "PASS"
        for c in checks
        if c["id"] in ("rigid-tip-alignment", "anchor-validity", "contact-plane", "body-clearance")
    )
    overall = "PASS" if not errors and geometry_ok else "FAIL"

    blend_sha = sha256_file(blend_path)
    bundle_sha = sha256_file(bundle / "bundle.json") if (bundle / "bundle.json").is_file() else None

    report = {
        "schema": "melo.hand-sync.report/0.3",
        "technicalStatus": overall,
        "geometrySubsetPass": geometry_ok,
        "motionReview": "REVIEW_REQUIRED",
        "appearanceReview": "REVIEW_REQUIRED",
        "p2Overall": "PARTIAL",
        "checks": checks,
        "perFrame": per_frame,
        "errors": errors,
        "referenceResolution": {"width": game_w, "height": game_h},
        "renderResolution": {"width": render_w, "height": render_h},
        "provenance": {
            "blendSha256": blend_sha,
            "bundleSha256": bundle_sha,
            "jobBundleDir": str(bundle),
        },
    }
    Path(args.out).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"VERIFY_{overall} p95_1080={p95:.4f} max={max_row['cameraProjectionErrorPxAt1080Ref']:.4f} geom={geometry_ok}")
    sys.exit(0 if overall == "PASS" else 1)


if __name__ == "__main__":
    main()
