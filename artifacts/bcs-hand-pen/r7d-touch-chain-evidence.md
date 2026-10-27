# R7d 真实触控链证据

**HEAD 基线：** R7d pipeline 产出（`reference-br-tl` + `referenceHitTest`）

## 三项独立验收（`touch-hit-chain.json`）

| 检查 | 说明 |
|------|------|
| **按下命中** | `pickAtDesignNorm` @ pointerdown 设计坐标 → `ref-piece-2-tri-h` |
| **释放解析** | `anchorForPieceAtDesignNorm` @ 末拖动帧 → `row:1, col:1` |
| **状态转移** | `applyPlacement` 对同一 action 成功 |

负例：`tests/referenceHitTest.test.ts` 中 legacy `(0.73, 0.88)` **不得**命中托盘块。

## 坐标空间

- Presentation / `pointerPath`：**设计画布归一化**（1064×1788）
- `touchVideoDeviceUv`：经 `pointerDesignUvToVideoDeviceUv`（contain 到 1080×1920）
- 拾取/落点：**与 `BlockPlacementReferenceScene.pick/anchorForPiece` 同式**（`referenceHitTest.ts`）

## 接近段

- export 前 18 帧：设计空间从托盘下方连续插值到 rack 命中点（非原地悬停再跳）

## 右手资产

- **ASSET_BLOCKED（解剖级）**：仍用 `procedural-right-gray-v2` 回归坐标；未引入可授权绑定手模。
- 已修：`ArmEntryRoot` 父局部/世界混用；前臂 parent `WristMarker`。

## 四帧 BCS（无手）

从 `runs/hand-sync-r7d/export/.../bundle/screen/` 对照 `interaction.json` 中 pointerdown / 拖动中 / pointerup / commit 的 `localFrameIndex` 取帧（见 `touch-hit-chain.json` 的 `commitLocalFrame`）。
