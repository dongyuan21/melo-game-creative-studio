"""CC0 Innerscene posable anatomical right hand (hand-posable.glb)."""

from pathlib import Path

from hand_sync_geometry import grip_local_in_pen_m

# static-stylus-grip-v2: thumb/index pinch, middle support, ring/pinky curled (pose mode XYZ).
_STYLUS_POSE_V2_RAD = {
    "hand_r": (-0.38, 0.05, 1.22),
    "thumb_01_r": (-1.28, 0.18, -0.82),
    "thumb_02_r": (0.12, 0.48, 0.08),
    "thumb_03_r": (0.0, 0.38, 0.0),
    "index_01_r": (-0.72, -0.18, 0.32),
    "index_02_r": (0.0, 0.0, 1.62),
    "index_03_r": (0.0, 0.0, 1.05),
    "middle_01_r": (-0.58, -0.22, 0.12),
    "middle_02_r": (0.0, 0.0, 1.68),
    "middle_03_r": (0.0, 0.0, 0.95),
    "ring_01_r": (-0.22, -0.08, 0.52),
    "ring_02_r": (0.0, 0.0, 1.35),
    "ring_03_r": (0.0, 0.0, 0.82),
    "pinky_01_r": (-0.12, -0.05, 0.62),
    "pinky_02_r": (0.0, 0.0, 1.22),
    "pinky_03_r": (0.0, 0.0, 0.72),
}

# Grip-local rotation: palm wraps pen +Z; wrist exits toward screen bottom-right.
_GRIP_FRAME_EULER = (0.0, 0.0, -0.48)
_ARM_ROOT_EULER = (1.52, 0.18, -0.68)
_UNIFORM_SCALE = 0.4
_CONTACT_OFFSET_GRIP = (0.014, 0.01, 0.006)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def resolve_hand_glb(scene_config) -> Path:
    rel = scene_config.get(
        "handRigAssetGlb",
        "tools/hand-sync/assets/licensed/posable-anatomical-right-hand/hand-posable.glb",
    )
    path = Path(rel)
    if not path.is_absolute():
        path = _repo_root() / path
    if not path.is_file():
        raise FileNotFoundError(f"hand rig GLB missing: {path}")
    return path


def _apply_pose(arm_obj, bpy, pose_table):
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="POSE")
    for bone_name, euler in pose_table.items():
        pb = arm_obj.pose.bones.get(bone_name)
        if pb is None:
            continue
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = euler
    bpy.ops.object.mode_set(mode="OBJECT")


def _contact_center_armature_space(arm_obj):
    """Pad contact between thumb and index tips (not bbox / wrist)."""
    import bpy
    from mathutils import Vector

    bpy.context.view_layer.update()
    t = arm_obj.pose.bones["thumb_03_r"].tail
    i = arm_obj.pose.bones["index_03_r"].tail
    return (Vector(t) + Vector(i)) * 0.5


def _wrist_exit_armature_space(arm_obj):
    import bpy
    from mathutils import Vector

    bpy.context.view_layer.update()
    return Vector(arm_obj.pose.bones["hand_r"].head)


def _neutral_gray_hand_material(bpy, mesh_obj):
    mat = bpy.data.materials.new("HandAssetNeutralGray")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs[0].default_value = (0.45, 0.44, 0.43, 1)
    bsdf.inputs["Roughness"].default_value = 0.78
    bsdf.inputs["Specular IOR Level"].default_value = 0.18
    mesh_obj.data.materials.clear()
    mesh_obj.data.materials.append(mat)


def _add_forearm_extension(bpy, grip, wrist_local):
    """Short continuous cuff from wrist toward off-screen BR (grip-local)."""
    from mathutils import Vector

    mat = bpy.data.materials.new("ForearmExtensionGray")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs[0].default_value = (0.43, 0.42, 0.41, 1)
    bsdf.inputs["Roughness"].default_value = 0.8
    exit_vec = Vector((0.048, -0.032, -0.006))
    base = Vector(wrist_local) + exit_vec
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0105, depth=0.052, location=tuple(base))
    fore = bpy.context.object
    fore.name = "ForearmExtension"
    fore.rotation_euler = (0.05, 1.12, -0.08)
    fore.parent = grip
    fore.data.materials.append(mat)
    return fore


