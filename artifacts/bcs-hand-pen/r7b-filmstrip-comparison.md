# R7b 与参考 filmstrip 对照说明

**参考：** `original-ref/Analysis-output-1-filmstrip.png`（真机实拍 `真机实拍.mp4` 抽帧）  
**本轮成片：** `deliveries/hand-sync-r7b-preview-ortho.mp4`（149 帧 / 30 fps / 540×960）

## 构图关系（像素验收，非 UV-only）

| 检查项 | 参考实拍观感 | R7b 正交 QC @270×480 |
|--------|----------------|----------------------|
| 主拖动方向 | 底部候选区 → 左上合法落点 | 笔尖 P：**(226.8, 422.4) → (37.8, 72.0)**，`directionOkPixelsQc: true` |
| 握持在笔尖右下 | 手在笔尖右下方，杆向右下延伸 | 握持 G 相对 P：**起 Δ(+43.1, +45.2)**，**止 Δ(+43.1, +45.2)**，`gripSideOkQc: true` |
| 右手可见 | 拇指/食指/中指握笔 | 灰模 `procedural-right-gray-v1`（掌+三指+前臂），**动作/解剖仍 REVIEW_REQUIRED** |
| 入画侧 | 右下进入 | 前臂 `Forearm` 朝画面右下延伸；`WristMarker` 见 `r7b-keyframes/r7b-*.png` |

## 三张静帧（P=红 tip，G=绿 grip，W=黄 wrist；青线=杆体朝向）

- `deliveries/r7b-keyframes/r7b-pre-contact.png`
- `deliveries/r7b-keyframes/r7b-mid-drag.png`
- `deliveries/r7b-keyframes/r7b-pre-release.png`

起止拖动标注：`deliveries/r7b-keyframes/motion-proof-start-frame.png`、`motion-proof-end-frame.png`

## 与旧 R7（GPT 否决片）差异

- **旧片：** 无手网格；笔杆从尖端向左下延伸（握持隐含在左下）。  
- **R7b：** 调整 `penTiltYaw/Roll` + `GripAnchor`；杆体青线指向右下；附灰模右手/前臂。整体参考验收 **未宣称 PASS**（右手解剖与 F70→F71 等待审）。
