"""Export R8a review stills (composite frames + grip closeup + side oblique)."""
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def run_blender_render(job: dict, blend: Path, frame: int, out_png: Path, overrides: dict | None = None):
    job_path = out_png.parent / f"_job_f{frame}.json"
    j = {**job, **(overrides or {}), "samples": overrides.get("samples", 24) if overrides else 24}
    j["outputDir"] = str(out_png.parent / f"_render_f{frame}")
    j["renderFrameStart"] = frame
    j["renderFrameEnd"] = frame
    job_path.write_text(json.dumps(j, indent=2) + "\n", encoding="utf-8")
    out_dir = Path(j["outputDir"])
    out_dir.mkdir(parents=True, exist_ok=True)
    blend_sha = json.loads((blend.parent / "solve-meta.json").read_text())["blendSha256"]
    env = {**dict(__import__("os").environ), "PYTHONPATH": str(ROOT / "tools/hand-sync")}
    blender = __import__("os").environ.get("BLENDER_BIN", "blender")
    proc = subprocess.run(
        [
            blender,
            "--background",
            "--python-exit-code",
            "1",
            "--python",
            str(ROOT / "tools/hand-sync/render_from_blend.py"),
            "--",
            "--job",
            str(job_path),
            "--blend",
            str(blend),
            "--expected-blend-sha256",
            blend_sha,
        ],
        capture_output=True,
        text=True,
        env=env,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr or proc.stdout)
    src = out_dir / "frames" / f"frame_{frame:04d}.png"
    if not src.is_file():
        frames = sorted(out_dir.glob("frames/frame_*.png"))
        src = frames[0] if frames else src
    shutil.copy(src, out_png)


def main():
    run_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "artifacts/bcs-hand-pen/runs/hand-sync-r8a"
    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "artifacts/bcs-hand-pen/deliveries/r8a-stills"
    job = json.loads((run_dir / "job.json").read_text(encoding="utf-8"))
    blend = run_dir / "render/probe_pen.blend"
    out_dir.mkdir(parents=True, exist_ok=True)

    for local in (18, 30, 41, 42, 43):
        run_blender_render(job, blend, local, out_dir / f"F{local:02d}_composite.png")

    closeup = {
        "orthographicCamera": True,
        "orthoScaleMul": 0.42,
        "resolution": [360, 640],
        "viewExposure": -0.55,
    }
    run_blender_render(job, blend, 30, out_dir / "F30_grip_closeup.png", closeup)

    side = {
        "cameraProfile": "perspective-oblique",
        "orthographicCamera": False,
        "resolution": [360, 640],
        "cameraLocation": [0.068, -0.088, 0.34],
        "cameraLensMm": 28,
        "viewExposure": -0.55,
    }
    run_blender_render(job, blend, 30, out_dir / "F30_side_oblique.png", side)

    meta = {
        "schema": "melo.hand-sync.r8a-stills/0.1",
        "frames": ["F18", "F30", "F41", "F42", "F43"],
        "extras": ["F30_grip_closeup", "F30_side_oblique"],
        "note": "Composite hand+pen+BCS; not BCS-only screen captures.",
    }
    (out_dir / "manifest.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"R8A_STILLS_OK {out_dir}")


if __name__ == "__main__":
    main()
