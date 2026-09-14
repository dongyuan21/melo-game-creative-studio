import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { replayActions } from '../src/domain/gameEngine';
import { parseStudioBundle } from '../src/domain/projectValidation';
import { GameSchemaError } from '../src/game-runtime/errors';
import { parseStudioProjectDocumentV2 } from '../src/game-runtime/projectParser';
import { frameReplayIdentity, semanticReplayIdentity } from '../src/game-runtime/replayEnvelope';
import { stableHash } from '../src/headless/stableHash';
import { hashBlockPlacementState } from '../src/games/block-placement/legacyRuntime';
import {
  importStudioDocument,
  migrateUnknownProjectToV2,
  replayBlockPlacementV2,
  replayHashesForV2Take,
} from '../src/games/block-placement/migrations/blockPlacementV1';

const demoPath = resolve(process.cwd(), 'examples/demo-cross-clear.melo.json');

function demoBundle() {
  return parseStudioBundle(JSON.parse(readFileSync(demoPath, 'utf8')));
}

describe('project V1 to V2 migration', () => {
  it('migrates the committed example and keeps complete state hashes', () => {
    const bundle = demoBundle();
    const { document, report } = migrateUnknownProjectToV2(structuredClone(bundle));
    expect(report.sourceFormat).toBe('melo-game-creative-studio-project');
    expect(report.sourceVersion).toBe('1.0.0');
    expect(report.targetFormat).toBe('melo-studio-project');
    expect(report.targetVersion).toBe('2.0.0');
    expect(report.gameId).toBe('block-placement');
    expect(report.actionCount).toBeGreaterThan(0);
    expect(report.interactionCount).toBe(report.actionCount);
    expect(report.sourceHash).toBe(stableHash(bundle));
    expect(report.targetHash).toBe(stableHash(document));

    const take = bundle.takes[0]!;
    const replay = document.takes[0]!;
    const v1Final = replayActions(take.initial, take.actions).at(-1)?.after ?? take.initial;
    const hashes = replayHashesForV2Take(document, replay);
    expect(hashes.finalStateHash).toBe(hashBlockPlacementState(v1Final));
    expect(replayBlockPlacementV2(replay, take.initial)).toEqual(v1Final);
  });

  it('round-trips through the V2 parser without silent defaults', () => {
    const { document } = migrateUnknownProjectToV2(demoBundle());
    const parsed = parseStudioProjectDocumentV2(JSON.parse(JSON.stringify(document)));
    expect(parsed).toEqual(document);
    expect(stableHash(parsed)).toBe(stableHash(document));
    const imported = importStudioDocument(parsed);
    expect(imported.project.id).toBe(demoBundle().project.id);
    expect(imported.takes[0]?.actions.map((action) => action.pieceId)).toEqual(
      demoBundle().takes[0]?.actions.map((action) => action.pieceId),
    );
  });

  it('keeps V1 parseStudioBundle behavior and rejects V2 documents', () => {
    const raw = JSON.parse(readFileSync(demoPath, 'utf8'));
    const parsed = parseStudioBundle(raw);
    expect(parsed.format).toBe('melo-game-creative-studio-project');
    expect(stableHash(parsed)).toBe(stableHash(demoBundle()));
    const { document } = migrateUnknownProjectToV2(parsed);
    expect(() => parseStudioBundle(document)).toThrow(/importStudioDocument/);
  });

  it('fails closed when required V2 fields are missing', () => {
    const { document } = migrateUnknownProjectToV2(demoBundle());
    const missingInteractions = structuredClone(document) as unknown as { takes: Array<Record<string, unknown>> };
    delete missingInteractions.takes[0]!.interactions;
    expect(() => parseStudioProjectDocumentV2(missingInteractions)).toThrowError(GameSchemaError);
    try {
      parseStudioProjectDocumentV2(missingInteractions);
    } catch (error) {
      expect((error as GameSchemaError).code).toBe('MISSING_FIELD');
    }
    const missingHash = structuredClone(document) as unknown as { game: { initialState: Record<string, unknown> } };
    delete missingHash.game.initialState.stateHash;
    expect(() => parseStudioProjectDocumentV2(missingHash)).toThrow(/stateHash/);
  });
});

describe('replay envelope hashes', () => {
  it('excludes pointer samples from the semantic hash and includes them in the frame hash', () => {
    const { document } = migrateUnknownProjectToV2(demoBundle());
    const replay = document.takes[0]!;
    const hashes = replayHashesForV2Take(document, replay);
    expect(hashes.semanticHash).toBe(stableHash(semanticReplayIdentity(replay)));

    const mutated = structuredClone(replay);
    const sample = mutated.interactions[0]?.samples?.[0];
    expect(sample).toBeDefined();
    sample!.x = sample!.x === 0.2 ? 0.21 : 0.2;
    expect(stableHash(semanticReplayIdentity(mutated))).toBe(hashes.semanticHash);
    expect(stableHash(frameReplayIdentity(mutated, {
      rhythm: document.direction?.rhythm,
      fps: document.production.output.fps,
      totalFrames: 1,
    }))).not.toBe(stableHash(frameReplayIdentity(replay, {
      rhythm: document.direction?.rhythm,
      fps: document.production.output.fps,
      totalFrames: 1,
    })));
    expect(JSON.stringify(semanticReplayIdentity(replay))).not.toMatch(/pointerPath/);
    expect(JSON.stringify(semanticReplayIdentity(replay))).not.toMatch(/"samples"/);
  });

  it('changes the frame hash when rhythm changes', () => {
    const { document } = migrateUnknownProjectToV2(demoBundle());
    const replay = document.takes[0]!;
    const base = stableHash(frameReplayIdentity(replay, {
      rhythm: document.direction?.rhythm,
      fps: 30,
      totalFrames: 120,
    }));
    const changed = stableHash(frameReplayIdentity(replay, {
      rhythm: { ...(document.direction?.rhythm as object), globalSpeed: 1.5 },
      fps: 30,
      totalFrames: 120,
    }));
    expect(changed).not.toBe(base);
  });
});
