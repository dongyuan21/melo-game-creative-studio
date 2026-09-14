# MULTI-GAME REFACTOR BASELINE

Date: 2026-09-04  
Plan: `docs/plans/MULTI_GAME_REFACTOR_EXECUTION_PLAN_V1.md`（PR #2 / `c1aadaf`）  
Protocol: `docs/plans/MULTI_GAME_REFACTOR_CONTINUOUS_EXECUTION_PROTOCOL_V1.md`  
Design: `docs/architecture/MULTI_GAME_FIXED_VIEW_SYSTEM_DESIGN_V2.md`  
Protocol start SHA: `526aee6c6a1ab01c005f868f555cafa81b6bbdd9`  
Absorbed upstream: `origin/main@f1c1052226eeaba92aff4cb4727a8fc7ee66ce74`  
Branch: `cursor/multi-game-platform-r0-r8-5d9d`  
Package: `0.3.0-alpha.4`

本文件冻结 **R0 开工基线**。协议要求从 `526aee6` 建分支；该 SHA 已是当前 `main` 祖先。为不覆盖后续合入的 Plan Shot、Board-plane pick 与 Browser PBR，R0 在 `526aee6` 上 fast-forward 吸收 `origin/main@f1c1052` 后再冻结身份。

开工时已核对：

```text
git merge-base --is-ancestor 526aee6 origin/main
git log --oneline 526aee6..origin/main
# Plan Shot / UV / fracture, board-plane pick, browser PBR
```

比较原点是吸收后的 `main@f1c1052`。若后续 main 再前进，必须 rebase/适配吸收，不得回退他人提交。

## Environment

| Item | Value |
|---|---|
| OS | Linux 6.12.94+ x86_64 |
| Node | 22.14.0 |
| npm | 10.9.7 |
| Three.js | 0.185.1 |
| Chrome | 148.0.7778.96 (`/usr/local/bin/google-chrome`) |
| Design canvas | 1064×1788 |
| Video output | 1080×1920, 30fps, silent |
| Capture GPU | Headless Chrome + SwiftShader（software WebGL） |

## Frozen identities

机器可读副本：`docs/reports/multi-game-refactor-baseline-identities.json`。  
`tests/multiGameRefactorBaseline.test.ts` 会重新编译 example Master / Recipe / 三份 MaterialPack，并与该文件逐字段比较。

### Public fixtures

`publicSceneCatalog()` 身份保持：

| id | snapshotHash | takeHash | status |
|---|---|---|---|
| idle | `fnv1a32:56eeaa38` | — | playing |
| pickup | `fnv1a32:56eeaa38` | — | playing |
| legal-preview | `fnv1a32:cc3a61bb` | — | playing |
| illegal-preview | `fnv1a32:4c9ffa19` | — | playing |
| single-clear | `fnv1a32:cc3a61bb` | `fnv1a32:05572d85` | playing |
| cross-clear | `fnv1a32:eac19161` | `fnv1a32:5a97ebe0` | playing |
| consecutive | `fnv1a32:485c16ac` | `fnv1a32:f34a84f4` | playing |
| endgame | `fnv1a32:d4ad67be` | — | game-over |

### V1 Plan / Material Runtime / Shot evidence

编译路径与 Capture 相同：`examples/headless/master.demo.json` + `variant.copper.demo.json` + `CAPTURE_ASSET_PATHS` + 对应 MaterialPack，`lockMode=frame-exact`，`clear.primary=effect.universal-clear`。

| Pack | pack / runtime contentHash | materialDescriptorKey | planHash |
|---|---|---|---|
| stainless-steel | `sha256:e8e180c7…de15432` | `fnv1a32:3e62cce0` | `fnv1a32:f83568be` |
| oak-wood | `sha256:67ce18b4…a95b5044` | `fnv1a32:25a47e01` | `fnv1a32:c6d2f91f` |
| aurora-shell | `sha256:7b3234ec…c43a4d02` | `fnv1a32:0ea05049` | `fnv1a32:0502ff1b` |

`resolveStyleFromRenderPlan` 在该 HEAD 上的证据（三份材质相同，除 materialId / planHash）：

```text
cameraDrivesPixels = true
layoutDrivesPixels = true
effectDrivesPixels = true
validatedCameraId = camera.fixed
renderedCameraProfile = camera.fixed
validatedLayoutId = layout.vertical
renderedLayoutProfile = 1080x1920
poseSource = fallback-fixed-shot
fovSource = fallback-fixed-shot
boardScreenRect = {78,332,924,924}
maximumScreenZoom = 1.025
```

Fallback `FIXED_SHOT_PROFILE` 仍冻结为：

```text
id = block-garden-fixed-shot-v1
designResolution = 1064×1788
boardScreenRect = {80,309,912,912}
maximumScreenZoom = 1.03
compositionAspect = 0.5625
```

## Architecture guards

`scripts/check-architecture.mjs` 与 `npm run check:architecture` 已纳入 `npm run check` 和 CI。

立即禁止：

```text
src/headless → src/games / React / Three / Canvas / reference2d / Scene
src/game-runtime → React / Three / Canvas / src/games / gameEngine / presentationCompiler / renderer / reference2d / domain/types
src/rendering | src/studio → domain/types
src/games/<A> → src/games/<B>
exporter → gameEngine（未列入 allowlist 的新边）
```

递减式债务（必须在对应 V1 阶段删除）：

| id | retire |
|---|---|
| exporter → presentationCompiler / StudioScene / Reference2DScene | R6 |
| App → domain/types / ThreeViewport / Reference2DViewport | R8 |
| integration catalog/bridge → domain/types；bridge → presentationCompiler | R6 / R8 |

未列入 allowlist 的同类新边会以 `UNLISTED_LEGACY_DEBT` 失败；allowlist 项消失则以 `STALE_LEGACY_ALLOWLIST` 失败。

## Capture

树内 `review-package/frames/` 与 `review-package/videos/` 仍是 STALE，不得引用。媒体只在 `review-package/run/`（gitignore）和 CI artifact。

| 项 | 状态 | 说明 |
|---|---|---|
| 历史 Full Capture | SUPERSEDED | `5c95db1` / CI `526aee6`；当时证据字段仍是 `cameraDrivesPixels=false` |
| R0 技术 Capture | 见执行日志 | SwiftShader；不是视觉批准 |
| 商业 Golden | BLOCKED | 无源视频；保持 BLOCKED，不得改成 PASS |
| 人工视觉批准 | PENDING | 实现者不得自批 |

## Non-goals for R0

未改 Gameplay、Presentation Compiler、Scene、PBR 参数、Shot 参数、Capture Spec。  
未把 T0–T5 标为完成。  
未建立平行材质系统或新的资产依赖遍历器。  
R0 不是人工 Review 门；通过自检后立即进入 R1。
