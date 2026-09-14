---
name: melo-material-compile
description: 把 MaterialPack 编译成 MaterialRuntimeDescriptor。不解码 GPU 纹理，也不会把 rendered 设为 true。
---

# 编译材质运行时

```bash
node dist-cli/cli/melo.js material compile \
  --pack <material-pack.json> \
  [--out <runtime.json>]
```

`rendered` 永远是 `false`。有贴图 URI 时 `resourcesReady` 仍为 `false`，因为 Node 不解码纹理。无贴图的参数包才是 `resourcesReady: true`。
