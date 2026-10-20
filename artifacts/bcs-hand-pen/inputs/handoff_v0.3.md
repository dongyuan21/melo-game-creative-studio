# BCS 手笔联动：Grok Bot＋Cursor 云端构建交接（单文件版 v0.3）

日期：2026-10-20。

**直接把此文件交给 Grok Bot。它包含完整技术方案、执行任务书、云端部署说明、验收标准和契约示例；没有依赖本对话里的隐含上下文。**

目标：使用 Cursor 在已授权云主机实现自然持笔动作与 BCS 最终拖拽一致。不是用户本机 Codex 工作流。用户电脑不需要安装 Blender；实际云端求解／渲染环境需要可运行的 Blender。首期不需要 Seedance Key。

本文件是设计交接，不是已经部署的系统。原视频、独立握笔 PNG、真实 BCS 工作区和手模型均须在目标云机核对，不能假定附带。业务 /0.2 schema 保留，执行包修订为 v0.3。

以下每节标题标出其在 ZIP 中的原文件名。正文提及“读取某文件”时，可直接阅读此文对应章节；不解压也能获得全部设计内容。JSON 和 TypeScript 原文在后半部分，可在实现时提取，不能把示例占位路径当真实输入。

## 文件对应索引
- 1. `README.md`
- 2. `00_发给Grok_Bot.md`
- 3. `02_Grok_Bot_Cursor执行任务书.md`
- 4. `06_云主机环境与Blender部署.md`
- 5. `01_技术方案.md`
- 6. `03_验收矩阵.md`
- 7. `07_阶段交接与成果回传.md`
- 8. `04_contracts.ts`
- 9. `examples/job.example.json`
- 10. `examples/scene.proxy.example.json`
- 11. `examples/cloud.execution.example.json`
- 12. `05_来源与核查记录.md`
- 13. `08_v0.3变更说明.md`
- 14. `VALIDATION.md`


---

# 交接章节 1 · `README.md`

## melo-gcs（BCS）手笔联动交接包 v0.3
### Grok Bot 接收任务 · Cursor 开发 · 云主机执行

日期：2026-10-20。

**本版替代 v0.2 的“用户本机＋Codex”执行前提。技术目标不变：自然的右手持笔动作，与 BCS 最终拖拽、预览、提交／取消精确匹配。**

优先做动作，沙发／平板外观与 Seedance 放到后面。用户电脑无需为本任务安装 Blender；执行求解与渲染的云主机内需要安装或提供可运行的 Blender。首轮 E0、P0–P5 不需要 Seedance API Key。

本包是完整设计与执行任务书，**不是已实现的 BCS 插件，不含已跑通的云部署、三维手模型或新样片**。`04_contracts.ts` 是类型草案；示例 JSON 明确标为 `exampleOnly`，不能当成实测环境、存在的资产或已通过报告。

### 交接方式

把本包交给 Grok Bot，从 `00_发给Grok_Bot.md` 开始。Bot 应先确认自己控制的云电脑和 Cursor 实际工作区。优先让 BCS、浏览器、Blender 和输出目录在同一台已授权主机；跨主机方案仅在真实资源约束出现后另行批准。

不要把本对话附件路径、用户电脑路径或 `sandbox:/mnt/data/…` 当作 Grok Bot 已经可读取的路径。参考视频和独立握笔 PNG 需在目标环境真实可访问。六帧拼图可以用于构图参考，但不能冒充独立透明手素材或完整原视频。

### 阅读顺序

1. `00_发给Grok_Bot.md`：可以直接发给 Bot 的任务入口与权限边界。
2. `02_Grok_Bot_Cursor执行任务书.md`：Bot 与 Cursor 的分工、E0→P5 执行要求。
3. `06_云主机环境与Blender部署.md`：云主机预检、Blender／浏览器独立冒烟和持久化。
4. `01_技术方案.md`、`03_验收矩阵.md`：坐标、时序、骨架控制和完整验收。
5. `07_阶段交接与成果回传.md`：进度、失败、恢复及交付要求。
6. `04_contracts.ts`、`examples/`：接口与说明性配置。
7. `05_来源与核查记录.md`、`08_v0.3变更说明.md`、`VALIDATION.md`：来源、变更和本包自身检查。

### 核心不变项

- BCS 仍然是玩法与屏幕画面的唯一来源，不把游戏规则搬到 Blender。
- 只用一份最终交互时间线；不让手独立平滑、变速或追赶游戏。
- 先探针、再笔、再三维手，再看自然度；PNG 仅作参考，不作为最终刚性贴图手。
- 保留真实抓取偏移，提交不等于松开笔；取消不产生玩法提交。
- 未运行、失败、阻塞、技术通过、动作待人审、外观批准分别记录。
- 不新购云资源、不接付费视频接口、不更改系统驱动、不发布或 push，除非另有明确授权。

### 环境与输入

不默认云主机是 Linux、具有 GPU、sudo 权限或已安装软件。E0 探测后记录实际系统。部署说明以 Linux 无界面主机为默认操作示例；如实际是 Windows，沿用相同后台执行目标并调整命令，不为了套文档迁移系统。

需要：可访问的 BCS 工作树或经授权的仓库入口、有效 Cursor 会话／凭证、允许写入的持久目录。参考视频、握笔 PNG 和手模型可按阶段补齐；必须标注缺失，不阻塞无关阶段，也不伪造视觉验收。

包版本更新到 v0.3；业务 `/0.2` schema 不变。本轮沿用 v0.2 历史源码检查快照 `f5278635…` 作为审计线索，不证明目标云主机的当前代码相同。


---

# 交接章节 2 · `00_发给Grok_Bot.md`

## 发给 Grok Bot：使用 Cursor 在云主机实现 BCS 手笔联动

请阅读附件交接包，使用你当前云电脑或用户已授权的云主机中的 **Cursor** 实际开发、运行和验证，不要仅输出讨论或再次生成计划。

### 目标

在现有 BCS／melo-game-creative-studio 上实现：一只自然屈伸的右手始终握住笔，笔尖接触、拖动、预览、提交／取消和抬笔与 BCS 最终交互一致。

先完成动作技术闭环：统一轨道 → 探针 → 笔 → 绑定手与前臂 → 不同动作回归。沙发、平板外观、Seedance 底板、皮肤极致写实和镜头抖动放后面。

### 你与 Cursor 的职责

你负责取得输入、确认目标云环境、给 Cursor 分阶段任务、核对可播放产物和报告、将结果交回用户。Cursor 负责检查与修改实际代码、安装被允许的依赖、运行 BCS 和 Blender、输出测试证据。不是让你重建一个聊天机器人，也不需要新建 Agent runtime。

优先用已有的 Cursor 使用入口；无桌面时评估 Cursor CLI。使用 CLI 前核对目标机版本、登录与权限；不得未经批准默认启用 `--force`／`--yolo`、关闭沙箱或暴露云主机端口。不要在未确认的托管环境中自动创建另一台云机器。

### 首先完成 E0，不要求用户在自己电脑安装软件

检查云主机 OS／架构、Cursor、仓库状态、Node／锁文件、浏览器／WebGL、FFmpeg、Blender、GPU 和持久磁盘。Blender 应安装／运行在真正求解和渲染的云环境中。保留现成版本；无现成版本时以 Blender 4.5 LTS 作为兼容性基线候选，验证后锁定具体版本。

分别进行：
1. BCS 浏览器实际出帧／编码冒烟；
2. Blender 无界面实际保存工程和小尺寸渲染冒烟。

没有 GPU 仍可以先做代码、几何、IK 与有限 CPU 预览；不要因此停止全部开发，也不要谎报 GPU 或产能。确实需要新资源时返回具体需求与已测耗时，未经批准不购买或扩容。

### 输入处理

先检查真实可访问的云端文件。BCS 可能需要从已有授权仓库取得；仓库候选为 `dongyuan21/melo-game-creative-studio`，不是强制覆盖现有 checkout。用户电脑的未提交代码并不会自动同步到云端，不知道时报告差异。

参考实拍视频和握笔 PNG 如未随附件出现，登记具体缺口。不要假定本对话的 sandbox 路径可读，也不要把分析拼图当作透明手贴图。缺素材时继续不依赖它们的阶段，手部视觉匹配不能提前通过。

### 执行与边界

先读 `02_Grok_Bot_Cursor执行任务书.md`、`06_云主机环境与Blender部署.md`；再按 `01_技术方案.md` 和 `03_验收矩阵.md` 执行 E0、P0–P5。

在独立工作区／实验分支中保护已有修改，遵守仓库 `AGENTS.md` 与 `.cursor/rules`。一次只让一个 Cursor 实例写同一工作树。阶段完成或阻塞即保存进度、实际运行命令、证据路径和输入哈希，不依赖聊天记忆恢复。

允许在已授权项目目录内开发、测试，以及在政策允许范围内配置项目级依赖。涉及付费、sudo、驱动更换、外部发布、扩大网络权限、下载许可受限资产或 push 时先请求确认。

不需要 Seedance Key，首轮不调用付费生成 API。不修改游戏规则来掩盖动作不匹配。手模型从现成合法可绑定资产取得，不能用占位模型宣称自然手已通过。

### 必须交付

先交一个真实约 5 秒的探针／笔／手闭环，随后完成 3 段不同动作的干净版和诊断版，以及冻结模板后的至少 5 个新动作结果。每阶段可先交实际完成的小产物，不能等最后再发现渲染不了。

最终交付代码 diff／获准的分支、环境锁定信息、BCS 工程与轨道、Blender 工程与烘焙、资产许可记录、视频、QC、失败样本和复现命令。通过可访问的附件或已批准的私有交付位置回传；仅给云主机绝对路径不算完成。

分开报告：运行状态、技术检查、动作人工评审、外观评审。没有人审就写 `REVIEW_REQUIRED`。Bot 自己看过不能等同于用户批准。该包是设计任务书，不是已经实现的系统。


---

# 交接章节 3 · `02_Grok_Bot_Cursor执行任务书.md`

## 给 Grok Bot／Cursor 的云端执行任务书 v0.3

本任务由 Grok Bot 接收，使用 Cursor 在云主机的 melo-gcs／BCS 工作区执行。目标是按阶段交付实际工程、视频和验证证据，不是只生成方案。先读本包 README、技术方案、验收矩阵、云端部署说明，再检查云端仓库的 AGENTS.md、.cursor/rules 等约束。

Grok Bot：输入／授权／环境确认、向 Cursor 传递阶段任务、检查实际文件与报告、回传成果。Cursor：代码审计与开发、依赖配置、真实测试与渲染。复用已有工具链，不自建 Bot 平台或 Grok→Cursor SDK。后面的“你”指实施任务的 Cursor 执行者；Grok Bot 负责追踪其产物与状态。

### A. 已确定的方向

先完成“自然的右手持笔动作与 BCS 最终拖拽画面匹配”。沙发、真实平板外观、Seedance 场景底板、镜头抖动放最后。

用户此前说明有 BCS、参考实拍视频和握笔 PNG；本轮未确认它们已进入云主机。先核对可访问文件和代码版本，不推测已上传。三维模型尚未准备，不能假定存在。PNG 用作握姿参考，不作为最终刚性贴图手。

三维动作用 Blender；优先取得现成合法可绑定资产或 MPFB 默认骨架，不从零用简单几何拼一只“写实手”。首轮不需要 Seedance Key，不调用付费 API，不购买模型，不建立新 LLM 后端。

### B. 工作方式

1. 从当前工作目录确认 repo root、git status、分支和 commit；保留未提交修改。不要 reset、删除或覆盖用户已有文件。
2. 创建清晰的实验分支或独立目录。路径按云端实际仓库架构调整，最小修改。不要为了套方案切回云端检查的旧快照。
3. 输出审计结果后继续完成能够自主推进的阶段；不要只有一份计划。遇到真实阻塞，记录可复现错误、缺少的确切输入和已完成的交付。
4. 每阶段至少有真实执行证据。运行成功、技术通过、动作审核、外观审核分开。
5. 不自动 push、不公开上传模型／视频、不把凭证写入文件。下载遵循原网站登录与许可，不绕过限制。

