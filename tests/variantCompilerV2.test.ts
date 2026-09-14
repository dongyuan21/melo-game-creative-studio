import { describe, expect, it } from 'vitest';
import { AssetRegistry } from '../src/headless/assetRegistry';
import type { AssetManifest, CreativeMaster, LookPackManifest } from '../src/headless/contracts';
import { compileVariant } from '../src/headless/variantCompiler';
import { compileVariantV2 } from '../src/headless/variantCompilerV2';
import { runQualityGate } from '../src/headless/qualityGate';
import { runQualityGateV2 } from '../src/headless/qualityGateV2';
import type { CreativeMasterV2 } from '../src/headless/creativeMasterV2';
import { MeloHeadlessError } from '../src/headless/errors';
import type { GameRenderContract } from '../src/game-runtime/renderContract';
import { GAME_RENDER_CONTRACT, GAME_RENDER_CONTRACT_VERSION } from '../src/game-runtime/renderContract';
import {
  BLOCK_PLACEMENT_RENDER_CONTRACT_ID,
  BLOCK_PLACEMENT_RENDER_CONTRACT_VERSION,
  blockPlacementRenderContract,
} from '../src/games/block-placement/render/renderContract';
import { collectMultiGameRefactorBaselineIdentities } from './multiGameRefactorBaseline';
import { makeFixture, ref } from './headlessFixtures';

function masterV2(master: CreativeMaster): CreativeMasterV2 {
  return {
    contract: 'melo.creative-master-v2',
    contractVersion: '2.0.0',
    id: master.id,
    game: {
      id: 'block-placement',
      moduleVersion: '1.0.0',
      rulesetId: 'block-placement-classic-v1',
      rulesetVersion: '1.0.0',
    },
    renderContractId: BLOCK_PLACEMENT_RENDER_CONTRACT_ID,
    renderContractVersion: BLOCK_PLACEMENT_RENDER_CONTRACT_VERSION,
    replay: { ...master.replay },
    layoutProfileRef: { ...master.layoutProfileRef },
    cameraProfileRef: { ...master.cameraProfileRef },
    baseOutput: { ...master.baseOutput },
  };
}

describe('variant compiler V2', () => {
  it('compiles the same Block look closure as V1 without changing V1 plan hashes', () => {
    const fixture = makeFixture();
    const registry = new AssetRegistry(fixture.assets);
    const v1 = compileVariant(fixture.master, fixture.recipe, registry, {
      renderer: 'fixed-camera-cinematic',
      requireHashes: true,
    });
    const v2 = compileVariantV2(masterV2(fixture.master), fixture.recipe, registry, blockPlacementRenderContract, {
      renderer: 'fixed-camera-cinematic',
      requireHashes: true,
    });
    expect(Object.keys(v1.assets ?? {}).sort()).toEqual(Object.keys(v2.assets ?? {}).sort());
    expect(Object.keys(v1.slots).sort()).toEqual(Object.keys(v2.slots).sort());
    expect(v2.planSchemaVersion).toBe('2.0.0');
    expect(v2.planHash).not.toBe(v1.planHash);
    expect(runQualityGate(v1, { requireHashes: true }).passed).toBe(true);
    expect(runQualityGateV2(v2, blockPlacementRenderContract, { requireHashes: true }).passed).toBe(true);

    const frozen = collectMultiGameRefactorBaselineIdentities();
    expect(frozen.materials.steel.planHash).toBe('fnv1a32:f83568be');
    expect(frozen.materials.wood.planHash).toBe('fnv1a32:c6d2f91f');
    expect(frozen.materials.aurora.planHash).toBe('fnv1a32:0502ff1b');
  });

  it('compiles a fake game contract with different required slots without compiler changes', () => {
    const fixture = makeFixture();
    const crushContract: GameRenderContract = {
      contract: GAME_RENDER_CONTRACT,
      contractVersion: GAME_RENDER_CONTRACT_VERSION,
      id: 'melo.render.block-crush-drop',
      version: '1.0.0',
      gameId: 'block-crush-drop',
      eventCatalog: [{ type: 'block-crush.drop', category: 'commit', tags: ['drop'] }],
      backends: {
        'fixed-camera-cinematic': {
          supportedPresentationSchemas: ['melo.block-crush.presentation-frame.v1'],
          requiredSlots: [
            { slotId: 'crush.board', acceptedKinds: ['board-skin', 'background'], required: true },
            { slotId: 'crush.drop-piece', acceptedKinds: ['material-pack'], required: true },
          ],
          passes: [],
        },
      },
    };
    const look: LookPackManifest = {
      ...fixture.assets.find((item) => item.id === 'look.copper') as LookPackManifest,
      id: 'look.crush',
      slots: {
        'crush.board': ref('background.dark', 'background', 'f'),
        'crush.drop-piece': ref('material.copper', 'material-pack', 'b'),
      },
    };
    const assets: AssetManifest[] = fixture.assets.filter((item) => item.id !== 'look.copper').concat(look);
    const master = masterV2(fixture.master);
    master.id = 'master.crush';
    master.game = { id: 'block-crush-drop', moduleVersion: '0.0.1', rulesetId: 'crush-diag', rulesetVersion: '0.0.1' };
    master.renderContractId = crushContract.id;
    master.renderContractVersion = crushContract.version;
    const recipe = {
      ...fixture.recipe,
      id: 'variant.crush',
      masterId: 'master.crush',
      lookPackRef: ref('look.crush', 'look-pack', '8'),
    };
    const plan = compileVariantV2(master, recipe, new AssetRegistry(assets), crushContract, {
      renderer: 'fixed-camera-cinematic',
      requireHashes: true,
    });
    expect(plan.slots['crush.board']).toBeDefined();
    expect(plan.slots['tile.material']).toBeUndefined();
    expect(runQualityGateV2(plan, crushContract, { requireHashes: true }).passed).toBe(true);
  });

  it('rejects unknown slots with an explicit path', () => {
    const fixture = makeFixture();
    const recipe = {
      ...fixture.recipe,
      slotOverrides: { 'mahjong.tile.body': ref('material.copper', 'material-pack', 'b') },
    };
    expect(() => compileVariantV2(
      masterV2(fixture.master),
      recipe,
      new AssetRegistry(fixture.assets),
      blockPlacementRenderContract,
      { renderer: 'fixed-camera-cinematic' },
    )).toThrowError(expect.objectContaining({ code: 'UNKNOWN_SLOT' }));
    try {
      compileVariantV2(
        masterV2(fixture.master),
        recipe,
        new AssetRegistry(fixture.assets),
        blockPlacementRenderContract,
        { renderer: 'fixed-camera-cinematic' },
      );
    } catch (error) {
      expect((error as MeloHeadlessError).path).toBe('$.slots.mahjong.tile.body');
    }
  });
});
