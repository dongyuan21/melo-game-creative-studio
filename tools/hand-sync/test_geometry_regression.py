"""A1: offset Pen mesh only — verify must FAIL with PEN/CAMERA errors."""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JOB = ROOT / "artifacts/bcs-hand-pen/runs/hand-sync-r3/job.json"
BLEND = ROOT / "artifacts/bcs-hand-pen/runs/hand-sync-r3/render/probe_pen.blend"


def run_verify(blend_path: Path) -> tuple[int, dict]:
    out = blend_path.parent / "qc_mutate.json"
    proc = subprocess.run(
        [
            "blender",
            "--background",
            "--python-exit-code",
            "1",
            "--python",
            str(ROOT / "tools/hand-sync/verify_hand_sync.py"),
            "--",
            "--job",
            str(JOB),
            "--blend",
            str(blend_path),
            "--out",
            str(out),
        ],
        capture_output=True,
        text=True,
    )
    qc = json.loads(out.read_text()) if out.is_file() else {}
    return proc.returncode, qc


def main():
    if not BLEND.is_file():
        print("SKIP missing baseline blend")
        sys.exit(0)
    td = Path(tempfile.mkdtemp())
    mutant = td / "mutant.blend"
    shutil.copy(BLEND, mutant)
    subprocess.check_call(
        ["blender", "--background", "--python", str(ROOT / "tools/hand-sync/mutate_pen_offset.py"), "--", str(mutant), "0.01"]
    )
    code, qc = run_verify(mutant)
    if code == 0:
        print("REGRESSION_FAIL pen offset still PASS")
        sys.exit(1)
    codes = {e.get("code") for e in qc.get("errors", [])}
    if not codes.intersection({"CAMERA_PROJECTION_EXCEEDED", "CONTACT_PLANE_DISTANCE"}):
        print("REGRESSION_FAIL unexpected error codes", codes)
        sys.exit(1)
    print("REGRESSION_PASS pen-offset detected", codes)
    sys.exit(0)


if __name__ == "__main__":
    main()
