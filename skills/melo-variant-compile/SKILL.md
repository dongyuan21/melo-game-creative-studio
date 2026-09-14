---
name: melo-variant-compile
description: 把 Creative Master、Variant Recipe 和资产目录编译成 Resolved Render Plan。在资产已校验、需要锁定一次出片计划时使用。
---

# 编译变体计划

```bash
node dist-cli/cli/melo.js variant compile \
  --master <master.json> \
  --recipe <recipe.json> \
  --assets <assets-dir-or-file> \
  [--renderer fixed-camera-cinematic] \
  [--require-hashes] \
  [--out <plan.json>]
```

`--renderer` 必须是 `capabilities.renderers` 之一。编译成功后用 `melo-quality-check` 跑结构门禁。CLI 不渲染视频。