def setup_posable_innerscene_hand(bpy, pen_obj, pen_target, scene_config):
    """
    Import rigged right hand; align pad contact frame to GripAnchor on pen shaft.
    Static grip v2 — pen motion drives hand via GripAnchor parent chain.
    """
    profile = scene_config.get("handRigProfile")
    if profile not in ("posable-innerscene-right-cc0",):
        return None, None, None, None

    glb_path = resolve_hand_glb(scene_config)
    grip_local = grip_local_in_pen_m(scene_config)

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=grip_local)
    grip = bpy.context.object
    grip.name = "GripAnchor"
    grip.parent = pen_obj
    grip.empty_display_size = 0.006
    grip.rotation_euler = _GRIP_FRAME_EULER

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    arm_entry = bpy.context.object
    arm_entry.name = "ArmEntryRoot"
    arm_entry.parent = pen_target
    arm_entry.empty_display_size = 0.012

    before_names = {o.name for o in bpy.data.objects}
    bpy.ops.import_scene.gltf(filepath=str(glb_path))
    imported = [o for o in bpy.data.objects if o.name not in before_names]
    imported_meta = [(o.name, o.type) for o in imported]
    arm_name = next((n for n, t in imported_meta if t == "ARMATURE"), None)
    if arm_name is None:
        raise RuntimeError("hand GLB import: no armature")
    arm = bpy.data.objects[arm_name]

    icosphere_names = [n for n, t in imported_meta if t == "MESH" and "icosphere" in n.lower()]
    for name in icosphere_names:
        if name in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)

    mesh_names = [n for n, t in imported_meta if t == "MESH" and n not in icosphere_names]
    for name in mesh_names:
        if name in bpy.data.objects:
            _neutral_gray_hand_material(bpy, bpy.data.objects[name])

    arm.name = "HandRig"
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    for child in arm.children:
        child.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    arm.scale = (1.0, 1.0, 1.0)

    _apply_pose(arm, bpy, _STYLUS_POSE_V2_RAD)

    arm.parent = grip
    arm.rotation_euler = _ARM_ROOT_EULER
    s = _UNIFORM_SCALE
    arm.scale = (s, s, s)
    from mathutils import Vector

    contact = _contact_center_armature_space(arm)
    off = Vector(_CONTACT_OFFSET_GRIP)
    arm.location = Vector((-contact.x * s, -contact.y * s, -contact.z * s)) + off
    bpy.context.view_layer.update()

    rot = arm.rotation_euler.to_matrix()
    wrist_bone = _wrist_exit_armature_space(arm) * s
    wrist_local = arm.location + (rot @ wrist_bone)
    _add_forearm_extension(bpy, grip, wrist_local)

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=tuple(wrist_local))
    wrist = bpy.context.object
    wrist.name = "WristMarker"
    wrist.parent = grip
    wrist.hide_render = True

    measured = {
        "uniformScale": _UNIFORM_SCALE,
        "contactLocalGripM": [round(c, 5) for c in contact * _UNIFORM_SCALE + arm.location],
        "wristLocalGripM": [round(w, 5) for w in wrist_local],
    }

    meta = {
        "handRigProfile": profile,
        "gripLocalPenM": list(grip_local),
        "handedness": "right",
        "assetLicense": "CC0",
        "assetSourceUrl": scene_config.get(
            "handRigAssetSourceUrl",
            "https://www.innerscene.com/tools/library/3d-parts/posable-anatomical-right-hand-f6098b4f",
        ),
        "assetGlb": str(
            glb_path.relative_to(_repo_root())
            if str(glb_path).startswith(str(_repo_root()))
            else glb_path
        ),
        "assetSha256": scene_config.get("handRigAssetSha256"),
        "pose": "static-stylus-grip-v2",
        "gripContactFrame": "thumb03-index03-pad-midpoint",
        "measured": measured,
        "armEntry": "screen-br-offset-from-tip",
    }
    grip["hand_sync_rig"] = profile
    return grip, wrist, arm_entry, meta
