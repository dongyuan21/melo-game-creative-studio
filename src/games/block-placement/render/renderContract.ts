import { REFERENCE_PASS_ORDER } from '../../../headless/contracts';
import type { GameRenderContract } from '../../../game-runtime/renderContract';
import { GAME_RENDER_CONTRACT, GAME_RENDER_CONTRACT_VERSION } from '../../../game-runtime/renderContract';
import { REQUIRED_LOOK_SLOTS } from '../../../headless/variantCompiler';
import { BLOCK_PLACEMENT_GAME_ID } from '../manifest';
import { BLOCK_PLACEMENT_PRESENTATION_SCHEMA_ID } from '../presentation/legacyPresentationAdapter';

export const BLOCK_PLACEMENT_RENDER_CONTRACT_ID = 'melo.render.block-placement';
export const BLOCK_PLACEMENT_RENDER_CONTRACT_VERSION = '1.0.0';

const SLOT_KINDS: Record<string, string[]> = {
  'background.base': ['background'],
  'board.skin': ['board-skin'],
  'tile.material': ['material-pack'],
  'interaction.preview': ['animation-asset', 'effect-pack'],
  'placement.confirmation': ['animation-asset', 'effect-pack'],
  'clear.primary': ['effect-pack'],
  'clear.tile-exit': ['animation-asset', 'effect-pack'],
  'hud.current-score': ['ui-theme'],
  'endgame.presentation': ['ui-theme', 'animation-asset', 'effect-pack'],
};

export const blockPlacementRenderContract: GameRenderContract = {
  contract: GAME_RENDER_CONTRACT,
  contractVersion: GAME_RENDER_CONTRACT_VERSION,
  id: BLOCK_PLACEMENT_RENDER_CONTRACT_ID,
  version: BLOCK_PLACEMENT_RENDER_CONTRACT_VERSION,
  gameId: BLOCK_PLACEMENT_GAME_ID,
  eventCatalog: [
    { type: 'block-placement.drag', category: 'interaction', tags: ['pointer'], legacyAliases: ['placement'] },
    { type: 'block-placement.placement-committed', category: 'commit', tags: ['placement'], legacyAliases: ['placement'] },
    { type: 'block-placement.line-cleared', category: 'resolve', tags: ['clear'], legacyAliases: ['line-clear'] },
    { type: 'block-placement.cross-cleared', category: 'resolve', tags: ['clear', 'cross'], legacyAliases: ['cross-clear'] },
    { type: 'block-placement.combo', category: 'resolve', tags: ['combo'], legacyAliases: ['combo'] },
    { type: 'block-placement.all-cleared', category: 'resolve', tags: ['all-clear'], legacyAliases: ['all-clear'] },
    { type: 'block-placement.game-over', category: 'outcome', tags: ['terminal'], legacyAliases: ['game-over'] },
  ],
  backends: {
    'reference-2d': {
      supportedPresentationSchemas: [BLOCK_PLACEMENT_PRESENTATION_SCHEMA_ID],
      requiredSlots: REQUIRED_LOOK_SLOTS.map((slotId) => ({
        slotId,
        acceptedKinds: SLOT_KINDS[slotId] ?? ['bitmap'],
        required: true,
        ...(slotId === 'tile.material' ? { role: 'tile-material' } : {}),
        ...(slotId === 'clear.primary' ? { role: 'clear-primary' } : {}),
      })),
      passes: REFERENCE_PASS_ORDER.map((id, order) => ({ id, order, required: true })),
    },
    'fixed-camera-cinematic': {
      supportedPresentationSchemas: [BLOCK_PLACEMENT_PRESENTATION_SCHEMA_ID],
      requiredSlots: REQUIRED_LOOK_SLOTS.map((slotId) => ({
        slotId,
        acceptedKinds: SLOT_KINDS[slotId] ?? ['bitmap'],
        required: true,
        ...(slotId === 'tile.material' ? { role: 'tile-material' } : {}),
        ...(slotId === 'clear.primary' ? { role: 'clear-primary' } : {}),
      })),
      passes: [],
    },
    'three-3d': {
      supportedPresentationSchemas: [BLOCK_PLACEMENT_PRESENTATION_SCHEMA_ID],
      requiredSlots: REQUIRED_LOOK_SLOTS.map((slotId) => ({
        slotId,
        acceptedKinds: SLOT_KINDS[slotId] ?? ['bitmap'],
        required: true,
        ...(slotId === 'tile.material' ? { role: 'tile-material' } : {}),
        ...(slotId === 'clear.primary' ? { role: 'clear-primary' } : {}),
      })),
      passes: [],
    },
  },
};
