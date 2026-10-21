"""Swapping two encoded video frames must fail full label verification."""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main():
    run = ROOT / "artifacts/bcs-hand-pen/runs/hand-sync-r6"
    video = ROOT / "artifacts/bcs-hand-pen/deliveries/hand-sync-r6-diagnostic.mp4"
    manifest = run / "render/frame-label-manifest.json"
    if not video.is_file() or not manifest.is_file():
        print("SKIP missing r6 diagnostic or manifest")
        sys.exit(0)
    td = Path(tempfile.mkdtemp())
    good = td / "good.mp4"
    shutil.copy(video, good)
    subprocess.check_call(
        [
            sys.executable,
            str(ROOT / "tools/hand-sync/verify_frame_label_mapping.py"),
            str(good),
            str(manifest),
        ]
    )
    # swap frame 12 and 13 in re-encoded copy via ffmpeg select concat hack
    swapped = td / "swapped.mp4"
    f12 = td / "f12.png"
    f13 = td / "f13.png"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(good),
            "-vf",
            "select=eq(n\\,12)",
            "-vframes",
            "1",
            str(f12),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(good),
            "-vf",
            "select=eq(n\\,13)",
            "-vframes",
            "1",
            str(f13),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    # rebuild all frames: for n!=12,13 extract; inject swapped at 12,13
    frames_dir = td / "frames"
    frames_dir.mkdir()
    for n in range(149):
        out = frames_dir / f"frame_{n:04d}.png"
        src_n = 13 if n == 12 else (12 if n == 13 else n)
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(good),
                "-vf",
                f"select=eq(n\\,{src_n})",
                "-vframes",
                "1",
                str(out),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-framerate",
            "30",
            "-i",
            str(frames_dir / "frame_%04d.png"),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(swapped),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    proc = subprocess.run(
        [sys.executable, str(ROOT / "tools/hand-sync/verify_frame_label_mapping.py"), str(swapped), str(manifest)],
        capture_output=True,
        text=True,
    )
    if proc.returncode == 0:
        print("SWAP_FAIL swapped video still passes label verify")
        sys.exit(1)
    print("SWAP_PASS swapped frames rejected")
    sys.exit(0)


if __name__ == "__main__":
    main()
