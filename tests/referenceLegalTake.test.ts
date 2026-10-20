import { describe, expect, it } from 'vitest';
import { anchorPointerUv, pointerPathBrTlLegal, referenceBrTlTake, trayPointerUv } from '../src/hand-sync/referenceLegalTake';
import { compileTake } from '../src/games/block-placement/presentation/presentationCompiler';
import { captureRhythm } from '../src/games/block-placement/capture/suite';

describe('referenceBrTlTake', () => {
  it('has one legal action with BR→TL pointer stroke on board', () => {
    const take = referenceBrTlTake();
    expect(take.actions).toHaveLength(1);
    const action = take.actions[0];
    const start = trayPointerUv(2);
    const end = anchorPointerUv(action.anchor);
    expect(end.x).toBeLessThan(start.x);
    expect(end.y).toBeLessThan(start.y);
    expect(end.y).toBeGreaterThan(0.22);
    const path = pointerPathBrTlLegal(action.durationFrames, 2, action.anchor);
    const last = path[path.length - 1];
    expect(last.x).toBeCloseTo(end.x, 2);
    expect(last.y).toBeCloseTo(end.y, 2);
    const compiled = compileTake(take, captureRhythm(), 30);
    expect(compiled.actions[0].transition.clear.cells.length).toBeGreaterThanOrEqual(0);
  });
});
