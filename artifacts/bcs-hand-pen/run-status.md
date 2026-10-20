# 运行状态总览

| 阶段 | 状态 | 证据 |
|------|------|------|
| E0 环境预检 | **PASS**（无 GPU，CPU 预览） | `environment.json`, `runs/e0/` |
| P0 代码审计 | **PASS** | `audit.md` |
| P1 交互轨导出 | **PASS**（最小实现） | `runs/hand-sync/p1-export/bundle/` |
| P2 探针/笔 | **PASS**（Blender CPU） | `runs/hand-sync/render/frames/` |
| P3 手绑定 | **PARTIAL**（前臂 IK 代理，非自然手） | `hand-sync-loop-preview.mp4` |
| P4–P5 多动作回归 | **NOT_RUN** | — |
| 动作评审 | **REVIEW_REQUIRED** | `motion-review.md` |
| 外观评审 | **REVIEW_REQUIRED** | `appearance-review.md` |

## 交付视频（分支内）

- `deliveries/hand-sync-loop-preview.mp4` — 探针/笔/前臂闭环 ~5s
- `deliveries/hand-sync-loop-diagnostic.mp4` — 同上 + 诊断字幕
- `deliveries/baseline-bcs-preview.mp4` — BCS WebCodecs 基线 ~5s
