#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ART="$ROOT/artifacts/bcs-hand-pen"
RUN="$ART/runs/hand-sync"
mkdir -p "$RUN"

cd "$ROOT"
HAND_SYNC_EXPORT=1 npm test -- tests/handSyncExport.test.ts

BUNDLE="$RUN/p1-export/bundle"
JOB="$RUN/job.json"
cat > "$JOB" <<EOF
{
  "schema": "melo.hand-sync.job/0.2",
  "mode": "hand",
  "bundleDir": "$BUNDLE",
  "outputDir": "$RUN/render",
  "samples": 8,
  "resolution": [270, 480]
}
EOF

export BLENDER_BIN="${BLENDER_BIN:-$(command -v blender)}"
"$BLENDER_BIN" --background --factory-startup \
  --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/render_hand_sync.py" -- \
  --job "$JOB" \
  2>&1 | tee "$RUN/render.log"

OUT_MP4="$ART/deliveries/hand-sync-loop-preview.mp4"
ffmpeg -y -framerate 30 -i "$RUN/render/frames/frame_%04d.png" \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart \
  -vf "scale=540:960" \
  "$OUT_MP4"

ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames,duration -of json "$OUT_MP4" \
  > "$ART/deliveries/hand-sync-loop-preview.ffprobe.json"

echo "PIPELINE_OK mp4=$OUT_MP4"
