#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ART="$ROOT/artifacts/bcs-hand-pen"
RUN="$ART/runs/hand-sync-r7e"
mkdir -p "$RUN/export" "$RUN/render" "$ART/deliveries/r7e-bcs-evidence"

cd "$ROOT"
export HAND_SYNC_EXPORT_ROOT="artifacts/bcs-hand-pen/runs/hand-sync-r7e/export"
HAND_SYNC_EXPORT=1 HAND_SYNC_SCREEN=1 npm test -- \
  tests/handSyncExport.test.ts tests/handSyncLayout.test.ts tests/handSyncInteraction.test.ts \
  tests/referenceLegalTake.test.ts tests/referenceHitTest.test.ts
BUNDLE="$(node -e "const f=require('fs');const p='$RUN/export/latest-run.json';console.log(JSON.parse(f.readFileSync(p,'utf8')).bundleDir)")"

python3 "$ROOT/tools/hand-sync/verify_game_interaction.py" "$BUNDLE"
npx tsx "$ROOT/tools/hand-sync/verify_touch_hit_chain.ts" "$BUNDLE" "$RUN/touch-hit-chain.json"
python3 "$ROOT/tools/hand-sync/verify_gameplay_chain.py" "$BUNDLE" "$RUN/gameplay-chain.json"
python3 "$ROOT/tools/hand-sync/report_motion_direction.py" "$BUNDLE" | tee "$RUN/motion-direction.json"

rm -rf "$RUN/render/frames"
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
  "orthographicCamera": true
}
EOF

export BLENDER_BIN="${BLENDER_BIN:-$(command -v blender)}"
export PYTHONPATH="$ROOT/tools/hand-sync:${PYTHONPATH:-}"
export HAND_SYNC_RUN_ROOT="$RUN"

"$BLENDER_BIN" --background --factory-startup --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/render_hand_sync.py" -- --job "$JOB"

BLEND_SHA="$(python3 -c "import json;print(json.load(open('$RUN/render/solve-meta.json'))['blendSha256'])")"
python3 -c "import json; j=json.load(open('$JOB')); j['blendSha256']='$BLEND_SHA'; json.dump(j, open('$JOB','w'), indent=2)"

"$BLENDER_BIN" --background --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/verify_hand_sync.py" -- --job "$JOB" --blend "$RUN/render/probe_pen.blend" --out "$RUN/render/qc-ortho.json"

python3 "$ROOT/tools/hand-sync/verify_grip_side.py" "$RUN/render/qc-ortho.json" "$RUN/grip-side.json"
python3 "$ROOT/tools/hand-sync/test_geometry_regression.py"
python3 "$ROOT/tools/hand-sync/test_keyframe_replay.py"

"$BLENDER_BIN" --background --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/render_from_blend.py" -- --job "$JOB" --blend "$RUN/render/probe_pen.blend" --expected-blend-sha256 "$BLEND_SHA"

PREV_O="$ART/deliveries/hand-sync-r7e-preview-ortho.mp4"
ffmpeg -y -framerate 30 -i "$RUN/render/frames/frame_%04d.png" \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart -vf "scale=540:960" "$PREV_O"

python3 "$ROOT/tools/hand-sync/build_diagnostic_video.py" \
  "$RUN/render/qc-ortho.json" "$RUN/render/frames" "$ART/deliveries/hand-sync-r7e-diagnostic-ortho.mp4" 30

python3 "$ROOT/tools/hand-sync/export_bcs_touch_evidence.py" "$BUNDLE" "$RUN/touch-hit-chain.json" "$ART/deliveries/r7e-bcs-evidence"
python3 "$ROOT/tools/hand-sync/measure_tip_pixels.py" "$RUN" "$RUN/tip-pixel-measurement.json" || true

echo "R7E_PIPELINE_OK ortho=$PREV_O touch-hit=$RUN/touch-hit-chain.json hand=ASSET_BLOCKED"
