import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { commandProduce } from '../src/cli/commands/authoring';
import { commandRender } from '../src/cli/commands/render';
import { findChromePath } from '../src/cli/chrome';
import { MELO_CAPABILITIES } from '../src/headless/capabilities';
import { BLOCK_PLACEMENT_GAME_ID } from '../src/games/block-placement/manifest';
import { BLOCK_PLACEMENT_CINEMATIC_BACKEND_ID } from '../src/games/block-placement/render/cinematicBackendAdapter';

describe('CLI document render', () => {
  it('lists registered render backends from the CLI', async () => {
    const listed = await commandRender({ list: true }) as {
      ok: boolean;
      rendered: boolean;
      backends: Array<{ id: string }>;
    };
    expect(listed.ok).toBe(true);
    expect(listed.rendered).toBe(false);
    expect(listed.backends.map((item) => item.id)).toContain(BLOCK_PLACEMENT_CINEMATIC_BACKEND_ID);
    expect(MELO_CAPABILITIES.commands).toContain('render');
  });

  it('leaves rendered false when Chrome is missing', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'melo-render-missing-'));
    const produced = await commandProduce({
      gameId: BLOCK_PLACEMENT_GAME_ID,
      template: 'showcase',
      seed: 7,
      maxMoves: 5,
      outDir: directory,
    }) as { ok: boolean; files: { document: string } };
    expect(produced.ok).toBe(true);
    const rendered = await commandRender({
      outDir: directory,
      quality: 'preview',
      maxFrames: 2,
      chromePath: null,
    }) as {
      ok: boolean;
      rendered: boolean;
      recoverable: boolean;
      code: string;
      renderRequest: { rendered: boolean; code?: string };
    };
    expect(rendered.ok).toBe(false);
    expect(rendered.rendered).toBe(false);
    expect(rendered.recoverable).toBe(true);
    expect(rendered.code).toBe('CHROME_NOT_FOUND');
    expect(rendered.renderRequest.rendered).toBe(false);
    expect(rendered.renderRequest.code).toBe('CHROME_NOT_FOUND');
    expect(existsSync(join(directory, 'video.mp4'))).toBe(false);
    const disk = JSON.parse(readFileSync(join(directory, 'render-request.json'), 'utf8')) as { rendered: boolean };
    expect(disk.rendered).toBe(false);
  });

  it('produce --render stays recoverable without Chrome', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'melo-produce-render-'));
    const produced = await commandProduce({
      gameId: BLOCK_PLACEMENT_GAME_ID,
      template: 'showcase',
      seed: 7,
      maxMoves: 5,
      outDir: directory,
      render: true,
      quality: 'preview',
      maxFrames: 2,
      chromePath: null,
    }) as {
      ok: boolean;
      rendered: boolean;
      render: { code: string; recoverable: boolean; rendered: boolean };
    };
    expect(produced.ok).toBe(true);
    expect(produced.rendered).toBe(false);
    expect(produced.render.code).toBe('CHROME_NOT_FOUND');
    expect(produced.render.recoverable).toBe(true);
    expect(produced.render.rendered).toBe(false);
  });

  it.skipIf(!findChromePath())('encodes a short Placement take in Chrome', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'melo-render-chrome-'));
    const produced = await commandProduce({
      gameId: BLOCK_PLACEMENT_GAME_ID,
      template: 'showcase',
      seed: 7,
      maxMoves: 5,
      outDir: directory,
    }) as { ok: boolean };
    expect(produced.ok).toBe(true);
    const rendered = await commandRender({
      outDir: directory,
      quality: 'preview',
      maxFrames: 2,
      timeoutMs: 180_000,
    }) as {
      ok: boolean;
      rendered: boolean;
      code?: string;
      errors: string[];
      videos: Array<{ path: string; bytes: number }>;
      renderRequest: { rendered: boolean; encoder?: string };
    };
    expect(rendered.errors, rendered.errors.join('\n')).toEqual([]);
    expect(rendered.ok).toBe(true);
    expect(rendered.rendered).toBe(true);
    expect(rendered.renderRequest.rendered).toBe(true);
    expect(rendered.renderRequest.encoder).toBe('chrome-webcodecs');
    expect(rendered.videos[0]?.bytes).toBeGreaterThan(1000);
    expect(existsSync(join(directory, 'video.mp4'))).toBe(true);
    expect(existsSync(join(directory, 'preview.png'))).toBe(true);
    const disk = JSON.parse(readFileSync(join(directory, 'render-request.json'), 'utf8')) as {
      rendered: boolean;
    };
    expect(disk.rendered).toBe(true);
  }, 180_000);
});
