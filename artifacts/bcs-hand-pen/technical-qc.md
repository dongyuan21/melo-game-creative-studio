# 技术检查（测量驱动）

| 检查 | 状态 | 证据 |
|------|------|------|
| vitest hand-sync | PASS | `tests/handSyncInteraction.test.ts` 等 |
| screen export | PASS | `bundle/screen-manifest.json` + PNG |
| solve | PASS | `runs/hand-sync-v2/render/solve-meta.json` |
| verify geometry | PASS | `runs/hand-sync-v2/render/qc.json` technicalStatus PASS |
| keyframe replay | PASS | `tools/hand-sync/test_keyframe_replay.py` |
| negative frozen tip | PASS | `run-negative-tests.sh` 非零退出 |
| GPU | NOT_RUN | |
| 自然手 | BLOCKED | 无授权资产 |

**采样分辨率**：求解/渲染 270×480，交付 mp4 缩放 540×960（烟雾）；投影容差按 `gameImagePx` 高度换算。

**qc 指标（摘录）**：max 投影误差 ~3.2e-5 px（PenTip vs PenTarget）；详见 `qc.json` perFrame。
