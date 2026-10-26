# @melo-game/dsh-plugin-melo

DeepSeek Harness **薄插件**：把 Melo Game Creative Studio 的 `melo` CLI 注册为 dsh 工具与官方 Skill。出片、玩法、渲染逻辑 **仅** 存在于 Melo 主仓库 CLI，本包只做参数映射与健康检查。

## 安装

```bash
# 1. 构建 Melo CLI
cd /path/to/melo-game-creative-studio
npm run build:cli
export MELO_CLI_PATH="$PWD/dist-cli/cli/melo.js"

# 2. 安装 dsh bundle（profile 名按你的环境替换）
dsh plugin --profile web add link:/path/to/melo-game-creative-studio/packages/dsh-plugin-melo

# 3. 可选：对话内联播放 MP4
dsh plugin --profile web add @orderg-x/dsh-video-preview

# 4. 重启 dsh
```

未安装 `@orderg-x/dsh-video-preview` 时，成功出片仍会返回 **文件路径与 deliverable 芯片**；安装后同一 MP4 可在回复下方内联播放。

## 健康检查

首次 `melo_produce` / `melo_render` 前，调用 **`melo_health`**（或在 produce/render 默认附带健康卡）。中文可读项包括：

- Node >= 22.12
- `MELO_CLI_PATH` / 内置 `dist-cli/cli/melo.js` 是否可用
- `melo capabilities` 是否成功
- Chrome 是否可用（映射 `CHROME_NOT_FOUND` 修复步骤）
- 会话下 `melo-out/` 是否可写

## 零决策预览

`melo_produce` 无参默认：`block-placement`、`showcase`、`preview`、`max-frames=48`、`out-dir=melo-out/`。加 `render: true` 等价 `melo produce --render`。

商业渲染请显式传 `quality`、`maxFrames`、游戏 id，或加载 `melo-from-puzzle-to-mp4` 分步 Skill。

## Skill 用法

捆绑 Skill（与仓库 `skills/` 对齐）：

| Skill | 用途 |
|---|---|
| `melo` | 入口与索引 |
| `melo-from-puzzle-to-mp4` | 出题 → 试玩 → 工程 → 可选出片 |
| `melo-remix-looks` | 同 Take 多套皮 |

在对话中让模型 `skill` 加载上述名称，再按 Skill 编排调用 `melo_*` 工具。

## 视频预览关联

本插件 **不** 实现播放器。成功时：

1. 工具 JSON 含 `mp4Absolute` / `mp4WorkspaceRelative`
2. 向 `deliverables/presented` 递交 MP4（与官方 `present` 同通道）
3. 若 profile 已装 `@orderg-x/dsh-video-preview`，宿主可自动内联播放

## Studio

`melo_studio` 返回 `http://127.0.0.1:4173`；在 Melo 根目录 `npm run dev` 启动人类精修界面。

## UX 验收清单

1. **首次健康卡**：`melo_health` / 首次 produce 前 capabilities + 中文缺失项；`CHROME_NOT_FOUND` 有修复指引。
2. **零决策默认**：无参 `melo_produce` → block-placement + showcase + preview + 短帧 + `melo-out/`。
3. **官方 Skill 随包分发**：`melo`、`melo-from-puzzle-to-mp4`、`melo-remix-looks`。
4. **可读进度/结果**：stage 标签、成功三元组（mp4、gameId/seed/skin、out-dir）、失败 code 中文 + 重试提示。
5. **期望管理**：文档与工具 `expectationNote` 说明 preview ≠ Studio 商业画质。
6. **可选 Studio**：`melo_studio` 工具打印本地 URL。

## 开发

```bash
npm run test --prefix packages/dsh-plugin-melo
```

架构说明：[`docs/dsh/README.md`](../../docs/dsh/README.md)
