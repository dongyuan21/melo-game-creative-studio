---
name: melo-asset-validate
description: 校验一份 Melo AssetManifest JSON。在把外部生成的材质/资产送进变体编译之前使用。
---

# 校验资产清单

```bash
node dist-cli/cli/melo.js asset validate <manifest.json>
```

`ok` 为 false 表示存在 `severity: error` 的问题。先修资产，再调用 `melo-variant-compile`。
