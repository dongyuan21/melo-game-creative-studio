"""Burn per-frame QC text into PNGs then encode (no SRT frame-slip)."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    Image = None


def label_lines_for_row(row: dict) -> list[str]:
    bc = row.get("bodyClearanceMinSignedM")
    bc_s = f"{bc:.5f}" if bc is not None else "na"
    ad = row.get("anchorMeshDeltaM")
    ad_s = f"{ad:.6f}" if ad is not None else "na"
    bcs = row.get("bcsPointerRenderPx")
    tip = row.get("measuredTipProjectionPx")
    reg = row.get("screenRegistrationErrorPxAt1080Ref")
    bcs_s = f"({bcs[0]:.1f},{bcs[1]:.1f})" if bcs else "na"
    tip_s = f"({tip[0]:.1f},{tip[1]:.1f})" if tip else "na"
    if bcs is None or tip is None or reg is None:
        reg_s = "na"
    else:
        reg_s = f"{float(reg):.3f}"
    mesh = row.get("meshTipSignedPlaneDistanceM")
    mesh_s = f"{mesh:.5f}" if mesh is not None else "na"
    return [
        f"f={row['localFrameIndex']} src={row.get('sourceFrameIndex')} c={row.get('contact')}",
        f"A bcs {bcs_s}  B tip {tip_s}",
        f"reg1080={reg_s} meshPlane={mesh_s}",
        f"body={bc_s} anch={ad_s}",
    ]


def burn_frames(qc_path: Path, frames_dir: Path, out_dir: Path) -> list[dict]:
    qc = json.loads(qc_path.read_text(encoding="utf-8"))
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = []
    if Image is None:
        raise RuntimeError("PIL required for diagnostic burn-in")
    font = ImageFont.load_default()
    for i, row in enumerate(qc["perFrame"]):
        src = frames_dir / f"frame_{i + 1:04d}.png"
        if not src.is_file():
            raise FileNotFoundError(src)
        lines = label_lines_for_row(row)
        im = Image.open(src).convert("RGBA")
        draw = ImageDraw.Draw(im)
        panel_h = 14 * len(lines) + 8
        draw.rectangle((0, im.height - panel_h, im.width, im.height), fill=(0, 0, 0, 200))
        y = im.height - panel_h + 4
        for line in lines:
            draw.text((4, y), line, fill=(255, 255, 255, 255), font=font)
            y += 14
        # frame index marker for decoded-video verification (top-left)
        fi = int(row["localFrameIndex"])
        draw.rectangle((0, 0, 8, 8), fill=((fi * 37) % 256, (fi * 91) % 256, (fi * 53) % 256, 255))
        dst = out_dir / f"frame_{i + 1:04d}.png"
        im_rgb = im.convert("RGB")
        im_rgb.save(dst)
        strip = im_rgb.crop((0, im_rgb.height - 40, im_rgb.width, im_rgb.height))
        strip_bytes = strip.tobytes()
        manifest.append(
            {
                "videoFrameIndex": i,
                "blenderFrame": i + 1,
                "localFrameIndex": row["localFrameIndex"],
                "sourceFrameIndex": row.get("sourceFrameIndex"),
                "label": "\n".join(lines),
                "frameMarkerRgb": [(fi * 37) % 256, (fi * 91) % 256, (fi * 53) % 256],
                "labelStripSha256": hashlib.sha256(strip_bytes).hexdigest(),
            }
        )
    return manifest


def main():
    qc_path, frames_dir, out_mp4, fps = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), float(sys.argv[4])
    diag_dir = out_mp4.parent / (out_mp4.stem + "-burned-frames")
    manifest = burn_frames(qc_path, frames_dir, diag_dir)
    manifest_path = frames_dir.parent / "frame-label-manifest.json"
    manifest_path.write_text(json.dumps({"frames": manifest}, indent=2) + "\n", encoding="utf-8")
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-framerate",
            str(fps),
            "-i",
            str(diag_dir / "frame_%04d.png"),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-vf",
            "scale=540:960",
            str(out_mp4),
        ]
    )


if __name__ == "__main__":
    main()
