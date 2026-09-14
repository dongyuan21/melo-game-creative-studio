import { describe, expect, it } from 'vitest';
import { GameSchemaError } from '../src/game-runtime/errors';
import { parseGameReplayEnvelope } from '../src/game-runtime/projectParser';
import {
  GAME_REPLAY_CONTRACT,
  GAME_REPLAY_CONTRACT_VERSION,
  semanticReplayIdentity,
  splitPointerPlacement,
} from '../src/game-runtime/replayEnvelope';

describe('replay envelope', () => {
  it('splits a placement into a semantic action and a pointer interaction', () => {
    const split = splitPointerPlacement({
      id: 'act-1',
      actor: 'human',
      pieceId: 'piece-0',
      anchor: { row: 1, col: 2 },
      durationFrames: 16,
      pointerPath: [{ frameOffset: 0, x: 0.2, y: 0.8 }],
      actionSchemaId: 'melo.runtime.block-placement.semantic-action',
    });
    expect(split.semantic.action).toEqual({ pieceId: 'piece-0', anchor: { row: 1, col: 2 } });
    expect(split.interaction).toMatchObject({
      modality: 'pointer',
      startFrame: 0,
      endFrame: 16,
      committedActionId: 'act-1',
    });
    expect(JSON.stringify(semanticReplayIdentity({
      contract: GAME_REPLAY_CONTRACT,
      contractVersion: GAME_REPLAY_CONTRACT_VERSION,
      gameId: 'block-placement',
      moduleVersion: '1.0.0',
      takeId: 'take-1',
      initialStateHash: 'fnv1a32:deadbeef',
      seed: 1,
      actions: [split.semantic],
      interactions: [split.interaction],
    }))).not.toContain('frameOffset');
  });

  it('rejects a replay that omits required fields instead of filling defaults', () => {
    expect(() => parseGameReplayEnvelope({
      contract: GAME_REPLAY_CONTRACT,
      contractVersion: GAME_REPLAY_CONTRACT_VERSION,
      gameId: 'block-placement',
      moduleVersion: '1.0.0',
      takeId: 'take-1',
      seed: 1,
      actions: [],
      interactions: [],
    })).toThrowError(GameSchemaError);
    try {
      parseGameReplayEnvelope({
        contract: GAME_REPLAY_CONTRACT,
        contractVersion: GAME_REPLAY_CONTRACT_VERSION,
        gameId: 'block-placement',
        moduleVersion: '1.0.0',
        takeId: 'take-1',
        seed: 1,
        actions: [],
        interactions: [],
      });
    } catch (error) {
      expect((error as GameSchemaError).code).toBe('MISSING_FIELD');
    }
  });
});
