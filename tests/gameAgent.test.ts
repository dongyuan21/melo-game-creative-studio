import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { commandAgent } from '../src/cli/commands/agent';
import { commandTake } from '../src/cli/commands/take';
import { ensureDefaultHeadlessPlatform } from '../src/bootstrap/headlessBootstrap';
import { MELO_CAPABILITIES } from '../src/headless/capabilities';
import { validateGameReplay } from '../src/game-runtime/replayValidation';
import { blockCrushDropAgent } from '../src/games/block-crush-drop/agent';
import { blockCrushDropDefinition } from '../src/games/block-crush-drop/definition';
import { BLOCK_CRUSH_DROP_GAME_ID } from '../src/games/block-crush-drop/manifest';
import { blockPlacementAgent } from '../src/games/block-placement/agent';
import { blockPlacementDefinition } from '../src/games/block-placement/definition';
import { BLOCK_PLACEMENT_GAME_ID } from '../src/games/block-placement/manifest';
import { tapTileTrayMatch3Agent } from '../src/games/taptile-tray-match3/agent';
import { tapTileTrayMatch3Definition } from '../src/games/taptile-tray-match3/definition';
import { TAPTILE_TRAY_MATCH3_GAME_ID } from '../src/games/taptile-tray-match3/manifest';
import { createDefaultTapTileProject } from '../src/taptile/project';
import type { GameAgentAdapter, GameAgentRunRequest } from '../src/game-runtime/agentAdapter';

function smallTapTileProject() {
  const project = createDefaultTapTileProject('free');
  project.level.tileInstances = project.level.tileInstances.slice(0, 6).map((tile, order) => ({
    ...tile,
    archetypeId: order < 3 ? 'archetype-bear' : 'archetype-gift',
    geometry: {
      ...tile.geometry,
      centerXPx: 100 + (order % 3) * 300,
      centerYPx: 500 + Math.floor(order / 3) * 300,
      layer: 0,
      order,
    },
  }));
  return project;
}

async function runAdapter(adapter: GameAgentAdapter, request: GameAgentRunRequest) {
  return adapter.run(request);
}

describe('game package agent adapters', () => {
  it('registers one adapter per demo game on the default platform', () => {
    const listed = ensureDefaultHeadlessPlatform().agents.list()
      .map((item) => item.gameId)
      .sort();
    expect(listed).toEqual([
      BLOCK_CRUSH_DROP_GAME_ID,
      BLOCK_PLACEMENT_GAME_ID,
      TAPTILE_TRAY_MATCH3_GAME_ID,
    ]);
    expect(MELO_CAPABILITIES.commands).toEqual(expect.arrayContaining([
      'agent list',
      'agent run',
      'take validate',
    ]));
  });

  it('emits a valid GameReplayEnvelope for Placement, Crush, and TapTile', async () => {
    const placement = await runAdapter(blockPlacementAgent, { seed: 7, maxMoves: 6 });
    expect(placement.validation.valid).toBe(true);
    expect(placement.replay.gameId).toBe(BLOCK_PLACEMENT_GAME_ID);
    expect(placement.replay.actions.length).toBeGreaterThan(0);
    expect(placement.status).not.toBe('failed');

    const crush = await runAdapter(blockCrushDropAgent, { seed: 29_980, maxMoves: 4 });
    expect(crush.validation.valid).toBe(true);
    expect(crush.replay.gameId).toBe(BLOCK_CRUSH_DROP_GAME_ID);
    expect(crush.replay.actions.length).toBeGreaterThan(0);

    const project = smallTapTileProject();
    const taptile = await runAdapter(tapTileTrayMatch3Agent, {
      seed: 27,
      config: project,
      profile: 'safe-win',
      options: { beamWidth: 40, maxExpandedStates: 800 },
    });
    expect(taptile.validation.valid, taptile.diagnostic).toBe(true);
    expect(taptile.replay.gameId).toBe(TAPTILE_TRAY_MATCH3_GAME_ID);
    expect(taptile.replay.actions.length).toBeGreaterThan(0);
    expect(taptile.status).toBe('solved');
  });

  it('rejects a tampered hash and an illegal action on every demo game', async () => {
    const placement = await runAdapter(blockPlacementAgent, { seed: 11, maxMoves: 4 });
    const crush = await runAdapter(blockCrushDropAgent, { seed: 3, maxMoves: 3 });
    const taptile = await runAdapter(tapTileTrayMatch3Agent, {
      seed: 5,
      config: smallTapTileProject(),
      profile: 'safe-win',
      options: { beamWidth: 40, maxExpandedStates: 800 },
    });

    const crushAction = crush.replay.actions[0]!.action as { pieceId: string; column: number; rotation: number };
    const crushIllegal = {
      pieceId: crushAction.pieceId === 'O4' ? 'I4' : 'O4',
      column: 0,
      rotation: 0 as const,
    };

    const cases = [
      {
        definition: blockPlacementDefinition,
        config: blockPlacementAgent.defaultConfig(),
        replay: placement.replay,
        illegal: { pieceId: 'no-such-piece', anchor: { row: 0, col: 0 } },
      },
      {
        definition: blockCrushDropDefinition,
        config: blockCrushDropAgent.defaultConfig(),
        replay: crush.replay,
        illegal: crushIllegal,
      },
      {
        definition: tapTileTrayMatch3Definition,
        config: smallTapTileProject(),
        replay: taptile.replay,
        illegal: { tileId: 'missing-tile' },
      },
    ] as const;

    for (const item of cases) {
      const hashTamper = structuredClone(item.replay);
      hashTamper.initialStateHash = 'tampered-initial-hash';
      const hashResult = validateGameReplay(item.definition, item.config, hashTamper);
      expect(hashResult.valid).toBe(false);
      expect(hashResult.issues.some((issue) => issue.code === 'TAKE_INITIAL_HASH_MISMATCH')).toBe(true);

      expect(item.replay.actions.length).toBeGreaterThan(0);
      const actionTamper = structuredClone(item.replay);
      actionTamper.actions[0]!.action = item.illegal;
      const illegalResult = validateGameReplay(item.definition, item.config, actionTamper);
      expect(illegalResult.valid).toBe(false);
      expect(illegalResult.issues.some((issue) => issue.code === 'ILLEGAL_ACTION' || issue.code === 'INVALID_ACTION')).toBe(true);
    }
  });
});

