# 技术 QC（R4-A）

| 检查 | 状态 | 证据 |
|------|------|------|
| rigid-tip / 相机投影 1080 | PASS | `runs/hand-sync-r4/render/qc.json` technicalStatus=PASS |
| anchor-validity（刚性锚点 vs 网格） | PASS | 同上 checks |
| contact-plane | PASS | 同上 |
| body-clearance（杆体，排除笔尖球） | PASS | worstMinSignedM 见 qc |
| screen-frame-identity（manifest SHA） | PASS | verify 逐帧 load_frame |
| 10 mm 对象偏移 | PASS | `negative-results.json` pen-offset-10mm |
| 仅顶点偏移 | PASS | ANCHOR_MESH_MISMATCH |
| 杆体穿屏 | PASS | BODY_CLEARANCE |
| 逐帧 label（0,1,19,20,70,71,90,91,110,111,112,148） | PASS | `verify_frame_label_mapping.py` + `frame-label-manifest.json` |
| 双进程关键帧重放 | PASS | `test_keyframe_replay.py` |
| cinematic / 四案例 / 完整负例矩阵 | NOT_RUN | R4-B |

容差：1080 参照 P95≤1px、max≤2px；接触 |signed|≤0.5mm；渲染 270×480。

**说明：** P2 总体仍为 PARTIAL；不宣称 probe-pen + reference-2d 全阶段审阅批准。
