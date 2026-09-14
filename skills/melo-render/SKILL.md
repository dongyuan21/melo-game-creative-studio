---
name: melo-render
description: 用无头 Chrome + WebCodecs 把 produce/document 目录编成 MP4。仅在实际编码成功后把 rendered 设为 true；找不到 Chrome 时恢复失败。
---

# 出片

Node CLI 不编码像素。本 skill 生成 `render-job.json`，再启动仓库里的 `scripts/document-render.mjs`：无头 Chrome 打开通用 document-render 页，按 `gameId` 从注册表解析电影后端，调用 `executeVideoRenderJob`。

```bash
node dist-cli/cli/melo.js render --list
node dist-cli/cli/melo.js render \
  --out-dir <produce-dir> \
  [--document <document.json>] \
  [--take-id <id>] \
  [--quality preview|standard|cinematic] \
  [--max-frames <int>] \
  [--still-only]
```

也可在流水线末尾：

```bash
node dist-cli/cli/melo.js produce --game <gameId> --out-dir <dir> --render --quality preview
```

成功时目录里有 `video.mp4`、`preview.png`，`render-request.json` 的 `rendered` 为 `true`，`encoder` 为 `chrome-webcodecs`。Placement 工程的 `production.lookPackRef.id` 会进入电影后端：`look.copper` 是铜金属外观，`look.candy-resin` 是原先的糖果树脂。这不是 plan-bound PBR 贴图绑定。

找不到 Chrome 时：`ok` 为 false，`recoverable` 为 true，`code` 为 `CHROME_NOT_FOUND`，**不会**把 `rendered` 写成 true。不要用 Node 假装已经出片。

`--max-frames` 只截断预览编码，不改 Take。GitHub Pages 不托管该命令。
