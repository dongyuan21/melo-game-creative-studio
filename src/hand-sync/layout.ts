import { blockPlacementCompositionProfile } from '../games/block-placement/profiles/composition';
import type { Mat4, Rect, Vec2 } from './contracts';

const { videoResolution, playfield } = blockPlacementCompositionProfile;

/** Device-normalized content rect (origin top-left, y down). */
export function blockPlacementContentRectDeviceUv(): Rect {
  const { width: vw, height: vh } = videoResolution;
  return {
    x: playfield.x / vw,
    y: playfield.y / vh,
    width: playfield.width / vw,
    height: playfield.height / vh,
  };
}

/** Map viewport-normalized pointer (BCS presentation) to game-image UV inside content rect. */
export function pointerToGameImageUv(pointer: Vec2, contentRect: Rect): Vec2 | null {
  const [px, py] = pointer;
  const gx = (px - contentRect.x) / contentRect.width;
  const gy = (py - contentRect.y) / contentRect.height;
  if (gx < 0 || gx > 1 || gy < 0 || gy > 1) return null;
  return [gx, gy];
}

/** Row-major 4×4 identity with uniform scale for proxy screen (meters). */
export function defaultWorldFromScreen(displayWidthM: number, displayHeightM: number): Mat4 {
  const sx = displayWidthM;
  const sy = displayHeightM;
  return [
    sx, 0, 0, 0,
    0, sy, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

export function frozenLayoutFromBlockPlacement(): {
  gameImagePx: { width: number; height: number };
  contentRectDeviceUv: Rect;
  displaySizeM: { width: number; height: number };
  worldFromScreen: Mat4;
} {
  const displayWidthM = 0.108;
  const displayHeightM = displayWidthM * (videoResolution.height / videoResolution.width);
  return {
    gameImagePx: { width: videoResolution.width, height: videoResolution.height },
    contentRectDeviceUv: blockPlacementContentRectDeviceUv(),
    displaySizeM: { width: displayWidthM, height: displayHeightM },
    worldFromScreen: defaultWorldFromScreen(displayWidthM, displayHeightM),
  };
}
