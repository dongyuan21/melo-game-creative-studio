"""Burn per-frame QC lines into diagnostic mp4."""
import json
import subprocess
import sys
import tempfile
from pathlib import Path


def main():
    qc_path, frames_dir, out_mp4, fps = sys.argv[1], Path(sys.argv[2]), sys.argv[3], float(sys.argv[4])
    qc = json.loads(Path(qc_path).read_text())
    srt = Path(tempfile.mkdtemp()) / "diag.srt"
    with srt.open("w") as f:
        for i, row in enumerate(qc["perFrame"]):
            start = i / fps
            end = (i + 1) / fps
            def ts(t):
                h = int(t // 3600)
                m = int((t % 3600) // 60)
                s = int(t % 60)
                ms = int((t - int(t)) * 1000)
                return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
            txt = (
                f"f={row['localFrameIndex']} src={row.get('sourceFrameIndex')} "
                f"act={row.get('actionId')} c={row.get('contact')} "
                f"err1080={row['cameraProjectionErrorPxAt1080Ref']:.3f} "
                f"plane={row['signedPlaneDistanceM']:.5f}"
            )
            f.write(f"{i + 1}\n{ts(start)} --> {ts(end)}\n{txt}\n\n")
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-framerate",
            str(fps),
            "-i",
            str(frames_dir / "frame_%04d.png"),
            "-vf",
            f"subtitles={srt}:force_style='FontSize=14',scale=540:960",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            out_mp4,
        ]
    )


if __name__ == "__main__":
    main()
