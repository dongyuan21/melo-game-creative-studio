---
name: melo-project-migrate
description: 把旧 Studio / Placement 工程码迁移成 StudioProjectDocumentV2。在导入历史 JSON 或跨版本工程时使用。
---

# 迁移工程

```bash
node dist-cli/cli/melo.js project migrate <project.json> [--out <document.json>]
```

当前迁移器面向 Block Placement 遗留工程。三个演示游戏的新工程请用 `melo-project-scaffold` / `melo-document-emit`，不要走这条路径。
