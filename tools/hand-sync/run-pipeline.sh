#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ART="$ROOT/artifacts/bcs-hand-pen"
RUN="$ART/runs/hand-sync-v2"
mkdir -p "$RUN"

cd "$ROOT"
HAND_SYNC_EXPORT=1 HAND_SYNC_SCREEN=1 npm test -- tests/handSyncExport.test.ts

BUNDLE="$(find "$ART/runs/hand-sync-v2/export" -path '*/bundle/interaction.json' 2>/dev/null | head -1 | xargs dirname)"
if [[ ! -f "$BUNDLE/interaction.json" ]]; then
  echo "missing bundle"
  exit 1
fi

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
  "projectionMaxPxAt1080": 2
}
EOF

export BLENDER_BIN="${BLENDER_BIN:-$(command -v blender)}"
export PYTHONPATH="$ROOT/tools/hand-sync:${PYTHONPATH:-}"

"$BLENDER_BIN" --background --factory-startup \
  --python-exit-code 1 --python "$ROOT/tools/hand-sync/render_hand_sync.py" -- \
  --job "$JOB" --solve-only

BLEND="$RUN/render/probe_pen.blend"
"$BLENDER_BIN" --background --python-exit-code 1 --python "$ROOT/tools/hand-sync/verify_hand_sync.py" -- \
  --job "$JOB" --blend "$BLEND" --out "$RUN/render/qc.json"

python3 "$ROOT/tools/hand-sync/test_keyframe_replay.py"

"$BLENDER_BIN" --background --factory-startup \
  --python-exit-code 1 --python "$ROOT/tools/hand-sync/render_hand_sync.py" -- \
  --job "$JOB"

OUT_MP4="$ART/deliveries/hand-sync-aligned-preview.mp4"
DIAG_MP4="$ART/deliveries/hand-sync-aligned-diagnostic.mp4"
ffmpeg -y -framerate 30 -i "$RUN/render/frames/frame_%04d.png" \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart -vf "scale=540:960" "$OUT_MP4"

python3 - <<'PY' "$RUN/render/qc.json" "$DIAG_MP4" "$OUT_MP4"
import json, subprocess, sys
qc = json.load(open(sys.argv[1]))
row = qc["perFrame"][len(qc["perFrame"])//2]
label = f"f={row['frameIndex']} act={row.get('actionId')} errPx={row['projectionErrorPx']:.2f}"
subprocess.check_call([
  "ffmpeg","-y","-i",sys.argv[3],
  "-vf",f"drawtext=text='{label}':fontsize=16:fontcolor=white:x=8:y=8:box=1:boxcolor=black@0.5",
  "-c:v","libx264","-pix_fmt","yuv420p","-movflags","+faststart",sys.argv[2],
])
PY

echo "PIPELINE_OK $OUT_MP4"
