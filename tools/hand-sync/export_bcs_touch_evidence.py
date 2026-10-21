"""Copy four BCS screen frames: pointerdown, mid-drag, pre-release, after-commit."""
import json
import shutil
import sys
from pathlib import Path


def main():
    bundle = Path(sys.argv[1])
    hit_path = Path(sys.argv[2])
    out = Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    hit = json.loads(hit_path.read_text(encoding="utf-8"))
    interaction = json.loads((bundle / "interaction.json").read_text(encoding="utf-8"))
    frames = interaction["frames"]
    by_local = {f["frameIndex"]: f for f in frames}

    def copy_label(local_idx: int, name: str):
        src = bundle / "screen" / f"frame_{local_idx:04d}.png"
        if not src.is_file():
            raise SystemExit(f"missing {src}")
        row = by_local[local_idx]
        meta = {
            "name": name,
            "localFrameIndex": local_idx,
            "sourceFrameIndex": row.get("sourceFrameIndex"),
            "contact": row.get("contact"),
            "touchVideoDeviceUv": row.get("touchVideoDeviceUv"),
            "preview": row.get("preview"),
            "pieceId": row.get("pieceId"),
            "events": row.get("events"),
        }
        shutil.copy2(src, out / f"{name}.png")
        (out / f"{name}.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")

    pd = hit["frames"]["pointerdownLocal"]
    ld = hit["frames"]["lastDragLocal"]
    cm = hit["frames"]["commitLocal"]
    ac = hit["frames"]["afterCommitLocal"]
    mid = (pd + ld) // 2 if pd is not None and ld is not None else ld
    copy_label(pd, "01-pointerdown")
    copy_label(mid, "02-mid-drag")
    copy_label(ld, "03-pre-release")
    copy_label(ac if ac is not None else cm + 1, "04-after-commit")
    print("BCS_EVIDENCE_OK", out)


if __name__ == "__main__":
    main()
