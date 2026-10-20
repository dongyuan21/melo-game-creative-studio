import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportHandSyncBundle } from '../src/hand-sync/exportBundle';
import { buildInteractionTrack } from '../src/hand-sync/buildInteractionTrack';
import { resolveTakeAnchor, takeById } from '../src/games/block-placement/capture/suite';

const artifactRoot = join(process.cwd(), 'artifacts/bcs-hand-pen/runs/hand-sync/p1-export');

describe('hand-sync export', () => {
  it('builds a contiguous interaction track from BCS presentation', () => {
    const track = buildInteractionTrack({
      takeId: 'consecutive',
      startFrame: resolveTakeAnchor(takeById('consecutive')).frames.pickup,
      frameCount: 30,
    });
    expect(track.schema).toBe('melo.hand-sync.interaction/0.2');
    expect(track.frames.length).toBe(30);
    for (let index = 1; index < track.frames.length; index += 1) {
      expect(track.frames[index].frameIndex).toBe(track.frames[index - 1].frameIndex + 1);
    }
    expect(track.frames.some((frame) => frame.contact)).toBe(true);
  });

  it('writes bundle artifacts when HAND_SYNC_EXPORT=1', () => {
    if (process.env.HAND_SYNC_EXPORT !== '1') return;
    mkdirSync(artifactRoot, { recursive: true });
    const result = exportHandSyncBundle({
      outDir: artifactRoot,
      takeId: 'consecutive',
      durationSeconds: 5,
    });
    expect(existsSync(result.interactionPath)).toBe(true);
    const interaction = JSON.parse(readFileSync(result.interactionPath, 'utf8'));
    expect(interaction.frameCount).toBeGreaterThanOrEqual(120);
    expect(result.fullInputHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
