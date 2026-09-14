import { describe, expect, it } from 'vitest';
import {
  collectRuntimeAssetReferenceIssues,
  collectRuntimeAssetRequests,
  createRuntimeAssetBindings,
  firstImageBinding,
  imageBindingDefaults,
  listRuntimeAssetSlotIds,
  readBrowserAssetMetadata,
  runtimeBindingRevision,
  type RuntimeImageAssetBinding,
} from '../src/assets/runtimeAssetBindings';
import {
  createBrowserAssetManifest,
  createBrowserAssetVariant,
} from '../src/assets/browserAssetAuthoring';
import type { BrowserAssetMetadata } from '../src/assets/browserAssetStore';
import type { AssetManifest, LookPackManifest } from '../src/headless/contracts';
import { AssetRegistry } from '../src/headless/assetRegistry';
import { compileVariant } from '../src/headless/variantCompiler';
import { makeFixture, ref } from './headlessFixtures';

function createPlan() {
  const fixture = makeFixture();
  const basePlan = compileVariant(
    fixture.master,
    fixture.recipe,
    new AssetRegistry(fixture.assets),
    { renderer: 'fixed-camera-cinematic', requireHashes: true },
  );
  const metadata: BrowserAssetMetadata = {
    contentHash: `sha256:${'8'.repeat(64)}`,
    uri: `melo-asset://sha256/${'8'.repeat(64)}`,
    fileName: 'background.png',
    mimeType: 'image/png',
    byteLength: 4096,
    createdAt: '2026-09-03T00:00:00.000Z',
    mediaClass: 'image',
    width: 720,
    height: 1280,
  };
  const asset = createBrowserAssetManifest(metadata, {
    role: 'background-image',
    fit: 'contain',
    opacity: 0.75,
    blendMode: 'screen',
  });
  const authored = createBrowserAssetVariant({
    plan: basePlan,
    masterId: fixture.master.id,
    lockMode: 'frame-exact',
    seed: 1,
    asset,
    role: 'background-image',
  });
  const plan = compileVariant(
    fixture.master,
    authored.recipe,
    new AssetRegistry([...fixture.assets, asset, authored.look]),
    { renderer: 'fixed-camera-cinematic', requireHashes: true },
  );
  return { plan, asset };
}

