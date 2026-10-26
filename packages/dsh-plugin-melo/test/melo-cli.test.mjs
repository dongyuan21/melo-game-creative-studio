import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildProduceArgv, buildRenderArgv } from '../lib/melo-cli.js';
import { mapErrorToZh } from '../lib/errors-zh.js';
import { collectHealth } from '../lib/health.js';
import { pathTriple, pickMp4Path } from '../lib/present-mp4.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('melo-cli argv mapping', () => {
  it('builds zero-decision produce defaults', () => {
    const cwd = '/tmp/workspace';
    const { argv, outDir } = buildProduceArgv({}, cwd);
    assert.equal(outDir, join(cwd, 'melo-out'));
    assert.deepEqual(argv, [
      'produce',
      '--game', 'block-placement',
      '--template', 'showcase',
      '--seed', '1',
      '--quality', 'preview',
      '--max-moves', '5',
      '--max-frames', '48',
      '--out-dir', outDir,
    ]);
  });

  it('builds render argv with out-dir', () => {
    const cwd = '/tmp/job';
    const { argv, outDir } = buildRenderArgv({ quality: 'preview', maxFrames: 12 }, cwd);
    assert.equal(outDir, join(cwd, 'melo-out'));
    assert.ok(argv.includes('render'));
    assert.ok(argv.includes('--max-frames'));
    assert.equal(argv[argv.indexOf('--max-frames') + 1], '12');
  });
});

describe('errors-zh', () => {
  it('maps CHROME_NOT_FOUND', () => {
    const guide = mapErrorToZh('CHROME_NOT_FOUND');
    assert.ok(guide?.zh.includes('Chrome'));
    assert.ok(guide?.hint);
  });
});

describe('present-mp4', () => {
  it('picks video path from videos array', () => {
    const out = pickMp4Path({ videos: [{ path: '/a/video.mp4' }] }, '/a');
    assert.equal(out, '/a/video.mp4');
  });

  it('pathTriple keeps relative when inside cwd', () => {
    const triple = pathTriple('/tmp/workspace/melo-out/video.mp4', '/tmp/workspace');
    assert.equal(triple.mp4WorkspaceRelative, 'melo-out/video.mp4');
  });
});

describe('health', () => {
  it('returns structured checks without Chrome', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'melo-health-'));
    const health = await collectHealth({ cwd: dir, meloPath: null, probeOutDir: join(dir, 'melo-out') });
    assert.equal(typeof health.cardZh, 'string');
    assert.ok(health.checks.some((c) => c.id === 'node'));
    assert.equal(health.readyForProduce, false);
  });
});
