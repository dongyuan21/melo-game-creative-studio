"""Measured Pen mesh tip must differ across frames in two fresh Blender processes."""
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUN = ROOT / "artifacts/bcs-hand-pen/runs/hand-sync-r3"
BLEND = RUN / "render/probe_pen.blend"
SCENE_CFG = next(RUN.glob("export/run-*/bundle/scene-config.json"), None)


def probe_tips(blend: Path, scene_cfg: Path, frames: list[int]) -> list[list[float]]:
    script = ROOT / "tools/hand-sync/_replay_probe.py"
    script.write_text(
        f"""
import bpy, json, sys
sys.path.insert(0, r"{ROOT / 'tools/hand-sync'}")
from hand_sync_geometry import evaluated_pen_tip_world
cfg = json.load(open(r"{scene_cfg}"))
bpy.ops.wm.open_mainfile(filepath=r"{blend}")
scene = bpy.context.scene
pen = bpy.data.objects["Pen"]
out = []
for f in {frames}:
    scene.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    out.append(list(evaluated_pen_tip_world(dg, pen, cfg)))
print("REPLAY_JSON", json.dumps(out))
"""
    )
    proc = subprocess.run(
        ["blender", "--background", "--python", str(script)],
        capture_output=True,
        text=True,
        timeout=120,
    )
    for line in proc.stdout.splitlines():
        if line.startswith("REPLAY_JSON"):
            return json.loads(line.split(" ", 1)[1])
    raise RuntimeError(proc.stdout + proc.stderr)


def main():
    if not BLEND.is_file() or not SCENE_CFG:
        print("FAIL missing blend or scene-config")
        sys.exit(1)
    interaction = json.loads(next(RUN.glob("export/run-*/bundle/interaction.json")).read_text())
    n = len(interaction["frames"])
    picks = [1, max(2, n // 3), max(3, (2 * n) // 3)]
    a = probe_tips(BLEND, SCENE_CFG, picks)
    b = probe_tips(BLEND, SCENE_CFG, picks)
    if a != b:
        print("FAIL replay mismatch between processes")
        sys.exit(1)
    if len({tuple(p) for p in a}) < 2:
        print("FAIL measured tip static", a)
        sys.exit(1)
    print("PASS keyframe replay", picks)


if __name__ == "__main__":
    main()
