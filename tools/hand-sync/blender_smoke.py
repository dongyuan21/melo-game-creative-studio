"""E0 Blender smoke: factory scene, save blend, render 256x256 PNG (Cycles CPU)."""
import argparse
import sys


def parse_args(argv):
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", required=True)
    return parser.parse_args(argv)


def main():
    import bpy
    from pathlib import Path

    args = parse_args(sys.argv)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.mesh.primitive_cube_add(size=0.5, location=(0, 0, 0.25))
    bpy.ops.object.light_add(type="SUN", location=(2, -2, 4))
    bpy.ops.object.camera_add(location=(2.5, -2.5, 1.8))
    cam = bpy.context.object
    cam.rotation_euler = (1.1, 0, 0.8)

    scene = bpy.context.scene
    scene.camera = cam
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 8
    scene.cycles.use_denoising = False
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    scene.render.filepath = str(out_dir / "smoke.png")

    blend_path = out_dir / "smoke.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    bpy.ops.render.render(write_still=True)
    print(f"SMOKE_OK blend={blend_path} png={scene.render.filepath}")


if __name__ == "__main__":
    main()
