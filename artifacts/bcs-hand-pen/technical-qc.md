# 技术 QC（R6）

| 检查 | 状态 | 证据 |
|------|------|------|
| screen-registration（pointerVideoPx vs 笔尖投影 + ScreenProxy≈layout） | PASS | `runs/hand-sync-r6/render/qc.json`；`test_screen_proxy_registration.py` |
| screen-frame-identity（manifest SHA + validate_manifest） | PASS | `screen_load.py`；`test_screen_faults.py` |
| actual-tip-contact（接触帧 mesh 平面距离） | PASS | F12 meshPlane=0；旧 R5 blend 回归 FAIL |
| anchor-validity（默认 0.2 mm） | PASS | R6 per-frame |
| body-clearance（全网格 min signed） | PASS | 负例 `pen-body-through` → 仅 `BODY_CLEARANCE` |
| rigid-tip-alignment | PASS | reg_max≈0 px @1080 ref |
| decoded-label-binding（149 帧 RGB 角标） | PASS | `verify_frame_label_mapping.py` + `test_label_video_swap.py` |
| 关键帧重放（双进程 + 乱序访问） | PASS | `test_keyframe_replay.py` |
| 几何负例三类 | PASS | `runs/hand-sync-r6/negative-results.json` |
| cinematic / 四案例 / 完整九点设备矩阵 | NOT_RUN | 原队列 |

## F12（local 12 / source 43，contact）

- `screenRegistrationErrorPxAt1080Ref` ≈ 2.3×10⁻⁵ px  
- `meshTipSignedPlaneDistanceM` = 0  
- `anchorMeshDeltaM` = 0  
- `bodyClearanceMinSignedM` = 0  

## R5 回归（审阅要求）

`artifacts/bcs-hand-pen/runs/hand-sync-r5/render/probe_pen.blend` + 旧 job 在新 verify 下 **FAIL**（`meshTipSignedPlaneDistanceM` 约 −2.84 mm 等被检出）。
