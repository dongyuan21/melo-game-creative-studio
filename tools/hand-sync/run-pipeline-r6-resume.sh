#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ART="$ROOT/artifacts/bcs-hand-pen"
RUN="$ART/runs/hand-sync-r6"
export HAND_SYNC_RUN_ROOT="$RUN"
export BLENDER_BIN="${BLENDER_BIN:-$(command -v blender)}"
export PYTHONPATH="$ROOT/tools/hand-sync:${PYTHONPATH:-}"
JOB="$RUN/job.json"
BLEND="$RUN/render/probe_pen.blend"
BLEND_SHA="$(python3 -c "import json;print(json.load(open('$RUN/render/solve-meta.json'))['blendSha256'])")"

"$BLENDER_BIN" --background --python-exit-code 1 \
  --python "$ROOT/tools/hand-sync/render_from_blend.py" -- --job "$JOB" --blend "$BLEND" --expected-blend-sha256 "$BLEND_SHA"

python3 "$ROOT/tools/hand-sync/test_geometry_regression.py"
python3 "$ROOT/tools/hand-sync/test_keyframe_replay.py"
python3 "$ROOT/tools/hand-sync/test_screen_faults.py"
python3 "$ROOT/tools/hand-sync/test_screen_proxy_registration.py"
python3 "$ROOT/tools/hand-sync/export_m1_keyframes.py" "$RUN" "$ART/deliveries/m1-keyframes" "$BLENDER_BIN"

PREV="$ART/deliveries/hand-sync-r6-preview.mp4"
DIAG="$ART/deliveries/hand-sync-r6-diagnostic.mp4"
ffmpeg -y -framerate 30 -i "$RUN/render/frames/frame_%04d.png" \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart -vf "scale=540:960" "$PREV"
python3 "$ROOT/tools/hand-sync/build_diagnostic_video.py" \
  "$RUN/render/qc.json" "$RUN/render/frames" "$DIAG" 30
python3 "$ROOT/tools/hand-sync/verify_frame_label_mapping.py" \
  "$DIAG" "$RUN/render/frame-label-manifest.json"
python3 "$ROOT/tools/hand-sync/test_label_video_swap.py"
bash "$ROOT/tools/hand-sync/run-negative-tests.sh"
echo "R6_RESUME_OK $PREV"
