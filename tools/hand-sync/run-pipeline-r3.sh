#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ART="$ROOT/artifacts/bcs-hand-pen"
RUN="$ART/runs/hand-sync-r3"
mkdir -p "$RUN/export" "$RUN/render"

cd "$ROOT"
HAND_SYNC_EXPORT=1 HAND_SYNC_SCREEN=1 npm test -- tests/handSyncExport.test.ts
BUNDLE="$(node -e "const f=require('fs');const p='$RUN/export/latest-run.json';console.log(JSON.parse(f.readFileSync(p,'utf8')).bundleDir)")"

JOB="$RUN/job.json"
cat > "$JOB" <<EOF
{
  "schema": "melo.hand-sync.job/0.2",
  "mode": "probe-pen",
  "bundleDir": "$BUNDLE",
  "outputDir": "$RUN/render",
  "screenTextureDir": "$BUNDLE/screen",
  "samples": 8,
  "resolution": [270, 480],
  "projectionMaxPxAt1080": 2,
  "projectionP95PxAt1080": 1,
  "contactDistanceMaxM": 0.0005
}
EOF

export BLENDER_BIN="${BLENDER_BIN:-$(command -v blender)}"
export PYTHONPATH="$ROOT/tools/hand-sync:${PYTHONPATH:-}"

"$BLENDER_BIN" --background --factory-startup --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/render_hand_sync.py" -- --job "$JOB"

BLEND="$RUN/render/probe_pen.blend"
"$BLENDER_BIN" --background --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/verify_hand_sync.py" -- --job "$JOB" --blend "$BLEND" --out "$RUN/render/qc.json"

python3 "$ROOT/tools/hand-sync/test_geometry_regression.py"
python3 "$ROOT/tools/hand-sync/test_keyframe_replay.py"

"$BLENDER_BIN" --background --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/render_from_blend.py" -- --job "$JOB" --blend "$BLEND"

PREV="$ART/deliveries/hand-sync-r3-preview.mp4"
DIAG="$ART/deliveries/hand-sync-r3-diagnostic.mp4"
ffmpeg -y -framerate 30 -i "$RUN/render/frames/frame_%04d.png" \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart -vf "scale=540:960" "$PREV"
python3 "$ROOT/tools/hand-sync/build_diagnostic_video.py" \
  "$RUN/render/qc.json" "$RUN/render/frames" "$DIAG" 30

bash "$ROOT/tools/hand-sync/run-negative-tests.sh"

echo "R3_PIPELINE_OK $PREV"
