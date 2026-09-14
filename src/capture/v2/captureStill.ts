import type { CompiledFrameSource } from '../../game-runtime/frameSource';
import type { GameRenderContract } from '../../game-runtime/renderContract';
import {
  assertPacketMatchesFrameSource,
} from '../../rendering/renderJob';
import {
  assertBackendSupportsPacket,
  type RenderBackendAdapter,
} from '../../rendering/backendRegistry';
import { containMapping, type CompositionProfile } from '../../rendering/composition';
import {
  assertRenderResourcePolicy,
  type RenderResourcePolicy,
} from '../../rendering/resourcePolicy';
import {
  validateFrameRenderRequestV2,
  type FrameRenderRequestV2,
} from '../../headless/frameRequestV2';
import { MeloHeadlessError } from '../../headless/errors';

export interface GameCaptureStillInput {
  request: FrameRenderRequestV2;
  frameSource: CompiledFrameSource;
  backend: RenderBackendAdapter;
  composition: CompositionProfile;
  renderContract: GameRenderContract;
  resourcePolicy: RenderResourcePolicy;
  plan?: Parameters<typeof assertRenderResourcePolicy>[1]['plan'];
}

export interface GameCaptureStillResult {
  blob: Blob;
  width: number;
  height: number;
  request: FrameRenderRequestV2;
}

function fail(code: string, message: string, path: string): never {
  throw new MeloHeadlessError(code, message, { path });
}

export async function captureStillV2(
  canvas: HTMLCanvasElement,
  input: GameCaptureStillInput,
): Promise<GameCaptureStillResult> {
  const issues = validateFrameRenderRequestV2(input.request, {
    renderContract: input.renderContract,
    composition: input.composition,
    renderer: input.backend.renderer,
  });
  if (issues.length > 0) {
    fail(issues[0]!.code, issues[0]!.message, issues[0]!.path ?? '$.request');
  }
  if (input.request.gameId !== input.frameSource.gameId) {
    fail('CAPTURE_GAME_MISMATCH', 'Capture request gameId does not match the frame source.', '$.request.gameId');
  }
  if (input.request.takeId !== input.frameSource.takeId) {
    fail('CAPTURE_TAKE_MISMATCH', 'Capture request takeId does not match the frame source.', '$.request.takeId');
  }
  if (input.request.fps !== input.frameSource.fps) {
    fail('CAPTURE_FPS_MISMATCH', 'Capture request fps does not match the frame source.', '$.request.fps');
  }

  const resources = assertRenderResourcePolicy(input.resourcePolicy, {
    ...(input.plan ? { plan: input.plan } : {}),
    renderContract: input.renderContract,
    backend: input.backend,
  });

  const packet = input.frameSource.evaluate(input.request.frameIndex);
  assertPacketMatchesFrameSource(packet, input.frameSource, input.request.frameIndex);
  assertBackendSupportsPacket(input.backend, packet);
  if (packet.payloadSchemaId !== input.request.presentationSchemaId) {
    fail(
      'CAPTURE_SCHEMA_MISMATCH',
      `Packet schema ${packet.payloadSchemaId} does not match request ${input.request.presentationSchemaId}.`,
      '$.presentationSchemaId',
    );
  }

  const width = input.request.targetPixels.width;
  const height = input.request.targetPixels.height;
  const stage = input.backend.createStage(canvas, resources);
  try {
    if (input.backend.letterboxFromDesign && input.backend.designResolution) {
      stage.resize(input.backend.designResolution.width, input.backend.designResolution.height, 1);
    } else {
      stage.resize(width, height, 1);
    }
    await stage.warmup(packet);
    stage.renderAt(packet);
    const still = stage.captureStill?.() ?? canvas;
    if (!still.width || !still.height) {
      fail('CAPTURE_EMPTY_CANVAS', 'Capture produced an empty canvas.', '$.targetPixels');
    }
    const blob = await new Promise<Blob | null>((resolve) => still.toBlob(resolve, 'image/png'));
    if (!blob || blob.size <= 0) {
      fail('CAPTURE_EMPTY_PNG', 'Capture did not produce a PNG artifact.', '$.artifact');
    }
    if (input.backend.letterboxFromDesign && input.backend.designResolution && (still.width !== width || still.height !== height)) {
      const mapped = document.createElement('canvas');
      mapped.width = width;
      mapped.height = height;
      const context = mapped.getContext('2d');
      if (!context) fail('CAPTURE_CONTEXT', 'Unable to create output canvas.', '$.targetPixels');
      const mapping = containMapping(input.backend.designResolution, { width, height });
      context.fillStyle = '#05070d';
      context.fillRect(0, 0, width, height);
      context.drawImage(still, mapping.offsetX, mapping.offsetY, mapping.drawWidth, mapping.drawHeight);
      const letterboxed = await new Promise<Blob | null>((resolve) => mapped.toBlob(resolve, 'image/png'));
      if (!letterboxed || letterboxed.size <= 0) {
        fail('CAPTURE_EMPTY_PNG', 'Letterboxed capture did not produce a PNG artifact.', '$.artifact');
      }
      return { blob: letterboxed, width, height, request: input.request };
    }
    return { blob, width: still.width, height: still.height, request: input.request };
  } finally {
    stage.dispose();
  }
}
