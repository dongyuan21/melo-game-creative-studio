---
name: melo-remix-looks
description: 同一份 Agent Take 换多套局内皮再出片。Crush/TapTile 换皮不改玩法哈希；Placement look 挂在 document.production.lookPackRef。不要重跑 Agent，也不要给 produce 加多皮开关。
---

# 一盘玩法、多套皮

Agent 只跑一次。每套皮：`skin apply` → `take validate` → `document emit` → 可选 `render`。Take 文件保持同一份。

局内皮不是 Studio 外壳。目录：

| 游戏 | 皮肤 / Look |
|---|---|
| Crush Wooood | `golden-embossed` `classic-maple` `deep-mahogany` `checker-maze` |
| TapTile | `animals-v1` `food-v1` `chain-combo-ui-v1` |
| Placement | `look.copper` `look.candy-resin` |

`look.copper` 驱动 document-render 铜金属参数外观，不是 plan-bound PBR 贴图。贴图走 `melo-placement-variant`。

## 1. 出一盘（只一次）

```bash
node dist-cli/cli/melo.js project scaffold \
  --game block-crush-drop \
  --template reference \
  --skin golden-embossed \
  --seed 29980 \
  --out /tmp/melo/remix/config.json
node dist-cli/cli/melo.js agent run \
  --game block-crush-drop \
  --config /tmp/melo/remix/config.json \
  --seed 29980 \
  --max-moves 8 \
  --out /tmp/melo/remix/take.json
node dist-cli/cli/melo.js take validate \
  --take /tmp/melo/remix/take.json \
  --game block-crush-drop \
  --config /tmp/melo/remix/config.json
```

## 2. 对每套皮出工程（Crush 示例）

```bash
mkdir -p /tmp/melo/remix/classic-maple
node dist-cli/cli/melo.js skin apply \
  --game block-crush-drop \
  --config /tmp/melo/remix/config.json \
  --skin classic-maple \
  --out /tmp/melo/remix/classic-maple/config.json
node dist-cli/cli/melo.js take validate \
  --take /tmp/melo/remix/take.json \
  --game block-crush-drop \
  --config /tmp/melo/remix/classic-maple/config.json
node dist-cli/cli/melo.js document emit \
  --game block-crush-drop \
  --config /tmp/melo/remix/classic-maple/config.json \
  --take /tmp/melo/remix/take.json \
  --skin classic-maple \
  --out /tmp/melo/remix/classic-maple/document.json
```

TapTile 把 `--game` / `--skin` 换成主题 id。Placement 的 `skin apply` 不改棋盘 config，但 `document emit --skin look.candy-resin` 会把 look 写进 `production.lookPackRef`。

校验失败就停。不要为了换皮重跑 `agent run`。

## 3. 可选出片

```bash
node dist-cli/cli/melo.js render \
  --out-dir /tmp/melo/remix/classic-maple \
  --document /tmp/melo/remix/classic-maple/document.json \
  --quality preview
```

每套皮一个目录、一份 `document.json`、一条 MP4。`take.json` 共用。
