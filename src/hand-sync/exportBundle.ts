import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildInteractionTrack } from './buildInteractionTrack';
import { compileTake } from '../games/block-placement/presentation/presentationCompiler';
import { HAND_SYNC_REFERENCE_TAKE_ID, referenceBrTlTake } from './referenceLegalTake';
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
import type { InteractionTrack } from './contracts';
import type { ScreenManifest } from './screenManifest';

/** Spatial ground truth for touch pixels comes from interaction touch track, not pen solve. */
function alignManifestTouchPointers(manifest: ScreenManifest, track: InteractionTrack): void {
  const video = track.layout.gameImagePx;
  for (const entry of manifest.frames) {
    const local = entry.localFrameIndex;
    const frame = track.frames[local];
    if (!frame) continue;
    const [u, v] = frame.touchVideoDeviceUv;
    entry.pointerVideoPx = { x: u * video.width, y: v * video.height };
    entry.pointerSpace = 'video-device-normalized';
  }
}

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
  takeId?: 'consecutive' | 'single-clear' | 'cross-clear' | typeof HAND_SYNC_REFERENCE_TAKE_ID;
  durationSeconds?: number;
  exportScreen?: boolean;
  approachFrames?: number;
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
  const useReference = (input.takeId ?? HAND_SYNC_REFERENCE_TAKE_ID) === HAND_SYNC_REFERENCE_TAKE_ID;
  const take = useReference
    ? referenceBrTlTake()
    : takeById(input.takeId as 'consecutive' | 'single-clear' | 'cross-clear');
  const anchor = resolveTakeAnchor(take, rhythm, fps);
  const compiled = compileTake(take, rhythm, fps);
  const first = compiled.actions[0];
  const approachFrames = input.approachFrames ?? (useReference ? 18 : 0);
  const durationSeconds = input.durationSeconds ?? (useReference ? 4.5 : 5);
  const postCommit = first ? first.clearEndFrame - first.releaseFrame + 8 : 0;
  const naturalEnd = first ? first.releaseFrame + postCommit : anchor.compiledTotalFrames - 1;
  const startSourceFrame = useReference
    ? Math.max(0, anchor.frames.pickup - approachFrames)
    : anchor.frames.pickup;
  const maxFrames = naturalEnd - startSourceFrame + 1;
  const frameCount = Math.min(Math.round(durationSeconds * fps), maxFrames);

  const frameSource = compileBlockPlacementFrameSource({ take, rhythm, fps });
  const track = buildInteractionTrack({
    take: useReference ? take : undefined,
    takeId: useReference ? undefined : (input.takeId as 'consecutive' | 'single-clear' | 'cross-clear'),
    startFrame: startSourceFrame,
    frameCount,
    fps,
  });

  const interactionWritten = writeJson(join(bundleDir, 'interaction.json'), track);
  const sceneConfigBody = {
    schema: 'melo.hand-sync.scene-proxy/0.3',
    displayPlane: 'xy',
    penTiltPitchRadians: 0.35,
    // R7b: grip projects below-right of tip on ortho main camera (yaw/roll sweep in Blender)
    penTiltYawRadians: 1.0,
    penTiltRollRadians: -0.4,
    penHalfLengthM: 0.06,
    penTipConeDepthM: 0.008,
    gripAlongShaftFraction: 0.35,
    handRigProfile: 'procedural-right-gray-v2',
    viewExposure: -0.85,
    areaLightEnergy: 9,
    armEntryScreenOffsetM: [0.052, -0.078, 0.012],
    handedness: 'right',
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
          HAND_SYNC_TAKE_ID: useReference ? HAND_SYNC_REFERENCE_TAKE_ID : input.takeId,
          HAND_SYNC_DURATION_SEC: String(durationSeconds),
          HAND_SYNC_START_FRAME: String(startSourceFrame),
          HAND_SYNC_FRAME_COUNT: String(frameCount),
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
    alignManifestTouchPointers(screenManifest, track);
    writeFileSync(manifestPath, `${JSON.stringify(screenManifest, null, 2)}\n`);
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
    takeId: useReference ? HAND_SYNC_REFERENCE_TAKE_ID : input.takeId,
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
