import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BR_TL_TARGET_ANCHOR,
  pointerPathBrTlLegal,
  referenceBrTlTake,
  referencePickAndReleaseDesign,
} from '../src/hand-sync/referenceLegalTake';
import { pointerDesignUvToVideoDeviceUv } from '../src/hand-sync/layout';
import { compileTake } from '../src/games/block-placement/presentation/presentationCompiler';
import { captureRhythm } from '../src/games/block-placement/capture/suite';

describe('referenceBrTlTake', () => {
  it('has one legal action with BR→TL pointer stroke on board', () => {
    const take = referenceBrTlTake();
    expect(take.actions).toHaveLength(1);
    const action = take.actions[0];
    const { pick, release } = referencePickAndReleaseDesign(take.initial);
    const [su, sv] = pointerDesignUvToVideoDeviceUv([pick.x, pick.y]);
    const [eu, ev] = pointerDesignUvToVideoDeviceUv([release.x, release.y]);
    expect(eu).toBeLessThan(su);
    expect(ev).toBeLessThan(sv);
    expect(action.anchor).toEqual(REFERENCE_BR_TL_TARGET_ANCHOR);
    const path = pointerPathBrTlLegal(action.durationFrames, pick, release);
    const last = path[path.length - 1];
    expect(last.x).toBeCloseTo(release.x, 3);
    expect(last.y).toBeCloseTo(release.y, 3);
    const compiled = compileTake(take, captureRhythm(), 30);
    expect(compiled.actions[0].transition.clear.cells.length).toBeGreaterThanOrEqual(0);
  });
});
