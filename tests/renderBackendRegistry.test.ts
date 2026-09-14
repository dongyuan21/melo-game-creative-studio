import { describe, expect, it } from 'vitest';
import type { PresentationPacket } from '../src/game-runtime/presentationPacket';
import {
  PRESENTATION_PACKET_CONTRACT,
  PRESENTATION_PACKET_CONTRACT_VERSION,
} from '../src/game-runtime/presentationPacket';
import {
  RenderBackendError,
  assertBackendSupportsPacket,
  getRenderBackend,
  registerRenderBackend,
  type RenderBackendAdapter,
} from '../src/rendering/backendRegistry';
import { readyRenderResources } from '../src/rendering/preparedRenderResources';

function packet(schema: string): PresentationPacket {
  return {
    contract: PRESENTATION_PACKET_CONTRACT,
    contractVersion: PRESENTATION_PACKET_CONTRACT_VERSION,
    identity: {
      gameId: 'dummy',
      moduleVersion: '0.0.1',
      takeId: 'take',
      frameIndex: 0,
      fps: 30,
      totalFrames: 1,
      stateHash: 'fnv1a32:0',
      presentationHash: 'fnv1a32:1',
    },
    semanticEvents: [],
    feedback: { cameraPunch: 0 },
    payloadSchemaId: schema,
    payload: { color: '#112233' },
  };
}

describe('render backend registry', () => {
  it('registers a dummy backend that records pixels without Block types', () => {
    const pixels: string[] = [];
    const adapter: RenderBackendAdapter = {
      id: `dummy.solid.${Math.random().toString(16).slice(2)}`,
      renderer: 'dummy-canvas',
      supportedPresentationSchemas: ['melo.dummy.presentation-frame.v1'],
      letterboxFromDesign: false,
      createStage() {
        return {
          resize() {},
          async warmup(next) {
            this.renderAt(next);
          },
          renderAt(next) {
            assertBackendSupportsPacket(adapter, next);
            pixels.push(String((next.payload as { color?: string }).color ?? ''));
          },
          dispose() {},
        };
      },
    };
    registerRenderBackend(adapter);
    expect(getRenderBackend(adapter.id)?.renderer).toBe('dummy-canvas');
    const stage = adapter.createStage({} as HTMLCanvasElement, readyRenderResources('test'));
    stage.renderAt(packet('melo.dummy.presentation-frame.v1'));
    expect(pixels).toEqual(['#112233']);
    stage.dispose();
  });

  it('fails before render when the presentation schema is unsupported', () => {
    const adapter: RenderBackendAdapter = {
      id: 'dummy.schema-check',
      renderer: 'dummy-canvas',
      supportedPresentationSchemas: ['melo.dummy.presentation-frame.v1'],
      letterboxFromDesign: false,
      createStage() {
        return {
          resize() {},
          async warmup() {},
          renderAt(next) {
            assertBackendSupportsPacket(adapter, next);
          },
          dispose() {},
        };
      },
    };
    const stage = adapter.createStage({} as HTMLCanvasElement, readyRenderResources('test'));
    try {
      stage.renderAt(packet('melo.block-placement.presentation-frame.v1'));
      throw new Error('expected schema rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(RenderBackendError);
      expect((error as RenderBackendError).code).toBe('BACKEND_SCHEMA_UNSUPPORTED');
      expect((error as RenderBackendError).path).toBe('$.payloadSchemaId');
    }
  });
});
