---
name: melo-document-emit
description: 把官方 config 和 Take 收成 StudioProjectDocumentV2，并可编译成 presentation frame source。在试玩校验之后、出片交接之前使用。
---

# 工程文档

```bash
node dist-cli/cli/melo.js document emit \
  --game <gameId> \
  --config <config.json> \
  [--take <take.json>] \
  [--skin <id>] \
  [--seed <int>] \
  [--out <document.json>]

node dist-cli/cli/melo.js document compile \
  --document <document.json> \
  [--take-id <id>] \
  [--out <frames.json>]
```

`document compile` 只产出 `totalFrames` / `frameSourceHash`，**不会**写出像素或 MP4。`rendered` 保持 `false`。真正编码请接 `melo-render`（无头 Chrome + WebCodecs）。
