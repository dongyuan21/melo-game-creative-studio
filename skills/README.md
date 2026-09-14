# Melo Skills

CLI 是原子执行面。Skill 是组合面。系统不内嵌 LLM。

```text
外部 Agent（Claude Code、Codex、自研编排）
        ↓  可读、可改、可另写
官方 Skill（本目录）或第三方 Skill
        ↓  只调用稳定命令
melo CLI 原子命令  →  JSON / 工程文件 / MP4
```

- **改配方**：改 Skill，或复制一份自己的 Skill。不要往 CLI 里堆矩阵参数。
- **改能力**：才改 CLI（新命令或现有命令的契约）。
- **1:1 包装**（`melo-agent-run` 等）方便发现参数；**组合 Skill**（`melo-remix-looks` 等）才是官方口味的编排。
- `melo produce` 是一条便捷 CLI，不是唯一合法路径。多皮、补出片、PBR 变体请用组合 Skill。

入口：[`melo/SKILL.md`](melo/SKILL.md)。命令手册：[`docs/cli/README.md`](../docs/cli/README.md)。
