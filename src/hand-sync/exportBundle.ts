import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildInteractionTrack } from './buildInteractionTrack';
import { resolveTakeAnchor, takeById } from '../games/block-placement/capture/suite';

function sha256File(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function gitHead(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  return result.stdout.trim() || 'unknown';
}

export interface ExportBundleInput {
  outDir: string;
  takeId: 'consecutive' | 'single-clear' | 'cross-clear';
  durationSeconds?: number;
}

export function exportHandSyncBundle(input: ExportBundleInput): {
  bundleDir: string;
  interactionPath: string;
  bundlePath: string;
  fullInputHash: string;
  frameCount: number;
} {
  const fps = 30;
  const take = takeById(input.takeId);
  const anchor = resolveTakeAnchor(take);
  const durationSeconds = input.durationSeconds ?? 5;
  const frameCount = Math.min(
    Math.round(durationSeconds * fps),
    anchor.compiledTotalFrames - anchor.frames.pickup,
  );
  const track = buildInteractionTrack({
    takeId: input.takeId,
    startFrame: anchor.frames.pickup,
    frameCount,
    fps,
  });

  const bundleDir = join(input.outDir, 'bundle');
  mkdirSync(bundleDir, { recursive: true });
  const interactionPath = join(bundleDir, 'interaction.json');
  const interactionJson = `${JSON.stringify(track, null, 2)}\n`;
  writeFileSync(interactionPath, interactionJson, 'utf8');
  const interactionHash = sha256File(interactionJson);

  const sceneConfig = {
    schema: 'melo.hand-sync.scene-proxy/0.2',
    displayPlane: 'xy',
    penTiltRadians: 0.35,
    mode: 'probe-pen-hand',
  };
  const scenePath = join(bundleDir, 'scene-config.json');
  writeFileSync(scenePath, `${JSON.stringify(sceneConfig, null, 2)}\n`, 'utf8');

  const fullInputHash = createHash('sha256')
    .update(interactionHash)
    .update(sha256File(JSON.stringify(sceneConfig)))
    .update(gitHead())
    .digest('hex');

  const bundle = {
    schema: 'melo.hand-sync.bundle/0.2',
    source: {
      repoCommit: gitHead(),
      dirtyPatchHash: null,
      gameId: 'block-placement',
      backendId: 'block-placement.fixed-camera-cinematic',
      takeId: input.takeId,
      takeHash: createHash('sha256').update(JSON.stringify(take)).digest('hex'),
      directorHash: 'n/a-preserve-mode',
      frameSourceHash: interactionHash,
    },
    fullInputHash,
    interaction: { path: 'interaction.json', sha256: interactionHash },
    screenManifest: { path: null, sha256: null },
    rigProfile: null,
    sceneConfig: { path: 'scene-config.json', sha256: sha256File(JSON.stringify(sceneConfig)) },
  };
  const bundlePath = join(bundleDir, 'bundle.json');
  writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');

  return {
    bundleDir,
    interactionPath,
    bundlePath,
    fullInputHash,
    frameCount: track.frameCount,
  };
}
