import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relative: string): string {
  return readFileSync(resolve(root, relative), 'utf8');
}

function skillNames(): string[] {
  return readdirSync(resolve(root, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

describe('official skills and CLI/Skill docs', () => {
  it('publishes composition skills that sequence atomic CLI commands', () => {
    const names = skillNames();
    expect(names).toEqual(expect.arrayContaining([
      'melo',
      'melo-from-puzzle-to-mp4',
      'melo-remix-looks',
      'melo-gate-before-render',
      'melo-resume-render',
      'melo-placement-variant',
      'melo-diagnose',
      'melo-agent-run',
      'melo-produce',
      'melo-render',
    ]));
    for (const name of [
      'melo-from-puzzle-to-mp4',
      'melo-remix-looks',
      'melo-gate-before-render',
      'melo-resume-render',
      'melo-placement-variant',
      'melo-diagnose',
    ]) {
      const body = read(join('skills', name, 'SKILL.md'));
      expect(body).toMatch(/node dist-cli\/cli\/melo\.js/);
      expect(body).not.toMatch(/vita-mahjong|Vita Mahjong/u);
    }
  });

  it('documents CLI atoms versus editable Skills in the hub and product docs', () => {
    const hub = read('skills/melo/SKILL.md');
    const index = read('skills/README.md');
    expect(index).toMatch(/CLI 是原子执行面/);
    expect(index).toMatch(/Skill 是组合面/);
    expect(hub).toMatch(/melo-remix-looks/);
    expect(hub).toMatch(/melo-from-puzzle-to-mp4/);
    expect(read('README.md')).toMatch(/CLI（原子）/);
    expect(read('README.md')).toMatch(/Skill（组合）/);
    expect(read('docs/cli/README.md')).toMatch(/\*\*composition\*\* surface/);
    expect(read('docs/ENGINEERING.md')).toMatch(/官方组合配方/);
    expect(read('docs/architecture/AGENT_OPERABLE_BOUNDARY.md')).toMatch(/belongs in `skills\/`/);
    expect(read('README.md')).toMatch(/入口 A：Studio/);
    expect(read('README.md')).toMatch(/入口 B：CLI \+ Skill/);
    expect(read('docs/ARCHITECTURE.md')).toMatch(/FixedCameraCinematic Renderer（当前 Placement 生产路径）/);
    expect(read('docs/LOCAL_REVIEW_AND_FEEDBACK.md')).not.toMatch(/给 Crush \/ 麻将出片/);
    expect(read('docs/LOCAL_REVIEW_AND_FEEDBACK.md')).toMatch(/Agent CLI 出片/);
  });

  it('does not keep the Vita Mahjong product name in current sources or product docs', () => {
    expect(read('README.md')).not.toMatch(/Vita Mahjong/);
    expect(read('src/bootstrap/platformBootstrap.ts')).not.toMatch(/Vita Mahjong|vita-mahjong-solitaire|VITA_MAHJONG/);
    expect(read('src/bootstrap/platformBootstrap.ts')).toMatch(/mahjong-solitaire/);
    expect(read('src/bootstrap/platformBootstrap.ts')).toMatch(/displayName: 'Mahjong'/);
    expect(read('docs/LOCAL_REVIEW_AND_FEEDBACK.md')).not.toMatch(/Vita Mahjong/);
  });
});
