import type { EffectPackManifest } from './contracts.js';
import { MELO_CONTRACT_VERSION } from './contracts.js';

/** Test/capture EffectPack that honestly declares compatibility with every material class. */
export const UNIVERSAL_CLEAR_EFFECT_ID = 'effect.universal-clear';

export function createUniversalClearEffect(): EffectPackManifest {
  return {
    contract: 'melo.asset-manifest',
    contractVersion: MELO_CONTRACT_VERSION,
    id: UNIVERSAL_CLEAR_EFFECT_ID,
    version: '1.0.0',
    kind: 'effect-pack',
    origin: 'generated',
    label: 'Universal clear (test fixture)',
    contentHash: 'sha256:47994ecbcd554a44a51c082916905fb2b0b0ca245023ed274383cd274845d74a',
    runtime: {
      renderers: ['fixed-camera-cinematic'],
      deterministic: true,
      budget: {
        textureMemoryMiB: 18,
        triangleCount: 12000,
      },
    },
    metadata: {
      studio: {
        stylePatch: { fx: 'crystal-shatter' },
        rendererAdapter: 'fixed-camera-cinematic',
      },
    },
    supportedEvents: ['line-clear', 'cross-clear', 'combo', 'all-clear'],
    compatibleMaterialClasses: ['*'],
    layers: [
      { id: 'sweep', role: 'energy', implementation: 'shader', required: true },
      { id: 'response', role: 'material-response', implementation: 'shader', required: true },
      { id: 'fragments', role: 'large-fragments', implementation: 'geometry', required: true },
      { id: 'sparks', role: 'particles', implementation: 'sprite', required: false },
    ],
  };
}
