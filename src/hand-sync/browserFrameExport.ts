import { DEFAULT_STYLE } from '../renderer/stylePresets';
import { captureStillV2 } from '../capture/v2/captureStill';
import { blockPlacementCompositionProfile } from '../games/block-placement/profiles/composition';
import { blockPlacementFrameFromPacket } from '../games/block-placement/presentation/legacyPresentationAdapter';
import { HAND_SYNC_REFERENCE_TAKE_ID, referenceBrTlTake } from './referenceLegalTake';
import { captureRhythm, resolveTakeAnchor, takeById } from '../games/block-placement/capture/suite';
import type { Take } from '../domain/types';
import {
  BLOCK_PLACEMENT_PRESENTATION_SCHEMA_ID,
  compileBlockPlacementFrameSource,
} from '../games/block-placement/presentation/legacyPresentationAdapter';
import { createBlockPlacementReferenceBackendAdapter } from '../games/block-placement/render/referenceBackendAdapter';
import { blockPlacementRenderContract } from '../games/block-placement/render/renderContract';
import { BLOCK_PLACEMENT_MODULE_VERSION } from '../games/block-placement/manifest';
import { createFrameRenderRequestV2 } from '../headless/frameRequestV2';
import { EMPTY_RUNTIME_ASSET_BINDINGS } from '../assets/runtimeAssetBindings';
import { touchVideoDeviceUvFromPresentationPointer } from './layout';
import type { ScreenManifest, ScreenFrameEntry } from './screenManifest';

async function sha256Blob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function resolveExportTake(takeId: string): Take {
  if (takeId === HAND_SYNC_REFERENCE_TAKE_ID) return referenceBrTlTake();
  return takeById(takeId as 'consecutive' | 'single-clear' | 'cross-clear');
}

export async function exportScreenFramesForTake(input: {
  takeId: string;
  startSourceFrame: number;
  frameCount: number;
  fps?: number;
  onProgress?: (localIndex: number, total: number) => void;
}): Promise<{ manifest: ScreenManifest; blobs: Array<{ localIndex: number; blob: Blob }> }> {
  const fps = input.fps ?? 30;
  const rhythm = captureRhythm();
  const take = resolveExportTake(input.takeId);
  const frameSource = compileBlockPlacementFrameSource({ take, rhythm, fps });
  const backend = createBlockPlacementReferenceBackendAdapter(DEFAULT_STYLE);
  const video = blockPlacementCompositionProfile.videoResolution;
  const canvas = document.createElement('canvas');
  const entries: ScreenFrameEntry[] = [];
  const blobs: Array<{ localIndex: number; blob: Blob }> = [];

  for (let local = 0; local < input.frameCount; local += 1) {
    const sourceFrameIndex = input.startSourceFrame + local;
    const packet = frameSource.evaluate(sourceFrameIndex);
    const presentationFrame = blockPlacementFrameFromPacket(packet);
    const request = createFrameRenderRequestV2({
      gameId: frameSource.gameId,
      moduleVersion: BLOCK_PLACEMENT_MODULE_VERSION,
      renderContract: blockPlacementRenderContract,
      presentationSchemaId: BLOCK_PLACEMENT_PRESENTATION_SCHEMA_ID,
      composition: blockPlacementCompositionProfile,
      planId: 'hand-sync.screen-manifest',
      planHash: frameSource.frameSourceHash,
      takeId: frameSource.takeId,
      frameIndex: sourceFrameIndex,
      fps: frameSource.fps,
      renderer: backend.renderer,
      coordinateSpace: 'video',
    });
    const captured = await captureStillV2(canvas, {
      request,
      frameSource,
      backend,
      composition: blockPlacementCompositionProfile,
      renderContract: blockPlacementRenderContract,
      resourcePolicy: {
        mode: 'procedural-no-assets',
        reason: 'hand-sync-screen-manifest-export',
        runtimeAssets: EMPTY_RUNTIME_ASSET_BINDINGS,
      },
    });
    const digest = await sha256Blob(captured.blob);
    const timestampSec = sourceFrameIndex / fps;
    let pointerVideoPx: { x: number; y: number } | null = null;
    if (presentationFrame.pointer) {
      const [vu, vv] = touchVideoDeviceUvFromPresentationPointer([
        presentationFrame.pointer.x,
        presentationFrame.pointer.y,
      ]);
      pointerVideoPx = {
        x: vu * video.width,
        y: vv * video.height,
      };
    }
    entries.push({
      localFrameIndex: local,
      sourceFrameIndex,
      timestampSec,
      path: `screen/frame_${String(local).padStart(4, '0')}.png`,
      sha256: digest,
      width: captured.width,
      height: captured.height,
      pointerVideoPx,
    });
    blobs.push({ localIndex: local, blob: captured.blob });
    input.onProgress?.(local, input.frameCount);
  }

  const manifest: ScreenManifest = {
    schema: 'melo.hand-sync.screen-manifest/0.2',
    backendId: 'block-placement.reference-2d',
    note: 'Same compileBlockPlacementFrameSource as interaction; letterboxed to videoResolution.',
    fps: { num: fps, den: 1 },
    frameCount: entries.length,
    frameSourceHash: frameSource.frameSourceHash,
    frames: entries,
  };
  return { manifest, blobs };
}

export function defaultExportWindowFromTake(takeId: string, durationSec = 5) {
  const take = resolveExportTake(takeId);
  const rhythm = captureRhythm();
  const anchor = resolveTakeAnchor(take, rhythm, 30);
  const fps = 30;
  const approachFrames = takeId === HAND_SYNC_REFERENCE_TAKE_ID ? 18 : 0;
  const startSourceFrame = Math.max(0, anchor.frames.pickup - approachFrames);
  const frameCount = Math.min(
    Math.round(durationSec * fps),
    anchor.compiledTotalFrames - startSourceFrame,
  );
  return { startSourceFrame, frameCount, fps };
}
