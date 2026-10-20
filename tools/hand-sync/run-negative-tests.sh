#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUN="${HAND_SYNC_RUN_ROOT:-$ROOT/artifacts/bcs-hand-pen/runs/hand-sync-r4}"
JOB="$RUN/job.json"
BLEND="$RUN/render/probe_pen.blend"
OUT="$RUN/negative-results.json"
BLENDER="${BLENDER_BIN:-blender}"
export PYTHONPATH="$ROOT/tools/hand-sync:${PYTHONPATH:-}"

TMP="$(mktemp -d)"

run_case() {
  local name="$1"
  local script="$2"
  local extra="${3:-}"
  local blend_copy="$TMP/$name.blend"
  cp "$BLEND" "$blend_copy"
  if [[ -n "$extra" ]]; then
    "$BLENDER" --background --python "$script" -- "$blend_copy" "$extra"
  else
    "$BLENDER" --background --python "$script" -- "$blend_copy"
  fi
  set +e
  "$BLENDER" --background --python-exit-code 1 --python "$ROOT/tools/hand-sync/verify_hand_sync.py" -- \
    --job "$JOB" --blend "$blend_copy" --out "$TMP/qc-$name.json"
  local code=$?
  set -e
  python3 -c "
import json
from pathlib import Path
d=json.loads(Path('$TMP/qc-$name.json').read_text())
out={'exit': $code, 'codes': sorted({e['code'] for e in d.get('errors',[])})}
Path('$TMP/$name-meta.json').write_text(json.dumps(out))
"
  if [[ "$code" -eq 0 ]]; then
    echo "NEGATIVE_FAIL $name still passes"
    exit 1
  fi
}

run_case "pen-offset-10mm" "$ROOT/tools/hand-sync/mutate_pen_offset.py" "0.01"
run_case "pen-vertex-only" "$ROOT/tools/hand-sync/mutate_pen_vertex.py" ""
run_case "pen-body-through" "$ROOT/tools/hand-sync/mutate_pen_body_through.py" ""

python3 - <<PY
import json
from pathlib import Path
tmp = Path("$TMP")
out = {}
for name in ("pen-offset-10mm", "pen-vertex-only", "pen-body-through"):
    out[name] = json.loads((tmp / f"{name}-meta.json").read_text())
Path("$OUT").write_text(json.dumps(out, indent=2) + "\n")
PY

OFF_CODES="$(python3 -c "import json; print(','.join(json.load(open('$TMP/pen-offset-10mm-meta.json'))['codes']))")"
if [[ "$OFF_CODES" != *"CAMERA_PROJECTION_EXCEEDED"* ]]; then
  echo "NEGATIVE_FAIL pen-offset expected CAMERA_PROJECTION_EXCEEDED got $OFF_CODES"
  exit 1
fi
VERT_CODES="$(python3 -c "import json; print(','.join(json.load(open('$TMP/pen-vertex-only-meta.json'))['codes']))")"
if [[ "$VERT_CODES" != *"ANCHOR_MESH_MISMATCH"* && "$VERT_CODES" != *"CAMERA_PROJECTION_EXCEEDED"* ]]; then
  echo "NEGATIVE_FAIL vertex-only got $VERT_CODES"
  exit 1
fi
BODY_CODES="$(python3 -c "import json; print(','.join(json.load(open('$TMP/pen-body-through-meta.json'))['codes']))")"
if [[ "$BODY_CODES" != *"BODY_CLEARANCE"* ]]; then
  echo "NEGATIVE_FAIL body-through expected BODY_CLEARANCE got $BODY_CODES"
  exit 1
fi
echo "NEGATIVE_PASS all three geometry faults"
