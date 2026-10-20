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


def validate_manifest(manifest: dict, interaction: dict) -> None:
    frames = manifest.get("frames") or []
    seen_local = set()
    interaction_by_local = {int(f["frameIndex"]): f for f in interaction.get("frames", [])}
    for entry in frames:
        local = int(entry["localFrameIndex"])
        if local in seen_local:
            raise ValueError(f"duplicate manifest localFrameIndex={local}")
        seen_local.add(local)
        ix = interaction_by_local.get(local)
        if not ix:
            raise ValueError(f"manifest local {local} missing from interaction")
        if int(entry.get("sourceFrameIndex", -1)) != int(ix.get("sourceFrameIndex", -1)):
            raise ValueError(f"manifest source mismatch local={local}")


def load_frame(local_index: int, manifest: dict, bundle_dir: Path) -> tuple[Path, dict]:
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
    local = blender_frame_1based - 1
    return load_frame(local, manifest, bundle_dir)
