"""Emit motion direction evidence for hand-sync bundles (stdout JSON)."""
import json
import sys
from pathlib import Path


def main():
    bundle = Path(sys.argv[1])
    ix = json.loads((bundle / "interaction.json").read_text(encoding="utf-8"))
    drag = [
        f
        for f in ix["frames"]
        if f.get("contact")
        and f.get("touchTrackSource") == "pointer-path"
        and f.get("actionId") == ix["frames"][0].get("actionId")
    ]
    if not drag:
        drag = [f for f in ix["frames"] if f.get("contact")]
    u0, v0 = drag[0]["touchVideoDeviceUv"]
    u1, v1 = drag[-1]["touchVideoDeviceUv"]
    take_id = None
    bp = bundle / "bundle.json"
    if bp.is_file():
        take_id = json.loads(bp.read_text(encoding="utf-8")).get("source", {}).get("takeId")
    out = {
        "takeId": take_id or ix.get("exportTakeId") or "unknown",
        "referenceMotion": ix.get("layout", {}).get("referenceMotion"),
        "dragFrames": len(drag),
        "startTouchVideoDeviceUv": [u0, v0],
        "endTouchVideoDeviceUv": [u1, v1],
        "deltaU": u1 - u0,
        "deltaV": v1 - v0,
        "directionOk": (u1 < u0 and v1 < v0),
    }
    print(json.dumps(out, indent=2))
    sys.exit(0 if out["directionOk"] else 1)


if __name__ == "__main__":
    main()
