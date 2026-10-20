export interface ScreenFrameEntry {
  localFrameIndex: number;
  sourceFrameIndex: number;
  timestampSec: number;
  path: string;
  sha256: string;
  width: number;
  height: number;
  /** BCS pointer ring center in exported video pixels (from design UV + contain). */
  pointerVideoPx?: { x: number; y: number } | null;
}

export interface ScreenManifest {
  schema: 'melo.hand-sync.screen-manifest/0.2';
  backendId: string;
  note: string;
  fps: { num: number; den: number };
  frameCount: number;
  frameSourceHash: string;
  frames: ScreenFrameEntry[];
}
