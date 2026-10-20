"""R5 normal blend must FAIL new actual-tip / penetration checks (documents fixed blind spot)."""
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
R5_BLEND = ROOT / "artifacts/bcs-hand-pen/runs/hand-sync-r5/render/probe_pen.blend"
R5_JOB = ROOT / "artifacts/bcs-hand-pen/runs/hand-sync-r5/job.json"
BLENDER = os.environ.get("BLENDER_BIN", "blender")


def main():
    if not R5_BLEND.is_file() or not R5_JOB.is_file():
        print("SKIP no r5 baseline blend")
        sys.exit(0)
    out = R5_BLEND.parent / "qc_r5_regression.json"
    proc = subprocess.run(
        [
            BLENDER,
            "--background",
            "--python-exit-code",
            "1",
            "--python",
            str(ROOT / "tools/hand-sync/verify_hand_sync.py"),
            "--",
            "--job",
            str(R5_JOB),
            "--blend",
            str(R5_BLEND),
            "--out",
            str(out),
        ],
        capture_output=True,
        text=True,
        env={**os.environ, "PYTHONPATH": str(ROOT / "tools/hand-sync")},
    )
    if proc.returncode == 0:
        print("REGRESSION_FAIL r5 blend still passes new verify")
        sys.exit(1)
    qc = json.loads(out.read_text()) if out.is_file() else {}
    codes = {e.get("code") for e in qc.get("errors", [])}
    if not codes.intersection({"ACTUAL_TIP_CONTACT", "BODY_CLEARANCE", "ANCHOR_MESH_MISMATCH"}):
        print("REGRESSION_FAIL r5 blend failed but not for geometry", codes)
        sys.exit(1)
    print("REGRESSION_PASS r5 blend rejected by new checks", codes)
    sys.exit(0)


if __name__ == "__main__":
    main()
