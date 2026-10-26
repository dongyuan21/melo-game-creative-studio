import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILLS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../skills');

const BUNDLED = [
  {
    name: 'melo',
    file: 'melo/SKILL.md',
    description: 'Melo Game Creative Studio 的 dsh 入口：工具面 + 官方组合 Skill 索引。',
  },
  {
    name: 'melo-from-puzzle-to-mp4',
    file: 'melo-from-puzzle-to-mp4/SKILL.md',
    description: '用原子 CLI / dsh 工具从出题拼到 Chrome 出片；默认官方配方，可改 Skill 编排。',
  },
  {
    name: 'melo-remix-looks',
    file: 'melo-remix-looks/SKILL.md',
    description: '同一份 Agent Take 换多套局内皮再出片；不重跑 Agent。',
  },
];

function adaptSkillBody(body) {
  return body
    .replaceAll('node dist-cli/cli/melo.js', 'melo（优先 melo_produce / melo_render / melo_capabilities 工具；或 MELO_CLI_PATH 指向的 CLI）')
    .replaceAll('dist-cli/cli/melo.js', 'melo CLI');
}

/**
 * @param {{ skills?: { register: (skill: unknown) => void }; logger?: { warn?: (msg: string) => void } }} ctx
 */
export function registerBundledSkills(ctx) {
  if (!ctx.skills || typeof ctx.skills.register !== 'function') {
    try {
      ctx.logger?.warn?.('melo-dsh: ctx.skills 不可用，跳过 Skill 注册');
    } catch { /* ignore */ }
    return;
  }
  for (const entry of BUNDLED) {
    try {
      const body = readFileSync(join(SKILLS_ROOT, entry.file), 'utf8');
      ctx.skills.register({
        name: entry.name,
        description: entry.description,
        content: adaptSkillBody(body),
        source: 'bundled',
        invocation: { modelInvocable: true, userInvocable: true },
      });
    } catch (error) {
      try {
        ctx.logger?.warn?.(`melo-dsh: Skill ${entry.name} 注册失败：${error instanceof Error ? error.message : error}`);
      } catch { /* ignore */ }
    }
  }
}
