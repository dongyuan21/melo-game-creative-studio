"""Regression: saved .blend must replay distinct tip positions in a fresh Blender process."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BLEND = ROOT / "artifacts/bcs-hand-pen/runs/hand-sync-v2/render/probe_pen.blend"
JOB = ROOT / "artifacts/bcs-hand-pen/runs/hand-sync-v2/job.json"


def probe_script(blend: str, frames: list[int]) -> list[tuple[float, float, float]]:
    code = f"""
import bpy, json
bpy.ops.wm.open_mainfile(filepath={json.dumps(blend)})
scene = bpy.context.scene
pen = bpy.data.objects['Pen']
out = []
for f in {frames}:
    scene.frame_set(f)
    bpy.context.view_layer.update()
    loc = pen.matrix_world @ bpy.data.objects['PenTip'].matrix_local.translation
    out.append([loc.x, loc.y, loc.z])
print('REPLAY_JSON', json.dumps(out))
"""
    proc = subprocess.run(
        ["blender", "--background", "--python-expr", code],
        capture_output=True,
        text=True,
        timeout=120,
    )
    for line in proc.stdout.splitlines():
        if line.startswith("REPLAY_JSON"):
            return json.loads(line.split(" ", 1)[1])
    raise RuntimeError(proc.stdout + proc.stderr)


def main():
    if not BLEND.is_file():
        print("SKIP no blend yet")
        sys.exit(0)
    interaction = json.loads((Path(json.loads(JOB.read_text())["bundleDir"]) / "interaction.json").read_text())
    n = len(interaction["frames"])
    picks = [1, max(2, n // 3), max(3, (2 * n) // 3)]
    first = probe_script(str(BLEND), picks)
    second = probe_script(str(BLEND), picks)
    if first != second:
        print("FAIL replay mismatch between two fresh processes")
        sys.exit(1)
    if len({tuple(p) for p in first}) < 2:
        print("FAIL tip positions not distinct across sample frames", first)
        sys.exit(1)
    print("PASS keyframe replay", picks)
    sys.exit(0)


if __name__ == "__main__":
    main()
