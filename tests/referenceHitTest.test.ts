import { describe, expect, it } from 'vitest';
import { createEmptyBoard } from '../src/games/block-placement/runtime/boardPresets';
import { createGame } from '../src/games/block-placement/runtime/gameEngine';
import {
  anchorForPieceAtDesignNorm,
  designNormForAnchor,
  pickAtDesignNorm,
  rackPickDesignNorm,
} from '../src/games/block-placement/input/referenceHitTest';
import {
  REFERENCE_BR_TL_PIECE_ID,
  REFERENCE_BR_TL_TARGET_ANCHOR,
  referencePickAndReleaseDesign,
} from '../src/hand-sync/referenceLegalTake';

describe('referenceHitTest', () => {
  const snapshot = createGame(createEmptyBoard(), 1, [
    { id: 'ref-piece-2-tri-h', shapeId: 'tri-h', color: 'amber', used: false, setIndex: 0, slotIndex: 2 },
  ]);

  it('rack pick hits tri-h in slot 2', () => {
    const pick = rackPickDesignNorm(2, 'tri-h');
    const hit = pickAtDesignNorm(snapshot, pick.x, pick.y);
    expect(hit).toEqual({ kind: 'piece', pieceId: REFERENCE_BR_TL_PIECE_ID });
  });

  it('release design resolves to target anchor', () => {
    const release = designNormForAnchor('tri-h', REFERENCE_BR_TL_TARGET_ANCHOR);
    const anchor = anchorForPieceAtDesignNorm(snapshot, REFERENCE_BR_TL_PIECE_ID, release.x, release.y);
    expect(anchor).toEqual(REFERENCE_BR_TL_TARGET_ANCHOR);
  });

  it('rejects legacy R7c wrong tray UV', () => {
    const hit = pickAtDesignNorm(snapshot, 0.73, 0.88);
    expect(hit?.kind).not.toBe('piece');
  });

  it('referencePickAndReleaseDesign is consistent', () => {
    const { pick, release } = referencePickAndReleaseDesign(snapshot);
    expect(pickAtDesignNorm(snapshot, pick.x, pick.y)?.pieceId).toBe(REFERENCE_BR_TL_PIECE_ID);
    expect(anchorForPieceAtDesignNorm(snapshot, REFERENCE_BR_TL_PIECE_ID, release.x, release.y)).toEqual(
      REFERENCE_BR_TL_TARGET_ANCHOR,
    );
  });
});
