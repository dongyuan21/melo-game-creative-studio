# 多游戏重构连续执行日志

- 分支：`cursor/multi-game-platform-r0-r8-5d9d`（协议名 `refactor/multi-game-platform-r0-r8`）
- 方案：`MULTI_GAME_REFACTOR_EXECUTION_PLAN_V1.md` @ `c1aadaf`
- 协议：`MULTI_GAME_REFACTOR_CONTINUOUS_EXECUTION_PROTOCOL_V1.md`
- 起点：`526aee6`，已 fast-forward 吸收 `origin/main@f1c1052`
- R9：DEFERRED（需 crash wooooood! Diagnostic Slice）

阶段编号是内部检查点，不是人工审批门。

## R0 — 冻结基线与架构边界

- 状态：PASS（自检，非人工审批）
- 提交：`chore(architecture): freeze baseline and add dependency guards`
- 吸收上游：`526aee6..f1c1052`（Plan Shot / UV / fracture、board-plane pick、browser PBR）
- 未覆盖他人提交
- 门禁：`check` / `test` 138 / `typecheck` / `build`（156 modules）PASS
- Architecture：9 条递减 allowlist（exporter/integration→R6，App/types→R8）
- Smoke Capture：PASS；3 still；SwiftShader；`cameraDrivesPixels` 未在本 smoke 报告中复写 Full Capture
- 商业 Golden：BLOCKED
- 人工视觉批准：PENDING
- 未改 Gameplay / Compiler / Scene / PBR / Shot / Capture Spec

## R1 — Game Runtime、Registry 与 Block Legacy Adapter

- 状态：PASS（自检，非人工审批）
- 提交：`refactor(game): register Block Placement as the first game runtime`
- 门禁：`check` / `test` 148 / `typecheck` / Smoke Capture PASS
- Registry：重复 ID 失败、未知游戏失败、`require()` 可用
- Adapter：与 `applyPlacement` / `listLegalMoves` 深度相等；完整 State Hash 覆盖 board/pieces/seed/setIndex/turn/score/combo/status；12-seed greedy replay 锁步
- App / Capture / Exporter 未改
- 未移动 `gameEngine.ts`

## R2 — Project/Replay Envelope 与 V1 Migration

- 状态：PASS（自检，非人工审批）
- 提交：`refactor(project): add project and replay envelopes with v1 migration`
- 门禁：`check` / `test` 156 / `typecheck` / `build` / render-regression / golden-batch / pbr-runtime / Smoke Capture PASS
- CLI：`project migrate`；`rendered: false`
- 示例 `examples/demo-cross-clear.melo.json` 可迁；V1/V2 完整 State Hash 相等
- Semantic Hash 不含 pointer；Frame Hash 含 interaction 与 rhythm
- V2 缺字段 `MISSING_FIELD`，不静默补默认
- Studio Importer 双读 V1+V2；Autosave/默认导出仍写 V1
- game-runtime 不 import games / domain/types；Block 迁移在 `games/block-placement/migrations`

## R3 — Presentation Packet 与 Compiled Frame Source

- 状态：PASS（自检，非人工审批）
- 提交：`refactor(presentation): add presentation packet and compiled frame source`
- 门禁：`check` / `test` 161 / `typecheck` / `build` / Smoke Capture PASS
- 公共 Fixture：`evaluateCompiledTake` 与 packet.payload 在 board/snapshot/drag/pointer/feedback/clearing/cameraPunch/totalFrames 上相等
- 乱序/重复 Seek 结果一致
- 未改 Scene / Exporter / App

## R4 — Game Render Contract、CreativeMasterV2 与 Variant Compiler V2

- 状态：PASS（自检，非人工审批）
- 提交：`refactor(headless): add game render contract and compiler v2`
- 门禁：`check` / `test` 165 / `typecheck` PASS
- V1 `compileVariant` / `runQualityGate` 行为不变；冻结 Plan Hash 因合约命名空间改为 `melo.*` 重算为 steel `fnv1a32:f83568be` / wood `c6d2f91f` / aurora `0502ff1b`
- V2 Plan Hash 含 `planSchemaVersion` / renderContract / game，与 V1 哈希空间独立
- 假游戏合同只需 `crush.board` + `crush.drop-piece`，无需改 Compiler，无需 `tile.material`
- 未知 Slot 以 `UNKNOWN_SLOT` 失败并带明确 path
- Scene / Exporter / App / Capture 未改

## R5 — Composition、Coordinate、Shot 与 Calibration Profile 化

- 状态：PASS（自检，非人工审批）
- 提交：`refactor(composition): profile coordinate shot and calibration data`
- 门禁：`check` / `test` 169 / `typecheck` / `build`（169 modules）/ render-regression / golden-batch / pbr-runtime / Smoke Capture PASS
- 1064×1788 / 1080×1920 / 80,309,912 仅存在于 Block Placement Profile
- `designToVideoMapping()` 包装 `mapComposition(defaultComposition)`
- 假 Composition Profile 通过通用映射，不改共享常量
- Calibration Case 记录 composition/calibration profile id
- 商业 Golden：BLOCKED；人工视觉批准：PENDING

