import type { RuntimeSchema } from '../../game-runtime/contracts';
import { GameSchemaError } from '../../game-runtime/errors';
import { isCrushWoodPieceId } from './shapes';
import type {
  CrushWoodAction,
  CrushWoodBoard,
  CrushWoodConfig,
  CrushWoodSkinId,
  CrushWoodState,
  CrushWoodStatus,
} from './types';

export const CRUSH_WOOD_CONFIG_SCHEMA_ID = 'melo.runtime.block-crush-drop.config';
export const CRUSH_WOOD_STATE_SCHEMA_ID = 'melo.runtime.block-crush-drop.state';
export const CRUSH_WOOD_ACTION_SCHEMA_ID = 'melo.runtime.block-crush-drop.action';
export const CRUSH_WOOD_SCHEMA_VERSION = '1.0.0';

function fail(path: string, detail: string): never {
  throw new GameSchemaError('INVALID_VALUE', `${path}: ${detail}`, { path });
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object');
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string, maximum = 240): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    fail(path, `must be a string of 1–${maximum} characters`);
  }
  return value;
}

function integer(value: unknown, path: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
    fail(path, `must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function skin(value: unknown, path: string): CrushWoodSkinId {
  if (value !== 'golden-embossed' && value !== 'classic-maple' && value !== 'deep-mahogany' && value !== 'checker-maze') {
    fail(path, 'must be a known Crush Wood skin id');
  }
  return value;
}

function status(value: unknown, path: string): CrushWoodStatus {
  if (value !== 'playing' && value !== 'won' && value !== 'game-over') fail(path, 'must be playing, won, or game-over');
  return value;
}

function queue(value: unknown, path: string): CrushWoodConfig['queue'] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 500) fail(path, 'must be a non-empty piece array');
  return value.map((piece, index) => isCrushWoodPieceId(piece) ? piece : fail(`${path}[${index}]`, 'unknown piece id'));
}

function rowStrings(value: unknown, rows: number, columns: number, path: string): string[] {
  if (!Array.isArray(value) || value.length !== rows) fail(path, `must contain ${rows} rows`);
  return value.map((row, index) => {
    const parsed = string(row, `${path}[${index}]`, columns);
    if (parsed.length !== columns || !/^[.#]+$/u.test(parsed)) {
      fail(`${path}[${index}]`, `must contain exactly ${columns} '.' or '#' characters`);
    }
    return parsed;
  });
}

function board(value: unknown, rows: number, columns: number, path: string): CrushWoodBoard {
  if (!Array.isArray(value) || value.length !== rows) fail(path, `must contain ${rows} rows`);
  return value.map((rowValue, rowIndex) => {
    if (!Array.isArray(rowValue) || rowValue.length !== columns) {
      fail(`${path}[${rowIndex}]`, `must contain ${columns} cells`);
    }
    return rowValue.map((cell, colIndex) => (
      cell === null || typeof cell === 'string' ? cell : fail(`${path}[${rowIndex}][${colIndex}]`, 'must be string or null')
    ));
  });
}

export const crushWoodConfigSchema: RuntimeSchema<CrushWoodConfig> = {
  id: CRUSH_WOOD_CONFIG_SCHEMA_ID,
  version: CRUSH_WOOD_SCHEMA_VERSION,
  parse(value) {
    const source = record(value, '$');
    const columns = integer(source.columns, '$.columns', 4, 40);
    const rows = integer(source.rows, '$.rows', 8, 80);
    return {
      levelId: string(source.levelId, '$.levelId'),
      columns,
      rows,
      initialRows: rowStrings(source.initialRows, rows, columns, '$.initialRows'),
      queue: queue(source.queue, '$.queue'),
      startingScore: integer(source.startingScore, '$.startingScore', 0, 10_000_000),
      targetScore: integer(source.targetScore, '$.targetScore', 1, 10_000_000),
      scorePerLine: integer(source.scorePerLine, '$.scorePerLine', 1, 100_000),
      startingTimeMs: integer(source.startingTimeMs, '$.startingTimeMs', 1_000, 3_600_000),
      moveTimeMs: integer(source.moveTimeMs, '$.moveTimeMs', 1, 60_000),
      skinId: skin(source.skinId, '$.skinId'),
    };
  },
  serialize: (value) => structuredClone(value),
};

export const crushWoodStateSchema: RuntimeSchema<CrushWoodState> = {
  id: CRUSH_WOOD_STATE_SCHEMA_ID,
  version: CRUSH_WOOD_SCHEMA_VERSION,
  parse(value) {
    const source = record(value, '$');
    const columns = integer(source.columns, '$.columns', 4, 40);
    const rows = integer(source.rows, '$.rows', 8, 80);
    const parsedQueue = queue(source.queue, '$.queue');
    return {
      levelId: string(source.levelId, '$.levelId'),
      columns,
      rows,
      board: board(source.board, rows, columns, '$.board'),
      queue: parsedQueue,
      queueIndex: integer(source.queueIndex, '$.queueIndex', 0, 1_000_000),
      score: integer(source.score, '$.score', 0, 10_000_000),
      targetScore: integer(source.targetScore, '$.targetScore', 1, 10_000_000),
      scorePerLine: integer(source.scorePerLine, '$.scorePerLine', 1, 100_000),
      linesCleared: integer(source.linesCleared, '$.linesCleared', 0, 1_000_000),
      combo: integer(source.combo, '$.combo', 0, 1_000_000),
      turn: integer(source.turn, '$.turn', 0, 1_000_000),
      remainingTimeMs: integer(source.remainingTimeMs, '$.remainingTimeMs', 0, 3_600_000),
      moveTimeMs: integer(source.moveTimeMs, '$.moveTimeMs', 1, 60_000),
      skinId: skin(source.skinId, '$.skinId'),
      status: status(source.status, '$.status'),
    };
  },
  serialize: (value) => structuredClone(value),
};

export const crushWoodActionSchema: RuntimeSchema<CrushWoodAction> = {
  id: CRUSH_WOOD_ACTION_SCHEMA_ID,
  version: CRUSH_WOOD_SCHEMA_VERSION,
  parse(value) {
    const source = record(value, '$');
    if (!isCrushWoodPieceId(source.pieceId)) fail('$.pieceId', 'unknown piece id');
    const rotation = integer(source.rotation, '$.rotation', 0, 3);
    return {
      pieceId: source.pieceId,
      column: integer(source.column, '$.column', 0, 39),
      rotation: rotation as 0 | 1 | 2 | 3,
    };
  },
  serialize: (value) => ({ ...value }),
};

export const crushWoodSchemas = {
  config: crushWoodConfigSchema,
  state: crushWoodStateSchema,
  action: crushWoodActionSchema,
};
