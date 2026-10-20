# 运行状态总览（审阅修订后）

| 阶段 | 状态 | 说明 |
|------|------|------|
| E0 | **PASS（CPU 范围）** | 浏览器 + Blender 冒烟；无 GPU 渲染验证 |
| P0 审计 | **PASS（修订）** | `legacyPresentationAdapter` 在 `placementFeedback` 每帧生成 commit 语义事件；手同步轨单独发边界事件 |
| P1 交互轨 + 屏幕 | **PARTIAL** | 同一 `compileBlockPlacementFrameSource` + `screen-manifest.json`（reference-2d→video）；**非** cinematic 最终后端；缺九点/留白全矩阵 |
| P2 探针/笔 | **PASS（重验）** | 关键帧 + 独立进程重放；`verify_hand_sync.py` 测量 PASS |
| P3 手绑定 | **PROXY_SMOKE / PARTIAL** | `probe-pen-proxy` 模式含 IK 约束骨架；无授权自然手 |
| P4–P5 | **NOT_RUN** | 技术案例目录待扩展 |
| 动作评审 | **REVIEW_REQUIRED** | |
| 外观评审 | **REVIEW_REQUIRED** | |

## 交付视频（分支）

- `deliveries/hand-sync-aligned-preview.mp4` — BCS 屏幕贴图 + 探针/笔（同 bundle 轨）~5s
- `deliveries/hand-sync-aligned-diagnostic.mp4` — 含帧号/actionId/误差字幕（来自 qc）
- 旧 `hand-sync-loop-*.mp4` 保留作轮次对比，**不再**作为 P2 验收依据

## 最新 run

- `runs/hand-sync-v2/` — 独立 runId 目录、qc.json、probe_pen.blend、screen/
