"""R7b: grip must project below-right of tip on contact frames (image TL origin)."""
import json
import sys
from pathlib import Path


def grip_side_ok(tip_px, grip_px):
    if not tip_px or not grip_px:
        return False
    return grip_px[0] > tip_px[0] and grip_px[1] > tip_px[1]


def main():
    qc_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else qc_path.parent / "grip-side.json"
    qc = json.loads(qc_path.read_text(encoding="utf-8"))
    contact = [r for r in qc.get("perFrame", []) if r.get("contact")]
    first_drag = [r for r in contact if r["localFrameIndex"] <= 19]
    rows = []
    failures = []
    for r in first_drag:
        tip = r.get("measuredTipProjectionPx")
        grip = r.get("gripProjectionPx")
        ok = grip_side_ok(tip, grip)
        rows.append(
            {
                "localFrameIndex": r["localFrameIndex"],
                "tipPx": tip,
                "gripPx": grip,
                "gripSideOk": ok,
            }
        )
        if not ok:
            failures.append(r["localFrameIndex"])
    report = {
        "schema": "melo.hand-sync.grip-side/0.1",
        "imageOrigin": "top-left",
        "constraint": "grip.x > tip.x and grip.y > tip.y",
        "firstDragFrameCount": len(first_drag),
        "perFrame": rows,
        "allFirstDragOk": len(failures) == 0 and len(first_drag) > 0,
        "failedLocalFrames": failures,
    }
    out_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"allFirstDragOk": report["allFirstDragOk"], "failed": failures[:5]}, indent=2))
    sys.exit(0 if report["allFirstDragOk"] else 1)


if __name__ == "__main__":
    main()
