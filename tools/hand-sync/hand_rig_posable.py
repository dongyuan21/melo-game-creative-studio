"""CC0 Innerscene posable anatomical right hand (hand-posable.glb)."""

from pathlib import Path

from hand_sync_geometry import grip_local_in_pen_m

# Stylus grip pose (pose mode, radians). Tuned for pen +Z shaft at GripAnchor.
_STYLUS_POSE_RAD = {
    "hand_r": (1.45, 0.05, -0.35),
    "thumb_01_r": (-0.35, 0.55, -0.85),
    "thumb_02_r": (0.0, 0.45, 0.0),
    "thumb_03_r": (0.0, 0.35, 0.0),
    "index_01_r": (1.15, 0.12, 0.08),
    "index_02_r": (0.0, 1.05, 0.0),
    "index_03_r": (0.0, 0.55, 0.0),
    "middle_01_r": (1.05, -0.05, 0.05),
    "middle_02_r": (0.0, 1.1, 0.0),
    "middle_03_r": (0.0, 0.5, 0.0),
    "ring_01_r": (0.95, -0.15, 0.12),
    "ring_02_r": (0.0, 0.85, 0.0),
    "ring_03_r": (0.0, 0.4, 0.0),
    "pinky_01_r": (0.85, -0.22, 0.18),
    "pinky_02_r": (0.0, 0.75, 0.0),
    "pinky_03_r": (0.0, 0.35, 0.0),
}


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


def _apply_pose(arm_obj, bpy):
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="POSE")
    for bone_name, euler in _STYLUS_POSE_RAD.items():
        pb = arm_obj.pose.bones.get(bone_name)
        if pb is None:
            continue
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = euler
    bpy.ops.object.mode_set(mode="OBJECT")


def _neutral_gray_hand_material(bpy, mesh_obj):
    if mesh_obj.data.materials:
        return
    mat = bpy.data.materials.new("HandAssetGray")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs[0].default_value = (0.42, 0.41, 0.4, 1)
    bsdf.inputs["Roughness"].default_value = 0.65
    mesh_obj.data.materials.append(mat)


def setup_posable_innerscene_hand(bpy, pen_obj, pen_target, scene_config):
    """
    Import rigged right hand; parent armature to GripAnchor on pen shaft.
    Static grip pose — pen motion drives hand via GripAnchor parent chain.
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
    grip.empty_display_size = 0.008
    # Palm toward shaft; wrist extends toward screen bottom-right in pen space.
    grip.rotation_euler = (0.0, 0.0, -0.48)

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    arm_entry = bpy.context.object
    arm_entry.name = "ArmEntryRoot"
    arm_entry.parent = pen_target
    arm_entry.empty_display_size = 0.012

    before_names = {o.name for o in bpy.data.objects}
    bpy.ops.import_scene.gltf(filepath=str(glb_path))
    imported = [o for o in bpy.data.objects if o.name not in before_names]
    arm = next((o for o in imported if o.type == "ARMATURE"), None)
    if arm is None:
        raise RuntimeError("hand GLB import: no armature")

    mesh_names = [
        o.name
        for o in imported
        if o.type == "MESH" and "icosphere" not in o.name.lower()
    ]
    for o in imported:
        if o.type == "MESH" and "icosphere" in o.name.lower():
            bpy.data.objects.remove(o, do_unlink=True)

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
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")

    _apply_pose(arm, bpy)

    arm.parent = grip
    arm.location = (0.0, 0.0, 0.0)
    arm.rotation_euler = (1.48, 0.15, -0.72)
    arm.scale = (0.48, 0.48, 0.48)
    bpy.context.view_layer.update()

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0.055, -0.028, -0.008))
    wrist = bpy.context.object
    wrist.name = "WristMarker"
    wrist.parent = grip
    wrist.hide_render = True

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
        "pose": "static-stylus-grip-v1",
        "armEntry": "screen-br-offset-from-tip",
    }
    grip["hand_sync_rig"] = profile
    return grip, wrist, arm_entry, meta
