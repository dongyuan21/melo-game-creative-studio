#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ART="$ROOT/artifacts/bcs-hand-pen"
RUN="$ART/runs/hand-sync-r7"
mkdir -p "$RUN/export" "$RUN/render" "$RUN/render-persp" "$ART/deliveries"

cd "$ROOT"
export HAND_SYNC_EXPORT_ROOT="artifacts/bcs-hand-pen/runs/hand-sync-r7/export"
HAND_SYNC_EXPORT=1 HAND_SYNC_SCREEN=1 npm test -- tests/handSyncExport.test.ts tests/handSyncLayout.test.ts tests/handSyncInteraction.test.ts
BUNDLE="$(node -e "const f=require('fs');const p='$RUN/export/latest-run.json';console.log(JSON.parse(f.readFileSync(p,'utf8')).bundleDir)")"

python3 "$ROOT/tools/hand-sync/verify_game_interaction.py" "$BUNDLE"

rm -rf "$RUN/render/frames" "$RUN/render-persp/frames"
JOB="$RUN/job.json"
cat > "$JOB" <<EOF
{
  "schema": "melo.hand-sync.job/0.6",
  "mode": "probe-pen",
  "bundleDir": "$BUNDLE",
  "outputDir": "$RUN/render",
  "screenTextureDir": "$BUNDLE/screen",
  "samples": 8,
  "resolution": [270, 480],
  "cameraProfile": "orthographic-test",
  "screenRegistrationMaxPxAt1080": 2,
  "screenRegistrationP95PxAt1080": 1,
  "contactDistanceMaxM": 0.0005,
  "anchorMeshMaxDeltaM": 0.0002,
  "bodyClearanceMinM": -0.0001,
  "orthographicCamera": true
}
EOF

export BLENDER_BIN="${BLENDER_BIN:-$(command -v blender)}"
export PYTHONPATH="$ROOT/tools/hand-sync:${PYTHONPATH:-}"
export HAND_SYNC_RUN_ROOT="$RUN"

python3 "$ROOT/tools/hand-sync/test_r5_blend_regression.py"

"$BLENDER_BIN" --background --factory-startup --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/render_hand_sync.py" -- --job "$JOB"

BLEND="$RUN/render/probe_pen.blend"
BLEND_SHA="$(python3 -c "import json;print(json.load(open('$RUN/render/solve-meta.json'))['blendSha256'])")"
python3 -c "import json; j=json.load(open('$JOB')); j['blendSha256']='$BLEND_SHA'; json.dump(j, open('$JOB','w'), indent=2)"

"$BLENDER_BIN" --background --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/verify_hand_sync.py" -- --job "$JOB" --blend "$BLEND" --out "$RUN/render/qc-ortho.json"
cp "$RUN/render/qc-ortho.json" "$RUN/render/qc.json"

python3 "$ROOT/tools/hand-sync/test_geometry_regression.py"
python3 "$ROOT/tools/hand-sync/test_keyframe_replay.py"
python3 "$ROOT/tools/hand-sync/test_screen_faults.py"
python3 "$ROOT/tools/hand-sync/test_screen_proxy_registration.py"

"$BLENDER_BIN" --background --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/render_from_blend.py" -- --job "$JOB" --blend "$BLEND" --expected-blend-sha256 "$BLEND_SHA"

JOB_P="$RUN/job-perspective.json"
python3 - <<PY
import json
j=json.load(open("$JOB"))
j.update({
  "outputDir": "$RUN/render-persp",
  "cameraProfile": "perspective-oblique",
  "orthographicCamera": False,
  "screenRegistrationMaxPxAt1080": 3.5,
  "screenRegistrationP95PxAt1080": 2.5,
})
json.dump(j, open("$JOB_P","w"), indent=2)
PY

"$BLENDER_BIN" --background --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/render_from_blend.py" -- --job "$JOB_P" --blend "$BLEND" --expected-blend-sha256 "$BLEND_SHA"

"$BLENDER_BIN" --background --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/verify_hand_sync.py" -- --job "$JOB_P" --blend "$BLEND" --out "$RUN/render-persp/qc.json"

PREV_O="$ART/deliveries/hand-sync-r7-preview-ortho.mp4"
PREV_P="$ART/deliveries/hand-sync-r7-preview-perspective.mp4"
ffmpeg -y -framerate 30 -i "$RUN/render/frames/frame_%04d.png" \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart -vf "scale=540:960" "$PREV_O"
ffmpeg -y -framerate 30 -i "$RUN/render-persp/frames/frame_%04d.png" \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart -vf "scale=540:960" "$PREV_P"

python3 "$ROOT/tools/hand-sync/build_diagnostic_video.py" \
  "$RUN/render/qc.json" "$RUN/render/frames" "$ART/deliveries/hand-sync-r7-diagnostic-ortho.mp4" 30

bash "$ROOT/tools/hand-sync/run-negative-tests.sh"

echo "R7_PIPELINE_OK ortho=$PREV_O persp=$PREV_P"
