---
name: melo-agent-run
description: 按 gameId 跑 Melo 游戏包 Agent，生成 GameReplayEnvelope。用于 block-placement、taptile-tray-match3、block-crush-drop 的机器试玩 Take。
---

# 生成 Agent Take

```bash
node dist-cli/cli/melo.js agent run \
  --game <gameId> \
  [--config <config.json>] \
  [--seed <int>] \
  [--profile <id>] \
  [--max-moves <int>] \
  [--beam-width <int>] \
  [--max-expanded-states <int>] \
  [--out <take.json>]
```

## 参数

- `--game`（必填）：`block-placement` | `taptile-tray-match3` | `block-crush-drop`
- `--config`：该游戏的官方配置。省略则用适配器默认（Placement 空棋盘、Crush 参考关、TapTile hourglass 工程）
- `--seed`：默认 `1`
- `--profile`：Placement/Crush 仅 `greedy`；TapTile 为 `max-clear` | `safe-win` | `danger-rescue` | `combo-heavy` | `fast-clear` | `intentional-fail`
- `--max-moves`：搜索/贪心步数上限
- `--beam-width` / `--max-expanded-states`：仅 TapTile
- `--out`：只写信封 JSON，不含 validation

## 输出

命令 JSON 含 `ok`、`rendered: false`、`status`（`solved|partial|empty|failed`）、`replay`、`validation`。`ok` 只表示信封能被官方 runtime 重放，不表示一定通关。

生成后必须用 `melo-take-validate` 再验一次，尤其是 Take 经过编辑或跨会话传递时。
