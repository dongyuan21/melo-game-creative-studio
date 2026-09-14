import type { GameRenderContract } from '../../../game-runtime/renderContract';
import { GAME_RENDER_CONTRACT, GAME_RENDER_CONTRACT_VERSION } from '../../../game-runtime/renderContract';
import { TAPTILE_TRAY_MATCH3_GAME_ID, TAPTILE_TRAY_MATCH3_MODULE_VERSION } from '../manifest';
import { TAPTILE_PRESENTATION_SCHEMA_ID } from '../presentation';

export const TAPTILE_RENDER_CONTRACT_ID = 'melo.render.taptile-tray-match3';

export const tapTileRenderContract: GameRenderContract = {
  contract: GAME_RENDER_CONTRACT,
  contractVersion: GAME_RENDER_CONTRACT_VERSION,
  id: TAPTILE_RENDER_CONTRACT_ID,
  version: TAPTILE_TRAY_MATCH3_MODULE_VERSION,
  gameId: TAPTILE_TRAY_MATCH3_GAME_ID,
  eventCatalog: [
    { type: 'tap.accepted', category: 'interaction', tags: ['tap', 'tile'] },
    { type: 'tap.rejected', category: 'interaction', tags: ['tap', 'blocked'] },
    { type: 'tile.fly-to-tray', category: 'reconfigure', tags: ['flight', 'tray'] },
    { type: 'tray.reordered', category: 'reconfigure', tags: ['tray', 'insert'] },
    { type: 'match.resolved', category: 'resolve', tags: ['match', 'clear'] },
    { type: 'tiles.unlocked', category: 'reconfigure', tags: ['unlock', 'blocker'] },
    { type: 'tray.warning', category: 'detect', tags: ['tray', 'warning'] },
    { type: 'game.won', category: 'outcome', tags: ['won'] },
    { type: 'game.lost', category: 'outcome', tags: ['lost'] },
  ],
  backends: {
    'fixed-camera-cinematic': {
      supportedPresentationSchemas: [TAPTILE_PRESENTATION_SCHEMA_ID],
      requiredSlots: [
        { slotId: 'tile.material', acceptedKinds: ['material-pack'], required: true, role: 'tile-material' },
        { slotId: 'clear.primary', acceptedKinds: ['effect-pack'], required: true, role: 'match-primary' },
        { slotId: 'taptile.board', acceptedKinds: ['board-skin', 'background'], required: true },
      ],
      passes: [
        { id: 'taptile-background', order: 0, required: true },
        { id: 'taptile-board', order: 1, required: true },
        { id: 'taptile-tray', order: 2, required: true },
        { id: 'taptile-vfx', order: 3, required: true },
        { id: 'taptile-hud', order: 4, required: true },
      ],
    },
  },
};
