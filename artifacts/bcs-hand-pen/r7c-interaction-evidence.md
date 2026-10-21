# R7c 合法交互证据

**Take：** `reference-br-tl`（`src/hand-sync/referenceLegalTake.ts`，synthesized，经 `applyPlacement` 校验）  
**不再** 对 `consecutive` 全 action 覆盖 `(0.84,0.88)→(0.14,0.15)` 而保留旧 anchor。

## 触控轨（device UV）

| 项 | 值 |
|----|-----|
| 起点（右下托盘 slot2） | (0.73, 0.88) |
| 终点（棋盘合法格） | (0.257, 0.237) |
| Δu, Δv | -0.473, -0.643 |
| `motion-direction.json` | `directionOk: true` |

## 提交链

见 `runs/hand-sync-r7c/gameplay-chain.json`：`pass: true`  
- 释放前最后一帧拖动 `preview.legal: true`（棋盘内，非 HUD v<0.2 带）  
- commit 帧 touch 与末拖动 touch 连续，无「HUD 松手 → 底行右格跳格」

## 阶段静帧

`deliveries/r7c-keyframes/`：`pre-contact`（`contact=false` 接近段）、`mid-drag`、`pre-release`
