import bpy
import sys

blend = sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=blend)
pen = bpy.data.objects["PenTarget"]
loc = pen.location.copy()
scene = bpy.context.scene
for f in range(scene.frame_start, scene.frame_end + 1):
    scene.frame_set(f)
    pen.location = loc
    pen.keyframe_insert(data_path="location", frame=f)
bpy.ops.wm.save_mainfile(filepath=blend)
