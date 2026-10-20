"""Procedural right-hand + forearm (gray proxy). CC0-style primitive rig for hand-sync R7b."""

from hand_sync_geometry import grip_local_in_pen_m


def _gray_mat(bpy, name: str):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs[0].default_value = (0.52, 0.52, 0.56, 1)
    mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.65
    return mat


def _link_mesh(bpy, name: str, mesh, mat):
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj


def setup_procedural_right_hand(bpy, pen_obj, scene_config):
    """
    GripAnchor on pen shaft; palm + fingers + forearm for right-hand readability.
    Forearm extends toward screen bottom-right (entry from off-screen BR).
    """
    profile = scene_config.get("handRigProfile", "procedural-right-gray-v1")
    if profile in (None, "none", "off"):
        return None, None, None

    grip_local = grip_local_in_pen_m(scene_config)
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=grip_local)
    grip = bpy.context.object
    grip.name = "GripAnchor"
    grip.parent = pen_obj
    grip.empty_display_size = 0.008

    mat = _gray_mat(bpy, "HandGrayMat")

    # Palm: offset toward +X +Y in grip space (below-right of tip in image for ortho cam).
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.012, 0.010, -0.006))
    palm = bpy.context.object
    palm.name = "HandPalm"
    palm.scale = (0.022, 0.016, 0.012)
    palm.parent = grip
    palm.data.materials.append(mat)

    for i, (lx, ly, lz, sx, sy, sz) in enumerate(
        [
            (0.006, 0.022, -0.002, 0.007, 0.018, 0.006),
            (-0.004, 0.024, -0.001, 0.006, 0.016, 0.005),
            (-0.012, 0.020, 0.0, 0.006, 0.014, 0.005),
        ]
    ):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(lx, ly, lz))
        finger = bpy.context.object
        finger.name = f"HandFinger_{i}"
        finger.scale = (sx, sy, sz)
        finger.parent = grip
        finger.data.materials.append(mat)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.038, 0.032, -0.004))
    forearm = bpy.context.object
    forearm.name = "Forearm"
    forearm.scale = (0.055, 0.028, 0.022)
    forearm.parent = grip
    forearm.data.materials.append(mat)

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0.052, 0.044, -0.002))
    wrist = bpy.context.object
    wrist.name = "WristMarker"
    wrist.parent = grip
    wrist.empty_display_size = 0.01
    wrist.hide_render = True

    meta = {
        "handRigProfile": profile,
        "gripLocalPenM": list(grip_local),
        "handedness": "right",
        "assetLicense": "procedural-in-repo",
    }
    grip["hand_sync_rig"] = profile
    return grip, wrist, meta
