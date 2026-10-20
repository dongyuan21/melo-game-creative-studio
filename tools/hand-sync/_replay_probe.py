
import bpy, json, sys
sys.path.insert(0, r"/workspace/tools/hand-sync")
from hand_sync_geometry import evaluated_pen_tip_world
cfg = json.load(open(r"/workspace/artifacts/bcs-hand-pen/runs/hand-sync-r7/export/run-1792514140544/bundle/scene-config.json"))
bpy.ops.wm.open_mainfile(filepath=r"/workspace/artifacts/bcs-hand-pen/runs/hand-sync-r7/render/probe_pen.blend")
scene = bpy.context.scene
pen = bpy.data.objects["Pen"]
picks = [1, 49, 99]
tips = {}
order = list(picks)
if True:
    order = [scene.frame_end] + [scene.frame_start] + [picks[len(picks)//2]] + sorted(picks, reverse=True) + sorted(picks)
for f in order:
    scene.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    tips[f] = list(evaluated_pen_tip_world(dg, pen, cfg))
out = [tips[f] for f in picks]
print("REPLAY_JSON", json.dumps(out))
