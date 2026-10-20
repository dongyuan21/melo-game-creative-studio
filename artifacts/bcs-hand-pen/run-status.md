# 运行状态（R7c / PR #18）

**HEAD：** 见 PR 最新 commit

| 维度 | 状态 |
|------|------|
| **运行** | PASS `bash tools/hand-sync/run-pipeline-r7c.sh` |
| **技术** | 合法 synthesized take + grip-side + 帧对齐 screen |
| **动作** | REVIEW_REQUIRED |
| **外观** | REVIEW_REQUIRED |
| **右手解剖** | REVIEW_REQUIRED（v2 灰模圆柱指+降曝光，非绑定资产） |

## 保留（GPT R8 认可）

- 主拖动右下→左上（`motion-direction.json`）
- 握持侧 G 在 P 右下（`grip-side.json`）

## R7c 修复

- **合法交互：** `reference-br-tl` take，见 `r7c-interaction-evidence.md`
- **手：** `procedural-right-gray-v2`，曝光/灯光降低；前臂 `ArmEntryRoot` 相对笔尖固定屏幕右下偏移
- **像素证明：** `directionOkPixelsQc` 与 PNG 启发式分列，见 `tip-pixel-measurement.json`

## 交付

- `deliveries/hand-sync-r7c-preview-ortho.mp4`
- `deliveries/hand-sync-r7c-diagnostic-ortho.mp4`
- `deliveries/r7c-keyframes/`