describe('runtime asset bindings', () => {
  it('extracts browser binary requests from a resolved render plan', () => {
    const { plan, asset } = createPlan();
    const metadata = readBrowserAssetMetadata(asset);
    const requests = collectRuntimeAssetRequests(plan);

    expect(metadata?.role).toBe('background-image');
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      slotId: 'background.base',
      role: 'background-image',
      contentHash: asset.contentHash,
    });
    expect(runtimeBindingRevision(plan)).toContain(plan.planHash);
  });

  it('creates deterministic image defaults from manifest metadata', () => {
    const { plan } = createPlan();
    const request = collectRuntimeAssetRequests(plan)[0]!;
    const binding = imageBindingDefaults(request, 'blob:runtime-background');

    expect(binding).toMatchObject({
      objectUrl: 'blob:runtime-background',
      fit: 'contain',
      opacity: 0.75,
      blendMode: 'screen',
      inset: 0,
    });
  });

  it('indexes bindings by slot and keeps compatibility getters', () => {
    const late = textureBinding({
      slotId: 'tile.material',
      contentHash: hashChar('c'),
      objectUrl: 'blob:late',
    });
    const early = textureBinding({
      slotId: 'tile.material',
      contentHash: hashChar('a'),
      objectUrl: 'blob:early',
    });
    const background = textureBinding({
      slotId: 'background.base',
      role: 'background-image',
      contentHash: hashChar('b'),
      objectUrl: 'blob:background',
    });
    const bindings = createRuntimeAssetBindings({
      revision: 'slot-map',
      bySlot: {
        'tile.material': [late, early],
      },
      background,
    });

    expect(Object.keys(bindings.bySlot).sort()).toEqual(['background.base', 'tile.material']);
    expect(bindings.bySlot['tile.material']?.map((item) => item.contentHash)).toEqual([
      hashChar('a'),
      hashChar('c'),
    ]);
    expect(firstImageBinding(bindings, 'tile.material')?.objectUrl).toBe('blob:early');
    expect(bindings.background?.objectUrl).toBe('blob:background');
    expect(bindings.tileFace).toBeNull();
    expect(bindings.textureMaps.map((item) => item.slotId)).toEqual(['tile.material', 'tile.material']);
  });

  it('returns no slot ids for a null plan and keeps missing records tagged with slotId', () => {
    expect(listRuntimeAssetSlotIds(null)).toEqual([]);
    const bindings = createRuntimeAssetBindings({
      revision: 'missing',
      missing: [
        { slotId: 'mahjong.tile.body', uri: 'melo-asset://sha256/missing', reason: 'blob-missing' },
        { slotId: 'tile.face', uri: 'melo-asset://sha256/bad', reason: 'hash-mismatch' },
      ],
    });
    expect(bindings.missing.map((item) => item.slotId)).toEqual(['mahjong.tile.body', 'tile.face']);
    expect(bindings.missing.every((item) => item.slotId.length > 0)).toBe(true);
  });

  it('collects Mahjong reserved slots from a V1 look pack without a second dependency walk', () => {
    const fixture = makeFixture();
    const look = fixture.assets.find((item) => item.id === 'look.copper') as LookPackManifest;
    const extraAssets: AssetManifest[] = MAHJONG_RESERVED_SLOTS.map((slotId, index) => {
      const character = String(index);
      const contentHash = hashChar(character);
      const uriDigest = slotId === 'mahjong.tile.body' ? 'a'.repeat(64) : character.repeat(64);
      const uri = `melo-asset://sha256/${uriDigest}`;
      return {
        contract: 'melo.asset-manifest',
        contractVersion: '1.0.0',
        id: slotId,
        version: '1.0.0',
        kind: 'bitmap',
        origin: 'generated',
        contentHash,
        uri,
        runtime: { renderers: ['fixed-camera-cinematic'], deterministic: true },
        metadata: {
          browserAsset: {
            role: 'texture-map',
            uri,
            fileName: `${slotId}.png`,
            mimeType: 'image/png',
            byteLength: 128,
          },
        },
      } as AssetManifest;
    });
    const authoredLook: LookPackManifest = {
      ...look,
      id: 'look.copper-mahjong-slots',
      contentHash: hashChar('9'),
      slots: {
        ...look.slots,
        ...Object.fromEntries(
          MAHJONG_RESERVED_SLOTS.map((slotId, index) => [slotId, ref(slotId, 'bitmap', String(index))]),
        ),
      },
    };
    const recipe = {
      ...fixture.recipe,
      id: 'variant.copper-mahjong-slots',
      lookPackRef: ref('look.copper-mahjong-slots', 'look-pack', '9'),
    };
    const plan = compileVariant(
      fixture.master,
      recipe,
      new AssetRegistry([...fixture.assets.filter((item) => item.id !== 'look.copper'), authoredLook, ...extraAssets]),
      { renderer: 'fixed-camera-cinematic', requireHashes: true },
    );
    const slotIds = listRuntimeAssetSlotIds(plan);
    const requests = collectRuntimeAssetRequests(plan);
    expect(MAHJONG_RESERVED_SLOTS.every((slotId) => slotIds.includes(slotId))).toBe(true);
    expect(MAHJONG_RESERVED_SLOTS.filter((slotId) => slotId !== 'mahjong.tile.body').every(
      (slotId) => requests.some((request) => request.slotId === slotId),
    )).toBe(true);
    const issues = collectRuntimeAssetReferenceIssues(plan);
    expect(issues).toEqual([
      expect.objectContaining({ slotId: 'mahjong.tile.body', reason: 'hash-mismatch' }),
    ]);
  });
});

const MAHJONG_RESERVED_SLOTS = [
  'mahjong.tile.body',
  'mahjong.tile.face-pack',
  'mahjong.tile.border',
  'mahjong.selection',
  'mahjong.pair-exit',
] as const;

function hashChar(character: string): string {
  return `sha256:${character.repeat(64)}`;
}

function textureBinding(
  patch: Partial<RuntimeImageAssetBinding> & Pick<RuntimeImageAssetBinding, 'slotId' | 'contentHash' | 'objectUrl'>,
): RuntimeImageAssetBinding {
  return {
    role: 'texture-map',
    sourceUri: `melo-asset://sha256/${patch.contentHash.slice(-64)}`,
    fileName: `${patch.slotId}.png`,
    mimeType: 'image/png',
    fit: 'contain',
    opacity: 1,
    blendMode: 'source-over',
    inset: 0,
    ...patch,
  };
}
