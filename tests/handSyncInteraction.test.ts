import { describe, expect, it } from 'vitest';
import { buildInteractionTrack } from '../src/hand-sync/buildInteractionTrack';
import { HAND_SYNC_REFERENCE_MOTION } from '../src/hand-sync/layout';
import { referenceBrTlTake } from '../src/hand-sync/referenceLegalTake';
import { compileTake } from '../src/games/block-placement/presentation/presentationCompiler';
import { captureRhythm, resolveTakeAnchor, takeById } from '../src/games/block-placement/capture/suite';

describe('hand-sync interaction v0.4 touch track', () => {
  it('uses touchVideoDeviceUv and does not alias design canvas', () => {
    const anchor = resolveTakeAnchor(takeById('consecutive'));
    const track = buildInteractionTrack({
      takeId: 'consecutive',
      startFrame: anchor.frames.pickup,
      frameCount: 80,
    });
    expect(track.schema).toBe('melo.hand-sync.interaction/0.3');
    expect(track.layout.coordinateContract).toBe('hand-sync-spatial-v0.4');
    const drag = track.frames.find((f) => f.phase === 'drag' && f.contact);
    expect(drag).toBeDefined();
    expect(drag!.touchVideoDeviceUv.length).toBe(2);
    expect((drag as { penDeviceUv?: unknown }).penDeviceUv).toBeUndefined();
    expect(drag!.touchTrackSource).toBe('pointer-path');
  });

  it('matches reference motion bottom-right to top-left on drag', () => {
    const take = referenceBrTlTake();
    const rhythm = captureRhythm();
    const anchor = resolveTakeAnchor(take, rhythm, 30);
    const compiled = compileTake(take, rhythm, 30);
    const action = compiled.actions[0]!;
    const track = buildInteractionTrack({
      take,
      startFrame: anchor.frames.pickup,
      frameCount: action.releaseFrame - action.startFrame + 1,
    });
    expect(track.layout.referenceMotion).toBe(HAND_SYNC_REFERENCE_MOTION);
    const drag = track.frames.filter(
      (f) => f.contact && f.touchTrackSource === 'pointer-path' && f.actionId === take.actions[0].id,
    );
    expect(drag.length).toBeGreaterThan(5);
    const [u0, v0] = drag[0]!.touchVideoDeviceUv;
    const [u1, v1] = drag[drag.length - 1]!.touchVideoDeviceUv;
    expect(u0).toBeGreaterThan(0.65);
    expect(v0).toBeGreaterThan(0.85);
    expect(u1).toBeLessThan(u0);
    expect(v1).toBeLessThan(v0);
    expect(v1).toBeGreaterThan(0.22);
    expect(drag[drag.length - 1]!.preview?.legal).toBe(true);
  });

  it('marks post-commit anchor pointer as presentation-only', () => {
    const anchor = resolveTakeAnchor(takeById('consecutive'));
    const track = buildInteractionTrack({
      takeId: 'consecutive',
      startFrame: anchor.frames.pickup,
      frameCount: 149,
    });
    const decorated = track.frames.find((f) => f.presentationAnchorUv !== null);
    if (decorated) {
      expect(decorated.touchTrackSource).toBe('held-last-touch');
      expect(decorated.contact).toBe(false);
    }
  });
});
