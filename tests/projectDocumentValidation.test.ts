import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDefaultGameRegistry } from '../src/bootstrap/gameRegistry';
import { parseStudioBundle } from '../src/domain/projectValidation';
import { GameSchemaError } from '../src/game-runtime/errors';
import { validateStudioProjectDocumentV2 } from '../src/game-runtime/projectDocument';
import { migrateUnknownProjectToV2 } from '../src/games/block-placement/migrations/blockPlacementV1';
import { BLOCK_PLACEMENT_SEMANTIC_ACTION_SCHEMA_ID } from '../src/games/block-placement/manifest';

const demoPath = resolve(process.cwd(), 'examples/demo-cross-clear.melo.json');

describe('studio project V2 semantic validation', () => {
  it('accepts the migrated demo through the public validation entry', () => {
    const bundle = parseStudioBundle(JSON.parse(readFileSync(demoPath, 'utf8')));
    const { document } = migrateUnknownProjectToV2(bundle);
    const validated = validateStudioProjectDocumentV2(document, createDefaultGameRegistry());
    expect(validated.game.game.id).toBe('block-placement');
    expect(validated.parsed.takes[0]?.actions.length).toBeGreaterThan(0);
    expect(validated.takes[0]?.actions[0]?.schemaId).toBe(BLOCK_PLACEMENT_SEMANTIC_ACTION_SCHEMA_ID);
  });

  it('rejects a take whose game id does not match the project', () => {
    const bundle = parseStudioBundle(JSON.parse(readFileSync(demoPath, 'utf8')));
    const { document } = migrateUnknownProjectToV2(bundle);
    document.takes[0]!.gameId = 'block-crush-drop';
    expect(() => validateStudioProjectDocumentV2(document, createDefaultGameRegistry())).toThrowError(GameSchemaError);
    try {
      validateStudioProjectDocumentV2(document, createDefaultGameRegistry());
    } catch (error) {
      expect((error as GameSchemaError).code).toBe('GAME_MISMATCH');
    }
  });

  it('rejects an interaction that points at a missing action', () => {
    const bundle = parseStudioBundle(JSON.parse(readFileSync(demoPath, 'utf8')));
    const { document } = migrateUnknownProjectToV2(bundle);
    document.takes[0]!.interactions[0]!.committedActionId = 'missing-action';
    expect(() => validateStudioProjectDocumentV2(document, createDefaultGameRegistry())).toThrow(/UNKNOWN_ACTION|missing-action/);
  });
});
