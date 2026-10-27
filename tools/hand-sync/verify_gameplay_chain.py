"""R7c: touch at release must match legal preview anchor (no HUD drop → distant commit)."""
import json
import sys
from pathlib import Path


def main():
    bundle = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else bundle.parent / "gameplay-chain.json"
    interaction = json.loads((bundle / "interaction.json").read_text(encoding="utf-8"))
    frames = interaction["frames"]
    commit_frames = []
    for row in frames:
        for ev in row.get("events") or []:
            if ev.get("kind") == "commit":
                commit_frames.append(row)
    if not commit_frames:
        print("GAMEPLAY_CHAIN_FAIL no commit event")
        sys.exit(1)
    commit = commit_frames[0]
    touch = commit.get("touchVideoDeviceUv")
    drag_contact = [r for r in frames if r.get("contact") and r.get("actionId")]
    last_drag = drag_contact[-1] if drag_contact else None
    preview = (last_drag or {}).get("preview") or commit.get("preview")
    errors = []
    if not preview or not preview.get("legal"):
        errors.append("release preview not legal")
    if touch and touch[1] < 0.2:
        errors.append(f"commit touch v={touch[1]:.3f} in HUD band")
    if last_drag and preview and last_drag.get("touchVideoDeviceUv"):
        lt = last_drag["touchVideoDeviceUv"]
        if touch and (abs(lt[0] - touch[0]) > 0.08 or abs(lt[1] - touch[1]) > 0.08):
            errors.append("commit touch jumped from last drag")
    report = {
        "schema": "melo.hand-sync.gameplay-chain/0.1",
        "commitLocalFrame": commit["frameIndex"],
        "lastDragLocalFrame": last_drag["frameIndex"] if last_drag else None,
        "pieceId": commit.get("pieceId"),
        "touchVideoDeviceUv": touch,
        "previewAnchor": preview,
        "pass": len(errors) == 0,
        "errors": errors,
    }
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"pass": report["pass"], "errors": errors}, indent=2))
    sys.exit(0 if report["pass"] else 1)


if __name__ == "__main__":
    main()