### B1. E0：云主机就绪与两条链路冒烟

完整操作见 `06_云主机环境与Blender部署.md`。此阶段先于 P0，不另行建设复杂环境平台。

- 记录 Bot 所在机、Cursor 工具实际执行机、BCS 路径和 Blender 运行机；优先同机，检查 cwd 与权限，不能只看远程桌面标题。
- Cursor 入口沿用现有配置。CLI 仅在适用时启用，先核对 `agent --help`／实际可执行文件和登录。不默认取消权限检查。
- Blender 缺失时在允许范围内使用官方兼容发行版，并记录下载来源、校验和和版本。系统库、管理员权限或驱动缺失需确认，不盲目升级机器。
- Blender 和 BCS 浏览器分别真实出帧；Blender 能渲染不代表 Chrome 的 WebGL 或编码可用，反之亦然。
- GPU 状态必须区分“操作系统看到设备”“Blender 可选设备”“实际渲染使用了设备”。无 GPU 可以先 CPU 小样，不声称 GPU 性能通过。
- 建持久 inputs/assets/runs/deliveries 目录，输入文件哈希入库，检查写权限和容量；`/tmp` 仅作临时缓存。

交付 `environment.json`、输入清单、Blender smoke 工程／PNG／日志、BCS smoke 视频或明确失败证据。环境检查不是正式手部验收。完整环境未就绪时只阻塞相关阶段，不伪造 PASS。

### C. P0：云端代码审计与基线

检查 Node、包管理锁文件、项目现有测试、Chrome／实际导出浏览器、Blender、FFmpeg、GPU 和可用磁盘。使用云端可工作的稳定版本并记录，不盲目升级依赖。

找到真正的调用链：

`Project/Take → Presentation compile → final FrameSource → active renderer → actual encoded output`。

核对以下位置，名称可能已在目标版本变化：

- `src/domain/types.ts` 中指针、动作和帧类型；
- `src/games/block-placement/presentation/presentationCompiler.ts`；
- `src/games/block-placement/presentation/legacyPresentationAdapter.ts`；
- `src/games/block-placement/render/BlockPlacementReferenceScene.ts`；
- `src/games/block-placement/render/BlockPlacementCinematicScene.ts`；
- 真实使用的 Studio／CLI render 入口和帧导出器。

必须验证：坐标对应哪个 viewport、DPR 和留白如何处理、拾取偏移如何实现、Cinematic 是否吸附、最后接触／释放／提交边界、预览是否用最终 anchor 而非当前 anchor、取消是否保留、fallback pointer 是否实际会被使用。

运行现有测试与一段可实际编码的短基线。记录现存失败，不将不相关失败伪装成新改动失败，也不忽略它们。

交付：`audit.md`、`environment.json`、`baseline.mp4`、`baseline-evidence.json`。选定一个实际目标输出后端。

### D. P1：BCS 导出适配与最终交互轨道

复用／最小提取共享呈现计算，禁止屏幕绘制和手部导出各自发明轨迹。生成版本化 HandSyncBundle：screen PNG 序列、frame manifest、最终交互轨道、布局、来源与哈希。

动作事件与持续反馈分开；commit、cancel、pointerup 必须有稳定 ID，不能逐帧重复触发。把旧的 releaseFrame 映射为经测试确认的边界，不靠名字猜测。

历史 Take 的接触信息缺失时标注 synthesized，而不是 recorded。需要试探／取消时，增加明确的呈现侧尝试段；取消不会提交棋盘。必须由 BCS 画出对应拖动与恢复过程，不能只让手做取消动作。

有两种运行模式：preserve 现有最终轨迹；joint-redesign 统一规划更自然的新轨迹再重编译 BCS。禁止只平滑 Blender 的接触轨迹。

交付：实际 bundle、`screen-debug.mp4`、时间／坐标单测、release/commit 边界证据。

### E. P2：先探针，再笔，不等三维手资产

在 Blender 建立尺寸已知的代理屏幕、固定相机。配置内容适配矩形，默认有一例必须带留白。

用小球代表笔尖，驱动 9 点标定和一条真实 BCS 拖动。接着生成独立笔模型，确认旋转和倾角变化后实际笔尖仍落在目标。

使用 world/armature/pose/local 显式转换。配置 JSON 四元数分量顺序与 Blender 构造转换要写测试。关闭镜头抖动、景深、运动模糊。

QC 读取经过依赖图求值的笔尖几何，并比较独立的屏幕目标。不要把 PenTarget 的位置与自身比较。

交付：`probe.blend`、`probe.mp4`、`pen.mp4`、投影与高度误差报告。只有该阶段通过才开始用手遮挡。

### F. P3：取得资产、校准握笔和骨架

优先评估 MPFB 默认人体 rig 和 IK helper，核心资产来源和许可见来源文件。只渲染右手／前臂，保留需要的画外骨架。若云端已有质量更好的合法可绑定手，允许通过 RigAdapter 替换。

记录下载地址、作者／项目、资产与工具许可、校验和、原始文件和导入版本。模型来源需要账号／人工操作时精确报告，不假装已下载；P2 不受此阻塞，P3 不可用占位手冒充通过。

输出骨骼清单与 RigAdapter。姿态参考用户 PNG；建立至少一套自然三指握笔，确定 T_hand_pen、笔尖和控制骨空间。

按 PenTarget → WristTarget → ArmIK 单向约束，不允许笔和手互相作为控制父级形成循环。手指持笔期间先固定；“松开游戏块”不是“松开笔”。限制关节、设置 elbow pole、关闭 stretch，检查实际网格接触。

交付：`grip.blend`、`rig-profile.json`、`asset-manifest.json`、三个关键姿态图、约 5 秒的拖动抬笔视频。

### G. P4–P5：自然动作与新动作回归

完成短拖、长拖、停顿试探、取消、抬笔和连续拿下一块。先在灰模中观察自然度，再增加基础材质。输入过快时只能共同重编译时间线，不能只让手慢一点。

做 3 段约 8–15 秒的视频，各有干净版和诊断版。冻结模板与参数后生成至少 5 个未单独调过的新 Take 作为留出测试；不是随机换颜色，不是逐条修好再称批量。

用约束检查覆盖全部帧；关键高速／转向区间增加子帧检查。记录速度、加速度、角速度作为诊断，不虚构一个“自然度分数”替代视觉审核。

保留至少一组不加噪声、不抖镜头的结果。自然度仍待人审时状态为 REVIEW_REQUIRED，不得自动写成 production_ready。

交付：批量输入、配置快照、视频、动作烘焙、逐帧误差、关键帧、negative tests、qc.json 和复现命令。

### G1. 云端任务管理与审核边界

每个运行使用唯一 runId 与独立目录。保存 input-hash、环境版本、命令、阶段、退出码和输出校验信息；任务恢复前先验证输入是否变化，不直接沿用旧聊天结论。渲染任务串行起步，不由两个 Bot 同时覆盖同一文件。

长渲染仅启动一次，使用目标环境已批准的持久会话／进程管理方式记录 PID 和日志；不要因为一次工具调用超时就再开重复渲染。遇到共享服务器资源冲突，只停止本任务拥有的进程，不清理其他人的任务。

动作评审需要用户实际看到片子并批准。技术通过后可继续生成诊断与候选对照，但不得把未批模板当作 production-ready 扩大生产。向用户交付视频附件或经过验证的私有下载方式，不能只贴无法访问的云路径。详见 `07_阶段交接与成果回传.md`。

### H. 允许的最低新增接口

新增独立实验入口或按仓库习惯接入以下原子操作：inspect、export、asset-prepare、solve、render、verify。名称可变，功能不可缺。

这些命令现在尚不存在；你需要实现并补 help / error code / exit code。

Blender 调用可以遵循这种形式（文件名、脚本和参数由你实现，不能仅写下命令就交付）：

```bash
"$BLENDER_BIN" --background <template.blend> --python-exit-code 1 --python <render_job.py> -- --job <job.json>
```

每条成功任务必须实际编码并用 ffprobe／解码回读确认帧数和时长。进程退出 0 不等于视频存在且可播放。

### I. 禁止提前做的工作

不要先生成沙发，不要为背景建模板平台，不要修皮肤到毛孔级，不要先做复杂人体物理，不要先做 Seedance mask 管线，不要从 BCS 迁移玩法到 Blender，不要重构整个多游戏平台。

P6 只在动作测试通过后准备生成式增强对照；其 API 参数和可用功能必须以当时实际服务为准。P7 才把最终场景外观接入。

### J. 最终汇报格式

汇报实际实现入口、修改文件、运行环境、测试命令、输出位置和用户实际能访问的交付附件。补充执行主机映射、Cursor 入口与授权状态、实际 CPU／GPU、未执行的依赖步骤。分开列出：

- 技术已通过的检查和证据；
- 人工已批准／待批准的动作和外观；
- 阻塞项、已知失败和没有测试的路径；
- 缓存命中和首跑耗时（目标主机实测值，不使用方案中的算例）；
- 下一阶段是否具备进入条件。

不要说“已经复刻真实拍摄”除非完整视觉审核确实通过。不要把本任务包的类型检查记录说成你的工程测试结果。


---

# 交接章节 4 · `06_云主机环境与Blender部署.md`

## 云主机环境与 Blender 部署（E0）

本文件是可执行的环境准备规范，不代表目标云机已经配置成功。默认用 Linux 无界面云主机说明；实际 OS、架构和权限必须先探测。用户自己的电脑不需要安装 Blender。

### 1. 先确认“真正在哪里运行”

由 Grok Bot 记录四项：Bot 云电脑、Cursor 的终端执行机、BCS 工作区、Blender 求解与渲染机。首轮尽量是同一台机器。远程桌面的窗口在一台机器，不足以证明终端命令也在该机。

优先沿用现有 Cursor 入口；不要为了套本方案迁移成 Cursor 托管 Cloud Agent。若已有桌面版能编辑并运行终端，继续使用。无桌面且有权限时，使用官方 Cursor CLI；不需要为 Blender 安装远程桌面或 MCP。

Grok Bot 的云电脑不默认有 GPU。存在桌面也不代表硬件图形加速可用。Linux 容器内看到的 GPU 与宿主机可能不同；必须在真正执行 Blender 的同一环境探测。

### 2. 工作区与持久目录

以下是建议布局，不是假定已经存在：

```text
<WORK_ROOT>/
  repo/                 # 经确认的 BCS checkout 或 worktree
  hand-sync-plan/       # 本包，建议只读保存
  inputs/               # 原始视频、PNG，保留原件
  assets/               # 模型、贴图、许可、导入缓存
  tools/                # 允许时放用户级 Blender 等工具
  runs/<runId>/         # 本次 bundle、求解、渲染、报告、日志
  deliveries/<runId>/   # 回传副本、检查清单、可审阅样片
  state/                # 当前阶段、环境与恢复记录
```

选择真实持久挂载或平台持久目录。不能只将最终成果放在 `/tmp`，也不能假设重启后某个缓存仍存在。路径统一从配置解析；仓库中不得写死开发者电脑的 `C:\…`、`D:\…`、`/Users/…` 路径。方案包中的 `/mnt/data/…` 也不是目标云机路径。

第一轮同一代码工作树只允许一个 Cursor 写入者，渲染并发设为 1。其他 Bot 如需读取只读证据，使用已冻结的产物副本。不要建立复杂分布式调度。

### 3. 环境预检清单

