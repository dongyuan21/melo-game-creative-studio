# 右手/前臂资产获取记录（R7e）

## 仓库内检索
- `**/*.{blend,fbx,glb}`：仅 hand-sync 探针 `.blend`，**无**可驱动右手绑定资产。

## 本轮下载尝试

| 候选 | 来源 | 结果 |
|------|------|------|
| OpenGameArt「Rigged Hand」zip | opengameart.org | HTTP 404 / 无文件 |
| glTF Sample `BoxAnimated.glb` | Khronos（占位盒） | 已下载，**非手**，仅作 glTF 导入烟测 |

实际文件（若存在）：
- `tools/hand-sync/assets/incoming/`（**不提交**公开仓库；见 `.gitignore` 建议）

## 许可与形态要求（未满足）
- 需：右手、腕+前臂、可握姿骨骼或可调静态握姿、许可可商用/修改。
- Mixamo / Adobe / Sketchfab 多数需登录；**未使用用户账号，未自动采购**。

## R8 解除阻塞（用户上传）

- **hand-posable.glb**（CC0，Innerscene）已入库：`tools/hand-sync/assets/licensed/posable-anatomical-right-hand/`
- 管线：`handRigProfile: posable-innerscene-right-cc0`，`handRigStatus: BOUND_STATIC_GRIP`
- 详见 `r8-hand-asset-evidence.md`

## 历史阻塞（R7e）

在无人机登录素材站、无用户上传包时曾为 **ASSET_BLOCKED**（OGA Rigged Hand 404 等）。

## 代码侧处理
- `handRigProfile: off` + `handRigStatus: ASSET_BLOCKED`（R7e 成片**仅笔+BCS**，不再迭代 procedural-gray）。
