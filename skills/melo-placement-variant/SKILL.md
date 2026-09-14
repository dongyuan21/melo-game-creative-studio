---
name: melo-placement-variant
description: Placement 的 plan-bound PBR 变体轨道：校验资产、编译 Variant、跑质量门禁。与 melo render 的 look.copper 参数铜金属不是同一条路。
---

# Placement PBR 变体（不是 document-render look）

两条路不要混：

| 路径 | 做什么 | 不做什么 |
|---|---|---|
| `melo-remix-looks` + `melo-render` | `look.copper` / `look.candy-resin` 进电影后端风格 | 不绑 PBR 贴图 |
| 本 Skill | Master + Recipe → Resolved Render Plan | CLI 不编码 MP4 |

## 命令

```bash
node dist-cli/cli/melo.js asset validate \
  examples/headless/assets/material.copper.json
node dist-cli/cli/melo.js variant compile \
  --master examples/headless/master.demo.json \
  --recipe examples/headless/variant.copper.demo.json \
  --assets examples/headless/assets \
  --renderer fixed-camera-cinematic \
  --require-hashes \
  --out /tmp/melo/copper-plan.json
node dist-cli/cli/melo.js quality check \
  --plan /tmp/melo/copper-plan.json \
  --strict \
  --require-hashes
```

需要参数材质运行时时再加 `melo-material-compile`。Node 不解码 GPU 纹理；有贴图的 pack 会报 `resourcesReady: false`。

`quality check` 失败不要宣称可发布。网页 Studio 的变体工作区走同一套 Compiler 与门禁，不在本 Skill 里点 UI。
