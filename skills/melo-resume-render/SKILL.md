---
name: melo-resume-render
description: 工程目录已在、上次因没有 Chrome 未能出片时，补跑 melo render。不要重跑 Agent，也不要手写 rendered: true。
---

# 补出片

适用：`produce` 或 `document emit` 已经写入目录，但 `render-request.json` 里是 `rendered: false` 且 `code` 为 `CHROME_NOT_FOUND` 或 `NOT_RUN`。

不要重跑 `agent run`。Take 和 document 已经在。

```bash
node dist-cli/cli/melo.js render \
  --out-dir <已有工程目录> \
  --quality preview
```

目录里需要 `document.json`（`produce` 会写）。若只有别处的 document：

```bash
node dist-cli/cli/melo.js render \
  --out-dir <dir> \
  --document <document.json> \
  --quality preview
```

成功：`video.mp4`、`preview.png`，`rendered: true`，`encoder: chrome-webcodecs`。

仍没有 Chrome：同样的可恢复失败。安装 Chrome / Chromium 或设置环境后重试本 Skill，不要用 Node 编码冒充。

`--max-frames` 只截断预览，不改 Take。
