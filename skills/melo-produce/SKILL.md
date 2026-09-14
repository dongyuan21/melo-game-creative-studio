---
name: melo-produce
description: 从出题到工程文档的一键流水线：scaffold → skin → agent take → validate → document → compile frames，可选 --render 交给 Chrome 出片。
---

# 自主创作流水线（便捷 CLI）

这是**一条** CLI，把 scaffold → skin → agent → document 串在一起。官方可编辑配方是 `melo-from-puzzle-to-mp4`；同一 Take 多套皮是 `melo-remix-looks`。不要给 `produce` 增加矩阵/多皮开关——那属于 Skill，不属于原子 CLI。

```bash
node dist-cli/cli/melo.js produce \
  --game <gameId> \
  [--template <id>] \
  [--skin <id>] \
  [--seed <int>] \
  [--profile <id>] \
  [--max-moves <int>] \
  [--beam-width <int>] \
  [--max-expanded-states <int>] \
  [--quality preview|standard|cinematic] \
  [--render] \
  [--max-frames <int>] \
  --out-dir <dir>
```

`--out-dir` 会写入：

- `config.json` 出题配置
- `take.json` 机器试玩信封
- `document.json` Studio V2 工程
- `frames.json` presentation 源（非像素）
- `render-request.json` 出片请求

不加 `--render` 时 `rendered` 为 `false`。加上后会调用 `melo-render`：有 Chrome 则写 `video.mp4`；没有 Chrome 则 `code: CHROME_NOT_FOUND`，工程文件仍保留。`ok` 表示 Take 能被官方 runtime 重放，不表示已经出片。要成片请看 `rendered`。
