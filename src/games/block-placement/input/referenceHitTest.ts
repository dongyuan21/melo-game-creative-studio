/**
 * Pure hit-test aligned with BlockPlacementReferenceScene.pick / anchorForPiece.
 * Pointer samples use design-canvas normalized coordinates (presentation pointer x/y).
 */
import type { GameSnapshot, GridCell } from '../../../domain/types';
import { REFERENCE_CANVAS, REFERENCE_LAYOUT } from '../../../reference2d/referenceProfile';
import { getShape, getShapeBounds } from '../runtime/shapes';

export type ReferencePickResult =
  | { kind: 'cell'; row: number; col: number }
  | { kind: 'piece'; pieceId: string }
  | null;

export function designNormToReferencePx(x: number, y: number): { x: number; y: number } {
  return { x: x * REFERENCE_CANVAS.width, y: y * REFERENCE_CANVAS.height };
}

export function referencePxToDesignNorm(x: number, y: number): { x: number; y: number } {
  return { x: x / REFERENCE_CANVAS.width, y: y / REFERENCE_CANVAS.height };
}

export function pickAtDesignNorm(
  snapshot: GameSnapshot,
  designX: number,
  designY: number,
  hiddenPieceId?: string | null,
): ReferencePickResult {
  const point = designNormToReferencePx(designX, designY);
  const { grid } = REFERENCE_LAYOUT.board;
  const gridSize = grid.pitch * 8 - grid.gap;
  if (
    point.x >= grid.x &&
    point.x <= grid.x + gridSize &&
    point.y >= grid.y &&
    point.y <= grid.y + gridSize
  ) {
    const col = Math.floor((point.x - grid.x) / grid.pitch);
    const row = Math.floor((point.y - grid.y) / grid.pitch);
    const localX = (point.x - grid.x) % grid.pitch;
    const localY = (point.y - grid.y) % grid.pitch;
    if (row >= 0 && row < 8 && col >= 0 && col < 8 && localX <= grid.cell && localY <= grid.cell) {
      return { kind: 'cell', row, col };
    }
  }

  for (const piece of snapshot.pieces) {
    if (piece.used || piece.id === hiddenPieceId) continue;
    const shape = getShape(piece.shapeId);
    const bounds = getShapeBounds(shape);
    const centerX = REFERENCE_LAYOUT.rack.centersX[piece.slotIndex] ?? REFERENCE_CANVAS.width / 2;
    const centerY = REFERENCE_LAYOUT.rack.centerY;
    const width = bounds.cols * REFERENCE_LAYOUT.rack.cell;
    const height = bounds.rows * REFERENCE_LAYOUT.rack.cell;
    const padding = 28;
    if (
      point.x >= centerX - width / 2 - padding &&
      point.x <= centerX + width / 2 + padding &&
      point.y >= centerY - height / 2 - padding &&
      point.y <= centerY + height / 2 + padding
    ) {
      return { kind: 'piece', pieceId: piece.id };
    }
  }
  return null;
}

export function anchorForPieceAtDesignNorm(
  snapshot: GameSnapshot,
  pieceId: string,
  designX: number,
  designY: number,
): GridCell | null {
  const piece = snapshot.pieces.find((candidate) => candidate.id === pieceId);
  if (!piece) return null;
  const point = designNormToReferencePx(designX, designY);
  const bounds = getShapeBounds(getShape(piece.shapeId));
  const liftedCenterY = point.y - REFERENCE_LAYOUT.rack.pickupLift;
  const topLeftX = point.x - (bounds.cols * REFERENCE_LAYOUT.board.grid.pitch) / 2;
  const topLeftY = liftedCenterY - (bounds.rows * REFERENCE_LAYOUT.board.grid.pitch) / 2;
  const col = Math.round((topLeftX - REFERENCE_LAYOUT.board.grid.x) / REFERENCE_LAYOUT.board.grid.pitch);
  const row = Math.round((topLeftY - REFERENCE_LAYOUT.board.grid.y) / REFERENCE_LAYOUT.board.grid.pitch);
  if (row < 0 || col < 0 || row + bounds.rows > 8 || col + bounds.cols > 8) return null;
  return { row, col };
}

/** Inverse of anchorForPiece: design norm touch where release resolves to anchor. */
export function designNormForAnchor(shapeId: string, anchor: GridCell): { x: number; y: number } {
  const bounds = getShapeBounds(getShape(shapeId));
  const { grid } = REFERENCE_LAYOUT.board;
  const topLeftX = grid.x + anchor.col * grid.pitch;
  const topLeftY = grid.y + anchor.row * grid.pitch;
  const centerX = topLeftX + (bounds.cols * grid.pitch) / 2;
  const liftedCenterY = topLeftY + (bounds.rows * grid.pitch) / 2;
  const centerY = liftedCenterY + REFERENCE_LAYOUT.rack.pickupLift;
  return referencePxToDesignNorm(centerX, centerY);
}

export function rackPickDesignNorm(slotIndex: number, shapeId: string): { x: number; y: number } {
  const bounds = getShapeBounds(getShape(shapeId));
  const centerX = REFERENCE_LAYOUT.rack.centersX[slotIndex] ?? REFERENCE_CANVAS.width / 2;
  const centerY = REFERENCE_LAYOUT.rack.centerY;
  return referencePxToDesignNorm(centerX, centerY);
}
