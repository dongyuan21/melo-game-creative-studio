"""Explicit screen frame loader for Blender replay (manifest + SHA, fail-closed)."""
import hashlib
import json
from pathlib import Path


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def load_frame(local_index: int, manifest: dict, bundle_dir: Path) -> tuple[Path, dict]:
    """
    Resolve screen PNG for local frame index (0-based in manifest entries).
    Returns absolute path and manifest row.
    """
    frames = manifest.get("frames") or []
    row = None
    for entry in frames:
        if int(entry["localFrameIndex"]) == local_index:
            row = entry
            break
    if row is None:
        raise FileNotFoundError(f"manifest missing localFrameIndex={local_index}")
    rel = row["path"]
    path = (bundle_dir / rel).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"missing screen file {path}")
    expected = row.get("sha256")
    if not expected:
        raise ValueError(f"manifest frame {local_index} missing sha256")
    actual = sha256_file(path)
    if actual != expected:
        raise ValueError(f"screen hash mismatch frame {local_index}: {actual[:12]} != {expected[:12]}")
    return path, row


def load_frame_for_blender_frame(blender_frame_1based: int, manifest: dict, bundle_dir: Path) -> tuple[Path, dict]:
    """Blender timeline is 1..N; manifest localFrameIndex matches interaction frameIndex (0-based)."""
    local = blender_frame_1based - 1
    return load_frame(local, manifest, bundle_dir)
