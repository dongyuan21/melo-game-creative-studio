# P0 云端代码审计（修订）

## 调用链（不变）

`Take → presentationCompiler → PresentationFrame → backend → chrome-webcodecs`（见上轮表）。

## 修订项（审阅意见）

1. **`legacyPresentationAdapter.eventsFromFrame`**：在 `placementFeedback` 存在的**每一帧**都会构造 `block-placement.placement-committed` 语义事件（非单帧边界）。手同步 `buildInteractionTrack` **不**复用该逻辑发 commit；仅在 `releaseFrame+1`（`atCommitFrame`）发**一条** `commit` 边界事件，并与 `pointerup` 分离。
2. **P1**：已导出 `screen-manifest.json` + `screen/*.png`，与 `interaction.json` 共享 `frameSourceHash` 来源；屏幕后端为 **reference-2d letterbox 到 video**，与目标 cinematic 后端仍有差异 → **PARTIAL**。
3. **P2**：原“PASS”撤销；现由 `verify_hand_sync.py` 逐帧测量笔尖 vs `PenTarget`，且 `test_keyframe_replay.py` 双进程重放。

## 目标后端

- 编码交付：cinematic（CLI 仍可用）
- 手同步屏幕 manifest：**reference-2d**（与 FrameSource 同 evaluate，非二次独立 take）
