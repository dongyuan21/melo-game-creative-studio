"""Push shaft vertices through screen; tip vertex at origin stays fixed."""
import sys

import bpy

blend = sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=blend)
pen = bpy.data.objects["Pen"]
tip_z_max = 0.0005
for v in pen.data.vertices:
    if v.co.z > tip_z_max:
        v.co.z = -abs(v.co.z) - 0.01
pen.data.update()
bpy.ops.wm.save_mainfile(filepath=blend)
