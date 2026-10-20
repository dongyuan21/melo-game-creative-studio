"""Shared screen/pen coordinate helpers for Blender hand-sync (meters, right-handed)."""
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


def screen_plane_dimensions_m(layout):
    return layout["displaySizeM"]["width"], layout["displaySizeM"]["height"]


def device_uv_to_screen_local_m(uv, layout, pen_height_m):
    w, h = screen_plane_dimensions_m(layout)
    u, v = float(uv[0]), float(uv[1])
    touch = float(layout.get("touchPlaneOffsetM", 0))
    x = (u - 0.5) * w
    y = (0.5 - v) * h
    z = touch + float(pen_height_m)
    return (x, y, z)


def screen_local_to_world(layout, local_xyz):
    m = layout.get("worldFromScreen")
    if not m:
        return local_xyz
    x, y, z = local_xyz
    wx = m[0] * x + m[4] * y + m[8] * z + m[12]
    wy = m[1] * x + m[5] * y + m[9] * z + m[13]
    wz = m[2] * x + m[6] * y + m[10] * z + m[14]
    return (wx, wy, wz)


def pen_target_world_m(frame, layout):
    local = device_uv_to_screen_local_m(frame["penDeviceUv"], layout, frame["penHeightM"])
    return screen_local_to_world(layout, local)


def pen_tip_offset_local_m(scene_config):
    """Cylinder aligned on +Z; tip at positive end."""
    half = float(scene_config.get("penHalfLengthM", 0.06))
    return (0.0, 0.0, half)


def evaluated_pen_tip_world(pen_obj, scene_config):
    import bpy

    tip = bpy.data.objects.get("PenTip")
    if tip is not None:
        return tuple(tip.matrix_world.translation)
    import mathutils

    offset = mathutils.Vector(pen_tip_offset_local_m(scene_config))
    return tuple(pen_obj.matrix_world @ offset)
