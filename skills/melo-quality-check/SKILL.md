---
name: melo-quality-check
description: 对 Resolved Render Plan 跑结构质量门禁。在 variant compile 之后、宣称可出片之前使用。
---

# 质量门禁

```bash
node dist-cli/cli/melo.js quality check \
  --plan <plan.json> \
  [--strict] \
  [--require-hashes] \
  [--max-texture-mib <n>] \
  [--max-triangles <n>] \
  [--max-plugin-mib <n>] \
  [--out <report.json>]
```

失败时返回稳定错误码（缺资产、材质/特效不兼容、权限、预算等）。`ok: false` 时不要当作可发布计划。
