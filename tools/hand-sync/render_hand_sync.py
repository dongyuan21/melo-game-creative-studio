"""
Solve (keyframes) + optional render. Modes: probe-pen | probe-pen-proxy.
"""
import argparse
import json
import math
import sys
import time
from pathlib import Path

from hand_sync_geometry import (
    load_json,
    pen_target_world_m,
    pen_tilt_quaternion,
    pen_tip_offset_local_m,
    screen_plane_dimensions_m,
)


def parse_args(argv):
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    parser = argparse.ArgumentParser()
    parser.add_argument("--job", required=True)
    parser.add_argument("--solve-only", action="store_true")
    return parser.parse_args(argv)


def build_screen_plane(layout, texture_path=None):
    import bpy

    w, h = screen_plane_dimensions_m(layout)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
    screen = bpy.context.object
    screen.name = "ScreenProxy"
    screen.scale = (w, h, 1)
    mat = bpy.data.materials.new("ScreenMat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    if texture_path and Path(texture_path).is_file():
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.name = "Image Texture"
        tex.image = bpy.data.images.load(str(texture_path))
        mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (0.08, 0.09, 0.12, 1)
    screen.data.materials.append(mat)
    return screen


def setup_scene_objects(mode, scene_config):
    import bpy
    import mathutils

    half = float(scene_config.get("penHalfLengthM", 0.06))
    pen_q = pen_tilt_quaternion(scene_config)

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0.02))
    pen_target = bpy.context.object
    pen_target.name = "PenTarget"
    pen_target.empty_display_size = 0.006

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0035, location=(0, 0, 0))
    probe = bpy.context.object
    probe.name = "ProbeTip"
    probe.parent = pen_target
    probe.location = (0, 0, 0)
    mat_probe = bpy.data.materials.new("ProbeMat")
    mat_probe.use_nodes = True
    mat_probe.node_tree.nodes["Principled BSDF"].inputs[0].default_value = (1, 0.25, 0.1, 1)
    probe.data.materials.append(mat_probe)

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    pen_tip = bpy.context.object
    pen_tip.name = "PenTip"
    pen_tip.parent = pen_target
    pen_tip.location = (0, 0, 0)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.0028, depth=half * 2, location=(0, 0, -half))
    pen = bpy.context.object
    pen.name = "Pen"
    pen.parent = pen_target
    pen.rotation_mode = "QUATERNION"
    pen.rotation_quaternion = pen_q
    pen.location = (0, 0, 0)
    mat_pen = bpy.data.materials.new("PenMat")
    mat_pen.use_nodes = True
    mat_pen.node_tree.nodes["Principled BSDF"].inputs[0].default_value = (0.92, 0.86, 0.2, 1)
    pen.data.materials.append(mat_pen)

    arm = hand_mesh = wrist_target = pole = None
    if mode == "probe-pen-proxy":
        bpy.ops.object.armature_add(location=(0, 0, 0))
        arm = bpy.context.object
        arm.name = "ForearmRig"
        bpy.ops.object.mode_set(mode="EDIT")
        bone_fore = arm.data.edit_bones.new("forearm")
        bone_fore.head = (0, 0, 0)
        bone_fore.tail = (0.055, 0.02, 0.01)
        bone_hand = arm.data.edit_bones.new("hand")
        bone_hand.head = bone_fore.tail
        bone_hand.tail = (0.095, 0.035, 0.015)
        bone_hand.parent = bone_fore
        bone_hand.use_connect = True
        bpy.ops.object.mode_set(mode="POSE")
        bpy.ops.object.mode_set(mode="OBJECT")

        bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
        wrist_target = bpy.context.object
        wrist_target.name = "WristTarget"
        bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0.02, -0.12, 0.08))
        pole = bpy.context.object
        pole.name = "ElbowPole"

        ik = arm.pose.bones["hand"].constraints.new(type="IK")
        ik.target = wrist_target
        ik.pole_target = pole
        ik.pole_angle = math.radians(90)
        ik.chain_count = 2
        ik.use_stretch = False

        bpy.ops.mesh.primitive_cube_add(size=0.022, location=(0, 0, 0))
        hand_mesh = bpy.context.object
        hand_mesh.name = "HandProxyMesh"
        hand_mesh.parent = arm
        hand_mesh.parent_type = "BONE"
        hand_mesh.parent_bone = "hand"

    return {
        "pen_target": pen_target,
        "probe": probe,
        "pen": pen,
        "pen_tip": pen_tip,
        "arm": arm,
        "hand_mesh": hand_mesh,
        "wrist_target": wrist_target,
        "half": half,
    }


