"""Draw touch path on a blank diagram + sample frame composite for direction proof."""
import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    raise SystemExit("PIL required")


def main():
    out = Path(sys.argv[1])
    motion = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    bundle = Path(sys.argv[3])
    ix = json.loads((bundle / "interaction.json").read_text(encoding="utf-8"))
    drag = [f for f in ix["frames"] if f.get("contact") and f.get("touchTrackSource") == "pointer-path"]
    pts = [f["touchVideoDeviceUv"] for f in drag]
    w, h = 540, 960
    im = Image.new("RGB", (w, h), (20, 24, 32))
    draw = ImageDraw.Draw(im)
    font = ImageFont.load_default()
    px = [(u * w, v * h) for u, v in pts]
    if len(px) >= 2:
        draw.line(px, fill=(80, 200, 255), width=3)
        draw.ellipse((px[0][0] - 8, px[0][1] - 8, px[0][0] + 8, px[0][1] + 8), fill=(255, 80, 80))
        draw.ellipse((px[-1][0] - 8, px[-1][1] - 8, px[-1][0] + 8, px[-1][1] + 8), fill=(80, 255, 120))
    draw.text((8, 8), "touchVideoDeviceUv path (BR->TL)", fill=(255, 255, 255), font=font)
    s = motion["startTouchVideoDeviceUv"]
    e = motion["endTouchVideoDeviceUv"]
    draw.text((8, 24), f"start {s} end {e}", fill=(220, 220, 220), font=font)
    draw.text((8, 40), f"du={motion['deltaU']:.3f} dv={motion['deltaV']:.3f}", fill=(220, 220, 220), font=font)
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out)
    print("MOTION_PROOF_OK", out)


if __name__ == "__main__":
    main()
