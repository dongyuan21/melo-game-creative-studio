#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUN="$ROOT/artifacts/bcs-hand-pen/runs/hand-sync-v2"
JOB="$RUN/job.json"
BLEND="$RUN/render/probe_pen.blend"
OUT="$RUN/negative-results.json"
BLENDER="${BLENDER_BIN:-blender}"
export PYTHONPATH="$ROOT/tools/hand-sync:${PYTHONPATH:-}"

TMP="$(mktemp -d)"
cp "$BLEND" "$TMP/frozen.blend"
"$BLENDER" --background --python "$ROOT/tools/hand-sync/mutate_freeze_tip.py" -- "$TMP/frozen.blend"

set +e
"$BLENDER" --background --python-exit-code 1 --python "$ROOT/tools/hand-sync/verify_hand_sync.py" -- \
  --job "$JOB" --blend "$TMP/frozen.blend" --out "$TMP/qc.json"
CODE=$?
set -e

echo "{\"frozenTipExitCode\": $CODE}" > "$OUT"
if [[ "$CODE" -eq 0 ]]; then
  echo "NEGATIVE_FAIL frozen-tip should not PASS verify"
  exit 1
fi
echo "NEGATIVE_PASS frozen-tip exit=$CODE"
