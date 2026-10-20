import { createEmptyBoard } from '../games/block-placement/runtime/boardPresets';
import { applyPlacement, cloneSnapshot, createGame } from '../games/block-placement/runtime/gameEngine';
import type { GridCell, PieceInstance, PlacementAction, PointerSample, Take, TileColor } from '../domain/types';

export const HAND_SYNC_REFERENCE_TAKE_ID = 'reference-br-tl' as const;

function piece(
  id: string,
  shapeId: string,
  color: TileColor,
  slotIndex: number,
): PieceInstance {
  return { id, shapeId, color, used: false, setIndex: 0, slotIndex };
}

/** Presentation pointer UV on output video (origin top-left, x right, y down). */
export function trayPointerUv(slotIndex: number): { x: number; y: number } {
  return { x: 0.27 + slotIndex * 0.23, y: 0.88 };
}

export function anchorPointerUv(anchor: GridCell): { x: number; y: number } {
  return {
    x: 0.16 + (anchor.col / 7) * 0.68,
    y: 0.16 + (anchor.row / 7) * 0.54,
  };
}

/** Bottom-right tray → board anchor, monotonic up-left on video. */
export function pointerPathBrTlLegal(
  durationFrames: number,
  slotIndex: number,
  anchor: GridCell,
): PointerSample[] {
  const start = trayPointerUv(slotIndex);
  const end = anchorPointerUv(anchor);
  if (end.x >= start.x - 0.02 || end.y >= start.y - 0.02) {
    throw new Error(
      `BR→TL path invalid: start (${start.x},${start.y}) end (${end.x},${end.y})`,
    );
  }
  const mid = {
    x: start.x * 0.55 + end.x * 0.45,
    y: start.y * 0.55 + end.y * 0.45,
  };
  return [
    { frameOffset: 0, x: start.x, y: start.y },
    { frameOffset: Math.max(1, Math.round(durationFrames * 0.42)), x: mid.x, y: mid.y },
    { frameOffset: durationFrames, x: end.x, y: end.y },
  ];
}

function findLegalAnchorBrTl(
  snapshot: ReturnType<typeof createGame>,
  pieceId: string,
  durationFrames: number,
): GridCell {
  const piece = snapshot.pieces.find((p) => p.id === pieceId);
  if (!piece) throw new Error(`missing piece ${pieceId}`);
  const start = trayPointerUv(piece.slotIndex);
  const candidates: GridCell[] = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const end = anchorPointerUv({ row, col });
      if (end.x < start.x - 0.08 && end.y < start.y - 0.12 && end.y > 0.22 && end.x > 0.18) {
        candidates.push({ row, col });
      }
    }
  }
  for (const anchor of candidates) {
    const action: PlacementAction = {
      id: `synth-${pieceId}-${anchor.row}-${anchor.col}`,
      actor: 'human',
      pieceId,
      anchor,
      durationFrames,
      pointerPath: pointerPathBrTlLegal(durationFrames, piece.slotIndex, anchor),
    };
    if (applyPlacement(cloneSnapshot(snapshot), action)) return anchor;
  }
  throw new Error('no legal BR→TL anchor for reference take');
}

/**
 * Single validated placement: right tray pickup → up-left on board.
 * Marked synthesized — not a recorded capture take.
 */
export function referenceBrTlTake(): Take {
  const board = createEmptyBoard();
  const pieces = [
    piece('ref-piece-0-domino-h', 'domino-h', 'cyan', 0),
    piece('ref-piece-1-single', 'single', 'rose', 1),
    piece('ref-piece-2-tri-h', 'tri-h', 'amber', 2),
  ];
  const initial = createGame(board, 20261020, pieces);
  const pieceId = 'ref-piece-2-tri-h';
  const durationFrames = 22;
  const anchor = findLegalAnchorBrTl(initial, pieceId, durationFrames);
  const action: PlacementAction = {
    id: `ref-br-tl-${pieceId}-${anchor.row}-${anchor.col}`,
    actor: 'human',
    pieceId,
    anchor,
    durationFrames,
    pointerPath: pointerPathBrTlLegal(durationFrames, 2, anchor),
  };
  const transition = applyPlacement(cloneSnapshot(initial), action);
  if (!transition) throw new Error('reference take action invalid after search');
  return {
    id: 'take-reference-br-tl',
    name: 'Hand-sync synthesized · right tray to legal board (BR→TL stroke)',
    createdAt: '2026-10-20T00:00:00.000Z',
    initial: cloneSnapshot(initial),
    actions: [transition.action],
  };
}
