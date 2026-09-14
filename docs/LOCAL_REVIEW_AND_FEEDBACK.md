# 本机出片与后续反馈

给下载代码后的人：先出一组约定好的竖屏成片，再按同一套格式写观感。后续迭代只接这类反馈，不把 SwiftShader / CI / 架构 Review 当成画面过关。

**本文件的人工视觉片单只评 Block Placement 的 Studio 五条 MP4。** 三款演示游戏都可以通过 Agent CLI 出题 / 换皮 / 试玩 / 出片；那是能力验证，跟下面 1～5 号片分开写。组合配方在 `skills/`（可改），原子命令在 CLI。不要把 CLI 短预览或 SwiftShader 样片当成商业画质通过。Mahjong 还没接入，不要对 `mahjong-solitaire` 跑 `agent run`。

环境：**Node.js 22.12+**、桌面 **Chrome**。Studio 导出必须在 Chrome 里完成。`melo render` 也是拉起无头 Chrome；Node 自己不会编码像素。

---

## 1. 下载并打开工作台

```bash
git clone https://github.com/dongyuan21/melo-game-creative-studio.git
cd melo-game-creative-studio
git checkout main
npm install
npm run dev
```

浏览器打开 [http://127.0.0.1:4173](http://127.0.0.1:4173)。只用 Chrome。导出是无声 1080×1920 H.264，大约 6 秒量级（示例 Take 约 180 帧 / 30 fps）。

若只想确认仓库能跑、不看画面，可另开终端：

```bash
npm test
npm run build
```

这与视觉评审无关。

---

## 2. 输入是什么

成片由四样东西决定。反馈里请写全，否则无法复现。

| 输入 | 你在工作台里选什么 | 本次约定 |
|---|---|---|
| 工程 / 牌面 | 导入 JSON，或编辑棋盘模板 | 先用仓库示例，再自己录一条 |
| Take | 已保存的落子序列 | 示例自带一条；自己录的请导出工程码一起交 |
| 渲染模式 + Look | 右侧「渲染模式」「Look Pack」「材质」 | 见下方片单 |
| 导演节奏 | 「节奏模板」 | 先 `真人自然`，再加一条 `悬念爆发` |

示例工程（**第一条必导**）：

```text
examples/demo-cross-clear.melo.json
```

内容：固定 8×8、「横纵双消」开局、三个候选块、一条真人语义动作。导入后不要改牌面再导出，否则旧 Take 会失效。

自己补录时：顶栏 **编辑** 选模板（展示局 / 横纵双消 / 险境救场）→ **真人试玩** 拖 2～4 手，其中至少一手清行或清列 → 自动保存 Take → **导演回放** → 导出。然后点 **导出工程码**，把 JSON 和 MP4 放在一起。

---

## 3. 请生成这 5 条视频

文件名请按表里写，方便对照。质量档一律选 **标准成片 · 14 Mbps**。3D 导出前右侧应显示「三维材质已提交，可进入正式导出」；若仍在加载，等完成再点。

导入 `demo-cross-clear.melo.json`，切到 **导演回放**，同一条 Take 连续导出：

| # | 文件名 | 渲染模式 | Look / 材质 | 节奏 | 请你重点看 |
|---|---|---|---|---|---|
| 1 | `01-cross-clear-2d-natural.mp4` | 真机参考 2D | 参考花园 · 完整（或当前工程 Look 保持默认 2D） | 真人自然 | 棋盘/托盘/HUD 是否像试玩广告；预消除染色、扫光、落点是否可读 |
| 2 | `02-cross-clear-2d-suspense.mp4` | 真机参考 2D | 与 #1 相同 | 悬念爆发 | **只评节奏**：拖拽是否拖沓、清除是否被放大、空拍是否过长。玩法应与 #1 相同 |
| 3 | `03-cross-clear-3d-candy.mp4` | 固定机位 3D | Look Pack「固定机位 3D · 糖果」，材质糖果树脂，LookDev 平衡影视 | 真人自然 | 体积、倒角、塑料感；清除碎裂是否廉价或过曝 |
| 4 | `04-cross-clear-3d-crystal.mp4` | 固定机位 3D | Look Pack「固定机位 3D · 水晶」，材质水晶玻璃，LookDev 高能量 | 真人自然 | 高光/透射是否发糊、Bloom 是否淹没棋盘、峰值是否可用 |
| 5 | `05-my-take-2d-natural.mp4` | 真机参考 2D | 与 #1 相同 | 真人自然 | **你自己录的 Take**：拾取、拖拽 Ghost、非法落点、清除是否跟手。同时提交导出的工程 JSON |

不要用「实验性 3D」出评审片，那条后端不是当前视觉基线。

### 可选第六条（工程回归，不是视觉批准）

本机有 Chrome 时：

```bash
npm run capture:review
```

会在 `review-package/run/` 写出公开 Fixture 的 20 张 PNG 和 4 条 MP4（2D + 钢 / 木 / aurora）。这是确定性回归，**软件渲染器画面不能当作商业画质通过**。若你打开这些 MP4，反馈请标明来源是 `capture:review`，不要和上面 5 条 Studio 成片混在一个印象里。

### Agent CLI 出片（能力验证，不是本片单）

若要确认本版 Agent 链路，跟 [`skills/melo-from-puzzle-to-mp4/SKILL.md`](../skills/melo-from-puzzle-to-mp4/SKILL.md)，同一 Take 换皮跟 [`skills/melo-remix-looks/SKILL.md`](../skills/melo-remix-looks/SKILL.md)。反馈请标明 `gameId`、模板、皮肤、`quality`、是否 `--max-frames`。这些 MP4 证明调度和编码，**不要和上面 5 条 Studio 成片混评**，也不要当成 Crush / TapTile 的商业画质通过。

---

## 4. 反馈怎么写

请按条写，一条一个问题。不要只说「3D 还不够好看」。

```text
视频：04-cross-clear-3d-crystal.mp4
时间：约 0:03（清除峰值）
输入：demo-cross-clear / 固定机位 3D / 水晶玻璃 / 高能量 / 真人自然
问题：Bloom 把整行高光糊成一片，看不清哪些格在消。
期望：棋盘格线在峰值仍可读，光只打在消除带上。
严重度：should-fix   （blocker / should-fix / note）
```

请覆盖这几类，没有意见也写「此类无意见」：

1. **布局**：棋盘是否居中、左右是否被裁、候选区是否够点。
2. **可读性**：颜色族、预消除、非法 Ghost、指针。
3. **节奏**：#1 vs #2；拖拽、停顿、清除谁该快谁该慢。
4. **材质**：#3 糖果是否像塑料玩具，#4 水晶是否像广告。
5. **清除演出**：扫光、碎裂、冲击波是「过弱 / 过脏 / 过闪」。
6. **HUD**：分数、评价词是否挡棋盘；没有评价词也请注明。
7. **跟手**：#5 自己录的，拖拽是否滑、吸附是否怪。

同时请附上：

- 5 条 MP4（#5 可只有你的 Take）
- #5 的工程 JSON
- Chrome 版本、电脑是否为独显（集成显卡请写明）
- 一句话总评：更像「能用的试玩演示」还是「还不能给客户看」

不要反馈这些（现阶段不会做，或会误导本片单）：

- 要求把 Crush / TapTile 的 CLI 短预览当成商业画质通过，或和 Placement Studio 五条片混成一个印象
- 要求给 Mahjong 出片（正式模块未接入）
- 给成片配音、BGM
- 自由摄像机、把整个棋盘做成开放世界 3D
- 把没有写出 MP4 的 CLI 结果标成 `rendered: true`，或把 Golden / SwiftShader 标成视觉通过
- 要求像素级对齐未进仓库的商业参考片

---

## 5. 收到反馈后怎么迭代

优先顺序固定：

1. **blocker**：裁切、看不清落点、导出失败、Take 与画面不一致。
2. **should-fix**：节奏、清除峰值、材质过曝/过脏——只动演出层，不改规则。
3. **note**：下一轮 Look / 新游戏包再处理。

同一条 Take 应能在只改 Look 或节奏后重导，不需要你重下。若反馈要求「重下才好看」，会先查是导演问题还是渲染问题。

架构 Review 已通过，不等于这些 MP4 已过审。下一轮代码会针对你点名的时间戳改 Pass、LookDev 或节奏默认值，再请你用**同一输入表**重导 1～5，做前后对比。

准备开 **crash wooooood! Diagnostic Slice** 之前，请先把上述 Block Placement 成片的 blocker 说清楚。Crush 第一刀仍是诊断切片，不是完整坍塌影视。
