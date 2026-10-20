# P0 云端代码审计（BCS 手笔联动 v0.3）

审计时间：2026-10-20。仓库：`melo-game-creative-studio` @ 实验分支 `cursor/bcs-hand-pen-v03-b114`。

## 调用链（Project/Take → 编码输出）

| 阶段 | 路径 | 说明 |
|------|------|------|
| Take / 类型 | `src/domain/types.ts` | `PointerSample`、`PresentationFrame.pointer`、`PlacementAction.pointerPath` |
| 呈现编译 | `src/games/block-placement/presentation/presentationCompiler.ts` | `compileTake` / `evaluateCompiledTake`；指针插值 `interpolatePointer`；`releaseFrame` 为放置边界 |
| 适配器 | `src/games/block-placement/presentation/legacyPresentationAdapter.ts` | 帧 → `PresentationPacket`；commit/drag 语义事件 |
| 导演层重导出 | `src/director/presentationCompiler.ts` | 兼容 re-export |
| 2D 参考场景 | `src/games/block-placement/render/BlockPlacementReferenceScene.ts` | 2D 参考渲染 |
| 电影后端 | `src/games/block-placement/render/BlockPlacementCinematicScene.ts` | `pointer` NDC 映射、`normalizedPointOnPlane`；`pointerDriven` 拖拽 |
| 后端注册 | `src/games/block-placement/render/cinematicBackendAdapter.ts`、`referenceBackendAdapter.ts` | CLI `render --list` 中 `block-placement.fixed-camera-cinematic` |
| 帧源 | `src/game-runtime/frameSource.ts`、`projectDocument.ts` | `compileFrameSourceFromDocument` |
| CLI 出片 | `src/cli/commands/render.ts` → `scripts/document-render.mjs` | 无头 Chrome + WebCodecs → `video.mp4` |

## 坐标与边界（已核对）

- **指针坐标**：`PresentationFrame.pointer.x/y` 为视口归一化 [0,1]，电影场景转 NDC：`x*2-1`，`y` 取反（见 `BlockPlacementCinematicScene.normalizedPointOnPlane`）。
- **DPR / 留白**：`blockPlacementCompositionProfile` 定义 `designResolution` 1064×1788、`videoResolution` 1080×1920、`playfield` 留白；手同步 `FrozenLayout.contentRectDeviceUv` 由 playfield 推导（`src/hand-sync/layout.ts`）。
- **拾取偏移**：编译期 `pointerPath` + `interpolatePointer`；电影场景在 `pointerDriven` 时用射线落点而非纯 anchor 插值。
- **提交边界**：`evaluateCompiledTake` 在 `safeFrame > releaseFrame` 进入 `placementFeedback`；adapter 在 commit 帧发 `block-placement.placement-committed`（单帧事件，非每帧重复）。
- **预览 anchor**：拖拽段使用 `action.anchor` 与 `draggedPiece`；放置后指针回落到 anchor 派生 UV。
- **取消**：本 Take fixture 未覆盖 cancel 轨；交互轨道 builder 预留 `cancel` 事件位，需后续 Take 实测。
- **Fallback pointer**：`pointerPath` 少于 2 点时使用 `interpolatePointer` 内建 fallback 路径（需在 P4 用真实 Take 回归）。

## 测试与基线

- `npm test`：67 files / 339 tests **PASS**（含浏览器捕获夹具）。
- `npm run test:browser-e2e`：block smoke **PASS**（WebGL SwiftShader + WebCodecs）。
- 短基线编码：`artifacts/bcs-hand-pen/deliveries/baseline-bcs-preview.mp4`（`produce` + `render --max-frames 150 --quality preview`），证据 `runs/p0/baseline-evidence.json`。

## 目标输出后端

- **屏幕/编码**：`chrome-webcodecs`（`block-placement.fixed-camera-cinematic`）。
- **手/笔求解**：Blender 4.0.2 Cycles **CPU** 后台脚本 `tools/hand-sync/render_hand_sync.py`。

## 本轮新增（实验）

- `src/hand-sync/*`：从 BCS 最终呈现轨导出 `melo.hand-sync.interaction/0.2`。
- `tools/hand-sync/*`：E0 smoke、探针/笔/前臂绑定预览渲染。

## 已知缺口 / 非阻塞

- 仓库根目录无 `AGENTS.md`、无 `.cursor/rules`（已记入 `environment.json`）。
- 参考实拍视频、握笔 PNG、可授权自然手模型未进入 VM（见 `inputs/input-gaps.md`）。
- Blender 官方 4.5 LTS 便携包下载 403；当前锁定 apt **4.0.2**。

## 审计结论（技术）

- **P0 技术审计**：**PASS**（调用链清晰，现有测试绿，浏览器与 CLI 编码冒烟成功）。
- **动作人工**：**REVIEW_REQUIRED**（见 `motion-review.md`）。
- **外观人工**：**REVIEW_REQUIRED**（见 `appearance-review.md`）。
