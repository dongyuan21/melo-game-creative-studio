#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ART="$ROOT/artifacts/bcs-hand-pen"
RUN="$ART/runs/hand-sync-r4"
mkdir -p "$RUN/export" "$RUN/render" "$ART/deliveries"

cd "$ROOT"
export HAND_SYNC_EXPORT_ROOT="artifacts/bcs-hand-pen/runs/hand-sync-r4/export"
HAND_SYNC_EXPORT=1 HAND_SYNC_SCREEN=1 npm test -- tests/handSyncExport.test.ts
BUNDLE="$(node -e "const f=require('fs');const p='$RUN/export/latest-run.json';console.log(JSON.parse(f.readFileSync(p,'utf8')).bundleDir)")"

rm -rf "$RUN/render/frames" "$RUN/render/*-burned-frames"
JOB="$RUN/job.json"
cat > "$JOB" <<EOF
{
  "schema": "melo.hand-sync.job/0.3",
  "mode": "probe-pen",
  "bundleDir": "$BUNDLE",
  "outputDir": "$RUN/render",
  "screenTextureDir": "$BUNDLE/screen",
  "samples": 8,
  "resolution": [270, 480],
  "projectionMaxPxAt1080": 2,
  "projectionP95PxAt1080": 1,
  "contactDistanceMaxM": 0.0005,
  "anchorMeshMaxDeltaM": 0.002,
  "bodyClearanceMinM": -0.0005,
  "areaLightEnergy": 18,
  "viewExposure": 0
}
EOF

export BLENDER_BIN="${BLENDER_BIN:-$(command -v blender)}"
export PYTHONPATH="$ROOT/tools/hand-sync:${PYTHONPATH:-}"

"$BLENDER_BIN" --background --factory-startup --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/render_hand_sync.py" -- --job "$JOB"

BLEND="$RUN/render/probe_pen.blend"
BLEND_SHA="$(python3 -c "import json;print(json.load(open('$RUN/render/solve-meta.json'))['blendSha256'])")"
python3 -c "import json; j=json.load(open('$JOB')); j['blendSha256']='$BLEND_SHA'; json.dump(j, open('$JOB','w'), indent=2); print('job blendSha', '$BLEND_SHA'[:12])"

"$BLENDER_BIN" --background --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/verify_hand_sync.py" -- --job "$JOB" --blend "$BLEND" --out "$RUN/render/qc.json"

export HAND_SYNC_RUN_ROOT="$RUN"
python3 "$ROOT/tools/hand-sync/test_geometry_regression.py"
python3 "$ROOT/tools/hand-sync/test_keyframe_replay.py"

"$BLENDER_BIN" --background --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/render_from_blend.py" -- --job "$JOB" --blend "$BLEND" --expected-blend-sha256 "$BLEND_SHA"

"$BLENDER_BIN" --background --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/render_side_view.py" -- --blend "$BLEND" --out "$ART/deliveries/hand-sync-r4-side-ortho.png" --frame 40

PREV="$ART/deliveries/hand-sync-r4-preview.mp4"
DIAG="$ART/deliveries/hand-sync-r4-diagnostic.mp4"
ffmpeg -y -framerate 30 -i "$RUN/render/frames/frame_%04d.png" \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart -vf "scale=540:960" "$PREV"
python3 "$ROOT/tools/hand-sync/build_diagnostic_video.py" \
  "$RUN/render/qc.json" "$RUN/render/frames" "$DIAG" 30
python3 "$ROOT/tools/hand-sync/verify_frame_label_mapping.py" \
  "$DIAG" "$RUN/render/frame-label-manifest.json"

bash "$ROOT/tools/hand-sync/run-negative-tests.sh"

echo "R4_PIPELINE_OK $PREV $DIAG HEAD=$(git -C "$ROOT" rev-parse HEAD)"