| 检查 | 必须记录 | 不应作出的推断 |
|---|---|---|
| OS / CPU 架构 | 发行版、架构、CPU／内存配额 | 不默认 x86_64 或 Ubuntu |
| 工作区 | repo root、HEAD、branch、dirty、现有规则 | 不默认与用户电脑完全同步 |
| Cursor | 实际入口、版本、登录与写权限状态 | 能聊天不等于已修改代码 |
| Node／包管理器 | 仓库指定版本、锁文件、安装结果 | 不另换包管理器升级全仓 |
| 浏览器 | 可执行文件、版本、启动日志、实际 WebGL 后端 | 有 Chrome 文件不等于可出片 |
| Blender | 可执行文件、版本、启动、保存和出帧结果 | 下载成功不等于能渲染 |
| FFmpeg/ffprobe | 版本、可用编码与解码能力 | 不要求 NVENC；软件编码可以 |
| GPU | OS 设备、Blender 设备枚举、实际后端与日志 | `nvidia-smi` 成功不等于 OptiX 成功 |
| 存储 | 输入可读、目录可写、可用容量、持久性 | 不承诺无限磁盘 |
| 网络／权限 | 仓库、官方工具、资产站点可达性 | 不绕过登录和验证码 |

预检只收集必要信息，不执行 `env` 全量转储，不把 token、SSH key 或账户详情写进报告。云机共享文件属于授权工作环境；额外加一个目录并不等于对同账户其他 Bot 构成安全隔离。[S14]

### 4. Cursor 配置

先查现有安装，使用实际可执行文件执行版本／help；目前官方 CLI 的主要入口为 `agent`。[S11][S12] 不需要把 Grok Bot 的名称转换为某个 `--model` 参数。

安装／登录缺失时遵守现有账号与权限流程。登录凭证通过平台安全配置或环境注入，不能把 key 放到任务书、shell 参数或 Git。不要在无人审批时默认使用 `--force`、`--yolo`、关闭 sandbox 或自动信任所有 MCP。

若确实使用 CLI，可按目标主机 help 选择 print 与明确输出格式；每次交给 Cursor 一个阶段任务，而非反复投递整个计划导致重复工作。读取仓库 AGENTS.md、.cursor/rules，不覆盖现有全局规则。[S13]

若只得到建议没有落盘修改：记录权限／模式问题，使用用户已批准的写入方式继续，不能将建议代码标作已实现。

### 5. Blender 安装和版本冻结

先检查已有安装；存在能运行的稳定版本就先测试，不盲目替换。没有时优先评估 Blender 4.5 LTS 官方发行包作为本项目兼容基线，依目标 OS／CPU 架构选正确包。[S15]

可在授权用户目录解压便携发行包并设置 `BLENDER_BIN`，无需要求用户在个人电脑安装。下载后核对官方校验信息／来源，记录版本和包哈希。不要自动将整机默认 Blender 指向新版本。

后台启动仍可能需要系统运行库。缺库时先报告具体错误；项目级可解决的依赖在授权范围内处理，涉及 sudo、驱动或管理员政策时请求确认。不要用 `pip install bpy` 代替安装完整 Blender；脚本由所选 Blender 内置 Python 执行。

云主机若已有容器规范则沿用，在容器内检查实际 GPU 和依赖。不要默认改为特权容器、挂载整个宿主文件系统或安装不明镜像。

#### 必须完成的最小冒烟

先执行：

```bash
"$BLENDER_BIN" --version
"$BLENDER_BIN" --help
```

在已批准的运行目录创建小型 `blender_smoke.py`，要求它只创建默认简单几何、相机和灯光，设置 Cycles CPU、256×256、8 samples，写出 `smoke.blend` 与一张 `smoke.png`；不得导入未知模型或执行其嵌入脚本。然后按目标主机支持的参数运行：

```bash
"$BLENDER_BIN" --background --factory-startup   --python-exit-code 1 --python "$SMOKE_SCRIPT" --   --out-dir "$SMOKE_DIR"
```

`SMOKE_SCRIPT` 由 Cursor 实际编写，`--out-dir` 是该自建脚本解析的参数，不是 Blender 已有业务命令。上面不是本包已实现 runner 的运行入口。

验证文件非空、PNG 可读取、`.blend` 可重新打开并渲染同一测试帧。保存 stdout/stderr、退出码、分辨率和耗时。后台渲染支持与命令顺序见 [S16]。

### 6. GPU 检查和无 GPU 处理

CPU 冒烟通过后才检查 GPU。先记录 OS 设备；再让 Blender Python 枚举 Cycles 可用设备及后端；最后在相同小场景中实际使用指定 GPU 渲染并保存证据。

必须区分 `gpu_detected`、`gpu_backend_available`、`gpu_render_verified`。选择了 GPU 设置也不自动等于驱动实际使用成功；日志不充分时保持 UNVERIFIED。失败时保留原异常，不静默回退 CPU 后写 GPU PASS。

无可用 GPU 的处理：

- E0、P0–P1、数值映射、骨架求解和低分辨率短预览继续，按实测资源和限额执行。
- 小预览可使用 270×480／540×960 与少量样本，记录质量档位；低分辨率 QC 按 1080×1920 像素尺度换算，不能代替最终输出验证。
- 全片或大批渲染前先测有限帧，估算时间／磁盘，不先发数千帧任务。
- CPU 有能力产出时仍可完成同等正确性检查，但不声称性能与 GPU 相同。超出已有资源预算，标记相关渲染阶段 BLOCKED 并保留可移交 Bundle。
- 不自动新建付费 GPU 实例。需要外部 GPU worker 时单独确认授权、输入传输和版本，不能成为 E0 默认架构。

GPU 驱动更新不是本任务的默认权限，不能为了一个 Blender 错误修改共享服务器驱动。

### 7. BCS 浏览器必须单独验证

按仓库锁文件安装依赖，先运行现有测试和生产导出。记录实际渲染后端、WebGL／编码支持、导出帧数和结果。不用一个 Node 进程退出 0 代替浏览器出片证据。

优先使用仓库已验证的浏览器驱动与启动方法，不顺手迁移为另一套自动化框架。浏览器无界面可用就不引入虚拟桌面；只有现有渲染链确需显示服务时才在授权范围内补充，并记录原因。

采用普通用户和正常 sandbox；不把 `--no-sandbox` 作为默认修复。软件 WebGL 可以作为经过验证的诊断路径，但如其像素与真实目标后端不同必须注明，不能用诊断路径 PASS 替代实际后端。

若 WebCodecs 编码不可用，但实际后端能正确导出 PNG，可在获准的适配范围内使用 PNG→FFmpeg 输出作为新编码路径；必须记录变化并验证帧数、时间戳与颜色，不能伪称原编码器已通过。连正确屏幕像素都没有时，不能手工画几张方块替代 BCS。

### 8. 资产与插件

真实模型和贴图进入 assets，并记录许可、来源和哈希。首选现成可绑定资产／MPFB。MPFB 的 GUI 操作不能直接假设在 background 模式可用：先核对当前插件 API 和导入路径；没有可复现无界面路径时，允许一次性的可审阅人工／桌面准备，但要保存批准的 `.blend`，后续批次不能重复依赖未记录点击。

不要对陌生 `.blend` 默认启用嵌入脚本自动执行。确需 rig 驱动或插件时先审来源，在授权范围内加载。握姿仍要人工评审，不因“绑定成功”自动批准。

本包没有独立握笔 PNG；用户声称持有，不等于已上传到目标机。文件清单不出现就登记为缺失。参考视频缺失时，源片复刻检查暂缓；BCS 合成轨迹与手部控制仍可探索。

### 9. E0 的输出与进入条件

`environment.json` 至少记录：选定执行位置、工具路径与版本、已确认的权限边界、repo 状态摘要、输入清单、CPU/GPU 验证状态、浏览器出片状态、持久目录、日志路径与缺口。凭证字段只记 configured/not_configured，不保存值。

`environment.lock.json` 是通过冒烟后生成的实际版本记录，不把示例文件复制过去冒充事实。恢复任务时重新比对。

E0 可按依赖部分完成。完成环境探测并知道可执行边界后即可推进能做的阶段；例如模型尚未取得不阻塞 P1–P2。Blender 不可运行时不能声称 P2 通过，BCS 实际像素未验证时不能声称整套同步通过。

### 10. 运行限制

默认不新增付费接口，不升级系统驱动，不公开服务端口，不自动 push，不上传模型到公开存储。项目服务器绑定 loopback，远程审核使用已有授权附件／私有通道。会话结束前保存实际已完成证据与恢复点，不承诺未启动的后台任务。


---

# 交接章节 5 · `01_技术方案.md`

## melo-gcs（BCS）手笔联动：技术方案 v0.3｜Grok Bot＋Cursor 云主机版

日期：2026-10-20。状态：设计交接，尚未连接或在用户的 Grok Bot 云工作机／授权云主机完成部署、代码修改或渲染验证。

包版本为 v0.3；交互、骨架、Bundle 的 `/0.2` 数据契约保持不变，避免把执行环境变更误当作业务协议升级。新增云端执行配置是设计草案，详见 `examples/cloud.execution.example.json`。

### 0. 本次变更：交给 Grok Bot，使用 Cursor 在云主机执行

**用户电脑不再是构建或渲染前提，用户不需要为本任务在自己的电脑安装 Blender。Blender 必须出现在实际执行动画求解和渲染的云主机／容器内。**

分工：Grok Bot 接收附件、确认授权的工作机与工作区、将明确阶段任务交给 Cursor、核查证据并向用户回传；Cursor 在同一云工作区读写代码、运行测试和调用工具；BCS、Blender 与 FFmpeg 执行实际导出、动画和编码。不要求重新开发 Grok Bot、另建 Agent runtime 或自创跨 Agent 协议。

优先复用 Grok Bot 当前已有的 Cursor 使用方式；有可用 Cursor 桌面就沿用，无桌面时可在被授权的云执行环境使用 Cursor CLI。官方 CLI 提供非交互执行入口，但具体安装、登录、命令与权限以目标机版本探测为准。[S11][S12] 不因写了“云主机”就默认已经创建 Cursor 托管 Cloud Agent，也不假定它有 GPU。

**先执行 E0 云环境预检，再执行下文 P0–P5。** E0 同时检查两条独立渲染链：BCS 浏览器的 WebGL／实际出帧，以及 Blender 的后台求解／实际渲染；其中一条通过不能替代另一条。详细步骤和命令见 `06_云主机环境与Blender部署.md`。

Grok Bot 官方文档描述其云电脑和账户内共享文件环境；因此本任务采用独立目录、单一代码写入者与渲染任务锁，避免影响其他 Bot 的文件和任务。[S14] 不假定管理员权限、GPU、完整桌面、模型资产或本对话附件已自动出现在机器上。

云端缺少 GPU 时，先用 CPU 进行适度的小分辨率、短片和几何测试，并如实记录；不能声称 GPU 已验证或批量产能已达到目标。实际 GPU 渲染或质量渲染受限时，完成可执行的开发部分后提出具体需求；未经批准不新购实例、不修改宿主显卡驱动、不迁移执行位置。

当前交接包不含原始参考视频、独立握笔 PNG 或三维模型。用户原电脑路径和本对话 `sandbox:` 路径不等于云主机可读路径。先登记输入，能继续的代码／探针阶段继续，真实缺口单独报告。

### 1. 目标与范围

第一阶段只证明一件事：一只可自然屈伸的右手，始终握住一支笔，其笔尖接触、拖动、停顿、预览、提交／取消、抬笔，与 BCS 的实际画面和状态转换相匹配。

首版固定：Block Placement、一只右手、一种握姿、一支笔、一个固定机位、一块简化屏幕。先 5 秒闭环，再 3 段约 8–15 秒的不同操作，最终增加冻结模板后的未调参样本。

延后：沙发与平板外观、Seedance 背景、真实相机标定、外部手持抖动、自由运镜、皮肤极致写实、多手型、多玩法、完整身体动作、刚体／软体手物理、商业产线调度。

**外观底板可以延后；坐标参考不能延后。** 现在用尺寸可知的代理屏幕和固定虚拟相机定义空间。后续生成底板尽量遵守已批准的机位与构图。换设备尺度或镜头后要重新做可达性和投影验证。

