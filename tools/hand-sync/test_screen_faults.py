"""Screen loader fault matrix (fail-closed)."""
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/hand-sync"))
from screen_load import load_frame, sha256_file, validate_manifest


def main():
    run = Path(os.environ.get("HAND_SYNC_RUN_ROOT", ROOT / "artifacts/bcs-hand-pen/runs/hand-sync-r6"))
    bundle = Path(json.loads((run / "job.json").read_text())["bundleDir"])
    manifest = json.loads((bundle / "screen-manifest.json").read_text())
    interaction = json.loads((bundle / "interaction.json").read_text())
    validate_manifest(manifest, interaction)

    td = Path(tempfile.mkdtemp())
    shutil.copytree(bundle / "screen", td / "screen")
    bad_manifest = json.loads(json.dumps(manifest))
    # swap two frame files on disk but keep manifest hashes -> must fail
    f0 = td / "screen/frame_0000.png"
    f1 = td / "screen/frame_0001.png"
    shutil.copy(f1, td / "screen/_tmp.png")
    shutil.copy(f0, f1)
    shutil.copy(td / "screen/_tmp.png", f0)
    try:
        load_frame(0, bad_manifest, td)
        print("FAULT_FAIL swap not detected")
        sys.exit(1)
    except ValueError:
        pass

    dup = json.loads(json.dumps(manifest))
    dup["frames"].append(dict(dup["frames"][0]))
    try:
        validate_manifest(dup, interaction)
        print("FAULT_FAIL duplicate local not detected")
        sys.exit(1)
    except ValueError:
        pass

    missing = json.loads(json.dumps(manifest))
    missing["frames"][5]["sha256"] = "0" * 64
    try:
        load_frame(5, missing, bundle)
        print("FAULT_FAIL bad hash not detected")
        sys.exit(1)
    except ValueError:
        pass

    print("FAULT_PASS screen loader matrix")
    sys.exit(0)


if __name__ == "__main__":
    main()
