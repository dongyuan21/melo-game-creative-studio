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

## 触控运动方向（参考实拍：右下 → 左上，右手）

- **Take：** `consecutive`（pickup 起 149 帧）；hand-sync 使用 **独立笔画** `referencePointerPath`（终点在画面左上，不再跟落格 anchor 停在下方）  
- **成片像素（QC 笔尖 @270×480，原点左上 x右 y下）：** 第一段拖动 **起 (226.8, 422.4)** → **止 (37.8, 72.0)** — 见 `tip-pixel-measurement.json`  
- **截图：** `deliveries/m1-keyframes/motion-proof-start-frame.png`、`motion-proof-end-frame.png`（红圈=QC 笔尖）  
- **右手：** `scene-config` `penTiltYawRadians=0.22`（杆从画面右侧进入）  

```text
视频画面 (device UV, 左上原点)
  u=0 ─────────────── u=1
v=0   ┌─────────────────┐
      │    ↖ 拖动方向    │
      │  起●        止●  │  起≈(0.72,0.86) 右下
v=1   └─────────────────┘  止≈(0.18,0.56) 左上
```

正交与斜角透视 **共用** 上述同一 bundle／触控轨。

## R7 交付视频

- 正交：`artifacts/bcs-hand-pen/deliveries/hand-sync-r7-preview-ortho.mp4`
- 斜角透视：`artifacts/bcs-hand-pen/deliveries/hand-sync-r7-preview-perspective.mp4`
- 诊断（正交烧录）：`artifacts/bcs-hand-pen/deliveries/hand-sync-r7-diagnostic-ortho.mp4`

## Run

`artifacts/bcs-hand-pen/runs/hand-sync-r7/`（`job.json`、`job-perspective.json`、`render/qc-ortho.json`、`render-persp/qc.json`）
