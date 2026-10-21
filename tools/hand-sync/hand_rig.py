"""Procedural right-hand + forearm (gray proxy). CC0-style primitive rig for hand-sync R7b."""

from hand_sync_geometry import grip_local_in_pen_m


def _gray_mat(bpy, name: str, base=0.38):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs[0].default_value = (base, base * 0.98, base * 1.02, 1)
    bsdf.inputs["Roughness"].default_value = 0.72
    bsdf.inputs["Specular IOR Level"].default_value = 0.25
    return mat


def _link_mesh(bpy, name: str, mesh, mat):
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj


def setup_procedural_right_hand(bpy, pen_obj, pen_target, scene_config):
    """
    GripAnchor on pen shaft; palm + fingers + forearm for right-hand readability.
    Forearm extends toward screen bottom-right (entry from off-screen BR).
    """
    profile = scene_config.get("handRigProfile", "procedural-right-gray-v1")
    if profile in (None, "none", "off"):
        return None, None, None, None

    grip_local = grip_local_in_pen_m(scene_config)
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=grip_local)
    grip = bpy.context.object
    grip.name = "GripAnchor"
    grip.parent = pen_obj
    grip.empty_display_size = 0.008

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    arm_entry = bpy.context.object
    arm_entry.name = "ArmEntryRoot"
    arm_entry.parent = pen_target
    arm_entry.empty_display_size = 0.012

    mat = _gray_mat(bpy, "HandGrayMat", base=0.36)
    mat_thumb = _gray_mat(bpy, "HandThumbMat", base=0.34)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.010, 0.008, -0.005))
    palm = bpy.context.object
    palm.name = "HandPalm"
    palm.scale = (0.020, 0.014, 0.010)
    palm.parent = grip
    palm.data.materials.append(mat)

    # thumb (right), index, middle — separated volumes for readability
    bpy.ops.mesh.primitive_cylinder_add(radius=0.004, depth=0.014, location=(0.014, -0.002, -0.003))
    thumb = bpy.context.object
    thumb.name = "HandThumb"
    thumb.rotation_euler = (1.1, 0.35, -0.5)
    thumb.parent = grip
    thumb.data.materials.append(mat_thumb)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.0032, depth=0.016, location=(0.002, 0.018, -0.001))
    index_f = bpy.context.object
    index_f.name = "HandIndex"
    index_f.rotation_euler = (0.25, 0.1, 0.15)
    index_f.parent = grip
    index_f.data.materials.append(mat)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.003, depth=0.015, location=(-0.008, 0.017, 0.0))
    middle_f = bpy.context.object
    middle_f.name = "HandMiddle"
    middle_f.rotation_euler = (0.18, 0.05, 0.08)
    middle_f.parent = grip
    middle_f.data.materials.append(mat)

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0.018, -0.012, -0.004))
    wrist = bpy.context.object
    wrist.name = "WristMarker"
    wrist.parent = grip

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.036, -0.032, -0.002))
    forearm = bpy.context.object
    forearm.name = "Forearm"
    forearm.scale = (0.058, 0.020, 0.016)
    forearm.parent = wrist
    forearm.data.materials.append(mat)

    wrist.empty_display_size = 0.01
    wrist.hide_render = True

    meta = {
        "handRigProfile": profile,
        "gripLocalPenM": list(grip_local),
        "handedness": "right",
        "assetLicense": "procedural-in-repo",
        "armEntry": "screen-br-offset-from-tip",
    }
    grip["hand_sync_rig"] = profile
    return grip, wrist, arm_entry, meta
