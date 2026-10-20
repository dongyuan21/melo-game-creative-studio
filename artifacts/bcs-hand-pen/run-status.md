# 运行状态（R6 / PR #18）

**审阅基线（R6 输入）：** `80cadd6`  
**本轮实现 HEAD：** 见 PR 最新 commit（推送后更新）

## 分项

| 维度 | 状态 | 说明 |
|------|------|------|
| **运行** | PASS | Blender 4.0.2 CPU；`bash tools/hand-sync/run-pipeline-r6.sh`（或 solve 已存在时 `run-pipeline-r6-resume.sh`） |
| **技术** | R6 几何/M1/M3/M4 子项见 `technical-qc.md`；P2 总体仍为 PARTIAL（非本轮范围项 NOT_RUN） |
| **动作** | REVIEW_REQUIRED | F70→F71 块间跳变未修 |
| **外观** | REVIEW_REQUIRED | 技术笔；ProbeTip 已 hide_render |

## R6 相对审阅的核实结论

- **已认可并保留：** R5 设计画布→视频 contain、`pointerVideoPx`、F12 三联大错位修复（审阅附件已验证）。
- **已闭合（相对 R5 审阅阻塞）：** 旧 R5 正常 blend 在新 verify 下 **必须 FAIL**（`test_r5_blend_regression.py` → `BODY_CLEARANCE` 等）；R6 正常 QC **PASS**（F12 `meshTipSignedPlaneDistanceM=0`，锚点 0.2 mm 预算）。
- **已跑：** 屏幕 loader 故障矩阵、ScreenProxy 布局偏移注册负例、乱序重放探针、149 帧角标校验、交换两帧 MP4 负例、三类几何负例（杆穿屏仅 `BODY_CLEARANCE`）。

## 视频与对照

- `artifacts/bcs-hand-pen/deliveries/hand-sync-r6-preview.mp4`
- `artifacts/bcs-hand-pen/deliveries/hand-sync-r6-diagnostic.mp4`
- `artifacts/bcs-hand-pen/deliveries/m1-keyframes/`（F0/F8/F12/F19 三联 + `*_side_r6.png` 侧视）

## Run 目录

`artifacts/bcs-hand-pen/runs/hand-sync-r6/`（`job.json`、`render/qc.json`、`negative-results.json`）
