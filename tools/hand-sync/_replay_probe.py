
import bpy, json, sys
sys.path.insert(0, r"/workspace/tools/hand-sync")
from hand_sync_geometry import evaluated_pen_tip_world
cfg = json.load(open(r"/workspace/artifacts/bcs-hand-pen/runs/hand-sync-r3/export/run-1792502520715/bundle/scene-config.json"))
bpy.ops.wm.open_mainfile(filepath=r"/workspace/artifacts/bcs-hand-pen/runs/hand-sync-r3/render/probe_pen.blend")
scene = bpy.context.scene
pen = bpy.data.objects["Pen"]
out = []
for f in [1, 49, 99]:
    scene.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    out.append(list(evaluated_pen_tip_world(dg, pen, cfg)))
print("REPLAY_JSON", json.dumps(out))
