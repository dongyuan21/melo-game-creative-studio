---
name: melo-schema
description: 列出或读取 Melo Headless JSON Schema。在外部 Agent 编写 AssetManifest / Recipe 之前对照契约。
---

# Schema

```bash
node dist-cli/cli/melo.js schema list
node dist-cli/cli/melo.js schema get <name>
```

当前名称包括 `asset-manifest@1`、`creative-master@1`、`variant-recipe@1`、`resolved-render-plan@1`。未知名称会返回 `SCHEMA_NOT_FOUND`。
