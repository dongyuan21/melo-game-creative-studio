#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ART="$ROOT/artifacts/bcs-hand-pen"
RUN="$ART/runs/e0"
mkdir -p "$RUN/blender-smoke" "$RUN/logs"

export BLENDER_BIN="${BLENDER_BIN:-$(command -v blender)}"
echo "BLENDER_BIN=$BLENDER_BIN" | tee "$RUN/logs/blender-path.txt"
"$BLENDER_BIN" --version | tee "$RUN/logs/blender-version.txt"

"$BLENDER_BIN" --background --factory-startup \
  --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/blender_smoke.py" -- \
  --out-dir "$RUN/blender-smoke" \
  2>&1 | tee "$RUN/logs/blender-smoke.log"

test -s "$RUN/blender-smoke/smoke.png"
test -s "$RUN/blender-smoke/smoke.blend"
echo "E0_BLENDER_SMOKE=PASS"
