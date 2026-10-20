import sys

import bpy

blend, offset_m = sys.argv[-2], float(sys.argv[-1])
bpy.ops.wm.open_mainfile(filepath=blend)
pen = bpy.data.objects["Pen"]
scene = bpy.context.scene
for f in range(scene.frame_start, scene.frame_end + 1):
    scene.frame_set(f)
    pen.location.x += offset_m
    pen.keyframe_insert(data_path="location", frame=f)
bpy.ops.wm.save_mainfile(filepath=blend)
