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
    """Rigid tip anchor in Pen object space (origin = contact tip vertex)."""
    return (0.0, 0.0, 0.0)


def screen_plane_dimensions_m(layout):
    return layout["displaySizeM"]["width"], layout["displaySizeM"]["height"]


def layout_world_from_screen_matrix(layout):
    import mathutils

    m = layout.get("worldFromScreen")
    if not m:
        return mathutils.Matrix.Identity(4)
    return mathutils.Matrix(
        (
            (m[0], m[4], m[8], m[12]),
            (m[1], m[5], m[9], m[13]),
            (m[2], m[6], m[10], m[14]),
            (m[3], m[7], m[11], m[15]),
        )
    )


def apply_world_from_screen_matrix(obj, layout):
    import mathutils

    obj.matrix_world = layout_world_from_screen_matrix(layout) @ obj.matrix_world


def expected_screen_proxy_matrix_world(layout):
    import mathutils

    w, h = screen_plane_dimensions_m(layout)
    scale = mathutils.Matrix.Diagonal((w, h, 1.0, 1.0))
    return layout_world_from_screen_matrix(layout) @ scale


def screen_proxy_layout_delta_m(depsgraph, screen_obj, layout):
    import mathutils

    expected = expected_screen_proxy_matrix_world(layout)
    actual = evaluated_object_world(depsgraph, screen_obj)
    return (actual.translation - expected.translation).length


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


def contain_mapping(layout):
    design = layout.get("designImagePx") or {"width": 1064, "height": 1788}
    video = layout["gameImagePx"]
    dw, dh = float(design["width"]), float(design["height"])
    vw, vh = float(video["width"]), float(video["height"])
    scale = min(vw / dw, vh / dh)
    draw_w, draw_h = dw * scale, dh * scale
    return {
        "scale": scale,
        "offsetX": (vw - draw_w) / 2,
        "offsetY": (vh - draw_h) / 2,
        "design": design,
        "video": video,
    }


def pointer_design_uv_to_video_device_uv(pen_device_uv, layout):
    mapping = contain_mapping(layout)
    du, dv = float(pen_device_uv[0]), float(pen_device_uv[1])
    dw = float(mapping["design"]["width"])
    dh = float(mapping["design"]["height"])
    vw = float(mapping["video"]["width"])
    vh = float(mapping["video"]["height"])
    vx = mapping["offsetX"] + du * dw * mapping["scale"]
    vy = mapping["offsetY"] + dv * dh * mapping["scale"]
    return (vx / vw, vy / vh)


def pen_target_world_m(frame, layout):
    video_uv = pointer_design_uv_to_video_device_uv(frame["penDeviceUv"], layout)
    local = device_uv_to_screen_local_m(video_uv, layout, frame["penHeightM"])
    return screen_local_to_world(layout, local)


def bcs_pointer_render_px(manifest_row, render_w, render_h, video_w, video_h):
    ptr = manifest_row.get("pointerVideoPx")
    if not ptr:
        return None
    sx = render_w / video_w
    sy = render_h / video_h
    return (float(ptr["x"]) * sx, float(ptr["y"]) * sy)


def pen_object_pose_for_tip(tip_world, pen_quat, tip_local):
    import mathutils

    offset = pen_quat @ mathutils.Vector(tip_local)
    loc = mathutils.Vector(tip_world) - offset
    return loc, pen_quat


def evaluated_object_world(depsgraph, obj):
    ev = obj.evaluated_get(depsgraph)
    return ev.matrix_world


def evaluated_pen_tip_world(depsgraph, pen_obj, scene_config):
    import mathutils

    tip_local = mathutils.Vector(tip_local_in_pen_m(scene_config))
    mw = evaluated_object_world(depsgraph, pen_obj)
    return tuple(mw @ tip_local)


def _pen_mesh_eval(depsgraph, pen_obj):
    ev = pen_obj.evaluated_get(depsgraph)
    mesh = ev.to_mesh()
    return ev, mesh


def pen_tip_vertex_index(pen_obj):
    mesh = pen_obj.data
    if "hand_sync_tip_vertex_index" in mesh:
        idx = int(mesh["hand_sync_tip_vertex_index"])
        if idx >= 0:
            return idx
    vg = pen_obj.vertex_groups.get("PenTip")
    if vg:
        vg_idx = vg.index
        for v in mesh.vertices:
            for g in v.groups:
                if g.group == vg_idx and g.weight > 0.5:
                    return v.index
    return None


def evaluated_pen_tip_from_mesh(depsgraph, pen_obj):
    import mathutils

    ev, mesh = _pen_mesh_eval(depsgraph, pen_obj)
    try:
        if not mesh.vertices:
            return None
        tip_i = pen_tip_vertex_index(pen_obj)
        if tip_i is not None and tip_i < len(mesh.vertices):
            w = ev.matrix_world @ mesh.vertices[tip_i].co
            return tuple(w)
        tip_v = min(mesh.vertices, key=lambda v: (v.co.x ** 2 + v.co.y ** 2, v.co.z))
        return tuple(ev.matrix_world @ tip_v.co)
    finally:
        ev.to_mesh_clear()


def anchor_vs_mesh_tip_delta_m(depsgraph, pen_obj, scene_config):
    import mathutils

    ev, mesh = _pen_mesh_eval(depsgraph, pen_obj)
    try:
        tip_i = pen_tip_vertex_index(pen_obj)
        if tip_i is None or tip_i >= len(mesh.vertices):
            return None
        tip_local = mathutils.Vector(tip_local_in_pen_m(scene_config))
        return (mathutils.Vector(mesh.vertices[tip_i].co) - tip_local).length
    finally:
        ev.to_mesh_clear()


def pen_mesh_min_signed_m(depsgraph, pen_obj, plane_origin, plane_normal):
    """Worst (minimum) signed distance across all evaluated pen mesh vertices."""
    import mathutils

    ev, mesh = _pen_mesh_eval(depsgraph, pen_obj)
    try:
        mw = ev.matrix_world
        origin = mathutils.Vector(plane_origin)
        normal = mathutils.Vector(plane_normal).normalized()
        min_signed = float("inf")
        for v in mesh.vertices:
            signed = (mw @ v.co - origin).dot(normal)
            if signed < min_signed:
                min_signed = signed
        return min_signed if min_signed != float("inf") else None
    finally:
        ev.to_mesh_clear()


def pen_body_clearance_m(depsgraph, pen_obj, plane_origin, plane_normal):
    """Alias: full-mesh minimum signed distance (shaft + tip)."""
    return pen_mesh_min_signed_m(depsgraph, pen_obj, plane_origin, plane_normal)


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
