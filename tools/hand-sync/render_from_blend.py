"""Render PNG sequence from saved .blend (no scene rebuild). Screen via load_frame + per-frame reload."""
import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

from screen_load import load_frame_for_blender_frame, sha256_file


def parse_args(argv):
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    p = argparse.ArgumentParser()
    p.add_argument("--job", required=True)
    p.add_argument("--blend", required=True)
    p.add_argument("--expected-blend-sha256", default=None)
    return p.parse_args(argv)


def main():
    import bpy

    args = parse_args(sys.argv)
    job = json.loads(Path(args.job).read_text())
    blend = Path(args.blend)
    expected_sha = args.expected_blend_sha256 or job.get("blendSha256")
    if expected_sha:
        actual = sha256_file(blend)
        if actual != expected_sha:
            print(f"RENDER_FAIL blend sha mismatch {actual[:12]} != {expected_sha[:12]}")
            sys.exit(4)

    out_dir = Path(job["outputDir"])
    frame_dir = out_dir / "frames"
    frame_dir.mkdir(parents=True, exist_ok=True)
    bundle_dir = Path(job["bundleDir"])
    mp = bundle_dir / "screen-manifest.json"
    if not mp.is_file():
        print("RENDER_FAIL missing screen-manifest.json")
        sys.exit(5)
    manifest = json.loads(mp.read_text(encoding="utf-8"))

    bpy.ops.wm.open_mainfile(filepath=str(blend))
    scene = bpy.context.scene
    if job.get("cameraProfile"):
        interaction = json.loads((bundle_dir / "interaction.json").read_text(encoding="utf-8"))
        scene_config = json.loads((bundle_dir / "scene-config.json").read_text(encoding="utf-8"))
        layout = interaction["layout"]
        for obj in list(bpy.data.objects):
            if obj.type == "CAMERA":
                bpy.data.objects.remove(obj, do_unlink=True)
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from render_hand_sync import setup_camera_and_light

        setup_camera_and_light(scene, layout, job, scene_config)
    screen = bpy.data.objects.get("ScreenProxy")
    if not screen or not screen.data.materials:
        print("RENDER_FAIL missing ScreenProxy material")
        sys.exit(6)
    tex_node = screen.data.materials[0].node_tree.nodes.get("ScreenTex")
    if not tex_node:
        print("RENDER_FAIL missing ScreenTex node")
        sys.exit(6)
    hide_pen = bool(job.get("hidePenObjects", False))
    for name in ("Pen", "ProbeTip", "PenTarget", "PenTipMarker", "BcsTouchTarget"):
        obj = bpy.data.objects.get(name)
        if obj:
            obj.hide_render = hide_pen
            obj.hide_viewport = hide_pen

    times = []
    for idx in range(scene.frame_start, scene.frame_end + 1):
        scene.frame_set(idx)
        path, _row = load_frame_for_blender_frame(idx, manifest, bundle_dir)
        if tex_node:
            if tex_node.image is None or tex_node.image.filepath != str(path):
                tex_node.image = bpy.data.images.load(str(path), check_existing=True)
            tex_node.image.filepath = str(path)
            tex_node.image.reload()
        t0 = time.time()
        scene.render.filepath = str(frame_dir / f"frame_{idx:04d}.png")
        bpy.ops.render.render(write_still=True)
        times.append(time.time() - t0)

    meta_path = out_dir / "render-meta.json"
    meta = {
        "blendSha256": sha256_file(blend),
        "renderSecondsPerFrameMean": sum(times) / max(1, len(times)),
        "frameCount": len(times),
        "screenLoader": "screen_load.load_frame_for_blender_frame" if manifest else "legacy_path",
    }
    meta_path.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"RENDER_OK frames={len(times)} blendSha={meta['blendSha256'][:12]}")


if __name__ == "__main__":
    main()
