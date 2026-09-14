import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  commandAuthoringCatalog,
  commandDocumentCompile,
  commandProduce,
  commandProjectScaffold,
  commandSkin,
} from '../src/cli/commands/authoring';
import { commandAgent } from '../src/cli/commands/agent';
import { commandTake } from '../src/cli/commands/take';
import { ensureDefaultHeadlessPlatform } from '../src/bootstrap/headlessBootstrap';
import { compileFrameSourceFromDocument } from '../src/game-runtime/projectDocument';
import type { GameReplayEnvelope } from '../src/game-runtime/replayEnvelope';
import { MELO_CAPABILITIES } from '../src/headless/capabilities';
import { BLOCK_CRUSH_DROP_GAME_ID } from '../src/games/block-crush-drop/manifest';
import type { CrushWoodPresentationPayload } from '../src/games/block-crush-drop/types';
import { BLOCK_PLACEMENT_GAME_ID } from '../src/games/block-placement/manifest';
import { TAPTILE_TRAY_MATCH3_GAME_ID } from '../src/games/taptile-tray-match3/manifest';
import { compileTapTileLevel } from '../src/taptile/gameplay';
import type { TapTileProjectV2 } from '../src/taptile/project';

describe('authoring adapters and produce pipeline', () => {
  it('registers templates and in-game skins for every demo game', async () => {
    const platform = ensureDefaultHeadlessPlatform();
    expect(platform.authoring.list().map((item) => item.gameId).sort()).toEqual([
      BLOCK_CRUSH_DROP_GAME_ID,
      BLOCK_PLACEMENT_GAME_ID,
      TAPTILE_TRAY_MATCH3_GAME_ID,
    ]);
    const catalog = await commandAuthoringCatalog({}) as {
      games: Array<{ gameId: string; templates: Array<{ id: string }>; skins: Array<{ id: string }> }>;
    };
    const taptile = catalog.games.find((item) => item.gameId === TAPTILE_TRAY_MATCH3_GAME_ID)!;
    expect(taptile.templates.map((item) => item.id)).toEqual(['hourglass', 't-shape', 'terraces', 'free']);
    expect(taptile.skins.map((item) => item.id)).toEqual(['animals-v1', 'food-v1', 'chain-combo-ui-v1']);
    const placementCatalog = catalog.games.find((item) => item.gameId === BLOCK_PLACEMENT_GAME_ID)!;
    expect(placementCatalog.skins.map((item) => item.id)).toEqual(['look.copper', 'look.candy-resin']);
    expect(MELO_CAPABILITIES.commands).toEqual(expect.arrayContaining([
      'project scaffold',
      'skin apply',
      'document emit',
      'produce',
      'render',
    ]));
  });

  it('scaffolds a Placement board preset and a Crush skin without importing games from CLI', async () => {
    const placement = await commandProjectScaffold({
      gameId: BLOCK_PLACEMENT_GAME_ID,
      template: 'cross-clear',
      seed: 11,
    }) as { ok: boolean; templateId: string; config: { board: { rows: number } } };
    expect(placement.ok).toBe(true);
    expect(placement.templateId).toBe('cross-clear');
    expect(placement.config.board.rows).toBe(8);

    const crush = await commandProjectScaffold({
      gameId: BLOCK_CRUSH_DROP_GAME_ID,
      template: 'corridor',
      skin: 'classic-maple',
      seed: 4,
    }) as { skinId: string; config: { skinId: string; initialRows: string[] } };
    expect(crush.skinId).toBe('classic-maple');
    expect(crush.config.skinId).toBe('classic-maple');
    expect(crush.config.initialRows[10]).toBe('##.................##');
  });

  it('replaces TapTile in-game theme without changing the level hash', async () => {
    const authoring = ensureDefaultHeadlessPlatform().authoring.require(TAPTILE_TRAY_MATCH3_GAME_ID);
    const scaffold = authoring.scaffold({ seed: 9, template: 'hourglass' });
    const before = compileTapTileLevel(scaffold.config as TapTileProjectV2).levelHash;
    const food = authoring.applySkin(scaffold.config, 'food-v1');
    expect((food.config as TapTileProjectV2).visuals.selectedThemeId).toBe('food-v1');
    expect(compileTapTileLevel(food.config as TapTileProjectV2).levelHash).toBe(before);
    const chain = await commandSkin({
      action: 'apply',
      gameId: TAPTILE_TRAY_MATCH3_GAME_ID,
      config: scaffold.config,
      skin: 'chain-combo-ui-v1',
    }) as { skinId: string; config: TapTileProjectV2 };
    expect(chain.skinId).toBe('chain-combo-ui-v1');
    expect(chain.config.visuals.selectedThemeId).toBe('chain-combo-ui-v1');
    expect(compileTapTileLevel(chain.config).levelHash).toBe(before);
  });

  it('produces a Placement bundle from puzzle to compiled frames, still unrendered', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'melo-produce-'));
    const produced = await commandProduce({
      gameId: BLOCK_PLACEMENT_GAME_ID,
      template: 'showcase',
      skin: 'look.copper',
      seed: 7,
      maxMoves: 5,
      outDir: directory,
    }) as {
      ok: boolean;
      rendered: boolean;
      status: string;
      files: { config: string; take?: string; document: string; frames?: string; renderRequest: string };
      frames: { totalFrames: number; rendered: boolean } | null;
      renderRequest: { rendered: boolean };
    };
    expect(produced.ok).toBe(true);
    expect(produced.rendered).toBe(false);
    expect(produced.frames?.totalFrames).toBeGreaterThan(0);
    expect(produced.renderRequest.rendered).toBe(false);
    const producedDocument = JSON.parse(readFileSync(produced.files.document, 'utf8')) as {
      takes: unknown[];
      production: { lookPackRef: { id: string } };
    };
    expect(producedDocument.takes).toHaveLength(1);
    expect(producedDocument.production.lookPackRef.id).toBe('look.copper');
    const compiled = await commandDocumentCompile({
      document: JSON.parse(readFileSync(produced.files.document, 'utf8')),
    }) as { ok: boolean; frames: { takeId: string; totalFrames: number } };
    expect(compiled.ok).toBe(true);
    expect(compiled.frames.totalFrames).toBe(produced.frames?.totalFrames);
  });

  it('keeps a Crush take valid after a palette swap and compiles the new skin', async () => {
    const platform = ensureDefaultHeadlessPlatform();
    const authoring = platform.authoring.require(BLOCK_CRUSH_DROP_GAME_ID);
    const scaffold = authoring.scaffold({ seed: 29_980, template: 'reference', skin: 'golden-embossed' });
    const run = await commandAgent({
      action: 'run',
      gameId: BLOCK_CRUSH_DROP_GAME_ID,
      config: scaffold.config,
      seed: 29_980,
      maxMoves: 4,
    }) as { ok: boolean; replay: GameReplayEnvelope };
    expect(run.ok).toBe(true);

    const skinned = await commandSkin({
      action: 'apply',
      gameId: BLOCK_CRUSH_DROP_GAME_ID,
      config: scaffold.config,
      skin: 'classic-maple',
    }) as { skinId: string; config: { skinId: string } };
    expect(skinned.skinId).toBe('classic-maple');
    expect(skinned.config.skinId).toBe('classic-maple');

    const validated = await commandTake({
      action: 'validate',
      gameId: BLOCK_CRUSH_DROP_GAME_ID,
      take: run.replay,
      config: skinned.config,
    }) as { ok: boolean };
    expect(validated.ok).toBe(true);

    const document = authoring.emitDocument({
      config: skinned.config,
      seed: 29_980,
      takes: [run.replay],
      skin: skinned.skinId,
    });
    expect(document.game.config.data).toMatchObject({ skinId: 'classic-maple' });
    const source = compileFrameSourceFromDocument(document, platform, {
      takeId: document.takes[0]!.takeId,
      directorProfile: document.direction?.rhythm ?? {},
      fps: 30,
    });
    expect((source.evaluate(0).payload as CrushWoodPresentationPayload).skinId).toBe('classic-maple');
  });
});