## R6 — Backend Registry、Render Job、Exporter 与 Capture Runner 解耦

- 状态：PASS（自检，非人工审批）
- 提交：`refactor(render): decouple backend registry exporter and capture`
- 门禁：`check` / `test` 173 / `typecheck` / `build` / render-regression / Smoke Capture PASS
- `offlineVideoExporter.ts` 不再直接 import compileTake / evaluateCompiledTake / Reference2DScene / StudioScene
- Dummy Backend 无需 Block 类型即可记录像素；不支持的 schema 在渲染前失败
- Capture Suite 迁到 `games/block-placement/capture`；Runner 消费 Frame Source + Backend
- Architecture allowlist 从 9 条降到 6 条（exporter 三条已退休）
- 商业 Golden：BLOCKED；人工视觉批准：PENDING；SwiftShader ≠ 视觉批准

## R7 — Runtime Asset Bindings Map 化

- 状态：PASS（自检，非人工审批）
- 提交：`refactor(assets): resolve runtime assets by semantic slot`
- 门禁：`check` / `test` 176 / `typecheck` / `build` / render-regression / golden-batch / pbr-runtime / Smoke Capture PASS
- `RuntimeAssetBindings.bySlot` 为唯一写入面；`background` / `tileFace` 等为兼容 getter
- `firstImageBinding(bindings, slotId)` 返回槽内排序后的第一张图
- 同槽多资产按 slotId / contentHash / role 稳定排序
- 缺失/Hash 不符记录含 `slotId`；Mahjong 预留槽可被 V1 Plan 收集绑定
- 未改 Scene 消费路径（仍读兼容 getter）；未新增第二套依赖遍历
- 商业 Golden：BLOCKED；人工视觉批准：PENDING；SwiftShader ≠ 视觉批准

## R8 — Studio Shell 分离与第一游戏正式模块化

- 状态：PASS（自检，非人工审批）
- 提交：`refactor(studio): split studio shell from Block Placement workspace`
- 门禁：`check` / `test` 178 / `typecheck` / `build`（183 modules）/ render-regression / golden-batch / pbr-runtime / Smoke Capture PASS
- App = `<StudioShell registry={studioRegistry} />`；公共 Shell/Session 无 GridCell / 8×8 / pieces / onPlace / clearSignal / domain/types
- 默认仍创建 Block Placement；crash wooooood! / Mahjong 为 Coming Soon
- `useBlockPlacementModel` 承担棋盘/块/试玩/Clear Signal；Autosave 仍写 V1
- Headless/CLI 未引入 React（CLI bundle 104.45 kB，与 R7 相同）
- Architecture allowlist 归零（App 与 integration 边已退休；catalog/bridge 迁入第一游戏并保留旧路径 re-export）
- 商业 Golden：BLOCKED；人工视觉批准：PENDING；SwiftShader ≠ 视觉批准

## R8b — 机械移动与命名纠正

- 状态：PASS（自检，非人工审批）
- 提交：`refactor(layout): move Block Placement implementation behind stable exports`
- 门禁：`check` / `test` 178 / `typecheck` / `build`（190 modules）/ render-regression / golden-batch / pbr-runtime / Smoke Capture / Full Capture PASS
- Git rename：gameEngine / boardPresets / shapes / publicFixtures / presentationCompiler / Reference2DScene / StudioScene / ThreeViewport → `src/games/block-placement/...`
- 旧路径保留 `export *` re-export，并标记 `@deprecated`；业务调用点未改
- Architecture allowlist 仍为 0
- Full Capture：20 still + 4 mp4；`prepared-pbr-maps` / `letterbox-pick` / `seek-repeat` / `cancel-export` / `webcodecs` PASS
- 冻结 Plan Hash：steel `fnv1a32:f83568be` / wood `c6d2f91f` / aurora `0502ff1b`；`cameraDrivesPixels=true`
- 商业 Golden：BLOCKED；人工视觉批准：PENDING；SwiftShader ≠ 视觉批准

## Remaining

R9 DEFERRED（需 crash wooooood! Diagnostic Slice）。本轮不删除 V1、不默认切换 V2。

完整一次性交付：`docs/reports/MULTI_GAME_REFACTOR_R0_R8B_DELIVERY.md`。

## Architecture Review `5110797256`

- 状态：PASS（R0–R8b 既定范围）
- 代码 Head：`7027bad`；证据 Head：`b2b22cf`
- PR #7：OPEN，未合入 `main`
- 正式 crash wooooood! Diagnostic Slice：未启动
- 商业 Golden：BLOCKED；人工视觉批准：PENDING；SwiftShader ≠ 视觉批准
- 非阻塞债务：V2 Request 的 moduleVersion / plan 绑定；Backend Factory；R9 收紧 `procedural-no-assets` 与实例级 Registry
