#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUN="$ROOT/artifacts/bcs-hand-pen/runs/hand-sync-r3"
JOB="$RUN/job.json"
BLEND="$RUN/render/probe_pen.blend"
OUT="$RUN/negative-results.json"
BLENDER="${BLENDER_BIN:-blender}"
export PYTHONPATH="$ROOT/tools/hand-sync:${PYTHONPATH:-}"

TMP="$(mktemp -d)"
cp "$BLEND" "$TMP/frozen-pen.blend"
"$BLENDER" --background --python "$ROOT/tools/hand-sync/mutate_pen_offset.py" -- "$TMP/frozen-pen.blend" "0.01"

set +e
"$BLENDER" --background --python-exit-code 1 --python "$ROOT/tools/hand-sync/verify_hand_sync.py" -- \
  --job "$JOB" --blend "$TMP/frozen-pen.blend" --out "$TMP/qc.json"
CODE=$?
set -e

QC="$(python3 -c "import json,sys; d=json.load(open('$TMP/qc.json')); print(','.join({e['code'] for e in d.get('errors',[])}))")"
echo "{\"penOffsetExitCode\": $CODE, \"errorCodes\": \"$QC\"}" > "$OUT"
if [[ "$CODE" -eq 0 ]]; then
  echo "NEGATIVE_FAIL pen offset still passes"
  exit 1
fi
if [[ "$QC" != *"CAMERA_PROJECTION_EXCEEDED"* ]]; then
  echo "NEGATIVE_FAIL expected CAMERA_PROJECTION_EXCEEDED got $QC"
  exit 1
fi
echo "NEGATIVE_PASS pen-offset code=$CODE"
