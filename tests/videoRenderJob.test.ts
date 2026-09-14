import { describe, expect, it } from 'vitest';
import type { CompiledFrameSource } from '../src/game-runtime/frameSource';
import {
  PRESENTATION_PACKET_CONTRACT,
  PRESENTATION_PACKET_CONTRACT_VERSION,
  type PresentationPacket,
} from '../src/game-runtime/presentationPacket';
import { readyRenderResources } from '../src/rendering/preparedRenderResources';
import {
  RenderBackendError,
  assertBackendSupportsPacket,
  type RenderBackendAdapter,
} from '../src/rendering/backendRegistry';
import {
  assertPacketMatchesFrameSource,
  assertVideoRenderJobContract,
} from '../src/rendering/renderJob';

function packet(schema: string, frameIndex = 0): PresentationPacket {
  return {
    contract: PRESENTATION_PACKET_CONTRACT,
    contractVersion: PRESENTATION_PACKET_CONTRACT_VERSION,
    identity: {
      gameId: 'dummy',
      moduleVersion: '0.0.1',
      takeId: 'dummy-take',
      frameIndex,
      fps: 30,
      totalFrames: 2,
      stateHash: `fnv1a32:${frameIndex}`,
      presentationHash: `fnv1a32:p${frameIndex}`,
    },
    semanticEvents: [],
    feedback: { cameraPunch: 0 },
    payloadSchemaId: schema,
    payload: { index: frameIndex },
  };
}

describe('video render job inputs', () => {
  it('lets a dummy backend consume a frame source without Block types', () => {
    const frames: number[] = [];
    const backend: RenderBackendAdapter = {
      id: 'dummy.job',
      renderer: 'dummy',
      supportedPresentationSchemas: ['melo.dummy.presentation-frame.v1'],
      letterboxFromDesign: false,
      createStage() {
        return {
          resize() {},
          async warmup(next) {
            this.renderAt(next);
          },
          renderAt(next) {
            assertBackendSupportsPacket(backend, next);
            frames.push(next.identity.frameIndex);
          },
          dispose() {},
        };
      },
    };
    const frameSource: CompiledFrameSource = {
      gameId: 'dummy',
      takeId: 'dummy-take',
      fps: 30,
      totalFrames: 2,
      frameSourceHash: 'fnv1a32:source',
      evaluate: (index) => packet('melo.dummy.presentation-frame.v1', index),
    };
    const stage = backend.createStage({} as HTMLCanvasElement, readyRenderResources('job'));
    for (let index = 0; index < frameSource.totalFrames; index += 1) {
      const next = frameSource.evaluate(index);
      assertBackendSupportsPacket(backend, next);
      stage.renderAt(next);
    }
    expect(frames).toEqual([0, 1]);
    stage.dispose();
  });

  it('rejects an unsupported schema before any dummy pixels are produced', () => {
    const backend: RenderBackendAdapter = {
      id: 'dummy.reject',
      renderer: 'dummy',
      supportedPresentationSchemas: ['melo.dummy.presentation-frame.v1'],
      letterboxFromDesign: false,
      createStage() {
        return {
          resize() {},
          async warmup() {},
          renderAt() {
            throw new Error('should not render');
          },
          dispose() {},
        };
      },
    };
    expect(() => assertBackendSupportsPacket(backend, packet('melo.other.presentation-frame.v1'))).toThrow(
      RenderBackendError,
    );
  });

  it('locks packet identity, fps, and prepared resources before encoding', () => {
    const frameSource: CompiledFrameSource = {
      gameId: 'dummy',
      takeId: 'dummy-take',
      fps: 30,
      totalFrames: 2,
      frameSourceHash: 'fnv1a32:source',
      evaluate: (index) => packet('melo.dummy.presentation-frame.v1', index),
    };
    const backend: RenderBackendAdapter = {
      id: 'dummy.lock',
      renderer: 'dummy',
      supportedPresentationSchemas: ['melo.dummy.presentation-frame.v1'],
      letterboxFromDesign: false,
      createStage() {
        return { resize() {}, async warmup() {}, renderAt() {}, dispose() {} };
      },
    };
    assertPacketMatchesFrameSource(frameSource.evaluate(1), frameSource, 1);
    expect(() => assertPacketMatchesFrameSource(frameSource.evaluate(1), frameSource, 0)).toThrow(
      /PACKET_FRAME_MISMATCH|frameIndex/,
    );
    const job = {
      frameSource,
      backend,
      output: { width: 1080, height: 1920, fps: 30, quality: 'preview' as const },
      projectName: 'dummy',
      takeName: 'take',
      resourcePolicy: {
        mode: 'procedural-no-assets' as const,
        reason: 'dummy identity lock does not bind a resolved render plan',
      },
    };
    expect(() => assertVideoRenderJobContract(job)).not.toThrow();
    expect(() => assertVideoRenderJobContract({ ...job, output: { ...job.output, fps: 24 } })).toThrow(
      /OUTPUT_FPS_MISMATCH|fps/,
    );
  });
});
