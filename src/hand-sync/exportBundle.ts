import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildInteractionTrack } from './buildInteractionTrack';
import { captureRhythm, resolveTakeAnchor, takeById } from '../games/block-placement/capture/suite';
import { compileBlockPlacementFrameSource } from '../games/block-placement/presentation/legacyPresentationAdapter';
import {
  directorConfigHash,
  gitCommit,
  gitDirtyPatchHash,
  sha256Bytes,
  sha256CanonicalJson,
  sha256Utf8File,
} from './provenance';
import type { ScreenManifest } from './screenManifest';

function writeJson(path: string, value: unknown): { path: string; fileSha256: string; canonicalSha256: string } {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(path, text, 'utf8');
  return {
    path,
    fileSha256: sha256Bytes(text),
    canonicalSha256: sha256CanonicalJson(value),
  };
}

export interface ExportBundleInput {
  outDir: string;
  takeId: 'consecutive' | 'single-clear' | 'cross-clear';
  durationSeconds?: number;
  exportScreen?: boolean;
}

export function exportHandSyncBundle(input: ExportBundleInput): {
  bundleDir: string;
  runId: string;
  fullInputHash: string;
  frameCount: number;
} {
  const runId = `run-${Date.now()}`;
  const runRoot = join(input.outDir, runId);
  const bundleDir = join(runRoot, 'bundle');
  mkdirSync(bundleDir, { recursive: true });

  const fps = 30;
  const rhythm = captureRhythm();
  const take = takeById(input.takeId);
  const anchor = resolveTakeAnchor(take);
  const durationSeconds = input.durationSeconds ?? 5;
  const frameCount = Math.min(
    Math.round(durationSeconds * fps),
    anchor.compiledTotalFrames - anchor.frames.pickup,
  );
  const startSourceFrame = anchor.frames.pickup;

  const frameSource = compileBlockPlacementFrameSource({ take, rhythm, fps });
  const track = buildInteractionTrack({
    takeId: input.takeId,
    startFrame: startSourceFrame,
    frameCount,
    fps,
  });

  const interactionWritten = writeJson(join(bundleDir, 'interaction.json'), track);
  const sceneConfigBody = {
    schema: 'melo.hand-sync.scene-proxy/0.2',
    displayPlane: 'xy',
    penTiltPitchRadians: 0.35,
    penTiltYawRadians: -0.21,
    penTiltRollRadians: 0,
    penHalfLengthM: 0.06,
    mode: 'probe-pen',
  };
  const sceneWritten = writeJson(join(bundleDir, 'scene-config.json'), sceneConfigBody);

  let screenManifest: ScreenManifest | null = null;
  let screenManifestWritten: ReturnType<typeof writeJson> | null = null;
  if (input.exportScreen !== false) {
    const exportResult = spawnSync(
      process.execPath,
      [join(process.cwd(), 'scripts/hand-sync-screen-export.mjs'), bundleDir],
      {
        env: {
          ...process.env,
          HAND_SYNC_TAKE_ID: input.takeId,
          HAND_SYNC_DURATION_SEC: String(durationSeconds),
        },
        encoding: 'utf8',
        timeout: 620_000,
      },
    );
    if (exportResult.status !== 0) {
      throw new Error(
        `screen export failed: ${exportResult.stderr || exportResult.stdout || exportResult.status}`,
      );
    }
    const manifestPath = join(bundleDir, 'screen-manifest.json');
    screenManifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ScreenManifest;
    screenManifestWritten = {
      path: manifestPath,
      fileSha256: sha256Utf8File(manifestPath),
      canonicalSha256: sha256CanonicalJson(screenManifest),
    };
  }

  const directorHash = directorConfigHash(rhythm, fps);
  const repoCommit = gitCommit();
  const dirtyPatchHash = gitDirtyPatchHash();

  const source = {
    repoCommit,
    dirtyPatchHash,
    gameId: 'block-placement',
    backendId: 'block-placement.reference-2d',
    takeId: input.takeId,
    takeHash: sha256CanonicalJson(take),
    directorHash,
    frameSourceHash: frameSource.frameSourceHash,
  };

  const fullInputHash = createHash('sha256')
    .update(interactionWritten.fileSha256)
    .update(sceneWritten.fileSha256)
    .update(screenManifestWritten?.fileSha256 ?? 'no-screen')
    .update(directorHash)
    .update(frameSource.frameSourceHash)
    .update(repoCommit)
    .update(dirtyPatchHash ?? '')
    .digest('hex');

  const bundle = {
    schema: 'melo.hand-sync.bundle/0.2',
    source,
    fullInputHash,
    interaction: { path: 'interaction.json', sha256: interactionWritten.fileSha256, canonicalSha256: interactionWritten.canonicalSha256 },
    screenManifest: screenManifestWritten
      ? { path: 'screen-manifest.json', sha256: screenManifestWritten.fileSha256, canonicalSha256: screenManifestWritten.canonicalSha256 }
      : { path: null, sha256: null, canonicalSha256: null },
    rigProfile: null,
    sceneConfig: {
      path: 'scene-config.json',
      sha256: sceneWritten.fileSha256,
      canonicalSha256: sceneWritten.canonicalSha256,
    },
    exportWindow: { startSourceFrame, frameCount, fps },
  };
  writeJson(join(bundleDir, 'bundle.json'), bundle);

  writeFileSync(
    join(runRoot, 'provenance.json'),
    `${JSON.stringify({ runId, source, fullInputHash, createdAt: new Date().toISOString() }, null, 2)}\n`,
  );
  writeFileSync(
    join(input.outDir, 'latest-run.json'),
    `${JSON.stringify({ runId, bundleDir, fullInputHash, createdAt: new Date().toISOString() }, null, 2)}\n`,
  );

  return { bundleDir, runId, fullInputHash, frameCount };
}
