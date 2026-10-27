# 静态握姿评审（R8a）

**状态：REVIEW_REQUIRED**（待用户目视批准静帧）

| 项目 | 说明 |
|------|------|
| Pose | `static-stylus-grip-v2` |
| 接触架 | `thumb03-index03-pad-midpoint` → `GripAnchor`（非 bbox / 非 WristMarker 替代） |
| 尺度 | `uniformScale=0.4`（`solve-meta.json` → `handRig.measured`） |
| 前臂 | `ForearmExtension` 灰模袖口，腕向画外 BR |
| 材质 | 中性灰 Principled（非皮肤） |

## 证据（手+笔+BCS 合成，非 BCS-only）

`deliveries/r8a-stills/`：

- `F18_composite.png` … `F43_composite.png`
- `F30_grip_closeup.png`
- `F30_side_oblique.png`

批准前**不出**全片 MP4（`run-pipeline-r8a.sh` 仅静帧）。