def keyframe_track(objects, frames, layout, scene_config, scene):
    import bpy
    import mathutils

    pen_target = objects["pen_target"]
    wrist_target = objects.get("wrist_target")
    half = objects["half"]

    for idx, frame in enumerate(frames, start=1):
        scene.frame_set(idx)
        world = pen_target_world_m(frame, layout)
        pen_target.location = world
        pen_target.keyframe_insert(data_path="location", frame=idx)
        if wrist_target:
            wrist = mathutils.Vector(world) + mathutils.Vector((-0.05, -0.04, -0.025))
            wrist_target.location = wrist
            wrist_target.keyframe_insert(data_path="location", frame=idx)

    if pen_target.animation_data and pen_target.animation_data.action:
        pen_target.animation_data.action.use_fake_user = True


def set_visibility(mode, objects):
    show_hand = mode == "probe-pen-proxy"
    for key in ("arm", "hand_mesh", "wrist_target"):
        obj = objects.get(key)
        if obj:
            obj.hide_render = not show_hand
            obj.hide_viewport = not show_hand


def main():
    import bpy

    args = parse_args(sys.argv)
    job = load_json(Path(args.job))
    bundle_dir = Path(job["bundleDir"])
    out_dir = Path(job["outputDir"])
    out_dir.mkdir(parents=True, exist_ok=True)
    mode = job.get("mode", "probe-pen")
    interaction = load_json(bundle_dir / "interaction.json")
    scene_config = load_json(bundle_dir / "scene-config.json")
    layout = interaction["layout"]
    frames = interaction["frames"]
    fps = interaction["fps"]["num"] / interaction["fps"]["den"]

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

    screen_tex = job.get("screenTextureDir")
    first_tex = None
    if screen_tex:
        candidate = Path(screen_tex) / "frame_0000.png"
        if candidate.is_file():
            first_tex = str(candidate)
    build_screen_plane(layout, first_tex)

    w, h = screen_plane_dimensions_m(layout)
    bpy.ops.object.light_add(type="AREA", location=(0, 0, 0.32))
    light = bpy.context.object
    light.data.energy = 60
    light.data.size = max(w, h)
    bpy.ops.object.camera_add(location=(0, 0, 0.38))
    scene.camera = bpy.context.object

    objects = setup_scene_objects(mode, scene_config)
    set_visibility(mode, objects)
    t0 = time.time()
    keyframe_track(objects, frames, layout, scene_config, scene)
    solve_seconds = time.time() - t0

    blend_path = out_dir / f"{mode.replace('-', '_')}.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    meta = {
        "solveSeconds": solve_seconds,
        "frameCount": len(frames),
        "mode": mode,
        "renderResolution": res,
        "samples": scene.cycles.samples,
    }
    (out_dir / "solve-meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")

    if not args.solve_only and job.get("renderFrames", True):
        frame_dir = out_dir / "frames"
        frame_dir.mkdir(exist_ok=True)
        render_times = []
        for idx in range(1, len(frames) + 1):
            scene.frame_set(idx)
            if screen_tex:
                tex_path = Path(screen_tex) / f"frame_{idx - 1:04d}.png"
                if tex_path.is_file():
                    screen = bpy.data.objects["ScreenProxy"]
                    mat = screen.data.materials[0]
                    tex = mat.node_tree.nodes.get("Image Texture")
                    if tex:
                        tex.image = bpy.data.images.load(str(tex_path))
            tr = time.time()
            scene.render.filepath = str(frame_dir / f"frame_{idx:04d}.png")
            bpy.ops.render.render(write_still=True)
            render_times.append(time.time() - tr)
        meta["renderSecondsTotal"] = sum(render_times)
        meta["renderSecondsPerFrameMean"] = sum(render_times) / max(1, len(render_times))
        (out_dir / "solve-meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")

    print(f"SOLVE_OK mode={mode} blend={blend_path}")


if __name__ == "__main__":
    main()
