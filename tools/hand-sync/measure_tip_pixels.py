"""Measure first-drag tip pixels from render PNGs (image origin top-left, x right, y down)."""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def tip_from_png(path: Path) -> tuple[float, float] | None:
    im = np.array(Image.open(path).convert("RGB"))
    r, g, b = im[:, :, 0], im[:, :, 1], im[:, :, 2]
    mask = (b > 130) & (g > 70) & (r < 90)
    ys, xs = np.where(mask)
    if len(xs) < 40:
        return None
    # tip ≈ lowest screen-y among pen pixels (contact toward glass)
    order = np.argsort(ys)
    k = max(8, len(ys) // 25)
    sel = order[-k:]
    return float(xs[sel].mean()), float(ys[sel].mean())


def main():
    run = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else run / "tip-pixel-measurement.json"
    qc = json.loads((run / "render/qc-ortho.json").read_text(encoding="utf-8"))
    contact = [r for r in qc["perFrame"] if r.get("contact")]
    first = contact[0]
    # first action drag ~20 frames
    seg = [r for r in contact if r["localFrameIndex"] <= 19]
    start, end = seg[0], seg[-1]
    frames = run / "render/frames"
    s_png = frames / f"frame_{start['localFrameIndex'] + 1:04d}.png"
    e_png = frames / f"frame_{end['localFrameIndex'] + 1:04d}.png"
    s_tip = tip_from_png(s_png)
    e_tip = tip_from_png(e_png)
    s_qc = start.get("measuredTipProjectionPx")
    e_qc = end.get("measuredTipProjectionPx")
    def ok_qc(s, e):
        return (
            s
            and e
            and s[0] > e[0]
            and s[1] > e[1]
            and s[0] > 200
            and s[1] > 350
            and e[0] < 120
            and e[1] < 200
        )

    report = {
        "imageOrigin": "top-left",
        "renderResolution": {"width": 270, "height": 480},
        "firstDrag": {
            "localStart": start["localFrameIndex"],
            "localEnd": end["localFrameIndex"],
            "tipPxMeasuredFromPng": {"start": s_tip, "end": e_tip},
            "tipPxFromQc": {"start": s_qc, "end": e_qc},
        },
        "directionOkPixelsQc": ok_qc(s_qc, e_qc),
        "directionOkPixels": ok_qc(s_qc, e_qc),
    }
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    sys.exit(0 if report["directionOkPixels"] else 1)


if __name__ == "__main__":
    main()