成功分开记录：运行成功、坐标／时序正确、动作自然、外观批准。不能用“导出了 MP4”替代后三项。

### 2. 前版源码检查线索，以及必须重新核对的边界

远端只读快照：`f5278635ef372f3587bfd2e6574e253dd71a24da`。以下源码发现继承自 v0.2 的历史远端检查记录。本轮未重新审计仓库；由 Cursor 对云主机实际 checkout 重新审计，不将旧快照视为当前事实。

#### 2.1 历史快照中已有的可复用能力

`src/domain/types.ts` 有 `PointerSample`、`PlacementAction.pointerPath`、`durationFrames`、`Take`。[S1]

`src/games/block-placement/presentation/presentationCompiler.ts` 的 `compileTake` 输出动作起始、释放、消除和结束帧；`evaluateCompiledTake` 计算指定帧的呈现结果。[S2]

`legacyPresentationAdapter.ts` 提供 `CompiledFrameSource.evaluate(frameIndex)` 和 `PresentationPacket`，可以作为寻找最终出片帧源的入口。[S3]

#### 2.2 不能直接拿 pointerPath 接一只手就宣布完成

1. `directedDuration` 会把原动作时长和导演节奏混合，`pointerPath.frameOffset` 会重新缩放。必须消费同一份最终时序。
2. 所查 `evaluateCompiledTake` 使用 `safeFrame <= releaseFrame` 仍返回 `pressed: true`。字段名不能代替实际边界语义；要测试最后接触帧、第一松开帧和第一落子画面。
3. 原轨迹不足时会使用含固定归一化坐标的 fallback。它是程序合成路径，不能标成真实用户触控，需重新验证布局和抓取关系。
4. 所查 Reference2D 的拖拽位置使用 pointer，Y 方向减 `pickupLift`；预览参考传入的 anchor。[S4]
5. 所查 Cinematic 的拖拽根据 `pointerDriven` 分支处理，还可能向 target 吸附并添加高度与缩放。因此它不等同于 Reference2D 的简单位移。[S5]
6. 所查帧适配器根据每帧呈现状态生成语义事件；`commit-${frame.frame}` 这类 ID 不等于一次输入提交事件。不能每看到一帧反馈就生成一次 pointerup。[S3]
7. 所查 `frameSourceHash` 的构造内容不足以单独证明手部轨迹和布局都没变。新任务的缓存身份必须包含完整轨迹、布局、姿态配置和资产哈希；不必为此先重构整个平台的 hash。[S3]

#### 2.3 P0 必须产出真实调用链

查清：Studio 实时试玩、Replay、CLI／浏览器导出是否走相同帧源；哪一个是用户实际需要的输出后端；指针坐标相对于何种 viewport；DPR、letterbox、相机投影、吸附和拾取抬高在哪里发生；取消是否已被保留。

至少对短拖动执行一次实际渲染。不能只读类型或导出静态对象就宣布完成审计。

本方案建议抽取或复用共享的 `resolveInteractionFrame` 纯函数，供屏幕绘制和轨道导出共同读取。函数名是建议，不是现有 API。

首版只实现一个经 P0 确认的输出后端。Reference2D 可以作为诊断后端；如果实际交付用 Cinematic，就必须对 Cinematic 另行通过一致性测试，不能拿前者的 PASS 代表后者。

### 3. 架构

```text
云端 BCS 工程 + Take + 导演配置
                 │
        最终交互／时间线编译
        （一次生成，统一冻结）
                 │
      ┌──────────┴────────────┐
      │                       │
BCS 屏幕逐帧导出       交互轨道 + 布局元数据
      │                       │
screen/000000.png      设备平面映射 + 笔姿态规划
      │                       │
      │                 手腕目标 + 手臂 IK
      │                       │
      └──────────┬────────────┘
                 │
         Blender 固定代理场景
                 │
   干净样片 / 诊断样片 / 已求解 pose / QC
                 │
       动作通过后再加外观和 Seedance
```

BCS 继续负责玩法与游戏像素。Blender 不复制游戏规则。Grok Bot 负责阶段交接与成果核验，Cursor 负责查代码、修改适配器、驱动 CLI／Python 和测试；不另建 LLM runtime。

推荐 TypeScript 做 BCS 导出与任务组织，Blender Python 做资产装配、目标驱动、求解、烘焙、渲染；复用工程现有测试工具；FFmpeg 做编码与回读。命令行后台渲染由 Blender 官方提供。[S9]

接口采用文件批处理优先，不先接 WebSocket 实时同步或 Blender MCP。不是禁止以后使用 MCP，而是首期不把它变成必需依赖。

### 4. 数据边界：屏幕画面和手共享一份最终轨道

#### 4.1 输出一个可复现的 HandSyncBundle

包含：

- 版本与来源：云端 checkout commit、dirty patch 摘要或哈希、gameId、选用后端、Take、编译配置和依赖版本。
- 时间：有理数 FPS、帧数、0 起始帧、BCS 与 Blender 的帧号映射。
- 布局：游戏输出像素尺寸、实际 contentRect、坐标变换、屏幕尺寸、代理场景与相机。
- 每帧交互：phase、contact、触控位置、pieceId、当前 preview、提交／取消等一次性事件及来源。
- 屏幕序列：逐帧 PNG、manifest、帧号与内容摘要。
- 资产和动作配置：rig、grip、笔尖局部点、约束、版本及哈希。

`04_contracts.ts` 是草案。不要在旧 Take 上塞大量 Blender 私有字段；优先新增版本化侧车文件并显式关联。

#### 4.2 一次性事件与持续状态分开

phase 是持续状态：approach/contact/drag/preview/lift/transfer/exit。

events 是边界事件：pointerdown、commit、cancel、pointerup。一个动作的一次提交只能有一个稳定事件 ID；它不是“这一帧正在显示提交反馈”的同义词。

commit 与 pointerup 的相对顺序由真实游戏语义决定，不预设所有游戏完全相同。首版以经核对的 Block Placement 路径为准，明确记录其约定。

轨道来源标为 recorded / synthesized-from-action / augmented-presentation。历史缺失的入镜、悬停、取消不能冒充已恢复的真人触控。

#### 4.3 取消和试探不能假造玩法

旧 Take 如果只保留成功落子，就补呈现侧尝试段：引用尚未提交的 snapshot，让 BCS 根据触控点更新拖拽和预览；取消后候选区恢复，玩法 snapshot 不发生一次放置转换。

所有合法性、预览、消除候选仍复用 BCS 规则。不得在 Blender 另写一套棋盘逻辑，也不得为了“看起来撤回”先提交再删除。

预览 anchor 应与当帧真实落点对应，而不是从拖动第一帧就永远显示最终 anchor。若目标工作区旧路径存在此行为，应做最小的呈现层修复并补回归测试。

### 5. 空间换算

#### 5.1 统一坐标约定

- 游戏图像：左上原点，x 右、y 下；明确采用像素中心还是连续图像边界坐标。
- 游戏 UV：最终导出纹理归一化坐标；不是编辑器窗口坐标。
- 设备 UV：整个显示面的左上原点，u 右、v 下。
- 屏幕局部三维：原点在中心，+X 右、+Y 上、+Z 离开玻璃，单位米，右手系。
- 变换：`T_A_B` 把 B 坐标变换到 A。JSON 矩阵用 row-major 存储，但运算采用列向量；所有转换都写单测。
- 四元数：线格式固定 xyzw；Blender Quaternion 构造的分量顺序通过适配器显式转换，不能直接逐项照抄。

#### 5.2 先应用布局，再映射到屏幕

从实时输入坐标到最终游戏图像坐标的路径，由 P0 审计确定。DPR、内部 composition offset、适配留白只应用一次。

若游戏纹理坐标为 `(u_g,v_g)`，它显示在设备 UV 的矩形 `(x0,y0,w,h)` 内：

`u_d = x0 + w*u_g;  v_d = y0 + h*v_g`。

例如 9:16 游戏等比放入 3:4 竖屏时，左右留白。笔尖必须使用同一个内容矩形，不能把整个设备当作 9:16 拉伸。

#### 5.3 屏幕 UV 到世界坐标

设屏幕宽高为 `Ws,Hs`：

`p_screen = ((u_d-0.5)*Ws, (0.5-v_d)*Hs, h_pen)`

`p_world = T_world_screen * [p_screen,1]`。

接触时 `h_pen=0`；悬停／抬笔阶段 `h_pen>0`。第一版把显示面与触控玻璃设为同平面，不模拟玻璃厚度和折射；以后增加时使用两套明确的平面定义。

最终相机将三维笔尖投影到成片，和游戏图像上的触控目标独立比较。

#### 5.4 先用探针验证，不要一开始用手遮住问题

在 Blender 中用小球／十字代表实际笔尖位置；BCS 输出里画独立校验标记。9 个位置、两种宽高比、带留白配置都测试，再让笔沿真实 Take 运动。

测量应读取经过约束求值的笔尖顶点／标记点，不能把 IK target 再投影一遍就称为实际笔尖误差。

### 6. 时间对齐

内部统一 `frameIndex=k`，首帧 0；`t=k*fps.den/fps.num`。Blender 的首帧设为 1，因此 `blenderFrame=k+1`。图片名仍用 0 起始，显式设置序列偏移。

BCS 与 Blender 都读取一个冻结 frame manifest，不使用各自的墙钟、requestAnimationFrame 或播放时长猜测。

既有 `releaseFrame` 含义要以实际 evaluator 边界为准。必须有“边界前一帧、边界帧、后一帧”的测试，确认手、按下状态和屏幕转换同相；不得统一盲目加一帧。

运动过快、过慢或间隔不够时，有两种合法处理：

- `preserve`：保留最终 BCS 轨迹和时序，只补手部姿态与非接触段；若不够自然，明确报告。
- `joint-redesign`：在玩法动作及落点不变的前提下，统一重新规划轨迹／节奏；重新编译屏幕和手，再冻结。原本的 frame-exact 保证此时不能继续声称保留，应使用明确批准的 semantic 不变量。

禁止只在 Blender 平滑或变速接触轨迹。禁止单独用视频补帧／光流修手部造成与屏幕的分离。

### 7. 手模型来源与握姿建立

用户现有 PNG 用作握姿、比例和角度参考，不等同于三维资产。本轮不走单图图生三维作为主要路径。

优先试验 MPFB 核心人体资产，使用默认 rig 和 IK helper；保留完整骨架或至少肩—上臂—前臂—手的链路，身体位于镜头外。官方提供标准 rig 和手部 IK 辅助。[S6] 核心图形资产的许可为 CC0，工具代码另有许可；第三方下载资产不能自动沿用核心许可。[S7]

选择 MPFB 是为可取得的骨架和动作验证，不是声称它的默认皮肤已经扫描级写实。若云端工作区已有更合适的合法预绑定手模型，可用一个 RigAdapter 替换，不同时维护多个完整动画系统。

模型下载失败或需要账户交互：记录具体地址、许可、需要的人工步骤，不绕过登录，不虚构下载成功。可以继续探针和笔的技术验证，但不能给自然手部打 PASS。

导入后规范单位和非均匀缩放。模型的骨骼名、rest pose、pose space 不做硬编码猜测；输出骨架清单和映射。

在目标测试相机下做一个稳定的三指握笔姿势。笔用独立简单几何，标记精确笔尖和握持位置；手指表面要接近笔，不穿插。通过后保存 `grip.blend` 和配置。

### 8. 动作控制

#### 8.1 单向依赖，避免约束循环

```
交互轨道 → PenTarget → WristTarget → Arm IK → Mesh
```

笔尖目标来自游戏；笔的方向来自已批准的动作模板。笔不受物理随机运动驱动。

定义 `T_hand_pen` 为握姿校准时笔在手坐标中的变换：

`T_world_hand = T_world_pen * inverse(T_hand_pen)`。

这给出手的目标，RigAdapter 再把它转换为实际控制骨／手腕目标的空间。不能把世界矩阵直接塞进局部骨骼矩阵。

