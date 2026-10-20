"""
Solve keyframes into .blend (probe-pen). Rendering uses render_from_blend.py on the same file.
R6: explicit tip vertex at local (0,0,0); probe hidden from render.
"""
import argparse
import hashlib
import json
import math
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


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def build_screen_plane(layout, screen_dir: Path | None):
    import bpy

    w, h = screen_plane_dimensions_m(layout)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
    screen = bpy.context.object
    screen.name = "ScreenProxy"
    screen.scale = (w, h, 1)
    bpy.context.view_layer.update()
    apply_world_from_screen_matrix(screen, layout)
    screen.data.update()
    mat = bpy.data.materials.new("ScreenMat")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    for n in list(nodes):
        nodes.remove(n)
    out = nodes.new("ShaderNodeOutputMaterial")
    emit = nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = 1.0
    tex = nodes.new("ShaderNodeTexImage")
    tex.name = "ScreenTex"
    if screen_dir and (screen_dir / "frame_0000.png").is_file():
        img = bpy.data.images.load(str(screen_dir / "frame_0000.png"), check_existing=True)
        img.source = "SEQUENCE"
        img.reload()
        tex.image = img
        links.new(tex.outputs["Color"], emit.inputs["Color"])
    else:
        emit.inputs["Color"].default_value = (0.12, 0.14, 0.18, 1)
    links.new(emit.outputs["Emission"], out.inputs["Surface"])
    screen.data.materials.append(mat)
    screen["hand_sync_screen_dir"] = str(screen_dir) if screen_dir else ""
    screen["hand_sync_screen_mode"] = "per_frame_reload"
    return screen


def build_pen_mesh_bmesh(tip_len: float, shaft_len: float, radius: float):
    """Cone tip at (0,0,0), shaft along +Z. Returns mesh data."""
    import bmesh

    bm = bmesh.new()
    tip = bm.verts.new((0.0, 0.0, 0.0))
    segs = 16
    ring_base = []
    ring_top = []
    for i in range(segs):
        a = 2.0 * math.pi * i / segs
        ring_base.append(bm.verts.new((radius * math.cos(a), radius * math.sin(a), tip_len)))
        ring_top.append(
            bm.verts.new((radius * math.cos(a), radius * math.sin(a), tip_len + shaft_len))
        )
    for i in range(segs):
        n = (i + 1) % segs
        bm.faces.new((tip, ring_base[i], ring_base[n]))
        bm.faces.new((ring_base[i], ring_top[i], ring_top[n], ring_base[n]))
    bm.normal_update()
    # bmesh Vert.index is valid only after to_mesh; tip is always the first vert created.
    return bm, 0


def setup_pen_mesh(scene_config):
    import bpy

    shaft_len = float(scene_config.get("penHalfLengthM", 0.06))
    tip_len = float(scene_config.get("penTipConeDepthM", 0.008))
    radius = float(scene_config.get("penShaftRadiusM", 0.0025))
    pen_q = pen_tilt_quaternion(scene_config)

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    pen_target = bpy.context.object
    pen_target.name = "PenTarget"

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.002, location=(0, 0, 0))
    probe = bpy.context.object
    probe.name = "ProbeTip"
    probe.parent = pen_target
    probe.hide_render = True
    probe.hide_viewport = True

    bm, tip_index = build_pen_mesh_bmesh(tip_len, shaft_len, radius)
    mesh = bpy.data.meshes.new("PenMesh")
    bm.to_mesh(mesh)
    bm.free()
    pen = bpy.data.objects.new("Pen", mesh)
    bpy.context.collection.objects.link(pen)
    pen.rotation_mode = "QUATERNION"
    vg = pen.vertex_groups.new(name="PenTip")
    vg.add([tip_index], 1.0, "REPLACE")
    mesh["hand_sync_tip_vertex_index"] = tip_index
    mat_pen = bpy.data.materials.new("PenMat")
    mat_pen.use_nodes = True
    mat_pen.node_tree.nodes["Principled BSDF"].inputs[0].default_value = (0.15, 0.45, 0.95, 1)
    pen.data.materials.append(mat_pen)

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    marker = bpy.context.object
    marker.name = "PenTipMarker"
    marker.parent = pen
    marker.location = tip_local_in_pen_m(scene_config)
    marker.hide_render = True

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    touch = bpy.context.object
    touch.name = "BcsTouchTarget"
    touch.parent = pen_target
    touch.hide_render = True

    return pen_target, probe, pen, pen_q, touch


def keyframe_track(pen_target, pen, pen_q, touch, frames, layout, scene, scene_config):
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


def setup_camera_and_light(scene, layout, job):
    import bpy

    w, h = screen_plane_dimensions_m(layout)
    cam_dist = float(job.get("cameraDistanceM", 0.55))
    bpy.ops.object.light_add(type="AREA", location=(0, 0.05, cam_dist + 0.08))
    light = bpy.context.object
    light.data.energy = float(job.get("areaLightEnergy", 18))
    light.data.size = max(w, h) * 0.85
    profile = job.get("cameraProfile", "orthographic-test")
    if profile == "perspective-oblique":
        import mathutils

        loc = job.get("cameraLocation", [0.055, -0.105, 0.36])
        bpy.ops.object.camera_add(location=tuple(loc))
        cam = bpy.context.object
        cam.data.type = "PERSP"
        cam.data.lens = float(job.get("cameraLensMm", 32))
        cam.data.sensor_fit = "VERTICAL"
        target = mathutils.Vector((0.0, 0.0, 0.0))
        cam.location = mathutils.Vector(loc)
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    else:
        bpy.ops.object.camera_add(location=(0, 0, cam_dist))
        cam = bpy.context.object
        if job.get("orthographicCamera", True):
            cam.data.type = "ORTHO"
            cam.data.ortho_scale = h * float(job.get("orthoScaleMul", 1.0))
        else:
            cam.data.lens = float(job.get("cameraLensMm", 26))
            cam.data.sensor_fit = "VERTICAL"
    scene.camera = cam
    scene.view_settings.exposure = float(job.get("viewExposure", 0.0))
    scene.view_settings.view_transform = "Standard"


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
    screen_dir = Path(job.get("screenTextureDir", bundle_dir / "screen"))

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
    setup_camera_and_light(scene, layout, job)

    pen_target, probe, pen, pen_q, touch = setup_pen_mesh(scene_config)
    t0 = time.time()
    keyframe_track(pen_target, pen, pen_q, touch, frames, layout, scene, scene_config)
    solve_seconds = time.time() - t0

    blend_path = out_dir / "probe_pen.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    blend_sha = sha256_file(blend_path)
    meta = {
        "solveSeconds": solve_seconds,
        "frameCount": len(frames),
        "blendSha256": blend_sha,
        "renderResolution": res,
        "bundleDir": str(bundle_dir),
    }
    (out_dir / "solve-meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"SOLVE_OK blend={blend_path} sha={blend_sha[:12]}")


if __name__ == "__main__":
    main()
