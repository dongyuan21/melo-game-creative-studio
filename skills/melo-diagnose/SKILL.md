---
name: melo-diagnose
description: Melo CLI 失败时的诊断配方。先分清未知游戏、Take 非法、哈希漂移和 Chrome 缺失，再决定重跑 Agent 还是只补 render。
---

# 失败诊断

先读 JSON 里的 `code` / `validation.issues[].code`，不要从零重跑整条链。

```bash
node dist-cli/cli/melo.js capabilities
node dist-cli/cli/melo.js agent list
node dist-cli/cli/melo.js authoring catalog --game <gameId>
node dist-cli/cli/melo.js render --list
```

## 常见 code

| code | 含义 | 下一步 |
|---|---|---|
| `UNKNOWN_AGENT` / `UNKNOWN_GAME` | `gameId` 未注册 | 只用 `agent list` 里的三个演示游戏。`mahjong-solitaire` 尚未接入 |
| `UNKNOWN_TEMPLATE` / `UNKNOWN_SKIN` | 目录里没有这个 id | `authoring catalog` / `skin list` |
| `TAKE_INITIAL_HASH_MISMATCH` | Take 与当前**玩法**配置对不上 | 不要为 Crush/TapTile 换皮怀疑这个；若改了棋盘/队列/关卡才需要重跑 Agent |
| `ILLEGAL_ACTION` | 动作在官方 runtime 下不合法 | 检查是否改过 Take 或用了错误 config |
| `CHROME_NOT_FOUND` | 没有 Chrome | `melo-resume-render`，不要标 `rendered: true` |
| `DOCUMENT_HAS_NO_TAKE` | 没有可出片的 Take | 先 `agent run`；`ok: false` 的 Take 不会被 `produce` 写进 document |
| `CLI_ARGUMENT_REQUIRED` | 缺参数 | 看对应原子 Skill |

`agent run` 的 `status: partial` 在 Crush 上很常见，只要 `validation.valid` 就可以换皮或出片。`failed` 才不要继续。

契约对照：`melo-schema`。旧工程：`melo-project-migrate`。Golden 没有源视频会保持 `BLOCKED`，不是渲染崩溃。
