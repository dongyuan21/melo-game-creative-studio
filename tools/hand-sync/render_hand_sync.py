"""
Solve keyframes into .blend (probe-pen). Rendering uses render_from_blend.py on the same file.
"""
import argparse
import json
import sys
import time
from pathlib import Path

from hand_sync_geometry import (
    apply_world_from_screen_matrix,
    load_json,
    pen_object_pose_for_tip,
    pen_target_world_m,
    pen_tilt_quaternion,
    screen_plane_dimensions_m,
    tip_local_in_pen_m,
)


def parse_args(argv):
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    parser = argparse.ArgumentParser()
    parser.add_argument("--job", required=True)
    return parser.parse_args(argv)


def build_screen_plane(layout, screen_dir: Path | None):
    import bpy

    w, h = screen_plane_dimensions_m(layout)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
    screen = bpy.context.object
    screen.name = "ScreenProxy"
    screen.scale = (w, h, 1)
    apply_world_from_screen_matrix(screen, layout)
    mat = bpy.data.materials.new("ScreenMat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.name = "ScreenTex"
    if screen_dir and (screen_dir / "frame_0000.png").is_file():
        img = bpy.data.images.load(str(screen_dir / "frame_0000.png"), check_existing=True)
        img.source = "SEQUENCE"
        img.reload()
        tex.image = img
        mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (0.08, 0.09, 0.12, 1)
    screen.data.materials.append(mat)
    screen["hand_sync_screen_dir"] = str(screen_dir) if screen_dir else ""
    return screen


def setup_pen_mesh(scene_config):
    import bpy

    half = float(scene_config.get("penHalfLengthM", 0.06))
    pen_q = pen_tilt_quaternion(scene_config)
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    pen_target = bpy.context.object
    pen_target.name = "PenTarget"

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.003, location=(0, 0, 0))
    probe = bpy.context.object
    probe.name = "ProbeTip"
    probe.parent = pen_target

    bpy.ops.mesh.primitive_cylinder_add(radius=0.0028, depth=half * 2, location=(0, 0, -half))
    pen = bpy.context.object
    pen.name = "Pen"
    pen.rotation_mode = "QUATERNION"
    for v in pen.data.vertices:
        v.co.z -= half
    pen.data.update()
    mat_pen = bpy.data.materials.new("PenMat")
    mat_pen.use_nodes = True
    pen.data.materials.append(mat_pen)
    mat_pen.node_tree.nodes["Principled BSDF"].inputs[0].default_value = (0.92, 0.86, 0.2, 1)

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    marker = bpy.context.object
    marker.name = "PenTipMarker"
    marker.parent = pen
    marker.location = tip_local_in_pen_m(scene_config)

    return pen_target, probe, pen, pen_q


def keyframe_track(pen_target, pen, pen_q, frames, layout, scene, scene_config):
    tip_local = tip_local_in_pen_m(scene_config)
    for idx, frame in enumerate(frames, start=1):
        scene.frame_set(idx)
        tip_w = pen_target_world_m(frame, layout)
        pen_target.location = tip_w
        pen_target.keyframe_insert(data_path="location", frame=idx)
        loc, rot = pen_object_pose_for_tip(tip_w, pen_q, tip_local)
        pen.location = loc
        pen.rotation_quaternion = rot
        pen.keyframe_insert(data_path="location", frame=idx)
        pen.keyframe_insert(data_path="rotation_quaternion", frame=idx)


def main():
    import bpy

    args = parse_args(sys.argv)
    job = load_json(Path(args.job))
    bundle_dir = Path(job["bundleDir"])
    out_dir = Path(job["outputDir"])
    out_dir.mkdir(parents=True, exist_ok=True)
    interaction = load_json(bundle_dir / "interaction.json")
    scene_config = load_json(bundle_dir / "scene-config.json")
    layout = interaction["layout"]
    frames = interaction["frames"]
    fps = interaction["fps"]["num"] / interaction["fps"]["den"]
    screen_dir = Path(job["screenTextureDir"]) if job.get("screenTextureDir") else bundle_dir / "screen"

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = int(job.get("samples", 8))
    scene.cycles.use_denoising = False
    res = job.get("resolution", [270, 480])
    scene.render.resolution_x = int(res[0])
    scene.render.resolution_y = int(res[1])
    scene.render.fps = int(fps)
    scene.frame_start = 1
    scene.frame_end = len(frames)
    scene.render.image_settings.file_format = "PNG"

    build_screen_plane(layout, screen_dir if screen_dir.is_dir() else None)
    w, h = screen_plane_dimensions_m(layout)
    bpy.ops.object.light_add(type="AREA", location=(0, 0, 0.32))
    bpy.context.object.data.energy = 60
    bpy.context.object.data.size = max(w, h)
    bpy.ops.object.camera_add(location=(0, 0, 0.38))
    scene.camera = bpy.context.object

    pen_target, probe, pen, pen_q = setup_pen_mesh(scene_config)
    t0 = time.time()
    keyframe_track(pen_target, pen, pen_q, frames, layout, scene, scene_config)
    solve_seconds = time.time() - t0

    blend_path = out_dir / "probe_pen.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    meta = {
        "solveSeconds": solve_seconds,
        "frameCount": len(frames),
        "blendSha256": None,
        "renderResolution": res,
    }
    (out_dir / "solve-meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"SOLVE_OK blend={blend_path}")


if __name__ == "__main__":
    main()
