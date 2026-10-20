# 运行状态（R4-A）

**审阅基线：** `8395def`  
**本 run HEAD：** 见 PR 最新 commit（R4 代码提交后更新）

## 分项

| 维度 | 状态 | 说明 |
|------|------|------|
| **运行** | PASS | Linux CPU；Blender `$(command -v blender)` 4.0.2；`run-pipeline-r4.sh` 闭环 |
| **技术** | PARTIAL | R4-A 几何/重放/逐帧 label 子项 PASS；P2 总体仍 PARTIAL；cinematic NOT_RUN |
| **动作** | REVIEW_REQUIRED | 无空中转移；F70→F71 块间跳变未修（R4-B） |
| **外观** | REVIEW_REQUIRED | 诊断光/emission 屏；非写实手/皮肤 |

## 阶段

| 阶段 | 状态 |
|------|------|
| E0 / P0 | PASS（沿用） |
| P1 reference-2d | PARTIAL（bundle.source.backendId 已改为 reference-2d） |
| R4-A 笔几何 + QC + 负例 + 同 blend 渲染 + 烧录诊断 | **PASS（本轮交付范围）** |
| R4-B 空中转移 / 四案例 / cinematic | NOT_RUN |
| P2 总体 | **PARTIAL** |

## 视频（分支内）

- `artifacts/bcs-hand-pen/deliveries/hand-sync-r4-preview.mp4`（149 帧，540×960）
- `artifacts/bcs-hand-pen/deliveries/hand-sync-r4-diagnostic.mp4`（PNG 烧录 QC，非 SRT）
- `artifacts/bcs-hand-pen/deliveries/hand-sync-r4-side-ortho.png`（侧视正交诊断）

## Run 目录

`artifacts/bcs-hand-pen/runs/hand-sync-r4/` — `export/latest-run.json` → bundle；`render/probe_pen.blend` + `qc.json` + `frame-label-manifest.json`

## 复现

```bash
bash tools/hand-sync/run-pipeline-r4.sh
```
