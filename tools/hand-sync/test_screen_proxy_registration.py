"""Screen proxy offset vs frozen layout must fail SCREEN_REGISTRATION / proxy layout check."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUN = Path(os.environ.get("HAND_SYNC_RUN_ROOT", ROOT / "artifacts/bcs-hand-pen/runs/hand-sync-r6"))
JOB = RUN / "job.json"
BLEND = RUN / "render/probe_pen.blend"
BLENDER = os.environ.get("BLENDER_BIN", "blender")


def main():
    if not BLEND.is_file():
        print("SKIP missing baseline blend")
        sys.exit(0)
    td = Path(tempfile.mkdtemp())
    mutant = td / "screen-offset.blend"
    shutil.copy(BLEND, mutant)
    subprocess.check_call(
        [
            BLENDER,
            "--background",
            "--python",
            str(ROOT / "tools/hand-sync/mutate_screen_proxy_offset.py"),
            "--",
            str(mutant),
            "0.015",
        ]
    )
    out = td / "qc.json"
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
            str(JOB),
            "--blend",
            str(mutant),
            "--out",
            str(out),
        ],
        capture_output=True,
        text=True,
        env={**os.environ, "PYTHONPATH": str(ROOT / "tools/hand-sync")},
    )
    if proc.returncode == 0:
        print("SCREEN_REG_FAIL offset blend still PASS")
        sys.exit(1)
    qc = json.loads(out.read_text()) if out.is_file() else {}
    codes = {e.get("code") for e in qc.get("errors", [])}
    if "SCREEN_REGISTRATION" not in codes and "SCREEN_PROXY_LAYOUT" not in codes:
        print("SCREEN_REG_FAIL unexpected codes", codes)
        sys.exit(1)
    print("SCREEN_REG_PASS proxy offset rejected", codes)
    sys.exit(0)


if __name__ == "__main__":
    main()
