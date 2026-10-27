"""Shift ScreenProxy transform (screen position) without changing pen track — registration fault."""
import sys


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    blend_path = argv[0]
    delta_m = float(argv[1]) if len(argv) > 1 else 0.012
    import bpy

    bpy.ops.wm.open_mainfile(filepath=blend_path)
    screen = bpy.data.objects.get("ScreenProxy")
    if not screen:
        raise SystemExit("missing ScreenProxy")
    screen.location.x += delta_m
    screen.location.y += delta_m * 0.25
    bpy.ops.wm.save_mainfile(filepath=blend_path)
    print(f"MUTATE_SCREEN_OK delta_m={delta_m}")


if __name__ == "__main__":
    main()
