"""Verify decoded diagnostic MP4 frame markers and manifest mapping (no pre-encode PNG shortcut)."""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

KEY_FRAMES = [0, 1, 19, 20, 70, 71, 90, 91, 110, 111, 112, 148]
ALL_FRAMES = list(range(149))


def extract_png(video: Path, frame_index: int, out: Path) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video),
            "-vf",
            f"select=eq(n\\,{frame_index})",
            "-vframes",
            "1",
            str(out),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def read_marker_rgb(png: Path) -> tuple[int, int, int]:
    from PIL import Image

    im = Image.open(png).convert("RGB")
    return im.getpixel((2, 2))


def ffprobe_frame_count(video: Path) -> int:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-count_packets",
            "-show_entries",
            "stream=nb_read_packets",
            "-of",
            "csv=p=0",
            str(video),
        ],
        text=True,
    ).strip()
    return int(out)


def main():
    video = Path(sys.argv[1])
    manifest_path = Path(sys.argv[2])
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))["frames"]
    by_video_idx = {m["videoFrameIndex"]: m for m in manifest}
    n_manifest = len(manifest)
    n_video = ffprobe_frame_count(video)
    if n_video != n_manifest:
        print(f"LABEL_VERIFY_FAIL frame count video={n_video} manifest={n_manifest}")
        sys.exit(1)
    failures = []
    with tempfile.TemporaryDirectory() as td:
        for fi in ALL_FRAMES:
            if fi not in by_video_idx:
                failures.append(f"missing manifest entry {fi}")
                continue
            row = by_video_idx[fi]
            expected_rgb = tuple(row.get("frameMarkerRgb") or [])
            if len(expected_rgb) != 3:
                failures.append(f"no frame marker for {fi}")
                continue
            png = Path(td) / f"f{fi}.png"
            extract_png(video, fi, png)
            actual = read_marker_rgb(png)
            if any(abs(int(a) - int(e)) > 18 for a, e in zip(actual, expected_rgb, strict=True)):
                failures.append(f"frame {fi} marker {actual} != {expected_rgb} local={row['localFrameIndex']}")
    if failures:
        print("LABEL_VERIFY_FAIL", failures)
        sys.exit(1)
    print("LABEL_VERIFY_PASS all", n_video, "keyframes", KEY_FRAMES)
    sys.exit(0)


if __name__ == "__main__":
    main()
