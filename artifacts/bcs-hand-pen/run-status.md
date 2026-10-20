# 运行状态（R7b / PR #18）

**空间契约：** `docs/hand-sync/spatial-contract-v0.4.md`  
**R6 几何/QC 基线：** 保留  
**HEAD：** 见 PR 最新 commit

## 分项

| 维度 | 状态 | 说明 |
|------|------|------|
| **运行** | PASS | `bash tools/hand-sync/run-pipeline-r7b.sh` |
| **技术** | v0.3 scene-config + grip-side QC + 双机位 |
| **动作** | REVIEW_REQUIRED | 灰模握姿；F70→F71 等未修 |
| **外观** | REVIEW_REQUIRED | 程序化灰手，非实拍皮肤 |
| **右手身份** | REVIEW_REQUIRED | 有可见灰模右手+前臂；非绑定解剖资产 |

## 触控与握持（成片像素为准）

- **Take：** `consecutive` + `referencePointerPath`（右下→左上）  
- **笔尖 P @270×480：** 第一段拖动 **(226.8, 422.4) → (37.8, 72.0)** — `runs/hand-sync-r7b/tip-pixel-measurement.json`  
- **握持 G：** `gripSideOkQc: true`（全程 `G.x>P.x` 且 `G.y>P.y`）— `runs/hand-sync-r7b/grip-side.json`  
- **对照：** `artifacts/bcs-hand-pen/r7b-filmstrip-comparison.md`

## R7b 交付

- 正交：`deliveries/hand-sync-r7b-preview-ortho.mp4`
- 斜角：`deliveries/hand-sync-r7b-preview-perspective.mp4`
- 诊断：`deliveries/hand-sync-r7b-diagnostic-ortho.mp4`
- 静帧：`deliveries/r7b-keyframes/`

## Run 目录

`artifacts/bcs-hand-pen/runs/hand-sync-r7b/`
