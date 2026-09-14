---
name: melo-project-scaffold
description: 按 gameId 出题，生成官方游戏配置 JSON。在 Agent 开始创作视频、需要一块可玩关卡时使用。
---

# 出题

```bash
node dist-cli/cli/melo.js authoring catalog --game <gameId>
node dist-cli/cli/melo.js project scaffold \
  --game <gameId> \
  [--template <id>] \
  [--skin <id>] \
  [--seed <int>] \
  [--out <config.json>]
```

## 模板

- `block-placement`：`showcase` | `cross-clear` | `dense-rescue` | `empty`
- `taptile-tray-match3`：`hourglass` | `t-shape` | `terraces` | `free`
- `block-crush-drop`：`reference` | `empty` | `corridor`

`--out` 写的是该游戏的官方 config，不是 Studio 外壳。换皮用 `melo-skin-apply`；一键流水线用 `melo-produce`。
