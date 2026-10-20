#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ART="$ROOT/artifacts/bcs-hand-pen"
RUN="$ART/runs/hand-sync-r4"
JOB="$RUN/job.json"
export BLENDER_BIN="${BLENDER_BIN:-$(command -v blender)}"
export PYTHONPATH="$ROOT/tools/hand-sync:${PYTHONPATH:-}"
export HAND_SYNC_RUN_ROOT="$RUN"

BLEND_SHA="$(python3 -c "import json;print(json.load(open('$RUN/render/solve-meta.json'))['blendSha256'])")"
python3 "$ROOT/tools/hand-sync/test_geometry_regression.py"
python3 "$ROOT/tools/hand-sync/test_keyframe_replay.py"

"$BLENDER_BIN" --background --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/render_from_blend.py" -- --job "$JOB" --blend "$RUN/render/probe_pen.blend" --expected-blend-sha256 "$BLEND_SHA"

"$BLENDER_BIN" --background --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/render_side_view.py" -- --blend "$RUN/render/probe_pen.blend" --out "$ART/deliveries/hand-sync-r4-side-ortho.png" --frame 40

ffmpeg -y -framerate 30 -i "$RUN/render/frames/frame_%04d.png" \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart -vf "scale=540:960" "$ART/deliveries/hand-sync-r4-preview.mp4"

python3 "$ROOT/tools/hand-sync/build_diagnostic_video.py" \
  "$RUN/render/qc.json" "$RUN/render/frames" "$ART/deliveries/hand-sync-r4-diagnostic.mp4" 30

python3 "$ROOT/tools/hand-sync/verify_frame_label_mapping.py" \
  "$ART/deliveries/hand-sync-r4-diagnostic.mp4" "$RUN/render/frame-label-manifest.json"

bash "$ROOT/tools/hand-sync/run-negative-tests.sh"
echo "R4_RESUME_OK"
