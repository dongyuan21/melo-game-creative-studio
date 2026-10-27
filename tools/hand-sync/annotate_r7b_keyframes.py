"""Three R7b stills: pre-contact, mid-drag, pre-release with P/G/W and shaft arrow."""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def pick_frames(qc, interaction_path=None):
    per = qc["perFrame"]
    contact_idxs = [r["localFrameIndex"] for r in per if r.get("contact")]
    if not contact_idxs:
        raise SystemExit("no contact frames")
    c0 = min(contact_idxs)
    seg_end = max(contact_idxs)
    pre = None
    if interaction_path and interaction_path.is_file():
        interaction = json.loads(interaction_path.read_text(encoding="utf-8"))
        for row in interaction.get("frames", []):
            if row.get("contact"):
                break
            pre = row["frameIndex"]
    if pre is None:
        pre = c0 - 1 if c0 > 0 else 0
    mid = (c0 + seg_end) // 2
    pre_rel = seg_end
    return [
        ("pre-contact", pre),
        ("mid-drag", mid),
        ("pre-release", pre_rel),
    ]


def draw_marker(d, x, y, color, label):
    d.ellipse((x - 10, y - 10, x + 10, y + 10), outline=color, width=3)
    d.text((x + 12, y - 8), label, fill=color)


def annotate_frame(run, row, label, out_path, sx, sy, font):
    fi = row["localFrameIndex"] + 1
    im = Image.open(run / "render/frames" / f"frame_{fi:04d}.png").convert("RGB")
    im = im.resize((540, 960))
    d = ImageDraw.Draw(im)
    tip = row["measuredTipProjectionPx"]
    grip = row.get("gripProjectionPx")
    wrist = row.get("wristProjectionPx")
    shaft = row.get("shaftFarProjectionPx")
    if tip:
        tx, ty = tip[0] * sx, tip[1] * sy
        draw_marker(d, tx, ty, (255, 50, 50), "P tip")
        if shaft:
            sx2, sy2 = shaft[0] * sx, shaft[1] * sy
            d.line((tx, ty, sx2, sy2), fill=(120, 200, 255), width=3)
            d.text((10, 72), "cyan: shaft toward body", fill=(180, 220, 255), font=font)
    if grip:
        gx, gy = grip[0] * sx, grip[1] * sy
        draw_marker(d, gx, gy, (50, 255, 80), "G grip")
    if wrist:
        wx, wy = wrist[0] * sx, wrist[1] * sy
        draw_marker(d, wx, wy, (255, 220, 50), "W wrist")
    d.text((10, 10), f"{label} local={row['localFrameIndex']}", fill=(255, 255, 0), font=font)
    if tip and grip:
        ok = grip[0] > tip[0] and grip[1] > tip[1]
        d.text(
            (10, 26),
            f"grip-side @270: {'OK' if ok else 'FAIL'} G-P=({grip[0]-tip[0]:.1f},{grip[1]-tip[1]:.1f})",
            fill=(0, 255, 0) if ok else (255, 80, 80),
            font=font,
        )
    im.save(out_path)


def main():
    run = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    qc = json.loads((run / "render/qc-ortho.json").read_text(encoding="utf-8"))
    by_local = {r["localFrameIndex"]: r for r in qc["perFrame"]}
    sx, sy = 540 / 270, 960 / 480
    font = ImageFont.load_default()
    interaction_path = run / "export" / "latest-run.json"
    bundle_hint = None
    if interaction_path.is_file():
        latest = json.loads(interaction_path.read_text(encoding="utf-8"))
        bundle_hint = Path(latest["bundleDir"]) / "interaction.json"
    for label, li in pick_frames(qc, bundle_hint):
        row = by_local[li]
        annotate_frame(run, row, label, out_dir / f"r7b-{label}.png", sx, sy, font)
    print("R7B_KEYFRAMES_OK", out_dir)


if __name__ == "__main__":
    main()
