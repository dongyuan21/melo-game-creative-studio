---
name: melo-capabilities
description: 列出 Melo Game Creative Studio CLI 的 capabilities、schema 与已注册 Agent。在开始组合其他 Melo skill 之前调用。
---

# 发现 Melo CLI 能力

```bash
node dist-cli/cli/melo.js capabilities
node dist-cli/cli/melo.js schema list
node dist-cli/cli/melo.js agent list
```

`capabilities.commands` 是当前二进制承认的命令清单。`agent list` 返回 `{ gameId, profiles }[]`。`render --list` 返回电影后端和构图。没有出现的 `gameId` 不要调用 `melo-agent-run`。组合入口见 `melo`。
