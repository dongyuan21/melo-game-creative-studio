# 技术 QC（R7 / v0.4）

| 检查 | 状态 | 证据 |
|------|------|------|
| 游戏侧出口 | PASS | `verify_game_interaction.py` |
| spatial-touch-registration（触控 UV→世界→相机 vs manifest） | PASS | 与 mesh 笔尖检查分离 |
| screen-registration（网格笔尖 vs manifest，仅接触帧） | PASS | `qc-ortho.json` / `render-persp/qc.json` |
| actual-tip-contact / body / anchor（R6） | PASS | 双机位；`test_r5_blend_regression.py` 仍 FAIL 旧 R5 blend |
| 双机位同 blend | PASS | `cameraProfile` orthographic-test + perspective-oblique |
| 坐标语义 | PASS | `interaction/0.3`：`touchVideoDeviceUv`，废弃 `penDeviceUv` 混用 |
| 屏幕故障 / 负例 / 149 帧角标 | PASS | 沿用 R6 脚本（pipeline 内） |

## 机位

- **orthographic-test**：排查基线（与 R6 同族容差 2px@1080 ref）
- **perspective-oblique**：固定斜角（容差 3.5px@1080 ref），**未**重调触控轨
