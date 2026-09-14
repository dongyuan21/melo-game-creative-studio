import { describe, expect, it } from 'vitest';
import { createDefaultGameRegistry } from '../src/bootstrap/gameRegistry';
import type { GameDefinition } from '../src/game-runtime/contracts';
import { GameRegistryError } from '../src/game-runtime/errors';
import { GameRegistry } from '../src/game-runtime/gameRegistry';
import { eraseGameDefinition } from '../src/game-runtime/registry';
import {
  BLOCK_CRUSH_DROP_GAME_ID,
  BLOCK_CRUSH_DROP_MODULE_VERSION,
} from '../src/games/block-crush-drop/manifest';
import {
  CRUSH_WOOD_ACTION_SCHEMA_ID,
  CRUSH_WOOD_CONFIG_SCHEMA_ID,
  CRUSH_WOOD_STATE_SCHEMA_ID,
} from '../src/games/block-crush-drop/schemas';
import { blockPlacementDefinition } from '../src/games/block-placement/definition';
import {
  BLOCK_PLACEMENT_ACTION_SCHEMA_ID,
  BLOCK_PLACEMENT_GAME_ID,
  BLOCK_PLACEMENT_MODULE_VERSION,
  BLOCK_PLACEMENT_SEMANTIC_ACTION_SCHEMA_ID,
  BLOCK_PLACEMENT_STATE_SCHEMA_ID,
} from '../src/games/block-placement/manifest';
import {
  TAPTILE_TRAY_MATCH3_GAME_ID,
  TAPTILE_TRAY_MATCH3_MODULE_VERSION,
} from '../src/games/taptile-tray-match3/manifest';

describe('game registry', () => {
  it('registers Block Placement, TapTile, and Crush Wood through the same GameDefinition contract', () => {
    const registry = createDefaultGameRegistry();
    const definition = registry.require(BLOCK_PLACEMENT_GAME_ID, BLOCK_PLACEMENT_MODULE_VERSION);
    const tapTile = registry.require(TAPTILE_TRAY_MATCH3_GAME_ID, TAPTILE_TRAY_MATCH3_MODULE_VERSION);
    const crush = registry.require(BLOCK_CRUSH_DROP_GAME_ID, BLOCK_CRUSH_DROP_MODULE_VERSION);
    expect(definition.manifest.gameId).toBe(BLOCK_PLACEMENT_GAME_ID);
    expect(definition.manifest.moduleVersion).toBe(BLOCK_PLACEMENT_MODULE_VERSION);
    expect(definition.manifest.topology).toBe('grid-2d');
    expect(tapTile.manifest).toMatchObject({
      gameId: TAPTILE_TRAY_MATCH3_GAME_ID,
      moduleVersion: TAPTILE_TRAY_MATCH3_MODULE_VERSION,
      topology: 'layered-planar',
      rulesetId: 'taptile-tray-match3-v1',
    });
    expect(crush.manifest).toMatchObject({
      gameId: BLOCK_CRUSH_DROP_GAME_ID,
      moduleVersion: BLOCK_CRUSH_DROP_MODULE_VERSION,
      topology: 'grid-2d',
      rulesetId: 'crush-wood-line-collapse-v1',
    });
    expect(registry.list()).toEqual([definition.manifest, tapTile.manifest, crush.manifest]);
    expect(registry.schemas.has(BLOCK_PLACEMENT_STATE_SCHEMA_ID, '1.0.0')).toBe(true);
    expect(registry.schemas.has(BLOCK_PLACEMENT_SEMANTIC_ACTION_SCHEMA_ID, '1.0.0')).toBe(true);
    expect(registry.schemas.has(BLOCK_PLACEMENT_ACTION_SCHEMA_ID, '1.0.0')).toBe(true);
    expect(registry.schemas.has(CRUSH_WOOD_CONFIG_SCHEMA_ID, '1.0.0')).toBe(true);
    expect(registry.schemas.has(CRUSH_WOOD_STATE_SCHEMA_ID, '1.0.0')).toBe(true);
    expect(registry.schemas.has(CRUSH_WOOD_ACTION_SCHEMA_ID, '1.0.0')).toBe(true);
  });

  it('erases the Block Placement definition without changing hashes', () => {
    const registry = createDefaultGameRegistry();
    const definition = registry.require(BLOCK_PLACEMENT_GAME_ID, BLOCK_PLACEMENT_MODULE_VERSION);
    const erased = eraseGameDefinition(definition);
    const parsed = erased.parseState(structuredClone(definition.runtime.createInitialState({}, 41782)));
    expect(erased.hashState(parsed)).toBe(definition.runtime.hashState(definition.runtime.createInitialState({}, 41782)));
  });

  it('fails on an unknown game id', () => {
    const registry = createDefaultGameRegistry();
    expect(() => registry.get('unknown-game')).toThrowError(GameRegistryError);
    try {
      registry.get('unknown-game');
    } catch (error) {
      expect(error).toBeInstanceOf(GameRegistryError);
      expect((error as GameRegistryError).code).toBe('UNKNOWN_GAME');
    }
  });

  it('fails when the same game id and module version are registered twice', () => {
    const registry = new GameRegistry();
    registry.register(blockPlacementDefinition);
    expect(() => registry.register(blockPlacementDefinition)).toThrowError(/already registered/);
    try {
      registry.register(blockPlacementDefinition);
    } catch (error) {
      expect(error).toBeInstanceOf(GameRegistryError);
      expect((error as GameRegistryError).code).toBe('DUPLICATE_GAME');
    }
  });

  it('does not leave a half-registered game when a later schema conflicts', () => {
    const registry = new GameRegistry();
    registry.register(blockPlacementDefinition);
    const colliding: GameDefinition<unknown, unknown, unknown, unknown> = {
      manifest: {
        gameId: 'contract-fixture-crush-drop',
        moduleVersion: '0.0.1',
        displayName: 'Colliding Crush Fixture',
        topology: 'grid-2d',
      },
      schemas: {
        config: {
          id: 'melo.runtime.contract-fixture-crush-drop.config',
          version: '0.0.1',
          parse: (value) => value,
          serialize: (value) => value,
        },
        state: blockPlacementDefinition.schemas.state,
        action: {
          id: 'melo.runtime.contract-fixture-crush-drop.action',
          version: '0.0.1',
          parse: (value) => value,
          serialize: (value) => value,
        },
      },
      runtime: blockPlacementDefinition.runtime,
    };
    expect(() => registry.register(colliding)).toThrowError(GameRegistryError);
    expect(registry.has('contract-fixture-crush-drop')).toBe(false);
    expect(registry.schemas.has('melo.runtime.contract-fixture-crush-drop.config', '0.0.1')).toBe(false);
    expect(registry.schemas.has('melo.runtime.contract-fixture-crush-drop.action', '0.0.1')).toBe(false);
  });
});
