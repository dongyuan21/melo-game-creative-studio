import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildProduceArgv, buildRenderArgv } from '../packages/dsh-plugin-melo/lib/melo-cli.js';
import { mapErrorToZh } from '../packages/dsh-plugin-melo/lib/errors-zh.js';
import { collectHealth } from '../packages/dsh-plugin-melo/lib/health.js';
import { pathTriple, pickMp4Path } from '../packages/dsh-plugin-melo/lib/present-mp4.js';

describe('dsh-plugin-melo smoke', () => {
  it('maps produce defaults for vitest workspace', () => {
    const { argv, outDir } = buildProduceArgv({ render: true }, '/workspace');
    expect(argv).toContain('--render');
    expect(argv).toContain('block-placement');
    expect(outDir).toBe('/workspace/melo-out');
  });

  it('builds render argv', () => {
    const { argv } = buildRenderArgv({ maxFrames: 10 }, '/job');
    expect(argv).toContain('--max-frames');
    expect(argv[argv.indexOf('--max-frames') + 1]).toBe('10');
  });

  it('exposes Chinese hint for chrome missing', () => {
    const guide = mapErrorToZh('CHROME_NOT_FOUND');
    expect(guide?.zh).toMatch(/Chrome/);
  });

  it('collects health card without melo cli', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'melo-dsh-health-'));
    const health = await collectHealth({ cwd: dir, meloPath: null, probeOutDir: join(dir, 'melo-out') });
    expect(health.cardZh).toContain('健康卡');
    expect(health.readyForProduce).toBe(false);
  });

  it('resolves mp4 path triple', () => {
    const mp4 = pickMp4Path({ videos: [{ path: '/job/video.mp4' }] }, '/job');
    expect(mp4).toBe('/job/video.mp4');
    expect(pathTriple('/job/video.mp4', '/job').mp4WorkspaceRelative).toBe('video.mp4');
  });
});
