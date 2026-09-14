import { describe, expect, it } from 'vitest';
import { compileTake, evaluateCompiledTake } from '../src/director/presentationCompiler';
import { RHYTHM_PRESETS } from '../src/director/rhythmPresets';
import { parseStudioBundle } from '../src/domain/projectValidation';
import {
  consecutiveTake,
  crossClearTake,
  idleSnapshot,
  publicSceneCatalog,
  singleClearTake,
} from '../src/domain/publicFixtures';
import type { PresentationFrame, Take } from '../src/domain/types';
import { PresentationRegistry } from '../src/game-runtime/presentationRegistry';
import { migrateBlockPlacementV1 } from '../src/games/block-placement/migrations/blockPlacementV1';
import {
  BLOCK_PLACEMENT_PRESENTATION_SCHEMA_ID,
  blockPlacementPresentationAdapter,
  compileBlockPlacementFrameSource,
} from '../src/games/block-placement/presentation/legacyPresentationAdapter';
import { DEFAULT_STYLE } from '../src/renderer/stylePresets';

function unwrap(payload: unknown): PresentationFrame {
  return payload as PresentationFrame;
}

function comparable(frame: PresentationFrame) {
  return {
    board: frame.board,
    snapshot: frame.snapshot,
    draggedPiece: frame.draggedPiece ?? null,
    pointer: frame.pointer ?? null,
    placementFeedback: frame.placementFeedback ?? null,
    clearing: frame.clearing ?? null,
    cameraPunch: frame.cameraPunch,
    totalFrames: frame.totalFrames ?? null,
  };
}

function takeFromSnapshot(id: string, snapshot: Take['initial']): Take {
  return {
    id,
    name: id,
    createdAt: '2026-09-03T00:00:00.000Z',
    initial: snapshot,
    actions: [],
  };
}

describe('block placement compiled frame source', () => {
  const rhythm = RHYTHM_PRESETS['human-natural'];

  it('unwraps the same payload as evaluateCompiledTake for public fixtures', () => {
    for (const scene of publicSceneCatalog()) {
      const take = scene.take ?? takeFromSnapshot(scene.id, scene.snapshot);
      const compiled = compileTake(take, rhythm, 30);
      const source = compileBlockPlacementFrameSource({ take, rhythm, fps: 30 });
      expect(source.totalFrames).toBe(compiled.totalFrames);
      const samples = [0, 1, Math.floor(compiled.totalFrames / 2), compiled.totalFrames - 1, compiled.totalFrames + 40, -3];
      for (const frameIndex of samples) {
        const packet = source.evaluate(frameIndex);
        const legacy = evaluateCompiledTake(compiled, frameIndex, rhythm);
        expect(packet.payloadSchemaId).toBe(BLOCK_PLACEMENT_PRESENTATION_SCHEMA_ID);
        expect(comparable(unwrap(packet.payload))).toEqual(comparable(legacy));
        expect(packet.identity.totalFrames).toBe(compiled.totalFrames);
        expect(packet.feedback.cameraPunch).toBe(legacy.cameraPunch);
      }
    }
  });

  it('returns identical packets for repeated and shuffled seeks', () => {
    const take = consecutiveTake();
    const source = compileBlockPlacementFrameSource({ take, rhythm, fps: 30 });
    const order = [0, source.totalFrames - 1, 12, 12, 40, 3, 40, 0];
    const firstPass = order.map((frame) => source.evaluate(frame));
    const secondPass = [...order].reverse().map((frame) => source.evaluate(frame));
    for (const packet of firstPass) {
      const again = source.evaluate(packet.identity.frameIndex);
      expect(again).toEqual(packet);
      expect(again.identity.presentationHash).toBe(packet.identity.presentationHash);
    }
    expect(secondPass.map((item) => item.identity.frameIndex)).toEqual([...order].reverse().map((frame) => source.evaluate(frame).identity.frameIndex));
  });

  it('compiles a V2 replay through the presentation adapter', () => {
    const take = crossClearTake();
    const bundle = parseStudioBundle({
      format: 'melo-game-creative-studio-project',
      version: '1.0.0',
      project: {
        schemaVersion: '1.0.0',
        id: 'frame-source-v2',
        name: 'Frame Source V2',
        ruleProfile: 'block-placement-classic-v1',
        seed: take.initial.seed,
        setupBoard: take.initial.board,
        setupPieces: take.initial.pieces,
        style: structuredClone(DEFAULT_STYLE),
        rhythm,
        render: { width: 1080, height: 1920, fps: 30, quality: 'standard' },
      },
      takes: [take],
    });
    const document = migrateBlockPlacementV1(bundle);
    const registry = new PresentationRegistry();
    registry.register(blockPlacementPresentationAdapter);
    const source = registry.require('block-placement').compile({
      project: document.game,
      replay: document.takes[0]!,
      directorProfile: rhythm,
      fps: 30,
    });
    const legacy = compileBlockPlacementFrameSource({ take, rhythm, fps: 30 });
    expect(source.totalFrames).toBe(legacy.totalFrames);
    expect(unwrap(source.evaluate(source.totalFrames - 1).payload).snapshot).toEqual(
      unwrap(legacy.evaluate(legacy.totalFrames - 1).payload).snapshot,
    );
  });

  it('fails when the same presentation adapter is registered twice', () => {
    const registry = new PresentationRegistry();
    registry.register(blockPlacementPresentationAdapter);
    expect(() => registry.register(blockPlacementPresentationAdapter)).toThrow(/already registered/);
  });

  it('keeps single-clear and idle frame hashes stable across seeks', () => {
    for (const take of [singleClearTake(), takeFromSnapshot('idle', idleSnapshot())]) {
      const source = compileBlockPlacementFrameSource({ take, rhythm, fps: 30 });
      const mid = Math.floor(source.totalFrames / 3);
      expect(source.evaluate(mid).identity.presentationHash).toBe(source.evaluate(mid).identity.presentationHash);
    }
  });
});
