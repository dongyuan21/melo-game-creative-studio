# 架构

## 产品目标

浏览器 **Studio** 完成牌面编辑、真人或机器试玩、语义 Replay、导演节奏、Reference 2D 校准、固定机位混合影视渲染和固定帧视频导出。同一套玩法真值也通过 **原子 CLI** 暴露给外部 Agent 和 CI；`skills/` 里的官方 Skill 只编排这些命令，系统不内嵌 LLM。

当前演示游戏三款：Block Placement、TapTile Tray Match3、crash wooooood!。Mahjong（`mahjong-solitaire`）仅 Studio Coming Soon，没有 Agent / authoring / render 适配器。Blender/AE 不进入当前运行链，只在后续作为资产工厂接入。

## 两条客户端

```text
人类  →  Studio（Chrome）→ 编辑 / 试玩 / 导演 / 导出 MP4
外部 Agent / CI  →  官方或自写 Skill  →  melo CLI 原子命令  →  JSON / 工程 / MP4
```

CLI 改的是能力契约。Skill 改的是配方。不要把多皮矩阵做成新的 CLI 开关。命令手册：[`cli/README.md`](cli/README.md)；分层：[`../skills/README.md`](../skills/README.md)。

## 三层真值

```text
Gameplay / Replay / Event truth
              │
              ├── Reference2D Renderer
              │   用于布局、时序、资产谱系与 Golden Scene 校准
              │
              └── FixedCameraCinematic Renderer（当前 Placement 生产路径）
                  ├── Screen 2D
                  ├── Procedural Shader / Render Recipe
                  ├── Camera-facing Sprite
                  ├── Shallow 3D
                  ├── Full 3D tile / large fragments
                  └── Baked-view / baked-transform assets
```

Reference 2D 不会被 Cinematic 后端替换，它长期承担标准答案、调试视图和回归基线。Studio 导出和 `melo render` 的 Placement 电影镜头走同一套固定机位后端；`look.copper` 是参数铜金属外观，plan-bound PBR 贴图仍走 `variant compile`。

## 单向依赖

```text
Game Package（互不 import）
  → Game Runtime（State / 该游戏的 semantic Action）
  → GameReplayEnvelope / Take
  → Presentation Compiler
  → PresentationFrame / Event tracks
  → Renderer Backend（Reference 2D | 固定机位 cinematic）
  → Canvas / VideoFrame
  → WebCodecs / MP4
```

玩法状态不依赖 React、Three.js、Canvas 或视频编码器。Renderer 只能消费真值层，不能反向改变合法动作、计分或 Replay。

平台层（`src/game-runtime`、`src/headless`、`src/cli`、`src/capture`）禁止反向依赖 `src/games`。CLI 经 bootstrap / registry 按 `gameId` 调度。`scripts/check-architecture.mjs` 在 CI 中检查这些边界。

## 语义资产而不是文件清单

`ASSET_LINEAGE_V2` 将一个画面原子建模为：

```text
semantic role
+ requirement policy
+ trigger
+ dependencies
+ evidence status
+ renderer representations
+ view dependency
+ replaceability
```

因此同一个 `clear.tile-destruction` 可以在 Reference 2D 中表现为渐隐/缩小，在固定机位后端中表现为真实大碎片 + Sprite 小碎屑，而不改变清除事件本身。这份谱系目前服务 Block Placement 的参考审计；其他游戏有自己的 Slot / Pass，不复用同一份 Atom 表。

## 固定机位契约

摄像机是一级 `CameraProfile`：

- Transform 锁定；
- 不允许 Orbit；
- 不允许镜头动画；
- 允许受限的最终屏幕平移、缩放、微旋转、震动和曝光脉冲；
- 物理投影在 Golden Scene 校准前保持 `calibration-pending`，不从单条录屏臆测焦距。

`src/assets/semanticAssetTypes.ts` 与 `src/assets/fixedCameraProfile.ts` 提供类型契约。

## 全视频审计

`tools/reference_audit/analyze_video.py` 解码每一个源帧，输出无时间缺口的状态索引和机器候选事件。人工复核事件与机器候选明确分级。公共仓库只提交帧号、状态、资产谱系和规则证据，不提交参考游戏的视频或截图。这是 Placement 参考片的审计工具，不是三款游戏共用的片源。

## 人类与机器统一入口

每款游戏有自己的 semantic Action（Placement 落子、TapTile 点选、Crush 投放）。人类在 Studio 里的拖拽/点击和 `melo agent run` 最终都写入统一的 `GameReplayEnvelope`，再经过该游戏的确定性回放校验。

动作真相是规则层的合法操作，不是像素。指针轨迹只是导演信息。Agent 通过合法动作 API 下棋，无需截图猜测棋盘。Coming Soon 的 Mahjong 没有这条入口。

## 实时与成片分离

实时试玩只记录 Replay。成片阶段编译固定帧 `PresentationFrame`，逐帧重演后送入浏览器视频编码链。因此导出可以慢于实时，但动作帧位不随机器负载变化。Node 进程本身不编码像素；`melo render` 拉起无头 Chrome，只有写出 MP4 后才把 `rendered` 设为 `true`。

## DCC 扩展缝

DCC 接入必须在 Reference 2D 资产槽位和固定机位契约稳定后进行。未来 Blender/AE 输出将编译为 Runtime Asset，而不是让浏览器直接解释任意 `.blend` 或 `.aep`。DCC 资产必须声明 Camera Profile、空间表达、可重新打光/换材质能力和性能预算。
