# R8 CC0 右手资产接入

## 资产

| 字段 | 值 |
|------|-----|
| 文件 | `tools/hand-sync/assets/licensed/posable-anatomical-right-hand/hand-posable.glb` |
| SHA-256 | `d1705ec1317516e79deb5c5ce4ef34e69bf6315bba9025e8a7374fbd0c745f47` |
| 许可 | CC0（见同目录 `LICENSE.txt`） |
| 来源 | [Innerscene posable anatomical right hand](https://www.innerscene.com/tools/library/3d-parts/posable-anatomical-right-hand-f6098b4f) |
| 管线 profile | `posable-innerscene-right-cc0` |
| 握姿 | `static-stylus-grip-v1`（`hand_rig_posable.py`） |

## 绑定

- `GripAnchor` 在笔杆 `gripAlongShaftFraction`；`HandRig` 父级为 GripAnchor，随笔运动。
- 触控链 **未改**：仍由 `interaction.json` / v0.2 验证器约束；`verify_hand_sync` 仍测笔尖与 BCS 触控。

## 交付

- `bash tools/hand-sync/run-pipeline-r8.sh`
- `deliveries/hand-sync-r8-preview-ortho.mp4`
- `deliveries/hand-sync-r8-diagnostic-ortho.mp4`
- `deliveries/r8-bcs-evidence/`

## 审阅

- 形态/握姿/释放后穿插：**REVIEW_REQUIRED**（见成片 F42 等帧）。
