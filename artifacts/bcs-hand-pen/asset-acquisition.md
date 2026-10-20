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

## 阻塞结论（D2）
**ASSET_BLOCKED**：在无人机登录素材站、无用户上传包的前提下，本轮**未取得**合格绑定右手模型。
- 最小外部需求（任选其一）：用户上传已授权 `.blend`/`.fbx`+许可文本；或用户在 Mixamo 等站下载后上传；或明确批准某一付费候选后再采购。

## 代码侧处理
- `handRigProfile: off` + `handRigStatus: ASSET_BLOCKED`（R7e 成片**仅笔+BCS**，不再迭代 procedural-gray）。
