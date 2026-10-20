"""Flip pen shaft through screen while keeping object origin at tip anchor."""
import sys

import bpy

blend = sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=blend)
pen = bpy.data.objects["Pen"]
for v in pen.data.vertices:
    if v.co.z > 0.01:
        v.co.z = -abs(v.co.z)
pen.data.update()
bpy.ops.wm.save_mainfile(filepath=blend)
