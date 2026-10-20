"""Game-side outlet: preview / events / touch track semantics (no Blender)."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main():
    bundle = Path(sys.argv[1])
    interaction = json.loads((bundle / "interaction.json").read_text(encoding="utf-8"))
    frames = interaction["frames"]
    errors = []
    for row in frames:
        fi = row["frameIndex"]
        if row.get("contact") and row.get("touchTrackSource") == "pointer-path":
            if row.get("preview") is None and row.get("actionId"):
                errors.append(f"frame {fi} contact drag missing preview")
        if row.get("presentationAnchorUv") and row.get("touchTrackSource") != "held-last-touch":
            errors.append(f"frame {fi} anchor presentation without held-last-touch")
        if row.get("touchTrackSource") == "synthesized-hover" and row.get("contact"):
            errors.append(f"frame {fi} contact with synthesized-hover")
        for ev in row.get("events") or []:
            if ev.get("kind") == "commit" and row.get("preview") and not row["preview"].get("legal"):
                errors.append(f"frame {fi} commit with illegal preview")
    if errors:
        print("GAME_VERIFY_FAIL", errors[:12])
        sys.exit(1)
    print("GAME_VERIFY_PASS frames", len(frames))
    sys.exit(0)


if __name__ == "__main__":
    main()
