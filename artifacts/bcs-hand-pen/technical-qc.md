# 技术检查（自动 / 冒烟）

| 检查 ID | 状态 | 来源 | 证据 |
|---------|------|------|------|
| node-tests | PASS | vitest | 339 tests |
| bcs-browser-smoke | PASS | `scripts/browser-capture.mjs` | `runs/e0/bcs-browser-smoke.json` |
| bcs-cli-encode | PASS | melo render | `deliveries/baseline-bcs-preview.mp4` |
| blender-save-render | PASS | E0 smoke | `runs/e0/blender-smoke/smoke.png` |
| hand-sync-track-contiguity | PASS | unit test | `tests/handSyncExport.test.ts` |
| probe-pen-follow-uv | PASS | Blender QC | `runs/hand-sync/render/qc.json` |
| gpu-render | NOT_RUN | no GPU | `environment.json` |
| natural-hand-appearance | BLOCKED | no licensed asset | `assets/asset-manifest.json` |
| motion-human | REVIEW_REQUIRED | — | `motion-review.md` |

**Bundle `fullInputHash`:** `95ed844fda66a4c93c03a04001364757a1e4ffff83d9e9d48cdea87b82f82b7f`