笔固定绑定到笔控制器；不要同时让手驱动笔又让笔驱动手。视觉手指可以随骨架变形，但握笔关系必须检查。

#### 8.2 手指、手腕、前臂的责任不同

手指：首版在持笔期间保持固定握姿。游戏释放方块仅表示触控结束，不意味着松开笔。

手腕：允许小范围弯曲、侧偏和旋转；由屏幕区域、笔倾角和姿态模板驱动，不随速度方向突然旋转。

前臂／上臂：用 IK 到达手腕目标，设置 elbow pole，限制角度，关闭伸长。Blender IK 提供目标、Pole Target、Chain Length 和 Stretch 等控制；骨骼约束空间需要正确处理。[S8][S10]

可保留画外的肩部锚点，但不能在每次拖动中无解释地瞬移它。需要重新布置时，在冻结任务之前统一改场景／姿态模板。

#### 8.3 动作分段

- approach：从画外／上一位置移动到候选块上方，不向 BCS 注入假触控。
- contact：笔尖下降并触发真实的抓取边界。
- drag：位置完全遵守共享轨迹。
- preview：可停顿／试探但不提交，继续接触。
- release/cancel：由明确边界触发；取消不改变游戏 snapshot。
- lift/transfer：抬起、回位或移到下一个候选，仍然握笔。
- exit：视野外收尾，不能在画内截断前臂。

初始悬停高度可用 10–25 mm、抬笔过渡可试 0.12–0.25 s，均属于待调试默认值，不是人体标准，更不能覆盖已冻结的真实时序。

#### 8.4 自然度从哪里来

先用连续速度／加速度的曲线安排非接触段。对于起终点确实静止的独立位移，可用 quintic time scaling `10s^3-15s^4+6s^5`。连续拖动不能给每两个点都套这种曲线，否则每个点都会停一下。

如需修改接触轨迹，先在共同规划层用样条／保速插值或新的真人试玩轨迹生成最终路径，再让 BCS 与手都使用它。保留抓取点、预览停顿、最终落点等约束，禁止平滑后越过边界。

可选的少量真人示范用于提供节奏、停顿和倾角先验，不要求完整动作捕捉，不把它变成启动前置条件。

不要先加随机抖动制造“真人感”。第一版要求无噪声也自然；后续变体仅加在允许的非关键自由度，并固定随机种子。

#### 8.5 求解和烘焙

优先按时间顺序求解，利用上帧姿态作为连续参考；检测 IK 翻转、接近全伸展的奇异姿态和关节限位。

硬约束优先于美观：接触点、握笔关系和不伸长保持；再调整批准范围内的笔倾角、肘部／手腕姿态。无解则报 `UNREACHABLE_POSE`／`JOINT_LIMIT`，不改游戏落点、不缩放手、不强行输出。

全部通过后烘焙姿态。渲染 Worker 只读烘焙结果，不在并行渲染时重新逐帧求解。跨设备 GPU 像素一致性不作默认保证；确定性检查优先比较事件、轨迹与量化后的姿态序列。

### 9. 渲染与调试

先做灰模和简单光照，不开镜头抖动、景深、运动模糊或皮肤美化，避免掩盖误差。预览可用云端已验证的快速渲染配置；最终再做 1080×1920 / 30 fps 基础材质版本。

屏幕使用 BCS 无损图像序列，逐帧锁定；不要默认用一个会自行播放的有损 MP4 纹理。每帧按 manifest 更新屏幕、姿态、相机再渲染。

输出 screen-only、hand-only、composite-clean、composite-debug 四种证据。诊断版显示目标／实际笔尖、frame、phase、piece/action ID、contact 和 commit/cancel 事件。

屏幕颜色管理单独核对，避免 BCS 已显示映射的像素又经一遍不匹配的显示变换；采用基准色块和投影后的棋盘验证。此项不是要求第一版解决复杂显示光学。

Blender 固定版本、配置和资产哈希。不要为了“用最新版本”自动升级用户环境。一个批准的模型／绑定只需建一次，批量任务不重新生成资产。

### 10. 工程模块建议

沿用云端仓库结构，不要求照抄目录名；建议最小范围：

```
<repo>/experiments/hand-sync/
  README.md
  config/
  manifests/         # 来源、许可、资产哈希；不是伪造的模型占位
  ts/
    inspect.ts
    exportBundle.ts
    resolveInteraction.ts
    compileInteraction.ts
    verifyBundle.ts
  blender/
    prepare_asset.py
    calibrate_grip.py
    solve_motion.py
    render_job.py
    inspect_motion.py
  tests/
  outputs/           # 大文件默认不进 Git
```

如果共享 resolver 必须移入 BCS 呈现层，做小范围提取并由旧渲染路径复用；不要复制一份后各自演化。不要修改玩法规则以让手显得正确。

建议新增原子操作：inspect / export / asset-prepare / solve / render / verify。它们是待开发的接口，不是当前 melo CLI 已存在的命令。批量组合由 Grok Bot／Cursor 通过明确的阶段任务或已有 Skill 编排，不让多个代理同时修改同一工作树。

任务级进度和证据写入持久目录，交接与恢复见 `07_阶段交接与成果回传.md`。

接口输出 JSON，区分 `prepared`、`solved`、`rendered`、`technical_pass`、`motion_review`、`appearance_review`；任何证据缺失不能默认为通过。

### 11. 阶段与退出标准

| 阶段 | 实际工作 | 必须交付 | 进入下一阶段的条件 |
|---|---|---|---|
| E0 云环境预检 | 云工作机、权限、Cursor、持久目录、Blender 与浏览器独立冒烟 | environment.json、工具版本、两条链路的实测结果 | 已知可运行阶段和准确阻塞项 |
| P0 云端代码审计 | 真实调用链、资产、一次基线渲染 | audit.md、baseline.mp4、局部函数／文件映射 | 选定后端，明确轨迹和释放边界 |
| P1 冻结交互 | 共享 resolver、帧序列、坐标／事件元数据 | bundle、screen-debug.mp4、单测 | 不依赖 Blender，独立验证屏幕拖动和事件 |
| P2 探针与笔 | 代理屏幕、相机、坐标换算、pen target | probe.mp4、pen.mp4、几何误差报告 | 实际笔尖跟随目标，边界无错帧 |
| P3 手与绑定 | 获取合法资产、握姿、RigAdapter、IK | grip.blend、关键帧、5 秒手笔视频 | 手能握住笔并自然覆盖基本范围 |
| P4 完整动作 | 试探、取消、抬笔、连续操作、连续姿态 | 3 段不同动作、干净版＋诊断版 | 坐标／时序检查通过，人工批准动作 |
| P5 未调参回归 | 固定模板后换新 Take／不同距离与布局 | 至少 5 个留出样本、批量报告 | 不逐条修动画，仍满足同一标准 |
| P6 外观比较 | 基础写实渲染；可选生成式增强 | 同动作对照、成本和首次通过率 | 用户决定可用外观路线 |
| P7 场景包装 | Seedance 底板、标定、合成、轻微镜头 | 最终场景成片与回归 | 换场景没有破坏前述匹配 |

P1 与 P3 的资产取得可部分并行；P4 不能在 P2 坐标失败时靠美化推进。

不规定“几天必成”。排期须在 P0 后根据目标后端、取消支持、资产可用性估算。最主要的人工评审点是握姿和动作自然度，而非每一条生产任务。

### 12. 验收原则

具体矩阵见 `03_验收矩阵.md`。起步指标为项目建议值，需经过测试冻结；不宣称行业标准。

- 基线无玻璃厚度、无折射、无镜头抖动时，实际笔尖投影误差目标 P95≤1 px、最大≤2 px（1080×1920），并检查超差时间段而非只有均值。
- 接触面距离目标≤0.5 mm；测 evaluated geometry，不测目标空物体。
- 同一最终时间线里的游戏、手、屏幕序列要精确同帧；不以允许 1 帧误差替代修复 off-by-one。
- 骨骼无缩放拉伸、无翻转；握笔接触和碰撞有合理 allowlist，不能把真实抓握接触全当穿插。
- 取消对玩法状态无提交副作用；预览不提前改变真实棋盘。
- 姿态自然和外观真实分开人工评审；可达不等于自然。
- 改动作路径后缓存必须失效；同姿态但不同屏幕光照也不能无条件缓存外观渲染。

### 13. Seedance 与未来背景的边界

P0–P5 不需要 API Key。没有 Key 不应阻塞动作系统。

P6 才确认实际可用接口、参考输入形式、授权和预算。可以导出灰模参考、基础材质参考、手笔蒙版、深度和轨迹作为实验材料，但不假定某供应商接受全部这些通道，也不把 mask 当硬动作约束。

生成后的像素重新验收。原始三维轨迹正确不代表生成输出正确；不得只保留最好看的样本来声称稳定。

P7 尽量用已批准代理相机与设备轮廓作为生成底板的参考。只有外观可延后，基本构图、尺度与动作可达性不能事后随意推翻。

### 14. 默认安全与协作边界

检查云端工作区、`AGENTS.md` 和 `.cursor/rules`；不覆盖现有修改、不删资产、不自动 push。不把密钥写进 prompt、日志或仓库。不付费下载或调用未授权 API。

合法可公开获取的资产可在许可允许范围内取得；不绕过登录和下载限制。素材授权与云端依赖缺失返回明确 BLOCKED。

交付需说明哪些代码已执行、哪些只读过、哪些依赖人工判断。不得用占位手、空数组、没有编码的视频或未回读的文件冒充完成。

### 15. 来源索引

[S1] domain/types.ts；[S2] presentationCompiler.ts；[S3] legacyPresentationAdapter.ts；[S4] ReferenceScene；[S5] CinematicScene；[S6] MPFB rig 官方文档；[S7] MakeHuman/MPFB 许可；[S8] Blender IK；[S9] Blender 命令行；[S10] Blender 约束空间。完整链接与检查范围见 `05_来源与核查记录.md`。新增 [S11] Cursor CLI、[S12] CLI 参数、[S13] Cursor 规则、[S14] Grok Bot 云电脑、[S15] Blender LTS、[S16] Blender 4.5 命令行、[S17] Cursor 托管云代理边界。


---

# 交接章节 6 · `03_验收矩阵.md`

## 验收矩阵

日期：2026-10-20。下述是建议的首轮项目门槛，不是外部标准，也不是已经得到的实测结果。

### 1. 状态

`NOT_RUN` 未执行；`PASS` 有证据通过；`FAIL` 已执行不满足；`BLOCKED` 缺少真实依赖／资产；`REVIEW_REQUIRED` 需要人判断；`WAIVED` 有明确原因的临时豁免。

不得把 BLOCKED、REVIEW_REQUIRED、WAIVED 统计为 PASS。纯技术 PASS 不代表外观可投放。

### 2. 正向案例

| ID | 案例 | 技术重点 | 视觉重点 |
|---|---|---|---|
| H01 | 同候选到附近的短拖动并提交 | 同帧接触、抓取和提交 | 不突然扎下或瞬移 |
| H02 | 到远端角落的长拖动 | 屏幕映射、可达性、无伸长 | 手腕和前臂协作，不像游标平移 |
| H03 | 拖动到预览区、停顿、再调整 | 预览与提交分离 | 停顿与再启动连续 |
| H04 | 拖出后取消、返回候选 | 无棋盘提交副作用，候选恢复 | 回撤和抬笔可信 |
| H05 | 连续两次不同候选操作 | 非接触转场不注入假输入 | 无一帧跳位，始终握笔 |
| H06 | 同源轨迹切换含留白的屏幕布局 | 变换一致、DPR／contentRect正确 | 不靠拉伸屏幕掩盖偏移 |
| H07 | 冻结模板后至少 5 个新 Take | 无逐条人工修动画 | 范围外失败有明确原因 |

