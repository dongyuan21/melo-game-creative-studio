import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportHandSyncBundle } from '../src/hand-sync/exportBundle';
import { buildInteractionTrack } from '../src/hand-sync/buildInteractionTrack';
import { HAND_SYNC_REFERENCE_TAKE_ID } from '../src/hand-sync/referenceLegalTake';
import { resolveTakeAnchor, takeById } from '../src/games/block-placement/capture/suite';

const exportRoot = join(
  process.cwd(),
  process.env.HAND_SYNC_EXPORT_ROOT ?? 'artifacts/bcs-hand-pen/runs/hand-sync-r3/export',
);

describe('hand-sync export', () => {
  it('builds a contiguous interaction track from BCS presentation', () => {
    const track = buildInteractionTrack({
      takeId: 'consecutive',
      startFrame: resolveTakeAnchor(takeById('consecutive')).frames.pickup,
      frameCount: 30,
    });
    expect(track.frames.length).toBe(30);
    for (let index = 1; index < track.frames.length; index += 1) {
      expect(track.frames[index].frameIndex).toBe(track.frames[index - 1].frameIndex + 1);
    }
  });

  it('writes bundle artifacts when HAND_SYNC_EXPORT=1', () => {
    if (process.env.HAND_SYNC_EXPORT !== '1') return;
    const withScreen = process.env.HAND_SYNC_SCREEN === '1';
    const result = exportHandSyncBundle({
      outDir: exportRoot,
      takeId: HAND_SYNC_REFERENCE_TAKE_ID,
      durationSeconds: withScreen ? 4.5 : 3,
      exportScreen: withScreen,
    });
    const bundleDir = result.bundleDir;
    expect(existsSync(join(bundleDir, 'interaction.json'))).toBe(true);
    expect(existsSync(join(bundleDir, 'bundle.json'))).toBe(true);
    const bundle = JSON.parse(readFileSync(join(bundleDir, 'bundle.json'), 'utf8'));
    expect(bundle.source.frameSourceHash).toMatch(/^(fnv1a32:[a-f0-9]+|[a-f0-9]{64})$/);
    expect(bundle.interaction.sha256).not.toBe(bundle.source.frameSourceHash);
    if (withScreen) {
      expect(existsSync(join(bundleDir, 'screen-manifest.json'))).toBe(true);
      expect(bundle.source.backendId).toBe('block-placement.reference-2d');
      const screenFiles = readdirSync(join(bundleDir, 'screen'));
      expect(screenFiles.length).toBeGreaterThan(10);
    }
    expect(result.fullInputHash).toMatch(/^[a-f0-9]{64}$/);
  }, 620_000);
});
