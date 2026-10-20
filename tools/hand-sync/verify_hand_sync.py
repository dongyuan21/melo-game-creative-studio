"""
Verify solved .blend against interaction.json; emit qc.json (never self-PASS in solver).
Exit 0 only if all checks pass.
"""
import argparse
import json
import math
import sys
from pathlib import Path

from hand_sync_geometry import (
    evaluated_pen_tip_world,
    load_json,
    pen_target_world_m,
    screen_plane_dimensions_m,
)


def parse_args(argv):
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    p = argparse.ArgumentParser()
    p.add_argument("--job", required=True)
    p.add_argument("--blend", required=True)
    p.add_argument("--out", required=True)
    return p.parse_args(argv)


def projection_error_px(tip_world, target_world, layout, game_w, game_h):
    w_m, h_m = screen_plane_dimensions_m(layout)
    dx = tip_world[0] - target_world[0]
    dy = tip_world[1] - target_world[1]
    err_m = math.sqrt(dx * dx + dy * dy)
    scale_x = game_w / w_m
    scale_y = game_h / h_m
    return err_m * max(scale_x, scale_y)


def main():
    import bpy

    args = parse_args(sys.argv)
    job = load_json(Path(args.job))
    interaction = load_json(Path(job["bundleDir"]) / "interaction.json")
    scene_config = load_json(Path(job["bundleDir"]) / "scene-config.json")
    layout = interaction["layout"]
    frames = interaction["frames"]
    game_w = layout["gameImagePx"]["width"]
    game_h = layout["gameImagePx"]["height"]
    tolerance_px = float(job.get("projectionMaxPxAt1080", 2.0))
    scale = game_h / 1080.0
    tol = tolerance_px * scale

    bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend)))
    scene = bpy.context.scene
    pen = bpy.data.objects.get("Pen")
    pen_target = bpy.data.objects.get("PenTarget")
    probe = bpy.data.objects.get("ProbeTip")
    if not pen or not pen_target:
        print("VERIFY_FAIL missing Pen or PenTarget")
        sys.exit(2)

    per_frame = []
    errors = []
    for idx, frame in enumerate(frames, start=1):
        scene.frame_set(idx)
        bpy.context.view_layer.update()
        target = pen_target_world_m(frame, layout)
        tip = evaluated_pen_tip_world(pen, scene_config)
        probe_loc = tuple(probe.location) if probe else tip
        err = projection_error_px(tip, target, layout, game_w, game_h)
        dist_z = abs(tip[2] - target[2])
        per_frame.append(
            {
                "frameIndex": frame["frameIndex"],
                "actionId": frame.get("actionId"),
                "targetWorldM": target,
                "tipWorldM": list(tip),
                "probeWorldM": list(probe_loc),
                "projectionErrorPx": err,
                "planeDistanceM": dist_z,
            }
        )
        if err > tol:
            errors.append(
                {
                    "code": "PROJECTION_EXCEEDED",
                    "frameIndex": frame["frameIndex"],
                    "message": f"projection {err:.4f}px > {tol:.4f}px",
                }
            )

    errs = [row["projectionErrorPx"] for row in per_frame]
    sorted_errs = sorted(errs)
    p95 = sorted_errs[int(math.ceil(0.95 * len(sorted_errs))) - 1] if sorted_errs else 0
    max_row = max(per_frame, key=lambda r: r["projectionErrorPx"])

    motion_ok = True
    if len(per_frame) >= 2:
        deltas = []
        for i in range(1, len(per_frame)):
            a = per_frame[i - 1]["tipWorldM"]
            b = per_frame[i]["tipWorldM"]
            deltas.append(math.dist(a, b))
        if max(deltas) < 1e-6:
            motion_ok = False
            errors.append({"code": "NO_MOTION", "message": "tip world position did not change across frames"})

    status = "PASS" if not errors and motion_ok else "FAIL"
    report = {
        "schema": "melo.hand-sync.report/0.2",
        "prepared": True,
        "solved": True,
        "rendered": job.get("rendered", False),
        "technicalStatus": status,
        "motionReview": "REVIEW_REQUIRED",
        "appearanceReview": "REVIEW_REQUIRED",
        "checks": [
            {
                "id": "tip-projection",
                "status": status,
                "measurementSource": "evaluated-geometry",
                "metrics": {
                    "p95PxAtGameHeight": p95,
                    "maxPxAtGameHeight": max_row["projectionErrorPx"],
                    "tolerancePxAtGameHeight": tol,
                    "firstFailFrame": errors[0]["frameIndex"] if errors else None,
                    "maxErrorFrame": max_row["frameIndex"],
                },
                "evidencePaths": [str(args.out)],
                "note": "PenTip mesh +Z vs PenTarget logic target; no denoise.",
            }
        ],
        "perFrame": per_frame,
        "errors": errors,
    }
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"VERIFY_{status} maxErrPx={max_row['projectionErrorPx']:.4f}")
    sys.exit(0 if status == "PASS" else 1)


if __name__ == "__main__":
    main()
