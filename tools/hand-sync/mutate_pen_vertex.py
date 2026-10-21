"""Move tip-region vertices without changing object transforms (geometry-only fault)."""
import sys

import bpy

blend = sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=blend)
pen = bpy.data.objects["Pen"]
mesh = pen.data
for v in mesh.vertices:
    if v.co.length < 0.01:
        v.co.x += 0.015
mesh.update()
bpy.ops.wm.save_mainfile(filepath=blend)
