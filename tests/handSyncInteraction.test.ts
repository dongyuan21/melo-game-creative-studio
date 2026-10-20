import { describe, expect, it } from 'vitest';
import { buildInteractionTrack } from '../src/hand-sync/buildInteractionTrack';
import { resolveTakeAnchor, takeById } from '../src/games/block-placement/capture/suite';
import { gameImageContentRectDeviceUv } from '../src/hand-sync/layout';

describe('hand-sync interaction boundaries', () => {
  it('uses stable actionId during drag (not drag-${frame})', () => {
    const take = takeById('consecutive');
    const anchor = resolveTakeAnchor(take);
    const track = buildInteractionTrack({
      takeId: 'consecutive',
      startFrame: anchor.frames.pickup,
      frameCount: 40,
    });
    const dragFrames = track.frames.filter((frame) => frame.actionId);
    expect(dragFrames.length).toBeGreaterThan(5);
    const uniqueIds = new Set(dragFrames.map((frame) => frame.actionId));
    expect(uniqueIds.size).toBe(1);
    expect(String(uniqueIds.values().next().value)).toMatch(/^fix-/);
  });

  it('emits single commit per action, not every placementFeedback frame', () => {
    const take = takeById('consecutive');
    const anchor = resolveTakeAnchor(take);
    const track = buildInteractionTrack({
      takeId: 'consecutive',
      startFrame: anchor.frames.pickup,
      frameCount: 80,
    });
    const commits = track.frames.flatMap((frame) => frame.events.filter((event) => event.kind === 'commit'));
    expect(commits.length).toBeGreaterThanOrEqual(1);
    expect(commits.length).toBeLessThanOrEqual(3);
  });

  it('marks contact on drag segment without progress threshold', () => {
    const take = takeById('consecutive');
    const anchor = resolveTakeAnchor(take);
    const track = buildInteractionTrack({
      takeId: 'consecutive',
      startFrame: anchor.frames.pickup,
      frameCount: 10,
    });
    const first = track.frames[0];
    if (first.events.some((event) => event.kind === 'pointerdown')) {
      expect(first.contact).toBe(true);
      expect(first.penHeightM).toBe(0);
    }
  });

  it('content rect covers letterboxed game image, not playfield-only', () => {
    const rect = gameImageContentRectDeviceUv();
    expect(rect.width).toBeGreaterThan(0.9);
    expect(rect.height).toBeGreaterThan(0.9);
    expect(rect.x).toBeGreaterThan(-0.001);
    expect(rect.y).toBeGreaterThan(-0.001);
  });
});
