---
name: melo-golden-batch
description: 根据 Golden Scene 索引生成批量校准报告。没有商业源视频时场景保持 BLOCKED，不要标视觉 PASS。
---

# Golden 批量报告

```bash
node dist-cli/cli/melo.js golden batch \
  --index docs/reference/v2/GOLDEN_SCENE_INDEX_V1.json \
  [--target-take-hash <hash>] \
  [--out <report.json>] \
  [--html <report.html>]
```

缺少仓库内参考帧时，13 个场景 / 39 个锚点保持 `BLOCKED`。这不是视觉通过。
