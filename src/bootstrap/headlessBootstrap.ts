import { blockCrushDropDefinition } from '../games/block-crush-drop/definition';
import { blockCrushDropPackage } from '../games/block-crush-drop/package';
import { blockPlacementPackage } from '../games/block-placement/package';
import { blockPlacementDefinition } from '../games/block-placement/definition';
import { tapTileTrayMatch3Package } from '../games/taptile-tray-match3/package';
import { tapTileTrayMatch3Definition } from '../games/taptile-tray-match3/definition';
import { GameRegistry } from '../game-runtime/gameRegistry';
import { createHeadlessPlatform, type HeadlessPlatform } from './gamePackage';

declare global {
  // Vite HMR re-evaluates this module and would otherwise re-register global
  // backends/compositions against a still-alive registry.
  var __meloDefaultHeadlessPlatform: HeadlessPlatform | undefined;
}

export function ensureDefaultHeadlessPlatform(): HeadlessPlatform {
  if (!globalThis.__meloDefaultHeadlessPlatform) {
    globalThis.__meloDefaultHeadlessPlatform = createHeadlessPlatform([
      blockPlacementPackage,
      tapTileTrayMatch3Package,
      blockCrushDropPackage,
    ]);
  }
  return globalThis.__meloDefaultHeadlessPlatform;
}

export function createDefaultGameRegistry(): GameRegistry {
  const registry = new GameRegistry();
  registry.register(blockPlacementDefinition);
  registry.register(tapTileTrayMatch3Definition);
  registry.register(blockCrushDropDefinition);
  return registry;
}

export function createHeadlessRuntimeRegistry(): GameRegistry {
  return createDefaultGameRegistry();
}
