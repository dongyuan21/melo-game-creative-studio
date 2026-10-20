# 动作人工评审

**状态：REVIEW_REQUIRED**

Bot/Cursor 已生成技术预览片，但**未经用户目视批准**。

| 项目 | 说明 |
|------|------|
| 预览片 | `deliveries/hand-sync-loop-preview.mp4`（约 5s，149 帧 @30fps） |
| 诊断片 | `deliveries/hand-sync-loop-diagnostic.mp4` |
| 轨道来源 | BCS `consecutive` take，自 `pickup` 起 5s，`preserve` 时间模式 |
| 技术检查 | 探针球、笔刚体、前臂骨随 `penDeviceUv` + `penHeightM` 运动（`runs/hand-sync/render/qc.json`） |
| 未验证 | 与实拍对齐、取消/试探语义、多动作回归、自然握笔屈伸 |
| 阻塞输入 | 参考视频、握笔 PNG、授权手模 |

请在目视后更新：通过 / 退回并注明帧段与动作类型。
