"""Export M1 evidence: source PNG, screen-only render, screen+pen for key local frames."""
import json
import shutil
import subprocess
import sys
from pathlib import Path

KEY_LOCAL = [0, 8, 12, 19]


def main():
    run = Path(sys.argv[1])
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    job = json.loads((run / "job.json").read_text())
    bundle = Path(job["bundleDir"])
    blender = sys.argv[3] if len(sys.argv) > 3 else "blender"
    root = Path(__file__).resolve().parents[2]

    # screen-only pass
    job_screen = {**job, "outputDir": str(run / "render-screen-only"), "hidePenObjects": True}
    screen_job_path = run / "job-screen-only.json"
    screen_job_path.write_text(json.dumps(job_screen, indent=2) + "\n")
    blend = run / "render" / "probe_pen.blend"
    sha = json.loads((run / "render/solve-meta.json").read_text())["blendSha256"]
    subprocess.check_call(
        [
            blender,
            "--background",
            "--python-exit-code",
            "1",
            "--python",
            str(root / "tools/hand-sync/render_from_blend.py"),
            "--",
            "--job",
            str(screen_job_path),
            "--blend",
            str(blend),
            "--expected-blend-sha256",
            sha,
        ],
        env={**dict(__import__("os").environ), "PYTHONPATH": str(root / "tools/hand-sync")},
    )

    for local in KEY_LOCAL:
        tag = f"F{local:02d}"
        src = bundle / "screen" / f"frame_{local:04d}.png"
        shutil.copy(src, out / f"{tag}_01_bcs_source.png")
        s_only = run / "render-screen-only" / "frames" / f"frame_{local + 1:04d}.png"
        full = run / "render" / "frames" / f"frame_{local + 1:04d}.png"
        shutil.copy(s_only, out / f"{tag}_02_screen_only.png")
        shutil.copy(full, out / f"{tag}_03_screen_plus_pen.png")
    print("M1_KEYFRAMES_OK", out)


if __name__ == "__main__":
    main()
