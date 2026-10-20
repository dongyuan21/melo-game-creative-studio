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

## 触控运动方向（参考实拍：右下 → 左上）

- **Take：** `consecutive`（公开切片 · 连续两次落子），窗口 `startSourceFrame=pickup`，149 帧  
- **确认方式：** `motion-direction.json` + 单测 `matches reference motion bottom-right to top-left`  
- **主拖动段：** `touchVideoDeviceUv` 自 `[0.72, 0.86]` → `[0.18, 0.56]`（Δu≈−0.54，Δv≈−0.30）  
- **实现：** fixture 原始 pointerPath 为左下→右上；hand-sync 对 presentation pointer 做 `u'=1-u` 镜像，屏幕导出与笔轨一致  

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
