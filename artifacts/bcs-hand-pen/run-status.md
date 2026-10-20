# 运行状态（R7 / PR #18）

**空间契约：** `docs/hand-sync/spatial-contract-v0.4.md`  
**R6 几何/QC 基线：** 保留（`4aa8f79` 起未回滚）  
**HEAD：** 见 PR 最新 commit

## 分项

| 维度 | 状态 | 说明 |
|------|------|------|
| **运行** | PASS | `bash tools/hand-sync/run-pipeline-r7.sh` |
| **技术** | v0.4 契约 + 双机位 QC PASS（见 `technical-qc.md`） |
| **动作** | REVIEW_REQUIRED | F70→F71 等未修 |
| **外观** | REVIEW_REQUIRED | 技术笔；双机位为验证配置 |

## R7 交付视频

- 正交：`artifacts/bcs-hand-pen/deliveries/hand-sync-r7-preview-ortho.mp4`
- 斜角透视：`artifacts/bcs-hand-pen/deliveries/hand-sync-r7-preview-perspective.mp4`
- 诊断（正交烧录）：`artifacts/bcs-hand-pen/deliveries/hand-sync-r7-diagnostic-ortho.mp4`

## Run

`artifacts/bcs-hand-pen/runs/hand-sync-r7/`（`job.json`、`job-perspective.json`、`render/qc-ortho.json`、`render-persp/qc.json`）
