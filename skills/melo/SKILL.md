---
name: melo
description: Melo Game Creative Studio 的 Agent 入口。CLI 提供原子命令；本仓库 skills/ 提供可改的官方组合配方。GitHub Pages 不出片。
---

# Melo Agent 入口

本仓库是 **Agent-operable**，不是内嵌 LLM。GitHub Pages 只部署前端 Studio；`melo` CLI 需要本地或后续后端的 Node 运行时。

先读 [`skills/README.md`](../README.md)：CLI 是执行面，Skill 是组合面。官方配方可以改；Claude Code / Codex 也可以按同一套 CLI 自写 Skill。

构建：`npm run build:cli`。可执行文件：`dist-cli/cli/melo.js`。输出一律 JSON。

## 三个可调度 gameId

- `block-placement`
- `taptile-tray-match3`
- `block-crush-drop`

`mahjong-solitaire` 只在 Studio 里 Coming Soon，没有 Agent / authoring / render 适配器。不要对它跑 `agent run`。

## 官方组合 Skill（按任务选）

| 任务 | Skill |
|---|---|
| 出题 → 试玩 → 工程 → 可选出片 | `melo-from-puzzle-to-mp4` |
| 同一份 Take 换多套局内皮再出片 | `melo-remix-looks` |
| 校验过了再出片，分清 `ok` / `rendered` | `melo-gate-before-render` |
| 工程已在、当时没有 Chrome，补编 MP4 | `melo-resume-render` |
| Placement PBR 变体计划（不是 document-render 铜金属） | `melo-placement-variant` |
| 命令失败、哈希漂移、Chrome 缺失 | `melo-diagnose` |

## 原子 Skill（查参数，不要当成流水线）

`melo-capabilities` → `melo-project-scaffold` → `melo-skin-apply` → `melo-agent-run` → `melo-take-validate` → `melo-document-emit` → `melo-render`

便捷捷径：`melo-produce`（一条 CLI，口味写死在二进制里；要改编排请改组合 Skill，不要给 `produce` 加矩阵开关）。

资产轨道：`melo-asset-validate` → `melo-variant-compile` → `melo-quality-check`；需要时 `melo-material-compile` / `melo-schema` / `melo-golden-batch` / `melo-project-migrate`。
