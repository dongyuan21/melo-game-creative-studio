# 复现命令（云 VM，cwd=`/workspace`）

## E0

```bash
npm ci && npm run build
npm run test:browser-e2e
cp review-package/run/browser-e2e.json artifacts/bcs-hand-pen/runs/e0/bcs-browser-smoke.json
bash tools/hand-sync/run-e0.sh
```

## P0 基线编码

```bash
node dist-cli/cli/melo.js produce \
  --game block-placement --template showcase --skin look.copper \
  --seed 7 --max-moves 6 \
  --out-dir artifacts/bcs-hand-pen/runs/p0/produce
node dist-cli/cli/melo.js render \
  --out-dir artifacts/bcs-hand-pen/runs/p0/produce \
  --quality preview --max-frames 150 --video
```

## P1–P2（屏幕 manifest + 探针/笔）

```bash
HAND_SYNC_EXPORT=1 HAND_SYNC_SCREEN=1 npm test -- tests/handSyncExport.test.ts
bash tools/hand-sync/run-pipeline.sh
bash tools/hand-sync/run-negative-tests.sh
# 输出: deliveries/hand-sync-aligned-preview.mp4
```

## 单测

```bash
npm test -- tests/handSyncExport.test.ts
HAND_SYNC_EXPORT=1 npm test -- tests/handSyncExport.test.ts  # 写入 bundle
```

## 输入哈希

```bash
sha256sum artifacts/bcs-hand-pen/inputs/*
cat artifacts/bcs-hand-pen/runs/hand-sync/p1-export/bundle/bundle.json | jq .fullInputHash
```