3 段展示片可覆盖 H01–H05，多项可在同片出现。H06 单独提供诊断结果；H07 保留每条结果，包括失败，不只展示精选。

### 3. 负向测试

| ID | 输入／故障 | 正确行为 |
|---|---|---|
| N01 | 手臂明显无法到达 | UNREACHABLE_POSE，不拉长模型 |
| N02 | 轨迹帧数和屏幕帧数不一致 | FRAME_COUNT_MISMATCH，不静默拉时长 |
| N03 | 屏幕序列缺一帧 | SCREEN_FRAME_MISSING，报告具体帧 |
| N04 | 同 Take ID 改动 pointerPath | 新 bundle hash、缓存失效 |
| N05 | 笔尖锚点缺失／单位错误 | INVALID_RIG_PROFILE／UNIT_MISMATCH |
| N06 | rig 资产不在云端工作区 | ASSET_NOT_FOUND，不渲染占位手并标成功 |
| N07 | 取消缺少游戏侧表现支持 | UNSUPPORTED_INTERACTION，而不是伪造提交再撤销 |
| N08 | 渲染进程退出0但MP4为空／不可解码 | OUTPUT_INVALID，rendered=false |
| N09 | y轴翻转、xyzw/wxyz误用、矩阵转置 | 单测和探针测试失败，不推进到写实 |
| N10 | 同帧反馈被当成多次提交 | EVENT_DUPLICATED |
| N11 | 所选后端没有轨迹适配 | BACKEND_NOT_VALIDATED，不沿用另一后端PASS |
| N12 | Seedance Key缺失 | P0–P5正常运行；增强阶段明确未配置 |

### 4. 自动检查与证据

#### 4.1 屏幕／轨迹一致性

游戏输出和轨道必须来自同一帧源与配置。记录输入、screen manifest、轨道、布局和模板的哈希。frameSourceHash 只作为元数据之一，不是唯一缓存身份。

9 点标定覆盖四角、四边中点、中心。另有不参与标定的验证点；不要用拟合的四角再次报告“零误差”。对直接构建的虚拟场景，检查独立投影路径与图像标记，排除同一错误公式自证。

基线条件：1080×1920、无镜头抖动、无景深、无运动模糊、无玻璃厚度和折射。

建议目标：实际笔尖投影误差 P95≤1px，最大≤2px。低分辨率诊断按最终像素尺度换算。报告最大值、超差帧段和原始样本，不能只报均值。

实际位置来源是求值后的笔尖几何／已校准局部点。检查 PenTarget 自己的位置不能证明实际模型正确。

#### 4.2 时间

同一最终轨道里的事件、接触、屏幕状态和图像序列精确同帧。边界检查前一帧、边界帧、后一帧。记录最后 pressed 帧、first pointerup 帧、首次提交可见帧。

不要要求从原始视频未知触控日志恢复出来的时间达到同样精确度；本阶段验证的是可控制的 BCS 渲染链路。

Blender帧1对应bundle帧0；FPS一致；输出帧数N；视频时长N/FPS（容器报告允许编码时间基的舍入，不允许真实缺帧）。

#### 4.3 几何与运动

接触时实际笔尖到平面的距离目标≤0.5mm（基线平面条件）。非接触阶段不在屏幕下方。检查关节限位、骨长变化、旋转翻转、网格明显穿插。

允许列表需要区分正常抓握接触、笔尖触屏和不允许的手指穿笔／手掌穿屏。BVH相交检测只能证明是否相交时，不得把结果误称精确穿透深度；深度阈值需要对应的实际距离算法。

指腹接触点从经过蒙皮求值的网格附近采样，不能只测骨头端点。首版接触间隙的数值阈值需随资产尺度和批准握姿校准；人工关键帧仍是必要证据。

每一帧检查；急转、释放和接触转换区间增加子帧检查。开启运动模糊前重新检查插值／烘焙，避免整数帧正常而中间穿插。

#### 4.4 确定性

同一输入和配置再次求解，事件、轨迹和量化后的姿态序列应相同。固定随机种子、冻结资产和软件版本。GPU跨设备／跨版本逐像素完全一致不作为默认承诺。

在中断后恢复，必须核验所有缓存输入。screen内容变化可能影响手部照明；缓存姿态与缓存外观分开。

### 5. 人工动作评审

先看灰模、正常速度、无抖动版本，再看关键帧和慢放。由至少一名有实际观感判断的审核者给出 approved / rejected / needs_changes，说明原因和帧段。

重点：始终握住笔；肩／肘不瞬移；手腕不僵硬平移也不过度扭转；长拖到远端姿态合理；接近与抬笔可辨；取消后回位连贯；前臂裁切始终在画外；方块吸附没有让笔追赶。

速度／加速度／角速度可以帮助定位异常，不能单独生成“自然度100分”。模型自动视觉评论可以辅助筛查，但首个模板的最终自然度判断由人确认。

### 6. 外观审核明确后置

P0–P5 不因缺毛孔、皮肤写实不足或没有沙发而否决动作技术成果，但相应外观状态必须 pending/deferred。

P6 再比较直接渲染与增强。生成结果独立检查笔尖、握持、轮廓和时序；遮挡区不能声称通过可见像素测量。三维目标正确不能给生成片直接打技术PASS。

### 7. 必须保留的交付

- 可重放的 BCS 工程／Take 和最终交互轨道；
- Blender 模板、批准握姿、rig映射、烘焙姿态和资产来源；
- 屏幕序列和manifest；
- 3 段展示片干净版／诊断版、至少5个留出结果；
- 所有验证报告、失败样本、关键帧、实测耗时；
- 从干净工作目录运行的复现说明（不假设某个未记录的GUI状态）。


### 8. v0.3 新增：云端执行验收

以下只验证环境和交付，不替代 H01–H07 的动作验收。

| ID | 检查 | 通过证据／正确行为 |
|---|---|---|
| C01 | 实际执行位置 | Bot、Cursor、BCS、Blender 所在机及目录已核对；不是假定用户本机 |
| C02 | 工作区与输入 | checkout/dirty 状态、真实输入路径与哈希；缺失输入明确标记 |
| C03 | Blender 后台 | 无需打开 GUI，实际写出 `.blend` 和可读 PNG；退出码、日志齐全 |
| C04 | BCS 浏览器 | 实际后端出帧、真实视频可解码；不是仅访问 HTML 或 Node 构建通过 |
| C05 | GPU 声明 | 设备枚举与渲染使用分开；无 GPU 正确降为 CPU 小样并声明限制 |
| C06 | 环境锁定 | Blender、Cursor、浏览器、Node、模型与配置的版本来源可追溯 |
| C07 | 中断恢复 | 恢复时核验 bundle 与模板哈希；不重复创建同一运行；缓存不误复用 |
| C08 | 持久成果 | 结果不只在 `/tmp`，交付副本和校验清单可读取 |
| C09 | 用户回传 | 视频或私有交付附件可取得；只给服务器绝对路径不算通过 |
| C10 | 权限与隔离 | 不覆盖既有代码、Bot 文件、系统驱动或其他渲染进程；无凭证进入产物 |
| C11 | 人工审批 | Bot／Cursor 自评不等于用户批准；没有审核记录即 REVIEW_REQUIRED |
| C12 | 重建验证 | 在新的任务目录用已记录环境和输入复现，未依赖未知 GUI 状态 |

#### 云端负例

- Blender 二进制存在但启动缺系统库：`BLENDER_BOOT_FAILED`，不是已安装成功。
- `nvidia-smi` 有输出但 Cycles GPU 不可用：分别报告设备发现与 GPU 渲染阻塞，不把 CPU 片当 GPU 片。
- Blender 成功而浏览器没有 WebGL：`BCS_RENDER_BACKEND_UNAVAILABLE`，不能偷换渲染后端后沿用原后端 PASS。
- 云机没有独立握笔 PNG：可以推进代码／探针／通用握姿候选，但不得声称已匹配用户 PNG。
- Cursor 只输出代码建议没有真实 diff：实施尚未完成，先检查入口权限，不能声称代码已落盘。
- 运行会话超时但子进程仍在：读取其日志与状态，不重开同任务。
- 模板评审待回复：保存 checkpoint，报告待审；不设置假 approved。


---

# 交接章节 7 · `07_阶段交接与成果回传.md`

## 阶段交接、恢复与成果回传

### 1. 角色边界

| 角色 | 主要责任 | 不应替代的责任 |
|---|---|---|
| 用户 | 提供或授权访问输入、确认付费／系统权限、批准动作和外观 | 不要求用户逐帧标注，不要求用户电脑装 Blender |
| Grok Bot | 云端文件与环境确认、给 Cursor 阶段任务、核对证据、回传 | 不凭 Cursor 的一句“完成”替代产物检查 |
| Cursor | 在真实云工作区实现、运行测试、求解与渲染、记录失败 | 不自行扩大到付费产线、驱动变更或公开发布 |
| BCS | 玩法规则、最终交互、屏幕像素 | 不负责重建真人皮肤 |
| Blender／FFmpeg | 几何、动作、渲染和媒体编码 | 不根据文字猜游戏是否合法 |

使用一个现有 Grok Bot 和一个写入 Cursor 会话即可；不把跨代理协作本身变成新项目。多 Bot 共享机器时，任务目录与写入权明确分离，机上凭证隔离遵循实际平台权限，不能认为目录隔离就是安全沙箱。

### 2. 每次交给 Cursor 的内容

发一个明确阶段，包含：runId、执行机／工作区、当前 commit 和已知 dirty 状态、输入文件路径、要读取的方案章节、允许修改范围、要运行的验证、输出目录、禁止事项和退出条件。

示例：先执行 E0 与 P0，验证两个渲染入口、取得最小 BCS baseline；不要创建新 UI、Seedance 管线或平台调度。不能反复同时派发同一个阶段到多个 Cursor 会话。

当 Cursor 有现成任务入口，直接传阶段正文；不要求先写 Grok→Cursor API。CLI 的会话续接是可选方便功能，恢复真值仍以落盘报告与输入哈希为准。

### 3. 状态落盘

建议 `state/task-state.json` 保存（字段为待实现设计）：

- runId、当前阶段、任务所有者和实际执行主机；
- repoCommit、dirtyPatchHash、bundleHash、环境锁定记录引用；
- `not_started/running/blocked/failed/review_required/completed`；
- 已验证输出、最后成功步骤、下一条可执行动作；
- blocker 的错误码、具体缺失输入／权限以及是否影响其他阶段；
- 用户批准记录或空值。

事件、动作及环境报告不要混为一份“成功”。生成 `probe.mp4` 只证明探针阶段，有模型才有手部阶段，视频经解码并技术通过后才进入自然度评审。

### 4. 长渲染与恢复

每个运行的输入冻结后计算哈希；输出按 runId 独立存放。开始前检查同任务是否已有活跃进程或已完成产物，避免重入。

用既有平台批准的进程管理方式保存 PID、命令和日志。工具调用超时后先查询已有任务，不直接重复提交。只停止本任务自己启动的进程；不得 `killall blender` 清理共享机器。

中断恢复检查 bundle、屏幕帧、rig、场景和环境版本；不一致则新开运行或显式失效。上一轮已求解动作可在哈希相同且证据完整时复用，旧的外观缓存不能因同 Take ID 无条件命中。

后台任务没有完成时应写 running 和真实日志位置，不把“已启动”写成“已交付”。不会使用的外部自动化平台不必安装。

### 5. 人工评审回路

Grok Bot 可以通过读取关键帧与日志辅助发现问题，但用户未批准的握姿／自然度必须为 REVIEW_REQUIRED。传出：正常速度干净视频、同动作诊断视频、关键帧、已知缺陷和明确需要用户判断的内容。

如用户尚未回复，可以整理证据、继续无关测试或生成待审候选；不能将模板用于已宣称生产可用的大批任务。以后若授权某个指定美术审核，可将其作为明确审查者记录。

### 6. 回传的最小交付包

