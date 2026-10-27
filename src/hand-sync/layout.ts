import { blockPlacementCompositionProfile } from '../games/block-placement/profiles/composition';
import { mapComposition, type ContainMapping } from '../rendering/composition';
import type { Mat4, Rect, Vec2 } from './contracts';

const profile = blockPlacementCompositionProfile;

/** Reference live-action stroke: bottom-right → top-left on output video (device UV, origin top-left). */
export const HAND_SYNC_REFERENCE_MOTION = 'bottom-right-to-top-left' as const;

/** Presentation pointer x/y are design-canvas normalized; map to video device UV. */
export function touchVideoDeviceUvFromPresentationPointer(pointer: Vec2): Vec2 {
  return pointerDesignUvToVideoDeviceUv(pointer);
}

/** Inverse of {@link pointerDesignUvToVideoDeviceUv} for exported touch tracks. */
export function videoDeviceUvToPointerDesignUv(videoUv: Vec2): Vec2 {
  const mapping = mapComposition(profile);
  const [vu, vv] = videoUv;
  const videoX = vu * profile.videoResolution.width;
  const videoY = vv * profile.videoResolution.height;
  const designX = (videoX - mapping.offsetX) / mapping.scale;
  const designY = (videoY - mapping.offsetY) / mapping.scale;
  return [
    designX / profile.designResolution.width,
    designY / profile.designResolution.height,
  ];
}

/** Game image (design canvas) letterboxed into device/video pixels — not playfield-only. */
export function gameImageContentRectDeviceUv(): Rect {
  const mapping = mapComposition(profile);
  const { videoResolution: target } = profile;
  return {
    x: mapping.offsetX / target.width,
    y: mapping.offsetY / target.height,
    width: mapping.drawWidth / target.width,
    height: mapping.drawHeight / target.height,
  };
}

export function containMappingForExport(): ContainMapping {
  return mapComposition(profile);
}

/** Pointer normalized on full device viewport (presentation pointer x/y). */
export function devicePointerToGameImageUv(pointer: Vec2, contentRect: Rect): Vec2 | null {
  const [px, py] = pointer;
  const gx = (px - contentRect.x) / contentRect.width;
  const gy = (py - contentRect.y) / contentRect.height;
  if (!Number.isFinite(gx) || !Number.isFinite(gy)) return null;
  if (gx < 0 || gx > 1 || gy < 0 || gy > 1) return null;
  return [gx, gy];
}

/** Screen-local meters: origin center, +X right, +Y up, touch plane Z=0. */
export function penDeviceUvToScreenLocalM(
  uv: Vec2,
  displaySizeM: { width: number; height: number },
  penHeightM: number,
  touchPlaneOffsetM: number,
): [number, number, number] {
  const [u, v] = uv;
  const x = (u - 0.5) * displaySizeM.width;
  const y = (0.5 - v) * displaySizeM.height;
  const z = touchPlaneOffsetM + penHeightM;
  return [x, y, z];
}

export function screenLocalToWorldM(local: [number, number, number], worldFromScreen: Mat4): [number, number, number] {
  const [x, y, z] = local;
  const wx = worldFromScreen[0] * x + worldFromScreen[4] * y + worldFromScreen[8] * z + worldFromScreen[12];
  const wy = worldFromScreen[1] * x + worldFromScreen[5] * y + worldFromScreen[9] * z + worldFromScreen[13];
  const wz = worldFromScreen[2] * x + worldFromScreen[6] * y + worldFromScreen[10] * z + worldFromScreen[14];
  return [wx, wy, wz];
}

/** Reference renderer pointer is normalized on design canvas (REFERENCE_CANVAS), not raw video UV. */
export function pointerDesignUvToVideoDeviceUv(pointer: Vec2): Vec2 {
  const mapping = mapComposition(profile);
  const [du, dv] = pointer;
  const designX = du * profile.designResolution.width;
  const designY = dv * profile.designResolution.height;
  const videoX = mapping.offsetX + designX * mapping.scale;
  const videoY = mapping.offsetY + designY * mapping.scale;
  return [
    videoX / profile.videoResolution.width,
    videoY / profile.videoResolution.height,
  ];
}

export function frozenLayoutFromBlockPlacement(): {
  gameImagePx: { width: number; height: number };
  designImagePx: { width: number; height: number };
  contentRectDeviceUv: Rect;
  displaySizeM: { width: number; height: number };
  worldFromScreen: Mat4;
  touchPlaneOffsetM: number;
} {
  const displayWidthM = 0.108;
  const displayHeightM = displayWidthM * (profile.videoResolution.height / profile.videoResolution.width);
  return {
    gameImagePx: { width: profile.videoResolution.width, height: profile.videoResolution.height },
    designImagePx: { width: profile.designResolution.width, height: profile.designResolution.height },
    contentRectDeviceUv: gameImageContentRectDeviceUv(),
    displaySizeM: { width: displayWidthM, height: displayHeightM },
    touchPlaneOffsetM: 0,
    worldFromScreen: [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ],
  };
}