describe('melo agent / take CLI', () => {
  it('lists the three registered agents', async () => {
    const result = await commandAgent({ action: 'list' }) as {
      ok: boolean;
      rendered: boolean;
      agents: Array<{ gameId: string; profiles: string[] }>;
    };
    expect(result.ok).toBe(true);
    expect(result.rendered).toBe(false);
    expect(result.agents.map((item) => item.gameId)).toEqual([
      BLOCK_CRUSH_DROP_GAME_ID,
      BLOCK_PLACEMENT_GAME_ID,
      TAPTILE_TRAY_MATCH3_GAME_ID,
    ]);
  });

  it('runs Placement and round-trips take validate', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'melo-agent-'));
    const takePath = join(directory, 'placement.take.json');
    const run = await commandAgent({
      action: 'run',
      gameId: BLOCK_PLACEMENT_GAME_ID,
      seed: 9,
      maxMoves: 5,
      out: takePath,
    }) as {
      ok: boolean;
      rendered: boolean;
      status: string;
      replay: { takeId: string; actions: unknown[] };
      validation: { valid: boolean };
    };
    expect(run.ok).toBe(true);
    expect(run.rendered).toBe(false);
    expect(run.validation.valid).toBe(true);
    expect(run.replay.actions.length).toBeGreaterThan(0);
    expect(JSON.parse(readFileSync(takePath, 'utf8')).takeId).toBe(run.replay.takeId);

    const validated = await commandTake({
      action: 'validate',
      gameId: BLOCK_PLACEMENT_GAME_ID,
      take: JSON.parse(readFileSync(takePath, 'utf8')),
    }) as { ok: boolean; validation: { valid: boolean; issues: unknown[] } };
    expect(validated.ok).toBe(true);
    expect(validated.validation.valid).toBe(true);
    expect(validated.validation.issues).toEqual([]);
  });

  it('runs Crush Wood through the CLI dispatcher', async () => {
    const run = await commandAgent({
      action: 'run',
      gameId: BLOCK_CRUSH_DROP_GAME_ID,
      seed: 1,
      maxMoves: 3,
    }) as { ok: boolean; replay: { gameId: string; actions: unknown[] }; validation: { valid: boolean } };
    expect(run.ok).toBe(true);
    expect(run.replay.gameId).toBe(BLOCK_CRUSH_DROP_GAME_ID);
    expect(run.replay.actions.length).toBeGreaterThan(0);
    expect(run.validation.valid).toBe(true);
  });

  it('runs a small TapTile project and rejects a mutated take', async () => {
    const project = smallTapTileProject();
    const run = await commandAgent({
      action: 'run',
      gameId: TAPTILE_TRAY_MATCH3_GAME_ID,
      config: project,
      seed: 27,
      profile: 'safe-win',
      beamWidth: 40,
      maxExpandedStates: 800,
    }) as { ok: boolean; replay: { actions: Array<{ action: { tileId: string } }> }; validation: { valid: boolean } };
    expect(run.ok).toBe(true);
    expect(run.validation.valid).toBe(true);

    const mutated = structuredClone(run.replay);
    mutated.actions[0]!.action = { tileId: 'missing-tile' };
    const report = await commandTake({
      action: 'validate',
      gameId: TAPTILE_TRAY_MATCH3_GAME_ID,
      take: mutated,
      config: project,
    }) as { ok: boolean; validation: { valid: boolean; issues: Array<{ code: string }> } };
    expect(report.ok).toBe(false);
    expect(report.validation.issues.some((issue) => issue.code === 'ILLEGAL_ACTION')).toBe(true);
  });

  it('fails closed on an unknown gameId', async () => {
    await expect(commandAgent({ action: 'run', gameId: 'mahjong-solitaire', seed: 1 }))
      .rejects.toMatchObject({ code: 'UNKNOWN_AGENT' });
  });
});
