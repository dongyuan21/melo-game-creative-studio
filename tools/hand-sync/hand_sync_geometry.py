"""Screen / pen geometry (meters). Measurement uses evaluated Pen mesh, not control empties."""
import json
import math
from pathlib import Path


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def pen_tilt_quaternion(scene_config):
    import mathutils

    pitch = float(scene_config.get("penTiltPitchRadians", scene_config.get("penTiltRadians", 0.35)))
    roll = float(scene_config.get("penTiltRollRadians", 0))
    yaw = float(scene_config.get("penTiltYawRadians", -0.21))
    return mathutils.Euler((pitch, yaw, roll), "XYZ").to_quaternion()


def tip_local_in_pen_m(scene_config):
    """Rigid tip anchor in Pen object space (origin = contact tip)."""
    return (0.0, 0.0, 0.0)


def screen_plane_dimensions_m(layout):
    return layout["displaySizeM"]["width"], layout["displaySizeM"]["height"]


def apply_world_from_screen_matrix(obj, layout):
    import mathutils

    m = layout.get("worldFromScreen")
    if not m:
        return
    mat = mathutils.Matrix(
        (
            (m[0], m[4], m[8], m[12]),
            (m[1], m[5], m[9], m[13]),
            (m[2], m[6], m[10], m[14]),
            (m[3], m[7], m[11], m[15]),
        )
    )
    obj.matrix_world = mat @ obj.matrix_world


def device_uv_to_screen_local_m(uv, layout, pen_height_m):
    w, h = screen_plane_dimensions_m(layout)
    u, v = float(uv[0]), float(uv[1])
    touch = float(layout.get("touchPlaneOffsetM", 0))
    x = (u - 0.5) * w
    y = (0.5 - v) * h
    z = touch + float(pen_height_m)
    return (x, y, z)


def screen_local_to_world(layout, local_xyz):
    import mathutils

    m = layout.get("worldFromScreen")
    if not m:
        return local_xyz
    mat = mathutils.Matrix(
        (
            (m[0], m[4], m[8], m[12]),
            (m[1], m[5], m[9], m[13]),
            (m[2], m[6], m[10], m[14]),
            (m[3], m[7], m[11], m[15]),
        )
    )
    return tuple((mat @ mathutils.Vector(local_xyz)))


def pen_target_world_m(frame, layout):
    local = device_uv_to_screen_local_m(frame["penDeviceUv"], layout, frame["penHeightM"])
    return screen_local_to_world(layout, local)


def pen_object_pose_for_tip(tip_world, pen_quat, tip_local):
    """World pose for Pen object so rigid tip_local lands on tip_world."""
    import mathutils

    offset = pen_quat @ mathutils.Vector(tip_local)
    loc = mathutils.Vector(tip_world) - offset
    return loc, pen_quat


def evaluated_object_world(depsgraph, obj):
    ev = obj.evaluated_get(depsgraph)
    return ev.matrix_world


def evaluated_pen_tip_world(depsgraph, pen_obj, scene_config):
    """Authoritative tip pose: rigid anchor on Pen object (not a recomputed target)."""
    import mathutils

    tip_local = mathutils.Vector(tip_local_in_pen_m(scene_config))
    mw = evaluated_object_world(depsgraph, pen_obj)
    return tuple(mw @ tip_local)


def evaluated_pen_tip_from_mesh(depsgraph, pen_obj):
    """Evaluated mesh vertex at rigid tip (minimum local Z on pen mesh)."""
    import mathutils

    ev = pen_obj.evaluated_get(depsgraph)
    mesh = ev.to_mesh()
    try:
        if not mesh.vertices:
            return None
        tip_v = min(mesh.vertices, key=lambda v: v.co.z)
        mw = ev.matrix_world
        return tuple(mw @ tip_v.co)
    finally:
        ev.to_mesh_clear()


def anchor_vs_mesh_tip_delta_m(depsgraph, pen_obj, scene_config):
    """Distance from rigid anchor (object origin) to mesh tip in pen local space."""
    import mathutils

    ev = pen_obj.evaluated_get(depsgraph)
    mesh = ev.to_mesh()
    try:
        if not mesh.vertices:
            return None
        tip_v = min(mesh.vertices, key=lambda v: v.co.z)
        tip_local = mathutils.Vector(tip_local_in_pen_m(scene_config))
        return (mathutils.Vector(tip_v.co) - tip_local).length
    finally:
        ev.to_mesh_clear()


def pen_body_clearance_m(depsgraph, pen_obj, plane_origin, plane_normal, tip_exclude_radius_m=0.0025):
    """Minimum signed plane distance on pen mesh excluding tip ball vertices near anchor."""
    import mathutils

    ev = pen_obj.evaluated_get(depsgraph)
    mesh = ev.to_mesh()
    try:
        mw = ev.matrix_world
        origin = mathutils.Vector(plane_origin)
        normal = mathutils.Vector(plane_normal).normalized()
        min_signed = float("inf")
        for v in mesh.vertices:
            if v.co.length <= tip_exclude_radius_m:
                continue
            w = mw @ v.co
            signed = (w - origin).dot(normal)
            if signed < min_signed:
                min_signed = signed
        return min_signed if min_signed != float("inf") else None
    finally:
        ev.to_mesh_clear()


def evaluated_probe_world(depsgraph, probe_obj):
    mw = evaluated_object_world(depsgraph, probe_obj)
    return tuple(mw.translation)


def screen_plane_frame(depsgraph, screen_obj):
    import mathutils

    mw = evaluated_object_world(depsgraph, screen_obj)
    origin = mw.translation
    normal = (mw.to_3x3() @ mathutils.Vector((0.0, 0.0, 1.0))).normalized()
    return origin, normal


def signed_plane_distance_m(point, origin, normal):
    import mathutils

    return (mathutils.Vector(point) - origin).dot(normal)


def camera_projection_px(scene, point_world, res_w, res_h):
    from bpy_extras.object_utils import world_to_camera_view
    import mathutils

    co = world_to_camera_view(scene, scene.camera, mathutils.Vector(point_world))
    if co.z < 0:
        return None
    px = co.x * res_w
    py = (1.0 - co.y) * res_h
    return (px, py)


def reference_game_resolution(layout):
    return layout["gameImagePx"]["width"], layout["gameImagePx"]["height"]
