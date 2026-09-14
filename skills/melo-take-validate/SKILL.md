---
name: melo-take-validate
description: 用官方 runtime 确定性重放校验一份 GameReplayEnvelope。在 Agent 生成或编辑 Take 之后、交给导演/出片之前使用。
---

# 校验 Take

```bash
node dist-cli/cli/melo.js take validate \
  --take <take.json> \
  [--game <gameId>] \
  [--config <config.json>] \
  [--out <report.json>]
```

## 规则

- `--take` 必须是 `melo.game-replay` 信封。
- `--game` 省略时使用信封内的 `gameId`。
- `--config` 必须与生成该 Take 时的**玩法**配置一致；省略则用该游戏 Agent 适配器的默认配置。
- Crush 的 `skinId`、TapTile 主题和 Placement look pack 是表现层：换皮后同一份 Take 仍应通过校验。
- 校验会检查 gameId/moduleVersion、初始哈希、动作 schema、合法动作集，以及 `resolve` 是否抛错。

`ok: false` 时不要继续 variant compile。看 `validation.issues[].code`（例如 `ILLEGAL_ACTION`、`TAKE_INITIAL_HASH_MISMATCH`）。
