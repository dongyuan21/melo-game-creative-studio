import { createEmptyBoard } from '../games/block-placement/runtime/boardPresets';
import { applyPlacement, cloneSnapshot, createGame } from '../games/block-placement/runtime/gameEngine';
import {
  anchorForPieceAtDesignNorm,
  designNormForAnchor,
  pickAtDesignNorm,
  rackPickDesignNorm,
  referencePxToDesignNorm,
} from '../games/block-placement/input/referenceHitTest';
import { REFERENCE_CANVAS } from '../reference2d/referenceProfile';
import { pointerDesignUvToVideoDeviceUv } from './layout';
import type { GridCell, PieceInstance, PlacementAction, PointerSample, Take, TileColor } from '../domain/types';

export const HAND_SYNC_REFERENCE_TAKE_ID = 'reference-br-tl' as const;
export const REFERENCE_BR_TL_TARGET_ANCHOR: GridCell = { row: 1, col: 1 };
export const REFERENCE_BR_TL_PIECE_ID = 'ref-piece-2-tri-h';
export const REFERENCE_BR_TL_SHAPE_ID = 'tri-h';
export const REFERENCE_BR_TL_SLOT = 2;

function piece(
  id: string,
  shapeId: string,
  color: TileColor,
  slotIndex: number,
): PieceInstance {
  return { id, shapeId, color, used: false, setIndex: 0, slotIndex };
}

function videoUvFromDesign(designX: number, designY: number): [number, number] {
  return pointerDesignUvToVideoDeviceUv([designX, designY]);
}

/** Monotonic BR→TL on output video UV. */
export function pointerPathBrTlLegal(
  durationFrames: number,
  pickDesign: { x: number; y: number },
  releaseDesign: { x: number; y: number },
): PointerSample[] {
  const [su, sv] = videoUvFromDesign(pickDesign.x, pickDesign.y);
  const [eu, ev] = videoUvFromDesign(releaseDesign.x, releaseDesign.y);
  if (eu >= su - 0.01 || ev >= sv - 0.01) {
    throw new Error(`BR→TL video path invalid: (${su},${sv}) -> (${eu},${ev})`);
  }
  const midDesign = {
    x: pickDesign.x * 0.55 + releaseDesign.x * 0.45,
    y: pickDesign.y * 0.55 + releaseDesign.y * 0.45,
  };
  const mid = videoUvFromDesign(midDesign.x, midDesign.y);
  return [
    { frameOffset: 0, x: pickDesign.x, y: pickDesign.y },
    { frameOffset: Math.max(1, Math.round(durationFrames * 0.45)), x: midDesign.x, y: midDesign.y },
    { frameOffset: durationFrames, x: releaseDesign.x, y: releaseDesign.y },
  ];
}

export function referencePickAndReleaseDesign(
  snapshot: ReturnType<typeof createGame>,
  anchor: GridCell = REFERENCE_BR_TL_TARGET_ANCHOR,
): { pick: { x: number; y: number }; release: { x: number; y: number } } {
  const pick = rackPickDesignNorm(REFERENCE_BR_TL_SLOT, REFERENCE_BR_TL_SHAPE_ID);
  const release = designNormForAnchor(REFERENCE_BR_TL_SHAPE_ID, anchor);
  const picked = pickAtDesignNorm(snapshot, pick.x, pick.y);
  if (picked?.kind !== 'piece' || picked.pieceId !== REFERENCE_BR_TL_PIECE_ID) {
    throw new Error(`pick miss at rack: ${JSON.stringify(picked)}`);
  }
  const resolved = anchorForPieceAtDesignNorm(snapshot, REFERENCE_BR_TL_PIECE_ID, release.x, release.y);
  if (!resolved || resolved.row !== anchor.row || resolved.col !== anchor.col) {
    throw new Error(`release anchor mismatch: ${JSON.stringify(resolved)} expected ${JSON.stringify(anchor)}`);
  }
  const [su, sv] = videoUvFromDesign(pick.x, pick.y);
  const [eu, ev] = videoUvFromDesign(release.x, release.y);
  if (eu >= su || ev >= sv) {
    throw new Error('BR→TL video ordering failed after hit-test points');
  }
  return { pick, release };
}

/** Approach start: slightly below/right of rack pick (design px), for continuous entry. */
export function referenceApproachStartDesign(pick: { x: number; y: number }): { x: number; y: number } {
  const px = pick.x * REFERENCE_CANVAS.width + 40;
  const py = pick.y * REFERENCE_CANVAS.height + 55;
  return referencePxToDesignNorm(px, py);
}

export function referenceBrTlTake(): Take {
  const board = createEmptyBoard();
  const pieces = [
    piece('ref-piece-0-domino-h', 'domino-h', 'cyan', 0),
    piece('ref-piece-1-single', 'single', 'rose', 1),
    piece('ref-piece-2-tri-h', REFERENCE_BR_TL_SHAPE_ID, 'amber', REFERENCE_BR_TL_SLOT),
  ];
  const initial = createGame(board, 20261020, pieces);
  const durationFrames = 24;
  const { pick, release } = referencePickAndReleaseDesign(initial, REFERENCE_BR_TL_TARGET_ANCHOR);
  const action: PlacementAction = {
    id: `ref-br-tl-${REFERENCE_BR_TL_PIECE_ID}-${REFERENCE_BR_TL_TARGET_ANCHOR.row}-${REFERENCE_BR_TL_TARGET_ANCHOR.col}`,
    actor: 'human',
    pieceId: REFERENCE_BR_TL_PIECE_ID,
    anchor: REFERENCE_BR_TL_TARGET_ANCHOR,
    durationFrames,
    pointerPath: pointerPathBrTlLegal(durationFrames, pick, release),
  };
  const transition = applyPlacement(cloneSnapshot(initial), action);
  if (!transition) throw new Error('reference take action invalid after hit-test path');
  return {
    id: 'take-reference-br-tl',
    name: 'Hand-sync synthesized · hit-test validated BR→TL (design pointer)',
    createdAt: '2026-10-20T00:00:00.000Z',
    initial: cloneSnapshot(initial),
    actions: [transition.action],
  };
}
