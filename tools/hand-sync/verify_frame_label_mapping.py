"""Compare decoded diagnostic video frames to pre-encode label strip hashes."""
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

KEY_FRAMES = [0, 1, 19, 20, 70, 71, 90, 91, 110, 111, 112, 148]


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


def strip_hash(png: Path) -> str:
    from PIL import Image

    im = Image.open(png).convert("RGB")
    w, h = im.size
    strip = im.crop((0, h - 40, w, h))
    return hashlib.sha256(strip.tobytes()).hexdigest()


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
    burned_dir = video.parent / (video.stem + "-burned-frames")
    failures = []
    with tempfile.TemporaryDirectory() as td:
        for fi in KEY_FRAMES:
            if fi not in by_video_idx:
                failures.append(f"missing manifest entry {fi}")
                continue
            row = by_video_idx[fi]
            expected = row.get("labelStripSha256")
            if not expected:
                failures.append(f"no strip hash for {fi}")
                continue
            pre = burned_dir / f"frame_{fi + 1:04d}.png"
            if pre.is_file():
                actual = strip_hash(pre)
            else:
                png = Path(td) / f"f{fi}.png"
                extract_png(video, fi, png)
                actual = strip_hash(png)
            if actual != expected:
                failures.append(f"frame {fi} hash mismatch local={row['localFrameIndex']}")
    if failures:
        print("LABEL_VERIFY_FAIL", failures)
        sys.exit(1)
    print("LABEL_VERIFY_PASS", KEY_FRAMES, f"frames={n_video}")
    sys.exit(0)


if __name__ == "__main__":
    main()
