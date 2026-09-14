import type { GameRenderContract } from '../../../game-runtime/renderContract';
import { GAME_RENDER_CONTRACT, GAME_RENDER_CONTRACT_VERSION } from '../../../game-runtime/renderContract';
import { BLOCK_CRUSH_DROP_GAME_ID, BLOCK_CRUSH_DROP_MODULE_VERSION } from '../manifest';
import { CRUSH_WOOD_PRESENTATION_SCHEMA_ID } from '../presentation';

export const CRUSH_WOOD_RENDER_CONTRACT_ID = 'melo.render.block-crush-drop';

export const crushWoodRenderContract: GameRenderContract = {
  contract: GAME_RENDER_CONTRACT,
  contractVersion: GAME_RENDER_CONTRACT_VERSION,
  id: CRUSH_WOOD_RENDER_CONTRACT_ID,
  version: BLOCK_CRUSH_DROP_MODULE_VERSION,
  gameId: BLOCK_CRUSH_DROP_GAME_ID,
  eventCatalog: [
    { type: 'block-crush.drop', category: 'interaction', tags: ['drop', 'piece'] },
    { type: 'block-crush.impact', category: 'commit', tags: ['drop', 'impact'] },
    { type: 'block-crush.crush-resolved', category: 'resolve', tags: ['clear', 'fracture'] },
    { type: 'block-crush.collapse', category: 'reconfigure', tags: ['collapse', 'gravity'] },
    { type: 'block-crush.settle', category: 'settle', tags: ['settle'] },
    { type: 'block-crush.level-complete', category: 'outcome', tags: ['won'] },
    { type: 'block-crush.game-over', category: 'outcome', tags: ['game-over'] },
  ],
  backends: {
    'fixed-camera-cinematic': {
      supportedPresentationSchemas: [CRUSH_WOOD_PRESENTATION_SCHEMA_ID],
      requiredSlots: [
        { slotId: 'tile.material', acceptedKinds: ['material-pack'], required: true, role: 'tile-material' },
        { slotId: 'clear.primary', acceptedKinds: ['effect-pack'], required: true, role: 'clear-primary' },
        { slotId: 'crush.board', acceptedKinds: ['board-skin', 'background'], required: true },
      ],
      passes: [
        { id: 'crush-background', order: 0, required: true },
        { id: 'crush-well', order: 1, required: true },
        { id: 'crush-fragments', order: 2, required: true },
        { id: 'crush-hud', order: 3, required: true },
      ],
    },
  },
};
