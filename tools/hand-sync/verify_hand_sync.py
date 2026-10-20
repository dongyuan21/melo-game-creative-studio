"""
Verify saved .blend: BCS registration, actual mesh tip contact, full-mesh penetration.
"""
import argparse
import json
import math
import sys
from pathlib import Path

from hand_sync_geometry import (
    anchor_vs_mesh_tip_delta_m,
    bcs_pointer_render_px,
    camera_projection_px,
    evaluated_pen_tip_from_mesh,
    evaluated_pen_tip_world,
    evaluated_probe_world,
    load_json,
    pen_body_clearance_m,
    pen_target_world_m,
    reference_game_resolution,
    screen_plane_frame,
    screen_proxy_layout_delta_m,
    signed_plane_distance_m,
)
from screen_load import load_frame_for_blender_frame, sha256_file, validate_manifest


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
    manifest_path = bundle / "screen-manifest.json"
    if not manifest_path.is_file():
        print("VERIFY_FAIL missing screen-manifest.json")
        sys.exit(2)
    manifest = load_json(manifest_path)
    validate_manifest(manifest, interaction)
    manifest_by_local = {int(f["localFrameIndex"]): f for f in manifest.get("frames", [])}

    bpy.ops.wm.open_mainfile(filepath=str(blend_path))
    scene = bpy.context.scene
    render_w, render_h = scene.render.resolution_x, scene.render.resolution_y
    pen = bpy.data.objects.get("Pen")
    probe = bpy.data.objects.get("ProbeTip")
    screen = bpy.data.objects.get("ScreenProxy")
    if not pen or not screen:
        print("VERIFY_FAIL missing Pen or ScreenProxy")
        sys.exit(2)

    contact_tol_m = float(job.get("contactDistanceMaxM", 0.0005))
    anchor_tol_m = float(job.get("anchorMeshMaxDeltaM", 0.0002))
    reg_max_px_1080 = float(job.get("screenRegistrationMaxPxAt1080", 2.0))
    reg_p95_px_1080 = float(job.get("screenRegistrationP95PxAt1080", 1.0))
    penetration_min_m = float(job.get("bodyClearanceMinM", -0.0001))
    screen_proxy_max_m = float(job.get("screenProxyLayoutMaxDeltaM", 0.00015))

    per_frame = []
    errors = []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    screen_identity_errors = []
    registration_errors_px1080 = []
    proxy_layout_m = screen_proxy_layout_delta_m(depsgraph, screen, layout)
    if proxy_layout_m > screen_proxy_max_m:
        errors.append(
            {
                "code": "SCREEN_REGISTRATION",
                "frameIndex": None,
                "message": f"ScreenProxy layout delta {proxy_layout_m:.6f}m > {screen_proxy_max_m}",
            }
        )

    for idx, frame in enumerate(frames, start=1):
        scene.frame_set(idx)
        depsgraph.update()
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
        mesh_tip = evaluated_pen_tip_from_mesh(depsgraph, pen)
        mesh_signed_m = signed_plane_distance_m(mesh_tip, plane_o, plane_n) if mesh_tip else None
        anchor_signed_m = signed_plane_distance_m(tip, plane_o, plane_n)
        body_min = pen_body_clearance_m(depsgraph, pen, plane_o, plane_n)
        anchor_delta = anchor_vs_mesh_tip_delta_m(depsgraph, pen, scene_config)
        tip_px = camera_projection_px(scene, tip, render_w, render_h)
        mrow = manifest_by_local.get(frame["frameIndex"])
        bcs_px = bcs_pointer_render_px(mrow, render_w, render_h, game_w, game_h) if mrow else None
        reg_err = None
        reg_err_1080 = None
        if bcs_px and tip_px:
            reg_err = math.hypot(tip_px[0] - bcs_px[0], tip_px[1] - bcs_px[1])
            reg_err_1080 = scale_to_reference(reg_err, render_h)
            registration_errors_px1080.append(reg_err_1080)

        row = {
            "localFrameIndex": frame["frameIndex"],
            "sourceFrameIndex": frame.get("sourceFrameIndex"),
            "actionId": frame.get("actionId"),
            "contact": frame.get("contact"),
            "expectedTipWorldM": list(target),
            "measuredTipWorldM": list(tip),
            "probeWorldM": list(probe_w),
            "screenRegistrationErrorPxAtRenderRes": reg_err,
            "screenRegistrationErrorPxAt1080Ref": reg_err_1080,
            "anchorSignedPlaneDistanceM": anchor_signed_m,
            "meshTipSignedPlaneDistanceM": mesh_signed_m,
            "bodyClearanceMinSignedM": body_min,
            "anchorMeshDeltaM": anchor_delta,
            "bcsPointerRenderPx": list(bcs_px) if bcs_px else None,
            "measuredTipProjectionPx": list(tip_px) if tip_px else None,
        }
        per_frame.append(row)

        if frame.get("contact"):
            if mesh_signed_m is None:
                errors.append(
                    {"code": "ACTUAL_TIP_CONTACT", "frameIndex": frame["frameIndex"], "message": "no mesh tip"}
                )
            elif mesh_signed_m < -contact_tol_m:
                errors.append(
                    {
                        "code": "ACTUAL_TIP_CONTACT",
                        "frameIndex": frame["frameIndex"],
                        "message": f"mesh tip signed {mesh_signed_m:.6f}m < -{contact_tol_m}",
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
        if body_min is not None and body_min < penetration_min_m:
            errors.append(
                {
                    "code": "BODY_CLEARANCE",
                    "frameIndex": frame["frameIndex"],
                    "message": f"mesh min signed {body_min:.6f}m < {penetration_min_m}",
                }
            )
        if frame.get("contact") and mrow and not mrow.get("pointerVideoPx"):
            errors.append(
                {
                    "code": "SCREEN_REGISTRATION",
                    "frameIndex": frame["frameIndex"],
                    "message": "contact frame missing pointerVideoPx",
                }
            )
        elif mrow and mrow.get("pointerVideoPx") and reg_err_1080 is not None and reg_err_1080 > reg_max_px_1080:
            errors.append(
                {
                    "code": "SCREEN_REGISTRATION",
                    "frameIndex": frame["frameIndex"],
                    "message": f"{reg_err_1080:.4f}px > {reg_max_px_1080}",
                }
            )

    reg_sorted = sorted(registration_errors_px1080)
    reg_p95 = reg_sorted[int(math.ceil(0.95 * len(reg_sorted))) - 1] if reg_sorted else float("inf")
    reg_max = max(registration_errors_px1080) if registration_errors_px1080 else float("inf")

    checks = [
        {
            "id": "rigid-tip-alignment",
            "status": "PASS" if reg_p95 <= reg_p95_px_1080 and reg_max <= reg_max_px_1080 else "FAIL",
            "metrics": {"p95PxAt1080Ref": reg_p95, "maxPxAt1080Ref": reg_max},
        },
        {
            "id": "anchor-validity",
            "status": "FAIL" if any(e["code"] == "ANCHOR_MESH_MISMATCH" for e in errors) else "PASS",
        },
        {
            "id": "actual-tip-contact",
            "status": "FAIL" if any(e["code"] == "ACTUAL_TIP_CONTACT" for e in errors) else "PASS",
        },
        {
            "id": "body-clearance",
            "status": "FAIL" if any(e["code"] == "BODY_CLEARANCE" for e in errors) else "PASS",
        },
        {
            "id": "screen-registration",
            "status": "FAIL"
            if any(e["code"] == "SCREEN_REGISTRATION" for e in errors)
            else ("NOT_RUN" if not reg_sorted else "PASS"),
        },
        {
            "id": "screen-frame-identity",
            "status": "FAIL" if screen_identity_errors else "PASS",
        },
        {
            "id": "decoded-label-binding",
            "status": "NOT_RUN",
        },
    ]
    geometry_ok = all(
        c["status"] == "PASS"
        for c in checks
        if c["id"]
        in (
            "rigid-tip-alignment",
            "anchor-validity",
            "actual-tip-contact",
            "body-clearance",
            "screen-registration",
        )
    )
    overall = "PASS" if not errors and geometry_ok else "FAIL"

    report = {
        "schema": "melo.hand-sync.report/0.4",
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
            "blendSha256": sha256_file(blend_path),
            "bundleSha256": sha256_file(bundle / "bundle.json") if (bundle / "bundle.json").is_file() else None,
            "jobBundleDir": str(bundle),
        },
    }
    Path(args.out).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"VERIFY_{overall} reg_max={reg_max:.4f} geom={geometry_ok}")
    sys.exit(0 if overall == "PASS" else 1)


if __name__ == "__main__":
    main()
