"""Orthographic side diagnostic: screen plane, tip, shaft along +Z outer."""
import argparse
import json
import sys
from pathlib import Path


def parse_args(argv):
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    p = argparse.ArgumentParser()
    p.add_argument("--blend", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--frame", type=int, default=40)
    return p.parse_args(argv)


def main():
    import bpy

    args = parse_args(sys.argv)
    bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend)))
    scene = bpy.context.scene
    scene.frame_set(args.frame)
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 480
    scene.render.image_settings.file_format = "PNG"
    for obj in bpy.data.objects:
        if obj.type == "CAMERA":
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.object.camera_add(location=(0.15, 0, 0.02))
    cam = bpy.context.object
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 0.22
    cam.rotation_euler = (1.5708, 0, 1.5708)
    scene.camera = cam
    scene.render.filepath = str(Path(args.out))
    bpy.ops.render.render(write_still=True)
    meta = {"frame": args.frame, "orthoScale": cam.data.ortho_scale}
    Path(str(args.out) + ".json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"SIDE_VIEW_OK {args.out}")


if __name__ == "__main__":
    main()
