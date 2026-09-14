import type { StyleSpec } from '../../../domain/types';
import type { MaterialPackManifest, MaterialRuntimeDescriptor } from '../../../headless/contracts';
import { compileMaterialRuntime } from '../../../headless/materialRuntime';
import { DEFAULT_STYLE } from '../../../renderer/stylePresets';
import {
  BLOCK_PLACEMENT_LOOK_CANDY_RESIN,
  BLOCK_PLACEMENT_LOOK_COPPER,
} from '../project';

/**
 * Parameter-only copper appearance for document render. This is not a plan-bound
 * PBR texture set; maps still go through variant compile.
 */
const COPPER_LOOK_MATERIAL_PACK: MaterialPackManifest = {
  contract: 'melo.asset-manifest',
  contractVersion: '1.0.0',
  id: 'material.copper-look',
  version: '1.0.0',
  kind: 'material-pack',
  origin: 'builtin',
  runtime: {
    renderers: ['fixed-camera-cinematic'],
    deterministic: true,
  },
  appearance: {
    baseColor: '#b76e45',
    roughness: 0.31,
    metalness: 0.88,
    clearcoat: 0.12,
    normalStrength: 0.24,
  },
  behavior: {
    materialClass: 'metal',
    density: 0.82,
    brittleness: 0.34,
    ductility: 0.58,
    elasticity: 0.08,
    hardness: 0.73,
    fractureMode: 'chips',
    largeFragmentRatio: 0.65,
    dustAmount: 0.05,
    sparkAmount: 0.36,
    dropletAmount: 0,
    gravityScale: 1.1,
    drag: 0.12,
  },
};

let copperRuntime: MaterialRuntimeDescriptor | undefined;

function copperMaterialRuntime(): MaterialRuntimeDescriptor {
  copperRuntime ??= compileMaterialRuntime({
    pack: COPPER_LOOK_MATERIAL_PACK,
    combine: 'multiply-factor',
  });
  return copperRuntime;
}

export function lookPackIdFromRuntimeAssets(value: unknown): string | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  if (!('lookPackId' in value)) return undefined;
  const id = (value as { lookPackId: unknown }).lookPackId;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

export function resolveBlockPlacementCinematicStyle(lookPackId?: string): StyleSpec {
  const cinematic: StyleSpec = {
    ...DEFAULT_STYLE,
    renderer: 'fixed-camera-cinematic',
  };
  if (lookPackId === BLOCK_PLACEMENT_LOOK_COPPER) {
    return {
      ...cinematic,
      lighting: 'clean-studio',
      background: '#1c120e',
      material: 'glossy-plastic',
      materialRuntime: copperMaterialRuntime(),
    };
  }
  if (lookPackId === BLOCK_PLACEMENT_LOOK_CANDY_RESIN || lookPackId === undefined) {
    return cinematic;
  }
  return cinematic;
}
