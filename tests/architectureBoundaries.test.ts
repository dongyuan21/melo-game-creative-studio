import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const script = resolve(process.cwd(), 'scripts/check-architecture.mjs');
const scratchRoots: string[] = [];

function scratchRepo(): string {
  const root = mkdtempSync(resolve(tmpdir(), 'melo-architecture-'));
  scratchRoots.push(root);
  return root;
}

function writeSource(root: string, relative: string, source: string): void {
  const file = resolve(root, relative);
  mkdirSync(resolve(file, '..'), { recursive: true });
  writeFileSync(file, source);
}

function importLine(names: string, specifier: string): string {
  return `import { ${names} } from ${JSON.stringify(specifier)};`;
}

function runGuard(repositoryRoot?: string, extraArgs: string[] = []) {
  const args = [script, '--json', ...extraArgs];
  if (repositoryRoot) args.push('--root', repositoryRoot, '--no-stale');
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const parsed = JSON.parse(result.stdout) as {
    ok: boolean;
    violations: Array<{ code: string; importer: string; target: string; pattern?: string; id?: string }>;
    debt: Array<{ id: string; retireIn: string }>;
    allowlist: Array<{ id: string; retireIn: string }>;
  };
  return { status: result.status, ...parsed };
}

afterEach(() => {
  while (scratchRoots.length > 0) {
    const root = scratchRoots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

describe('architecture import guards', () => {
  it('accepts the current repository and records the decreasing legacy allowlist', () => {
    const result = runGuard();
    expect(result.status).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.debt.map((item) => item.id).sort()).toEqual(
      result.allowlist.map((item) => item.id).sort(),
    );
    expect(result.allowlist).toEqual([]);
    expect(result.debt).toEqual([]);
  });

  it('rejects headless imports of games, UI runtimes, and scenes', () => {
    const root = scratchRepo();
    writeSource(root, 'src/games/block-placement/index.ts', 'export const gameId = "block-placement";\n');
    writeSource(root, 'src/renderer/StudioScene.ts', 'export class StudioScene {}\n');
    writeSource(
      root,
      'src/headless/bad.ts',
      [
        importLine('gameId', '../games/block-placement/index'),
        'import { WebGLRenderer } from "three";',
        importLine('StudioScene', '../renderer/StudioScene'),
        'void gameId;',
        'void WebGLRenderer;',
        'void StudioScene;',
        '',
      ].join('\n'),
    );
    const result = runGuard(root);
    expect(result.status).not.toBe(0);
    expect(result.violations.map((item) => item.code).sort()).toEqual([
      'HEADLESS_IMPORTS_GAME',
      'HEADLESS_IMPORTS_SCENE',
      'HEADLESS_IMPORTS_UI_RUNTIME',
    ]);
  });

  it('rejects game-runtime imports of games, React, renderer, and first-game engine modules', () => {
    const root = scratchRepo();
    writeSource(root, 'src/games/block-placement/index.ts', 'export const gameId = "block-placement";\n');
    writeSource(root, 'src/renderer/pbrMaterialFactory.ts', 'export const factory = true;\n');
    writeSource(root, 'src/domain/gameEngine.ts', 'export const createGame = () => null;\n');
    writeSource(
      root,
      'src/game-runtime/bad.ts',
      [
        'import { createElement } from "react";',
        importLine('gameId', '../games/block-placement/index'),
        importLine('factory', '../renderer/pbrMaterialFactory'),
        importLine('createGame', '../domain/gameEngine'),
        'void createElement;',
        'void gameId;',
        'void factory;',
        'void createGame;',
        '',
      ].join('\n'),
    );
    const result = runGuard(root);
    expect(result.status).not.toBe(0);
    expect(result.violations.map((item) => item.code).sort()).toEqual([
      'GAME_RUNTIME_IMPORTS_GAME',
      'GAME_RUNTIME_IMPORTS_GAME',
      'GAME_RUNTIME_IMPORTS_RENDERER',
      'GAME_RUNTIME_IMPORTS_UI',
    ]);
  });

  it('rejects platform modules importing Block types from domain/types', () => {
    const root = scratchRepo();
    writeSource(root, 'src/domain/types.ts', 'export type GridCell = { row: number; col: number };\n');
    writeSource(
      root,
      'src/game-runtime/bad.ts',
      `${importLine('GridCell', '../domain/types')}\nexport type Cell = GridCell;\n`,
    );
    const result = runGuard(root);
    expect(result.status).not.toBe(0);
    expect(result.violations).toEqual([
      {
        code: 'PLATFORM_IMPORTS_BLOCK_TYPES',
        importer: 'src/game-runtime/bad.ts',
        target: 'src/domain/types.ts',
      },
    ]);
  });

  it('rejects one game importing another', () => {
    const root = scratchRepo();
    writeSource(root, 'src/games/block-crush/index.ts', 'export const crush = true;\n');
    writeSource(
      root,
      'src/games/block-placement/index.ts',
      `${importLine('crush', '../block-crush/index')}\nvoid crush;\n`,
    );
    const result = runGuard(root);
    expect(result.status).not.toBe(0);
    expect(result.violations).toEqual([
      {
        code: 'GAME_IMPORTS_OTHER_GAME',
        importer: 'src/games/block-placement/index.ts',
        target: 'src/games/block-crush/index.ts',
      },
    ]);
  });

  it('rejects rendering, studio, and V2 capture imports of concrete games', () => {
    const root = scratchRepo();
    writeSource(root, 'src/games/block-placement/index.ts', 'export const gameId = "block-placement";\n');
    writeSource(
      root,
      'src/rendering/bad.ts',
      `${importLine('gameId', '../games/block-placement/index')}\nvoid gameId;\n`,
    );
    writeSource(
      root,
      'src/studio/bad.ts',
      `${importLine('gameId', '../games/block-placement/index')}\nvoid gameId;\n`,
    );
    writeSource(
      root,
      'src/capture/v2/bad.ts',
      `${importLine('gameId', '../../games/block-placement/index')}\nvoid gameId;\n`,
    );
    const result = runGuard(root);
    expect(result.status).not.toBe(0);
    expect(result.violations.map((item) => item.code).sort()).toEqual([
      'CAPTURE_V2_IMPORTS_GAME',
      'RENDERING_IMPORTS_GAME',
      'STUDIO_IMPORTS_GAME',
    ]);
  });

  it('rejects new exporter-to-scene debt that is not on the allowlist', () => {
    const root = scratchRepo();
    writeSource(root, 'src/domain/gameEngine.ts', 'export const applyPlacement = () => null;\n');
    writeSource(
      root,
      'src/exporter/offlineVideoExporter.ts',
      `${importLine('applyPlacement', '../domain/gameEngine')}\nvoid applyPlacement;\n`,
    );
    const result = runGuard(root);
    expect(result.status).not.toBe(0);
    expect(result.violations).toEqual([
      {
        code: 'UNLISTED_LEGACY_DEBT',
        importer: 'src/exporter/offlineVideoExporter.ts',
        target: 'src/domain/gameEngine.ts',
        pattern: 'exporter-block-runtime',
      },
    ]);
  });
});