```text
delivery/<runId>/
  SUMMARY.md             # 实际完成、未完成、执行位置、复现入口
  preview/               # clean.mp4 / debug.mp4 / 关键帧
  reports/               # QC、逐帧误差、环境、测试结果与失败样本索引
  source/                # 代码 diff、配置、依赖锁定、必要的复现脚本
  manifests/             # 轨道、屏幕序列、资产许可与哈希清单
  CHECKSUMS.sha256
```

完整 Blender 工程、烘焙动作及较大序列保存在持久目录；按许可和授权通过附件或私有存储回传。大模型／纹理不能自动推到公开 GitHub；确需分包时标明各包用途、完整性和复现所需清单。字体、密钥和账号文件不随交付打包。

Bot 需实际验证附件或已有私有链接可用，平台若不支持对应文件类型先报告再改用批准的交付方式。禁止捏造下载链接。只给 `/home/.../final.mp4` 不是给用户的完成交付。

默认不 push。若用户另行批准分支回传，则使用明确分支，先检查改动与资产许可，不直接覆盖 main。不因为某托管产品默认 push，就擅自改写这个边界。

### 7. 最终汇报模板

1. **实际执行**：哪些阶段、哪台主机、哪个版本、哪些命令和产物。
2. **技术证据**：通过／失败／未跑各项，指向对应报告和视频。
3. **动作与外观**：谁批准、何时批准；没有则明确待审。
4. **限制**：缺输入、CPU／GPU、模型授权或环境问题，不隐瞒降级路径。
5. **可重放交付**：附件、哈希、复现命令与残余步骤。

不要把设计包自身的类型检查当成 BCS 测试；不要把“云端可以调用 Blender”当成“手部动作已经自然”。


---

# 交接章节 8 · `04_contracts.ts`

```typescript
/**
 * Proposed contracts only; not an implemented BCS/Blender integration.
 * All numeric finiteness, dimensions, event uniqueness and referential integrity
 * require runtime validation in the cloud-workspace implementation.
 */
export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
/** Wire order: x,y,z,w. Convert explicitly for Blender mathutils. */
export type QuatXYZW = readonly [number, number, number, number];
/** Row-major storage; multiply column vectors. T_A_B maps B into A. */
export type Mat4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number
];
export type Hash = string;
export interface Rate { readonly num: number; readonly den: number; }
export interface AssetRef {
  readonly path: string;
  readonly sha256: Hash;
}
export interface Rect {
  readonly x: number; readonly y: number;
  readonly width: number; readonly height: number;
}
export type Phase = 'approach' | 'contact' | 'drag' | 'preview' | 'lift' | 'transfer' | 'exit';
export type TrackOrigin = 'recorded' | 'synthesized-from-action' | 'augmented-presentation';
export interface BoundaryEvent {
  readonly id: string;
  readonly kind: 'pointerdown' | 'commit' | 'cancel' | 'pointerup';
  readonly actionId: string | null;
  readonly pieceId: string | null;
  readonly source: TrackOrigin;
}
export interface PreviewState {
  readonly row: number;
  readonly col: number;
  readonly legal: boolean;
  readonly clearRows: readonly number[];
  readonly clearCols: readonly number[];
}
export interface InteractionFrame {
  readonly frameIndex: number; // 0-based and contiguous
  readonly phase: Phase;
  readonly contact: boolean;
  readonly actionId: string | null;
  readonly pieceId: string | null;
  readonly origin: TrackOrigin;
  /** Actual input in final game-image UV; null when not injecting game input. */
  readonly touchGameUv: Vec2 | null;
  /** Pen projection on display plane; can be outside [0,1] during offscreen moves. */
  readonly penDeviceUv: Vec2;
  readonly penHeightM: number;
  readonly preview: PreviewState | null;
  readonly events: readonly BoundaryEvent[];
  /** Presentation identity for this actual final screen frame. */
  readonly sourcePresentationHash: Hash;
  readonly sourceStateHash: Hash;
}
export interface FrozenLayout {
  readonly gameImagePx: { readonly width: number; readonly height: number; };
  readonly pixelConvention: 'continuous-image-edge-coordinates';
  readonly contentRectDeviceUv: Rect;
  readonly displaySizeM: { readonly width: number; readonly height: number; };
  readonly worldFromScreen: Mat4;
  readonly screenAxes: 'right-handed-x-right-y-up-z-out';
  readonly touchPlaneOffsetM: number; // 0 for first-stage proxy
  readonly sourceBackendId: string;
  readonly sourceLayoutHash: Hash;
  readonly mappingVersion: string;
}
export interface InteractionTrack {
  readonly schema: 'melo.hand-sync.interaction/0.2';
  readonly fps: Rate;
  readonly frameCount: number;
  readonly frameIndexBase: 0;
  readonly timeMode: 'preserve' | 'joint-redesign';
  readonly frames: readonly InteractionFrame[];
  readonly layout: FrozenLayout;
}
export interface RigProfile {
  readonly schema: 'melo.hand-sync.rig/0.2';
  readonly rigId: string;
  readonly asset: AssetRef;
  readonly armatureObject: string;
  readonly unit: 'm';
  readonly boneMap: Readonly<Record<string, string>>;
  readonly wristControlSpace: 'world' | 'armature' | 'pose';
  readonly handFromPen: Mat4;
  readonly penTipLocalM: Vec3;
  readonly penAxisLocal: Vec3;
  readonly shoulderAnchorWorldM: Vec3;
  readonly elbowPoleWorldM: Vec3;
  readonly allowStretch: false;
  readonly approvedGripId: string;
  readonly jointLimits: readonly {
    readonly bone: string;
    readonly minRadians: Vec3;
    readonly maxRadians: Vec3;
  }[];
  readonly licenseManifest: AssetRef;
}
export interface MotionFrame {
  readonly frameIndex: number;
  readonly penPositionWorldM: Vec3;
  readonly penRotationWorld: QuatXYZW;
  readonly wristPositionWorldM: Vec3;
  readonly wristRotationWorld: QuatXYZW;
  /** Baked local pose for declared rig adapter; convention stored in manifest. */
  readonly boneRotations: Readonly<Record<string, QuatXYZW>>;
  readonly measuredTipWorldM: Vec3;
  readonly solved: boolean;
}
export interface ScreenFrame {
  readonly frameIndex: number;
  readonly path: string;
  readonly sha256: Hash;
}
export interface HandSyncBundle {
  readonly schema: 'melo.hand-sync.bundle/0.2';
  readonly source: {
    readonly repoCommit: string;
    readonly dirtyPatchHash: Hash | null;
    readonly gameId: string;
    readonly backendId: string;
    readonly takeId: string;
    readonly takeHash: Hash;
    readonly directorHash: Hash;
    readonly frameSourceHash: Hash;
  };
  readonly fullInputHash: Hash; // includes full track, layout and all relevant assets/config
  readonly interaction: AssetRef;
  readonly screenManifest: AssetRef;
  readonly rigProfile: AssetRef | null; // null allowed only for probe/pen stages
  readonly sceneConfig: AssetRef;
}
export type CheckStatus = 'NOT_RUN' | 'PASS' | 'FAIL' | 'BLOCKED' | 'REVIEW_REQUIRED' | 'WAIVED';
export interface QCCheck {
  readonly id: string;
  readonly status: CheckStatus;
  readonly measurementSource: 'unit-test' | 'evaluated-geometry' | 'rendered-pixels' | 'media-decode' | 'human';
  readonly metrics: Readonly<Record<string, number | string | null>>;
  readonly evidencePaths: readonly string[];
  readonly note: string;
}
export interface JobReport {
  readonly schema: 'melo.hand-sync.report/0.2';
  readonly prepared: boolean;
  readonly solved: boolean;
  readonly rendered: boolean;
  readonly technicalStatus: CheckStatus;
  readonly motionReview: CheckStatus;
  readonly appearanceReview: CheckStatus;
  readonly outputPaths: readonly string[];
  readonly checks: readonly QCCheck[];
  readonly errors: readonly { readonly code: string; readonly message: string; readonly frameIndex?: number; }[];
}
```


---

# 交接章节 9 · `examples/job.example.json`

```json
{
  "exampleOnly": true,
  "note": "拟新增任务格式，尚无本包内可执行runner；路径须由云端Cursor实际生成后替换。",
  "schema": "melo.hand-sync.job/0.2",
  "mode": "probe",
  "bundlePath": "<ACTUAL_BUNDLE_PATH>",
  "scenePath": "<ACTUAL_SCENE_PATH>",
  "rigProfilePath": null,
  "outputDir": "<ACTUAL_OUTPUT_DIR>",
  "requireEncodedVideo": true,
  "qualityGate": {
    "projectionP95PxAt1080": 1,
    "projectionMaxPxAt1080": 2,
    "contactDistanceMaxM": 0.0005
  },
  "externalGeneration": {
    "enabled": false
  },
  "review": {
    "motion": "NOT_RUN",
    "appearance": "NOT_RUN"
  }
}
```


---

# 交接章节 10 · `examples/scene.proxy.example.json`

```json
{
  "exampleOnly": true,
  "note": "说明性代理场景，不代表用户设备真实尺寸；实际屏幕布局由云端BCS适配器导出。",
  "schema": "melo.hand-sync.proxy-scene/0.2",
  "worldUnit": "m",
  "worldFromScreenRowMajor": [
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1
  ],
  "screenAxes": "right-handed-x-right-y-up-z-out",
  "displaySizeM": {
    "width": 0.18,
    "height": 0.24
  },
  "touchPlaneOffsetM": 0,
  "exampleGameImagePx": {
    "width": 1080,
    "height": 1920
  },
  "contentRectDeviceUv": {
    "x": 0.125,
    "y": 0,
    "width": 0.75,
    "height": 1
  },
  "camera": {
    "positionWorldM": [
      0,
      -0.28,
      0.52
    ],
    "lookAtWorldM": [
      0,
      0,
      0
    ],
    "focalLengthMm": 50,
    "sensorWidthMm": 36,
    "sensorFit": "VERTICAL"
  },
  "output": {
    "width": 1080,
    "height": 1920,
    "fps": {
      "num": 30,
      "den": 1
    },
    "firstBundleFrame": 0,
    "firstBlenderFrame": 1
  },
  "diagnostic": {
    "cameraShake": false,
    "motionBlur": false,
    "depthOfField": false,
    "tipMarker": true
  }
}
```


---

# 交接章节 11 · `examples/cloud.execution.example.json`

```json
{
  "exampleOnly": true,
  "note": "拟新增云端执行配置，全部路径与主机属性须在E0实测；本包不含部署runner。不是Grok Bot或Cursor官方配置schema。",
  "schema": "melo.hand-sync.cloud-execution/0.3",
  "handoff": {
    "recipient": "Grok Bot",
    "codingTool": "Cursor",
    "cursorEntry": "detect-existing",
    "executionEnvironment": "detect-authorized-cloud-host"
  },
  "paths": {
    "workRoot": "<ACTUAL_PERSISTENT_WORK_ROOT>",
    "repoRoot": "<ACTUAL_BCS_CHECKOUT>",
    "inputRoot": "<ACTUAL_INPUT_ROOT>",
    "assetRoot": "<ACTUAL_ASSET_ROOT>",
    "runRoot": "<ACTUAL_RUN_ROOT>",
    "deliveryRoot": "<ACTUAL_DELIVERY_ROOT>",
    "blenderBinary": "<ACTUAL_BLENDER_BIN>"
  },
  "environment": {
    "os": null,
    "architecture": null,
    "blenderVersion": null,
    "cursorVersion": null,
    "browserVersion": null,
    "gpuDetected": null,
    "gpuRenderVerified": false,
    "bcsRenderVerified": false,
    "blenderSmokeVerified": false
  },
  "renderPolicy": {
    "maxConcurrentJobs": 1,
    "cpuPreviewAllowed": true,
    "preferredBlenderBaseline": "4.5 LTS, verify actual compatible version",
    "finalOutput": {
      "width": 1080,
      "height": 1920,
      "fps": {
        "num": 30,
        "den": 1
      }
    },
    "allowSilentGpuFallback": false
  },
  "scope": {
    "initialStages": [
      "E0",
      "P0",
      "P1",
      "P2",
      "P3",
      "P4",
      "P5"
    ],
    "seedanceRequired": false,
    "backgroundGenerationDeferred": true
  },
  "permissions": {
    "autoProvisionPaidResources": false,
    "changeHostDrivers": false,
    "allowAdminChangesWithoutApproval": false,
    "autoPush": false,
    "publishArtifacts": false,
    "autoApproveAllCursorCommands": false
  },
  "delivery": {
    "method": "existing-attachment-or-approved-private-channel",
    "remotePathAloneIsDelivery": false
  },
  "stageState": {
    "status": "NOT_RUN",
    "humanMotionApproval": null,
    "humanAppearanceApproval": null
  }
}
```


