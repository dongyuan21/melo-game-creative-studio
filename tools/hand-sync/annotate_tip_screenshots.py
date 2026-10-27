"""Annotate start/end drag frames with QC tip pixels (scaled to 540x960)."""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main():
    run = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    qc = json.loads((run / "render/qc-ortho.json").read_text(encoding="utf-8"))
    seg = [r for r in qc["perFrame"] if r.get("contact") and r["localFrameIndex"] <= 19]
    start, end = seg[0], seg[-1]
    sx, sy = 540 / 270, 960 / 480
    font = ImageFont.load_default()
    for label, row in (("start", start), ("end", end)):
        fi = row["localFrameIndex"] + 1
        tip = row["measuredTipProjectionPx"]
        im = Image.open(run / "render/frames" / f"frame_{fi:04d}.png").convert("RGB")
        im = im.resize((540, 960))
        x, y = tip[0] * sx, tip[1] * sy
        d = ImageDraw.Draw(im)
        d.ellipse((x - 12, y - 12, x + 12, y + 12), outline=(255, 40, 40), width=4)
        d.line((x, y, x + 40, y + 40), fill=(255, 200, 0), width=2)
        d.text((10, 10), f"{label} local={row['localFrameIndex']}", fill=(255, 255, 0), font=font)
        d.text((10, 26), f"tip px @270: ({tip[0]:.1f}, {tip[1]:.1f})", fill=(255, 255, 0), font=font)
        d.text((10, 42), f"tip px @540: ({x:.1f}, {y:.1f})", fill=(255, 255, 0), font=font)
        im.save(out_dir / f"motion-proof-{label}-frame.png")
    print("ANNOTATE_OK", out_dir)


if __name__ == "__main__":
    main()
