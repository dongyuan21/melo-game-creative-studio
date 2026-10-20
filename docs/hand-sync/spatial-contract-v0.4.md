# BCS 手笔联动 — 交互与空间契约 v0.4

> 冻结于 PR #18 R7。R6 真实笔尖 / 穿屏 / 屏幕身份检查 **不放宽**，仅修订数据语义与验证出口。

## 1. 同步来源（什么驱动笔）

| 数据 | 用途 | 禁止 |
|------|------|------|
| **触控轨道** `touchVideoDeviceUv` + 边界事件 `pointerdown/commit/pointerup` | 拍摄层笔尖目标、接触判定 | 不得用块中心、落格 anchor、提交后装饰 pointer 驱动笔尖 |
| **预览** `preview`（吸附格、合法性） | 游戏侧验证抓取/预览/提交一致 | 不直接写入 Blender 笔轨 |
| **呈现 pointer**（提交后 anchor 派生等） | 仅标注 `presentationAnchorUv` + `touchTrackSource` | 不得冒充 `recorded` 触控 |

`touchTrackSource`：

- `pointer-path` — 来自 `pointerPath` 插值（可信触控）
- `held-last-touch` — 无新 pointer 时保持上一帧触控（抬笔过渡）
- `synthesized-hover` — 无触控记录时的空中默认

旧 Take 无 `pointerPath` 时走 fallback 路径，帧级 `origin` 仍为 `synthesized-from-action`。

## 2. 坐标空间

每份坐标在契约中注明：**空间 ID、单位、原点、时间（帧 index）**。

| 字段 | 空间 | 单位 | 原点 |
|------|------|------|------|
| `touchVideoDeviceUv` | `video-device-normalized` | UV 0–1 | 输出图像左上 |
| `touchGameImageUv` | `game-image-normalized` | UV 0–1 | 游戏图左上（letterbox 内） |
| `presentationAnchorUv` | `game-image-normalized` | UV 0–1 | 仅呈现反馈，不驱动笔 |
| 屏局部 | `screen-local-meters` | m | 屏中心，+Z 朝外 |
| `worldFromScreen` | `world` | m | 列主序 4×4 |

变换链：

```text
touchGameImageUv（可选）
  → touchVideoDeviceUv（权威触控）
  → screen-local-meters（含 penHeightM）
  → world（worldFromScreen）
  → camera → render pixels
```

**`penDeviceUv` 已废弃**（v0.3 误用为设计画布坐标）；v0.4 使用 `touchVideoDeviceUv`。

## 3. 两个验证出口

1. **游戏侧** `verify_game_interaction.py`：预览格、事件与 `touchGameImageUv`/阶段一致；提交帧事件与 preview 合法性格一致。
2. **空间侧** `verify_hand_sync.py`：
   - `spatial-touch-registration`：由 **触控 UV→世界→相机** 投影的像素 vs manifest `pointerVideoPx`（不用笔尖网格自证）
   - `screen-registration`：manifest vs **真实网格笔尖** 投影（接触帧）
   - R6：`actual-tip-contact`、`body-clearance`、`anchor-validity` 保持

## 4. 双机位

同一场景、同一 `.blend`、同一触控轨，仅切换 job 中的 `cameraProfile`：

- `orthographic-test` — 排查用正交（R5/R6 基线）
- `perspective-oblique` — 固定斜角透视（约 32mm、位置相对屏平面冻结）

**禁止**为透视单独重调轨迹或触点偏移。

## 5. v0.4 最小停止线

短轨（抓取→拖动→吸附预览→提交→抬笔）在 **正交 + 斜角透视** 下均通过上述验证；改坏屏幕 UV、笔几何或帧对应必须 FAIL。