---

# 交接章节 12 · `05_来源与核查记录.md`

## 来源与核查记录

交接包修订日期：2026-10-20。

### 检查范围与证据分层

本轮实际读取了用户对话中已挂载的 v0.2 ZIP 及 Markdown，保留其中技术设计和历史源码审阅线索，改写为 Grok Bot＋Cursor 云端执行方案。本轮没有重新调用 GitHub 审计当前 main，也没有连接目标云主机。

下文 S1–S5 及其摘记来自 v0.2 的历史检查记录：当时记录的提交为 `f5278635ef372f3587bfd2e6574e253dd71a24da`。它们只作为 P0 的核查入口，不能推断云端当前 checkout 相同。S6–S10 是前版提供的官方技术参考；S11–S17 是本轮为执行环境变更核对的官方资料。

未执行：云端安装、Cursor 登录、BCS 构建、手模型取得、Blender IK／渲染、Seedance 调用。没有任何新样片或一次通过率实测。公开资料不能证明用户账户权限、云主机 GPU 或网络可用。

### 远端源码

#### S1. 指针与动作类型

https://github.com/dongyuan21/melo-game-creative-studio/blob/f5278635ef372f3587bfd2e6574e253dd71a24da/src/domain/types.ts

检查了 PointerSample、PlacementAction、Take 等定义。已有轨迹不代表已保存完整的 hover／cancel／手部三维姿态。

#### S2. Placement 呈现编译与求值

https://github.com/dongyuan21/melo-game-creative-studio/blob/f5278635ef372f3587bfd2e6574e253dd71a24da/src/games/block-placement/presentation/presentationCompiler.ts

检查了轨迹 fallback、directedDuration、compileTake、evaluateCompiledTake。导演会改时长；releaseFrame 的边界需按求值代码测试。

#### S3. 帧适配器

https://github.com/dongyuan21/melo-game-creative-studio/blob/f5278635ef372f3587bfd2e6574e253dd71a24da/src/games/block-placement/presentation/legacyPresentationAdapter.ts

检查了 PresentationPacket、逐帧事件构造、CompiledFrameSource 及 frameSourceHash 构造。不能把逐帧反馈当一次性触控事件；不能只凭一个上游hash判断手部配置是否可缓存。

#### S4. Reference2D 渲染器

https://github.com/dongyuan21/melo-game-creative-studio/blob/f5278635ef372f3587bfd2e6574e253dd71a24da/src/games/block-placement/render/BlockPlacementReferenceScene.ts

抽查 resize / clientToReference / anchorForPiece / activeDraggedPiece / drawDragAndPreview / draw。涉及设计分辨率、留白、pickupLift 和 preview anchor。

#### S5. Cinematic 渲染器

https://github.com/dongyuan21/melo-game-creative-studio/blob/f5278635ef372f3587bfd2e6574e253dd71a24da/src/games/block-placement/render/BlockPlacementCinematicScene.ts

抽查 syncScene、rebuildDraggedPiece 和 syncCamera。拖动包含 pointerDriven 分支、目标吸附、z 方向抬高和缩放；不能直接假定与 Reference2D 相同。

### 官方工具资料

#### S6. MPFB 绑定

https://static.makehumancommunity.org/mpfb/docs/characters/rig.html

官方说明默认标准 rig 可增加 IK helper，包括便于摆放手部的 IK 骨。本文仅用它支持资产和绑定入口，不声称默认资产已达到商业近景写实。

#### S7. MPFB / MakeHuman 许可

https://static.makehumancommunity.org/about/license.html

官方区分核心图形资产 CC0 与工具代码 GPL/AGPL；第三方资源逐一核对。本计划不附第三方模型，不代表已经下载或完成许可清单。

#### S8. Blender IK

https://docs.blender.org/manual/en/dev/animation/constraints/tracking/ik_solver.html

官方列出 Target、Pole Target、Chain Length、Stretch 等约束。实施时以目标主机冻结版本的API实际行为为准；不因此推荐安装开发版。

#### S9. Blender 命令行

https://docs.blender.org/manual/en/4.1/advanced/command_line/arguments.html

用于确认后台运行、脚本参数、帧范围和命令顺序。此链接不是推荐锁定4.1版本；目标主机版本由E0探测和验证。

#### S10. Blender 约束空间

https://docs.blender.org/manual/en/5.0/animation/constraints/interface/common.html

用于确认约束与骨骼空间有明确转换语义。RigAdapter 必须适配实际骨架的 rest/pose/world/local 空间。

### 非外部事实

本包中的阶段安排、目录名、命令名、类型接口、数值验收门槛、悬停高度与时长，是针对本项目提出的工程设计，不是上述官方文档规定，也不是已经测得的产能或成功率。

未验证 Seedance 本次账户、地区或提供商的实际 API，也没有承诺 mask／深度／骨骼硬约束功能。该接入明确后置。


### v0.3 新增官方资料（2026-10-20 核对）

#### S11. Cursor CLI / Headless
https://cursor.com/docs/cli/overview
https://cursor.com/docs/cli/headless

用于确认终端入口和非交互执行。当前文档使用 `agent`，旧文档可能出现 `cursor-agent`；目标机先检查版本和 help。`--print` 不应被当作安全沙箱；自动写入／命令批准规则按实际版本和权限配置核实。不要默认添加 `--force` 或 `--yolo`。

#### S12. Cursor CLI 参数
https://cursor.com/docs/cli/reference/parameters
https://cursor.com/docs/cli/reference/permissions

用于确认 `--version`、`--help`、`--output-format`、登录状态与权限参数。任务书不强制指定模型名称、账户套餐或命令批准策略，不硬编码新的 Grok API。凭证不写入命令参数和普通日志。

#### S13. Cursor 规则
https://cursor.com/docs/rules

官方说明 `.cursor/rules` 和 `AGENTS.md`。本计划要求读取并遵守已有规则，而不是覆盖它们。仅凭增加提示词不能保证安全边界，执行权限和目录隔离仍需落实。

#### S14. Grok Bot 云电脑与工作方式
https://cursor.com/docs/grok-bot
https://cursor.com/docs/grok-bot/work

官方描述持久云电脑、文件系统、终端和账户内多 Bot 共享电脑的模型。这里据此要求独立工作区、单写入者、证据持久化，不声称用户当前机器拥有某种 GPU、管理员权限或已安装软件。现有 Bot 与 Cursor 的连接方式优先复用。

#### S15. Blender 4.5 LTS 与发行记录
https://www.blender.org/releases/4-5/
https://www.blender.org/download/lts/

4.5 LTS 仍在支持期内，官方列支持至 2027 年 7 月。本项目沿用其作为兼容性基线，不宣称它是最新 LTS，不写死一个未在目标主机验证的补丁版。已存在且适配资产的稳定版本可保留。

#### S16. Blender 4.5 LTS 后台命令与渲染设备
https://docs.blender.org/manual/en/4.5/advanced/command_line/arguments.html
https://docs.blender.org/manual/nl/4.5/advanced/command_line/arguments.html

本轮英文页面抓取失败，核对到官方荷兰语路径中的英文命令说明；包含 `--background`、`--python`、命令先后顺序和 Cycles 设备选择。实施时以目标二进制 help 和该版本 Python API 为准。

#### S17. Cursor 托管 Cloud Agents 与执行位置边界
https://cursor.com/docs/cloud-agent
https://cursor.com/docs/cloud-agent/self-hosted/my-machines

托管 Cloud Agent 与在用户授权云主机运行 Cursor 并不自动等同。官方托管流程包含仓库分支回传；本任务默认不自动 push，因此不得无条件切换到会执行不同交付策略的产品入口。确需切换时先确认执行主机、权限和交付策略。


---

# 交接章节 13 · `08_v0.3变更说明.md`

## v0.3 变更说明

基于本对话已提供的 v0.2 技术方案原文件修订；保留原版，不覆盖旧 ZIP。

| 内容 | v0.2 | v0.3 |
|---|---|---|
| 交接对象 | 本地 Codex | Grok Bot 接收，使用 Cursor 执行 |
| 执行位置 | 用户本机 BCS 工作区 | Bot 云电脑／已经授权的云主机 |
| Blender | 默认本机可准备 | 在实际云端求解／渲染环境安装或使用，不要求用户电脑安装 |
| 环境前置 | P0 内一般探测 | 新增 E0，独立验证 Blender 与 BCS 浏览器两条链 |
| GPU | 本机探测 | 不假定有 GPU；CPU 小样可继续，GPU 与产能独立证明 |
| 输入 | 本地材料待定位 | 云端重新确认路径／权限／哈希，不假设附件自动转移 |
| 工作方式 | 单 Codex 任务 | Bot 分阶段交给 Cursor；单写入者、持久进度、恢复和交付 |
| 输出 | 本地视频与项目 | 持久云目录＋可访问的附件／批准私有回传，不只报路径 |
| 权限 | 不覆盖、不采购、不 push | 保留，增加管理员／驱动／云资源／公开端口边界 |
| Seedance | 动作通过后再接 | 不变，E0 与 P0–P5 无需 Key |

技术核心未改变：共享最终交互轨道；探针→笔→手；坐标／时序／握笔约束；取消不提交；直接渲染与生成增强后置。业务 `/0.2` schema 保留，不做没有必要的协议迁移。

本轮实际工作是文档与交接包修订及静态检查，没有连接 Grok Bot 云主机、安装软件、编辑用户仓库或完成渲染。


---

# 交接章节 14 · `VALIDATION.md`

## 本交接包检查记录 v0.3

日期：2026-10-20。检查发生在本次文档修订工作环境，不是用户的目标云主机。

### 已执行的包级检查

- 读取原始 v0.2 ZIP 及主要 Markdown，在保留技术核心的基础上修改执行方与主机前提。
- 全部必需文档存在且非空，旧 Codex 任务书入口已替换；历史版本说明保留原称呼。
- 三个说明性 JSON 均可解析，均带 `exampleOnly: true`；云端示例没有虚构已取得的主机参数或测试成功状态。
- 屏幕配置的内容矩形保持 9:16 图像比例。
- `tsc --noEmit --strict --target ES2020 04_contracts.ts` 通过；仅证明类型声明可以检查，不是 BCS 或动画实现测试。
- Markdown 代码块配对、文档引用文件名与核心 schema 版本已检查。
- 单文件版由本包内容合并，供 Grok Bot 在不解压时阅读；业务数据契约仍为 `/0.2`，包版本是 v0.3。
- ZIP 成员完整性与 MANIFEST.json 中逐文件 SHA-256／字节长度已校验。

### 未执行

没有连接 Grok Bot 或任何用户云主机；没有安装 Cursor、Blender、Chrome 或 GPU 驱动；没有克隆或修改用户仓库；没有重审 GitHub 当前 main；没有下载手模型；没有运行 IK、BCS／Blender 渲染或 Seedance。

本包不含三维模型、字体、凭证、原视频、独立握笔 PNG 或伪造的效果样片。环境、接口和任务示例需要 Grok Bot／Cursor 在目标云机实际实现和验证。
