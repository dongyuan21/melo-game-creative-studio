---
name: melo-skin-apply
description: 替换游戏内主题/皮肤/Look，不替换 Studio 外壳。用于 TapTile 牌面主题、Crush 木块皮肤、Placement look pack。
---

# 替换游戏内 UI / 皮肤

```bash
node dist-cli/cli/melo.js skin list [--game <gameId>]
node dist-cli/cli/melo.js skin apply \
  --game <gameId> \
  --config <config.json> \
  --skin <id> \
  [--out <config.json>]
```

## 能力边界

这是**局内视觉**，不是 Studio 导航壳：

- TapTile：`animals-v1` / `food-v1` / `chain-combo-ui-v1`（`levelHash` 不变）
- Crush Wooood：`golden-embossed` / `classic-maple` / `deep-mahogany` / `checker-maze`（`skinId` 只换画板，玩法哈希不变，不必重跑 Agent）
- Block Placement：`look.copper`（铜金属电影镜头）/ `look.candy-resin`（糖果树脂）。挂在 `document.production.lookPackRef`，`melo render` 会读这个 id。PBR 贴图仍走 variant compile。

换皮后可直接 `melo-take-validate`，不必为 Crush 换皮重跑 `melo-agent-run`。要出片走 `melo-produce` 或 `melo-document-emit` + `melo-render`。
