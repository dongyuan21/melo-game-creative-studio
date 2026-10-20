# R7e 系统级触控链与预览收尾

**审阅基线：** `1e98af6`（R7d）；**本轮：** D1 收尾 + D2 `ASSET_BLOCKED`（无手成片）

## 冻结（勿回退）

- 主拖动 **右下→左上**；名义握持 G 在 P 右下
- 固定 take `reference-br-tl`：tri-h slot2 → **row1 col1**
- R7d 已认可的按下/释放/落格逻辑 **不重写**

## `touch-hit-chain.json` schema **0.2**

| 检查 | 绑定对象 |
|------|----------|
| `pickHitOk` | 导出 `interaction.json` pointerdown 的 `touchVideoDeviceUv` → 设计空间 → `pickAtDesignNorm` |
| `releaseAnchorOk` | 末 contact 帧触控 → `anchorForPieceAtDesignNorm` |
| `previewAtReleaseOk` | 末拖动帧 `preview` 为合法 `1,1` |
| `commitIdentityOk` | commit 事件 `actionId` + piece 身份 |
| `stateTransferOk` | commit 后 presentation 棋盘格已填、piece `used` |
| takeHash | `bundle.json` `source.takeHash` === `sha256CanonicalJson(referenceBrTlTake())` |

命令：`npx tsx tools/hand-sync/verify_touch_hit_chain.ts <bundleDir> <out.json>`

## F18 预览语义

- `presentationCompiler` / `buildInteractionTrack`：reference take 在棋盘外 **不回退** `action.anchor`；`preview` 为 `null`，`draggedPiece.anchor` 为 `{-1,-1}` 直至解析到合法格
- `verify_game_interaction.py`：对 `takeId=reference-br-tl` 允许托盘区 contact 无 preview

## 命中实现

- `BlockPlacementReferenceScene` pick/anchor **委托** `referenceHitTest.ts`（单套公式）

## 四帧 BCS 证据（无手）

`deliveries/r7e-bcs-evidence/`：由 `export_bcs_touch_evidence.py` 从当前 bundle + `touch-hit-chain.json` 导出。

## 右手（D2）

- `scene-config` / export：`handRigProfile: off`，`handRigStatus: ASSET_BLOCKED`
- 停止 **procedural-right-gray-v2/v3** 视觉迭代；详见 `asset-acquisition.md`
- 成片：`hand-sync-r7e-preview-ortho.mp4`（笔 + BCS，无代理手）
