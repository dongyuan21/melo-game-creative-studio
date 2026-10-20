import { describe, expect, it } from 'vitest';
import { buildInteractionTrack } from '../src/hand-sync/buildInteractionTrack';
import { resolveTakeAnchor, takeById } from '../src/games/block-placement/capture/suite';

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
