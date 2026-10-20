export interface ScreenFrameEntry {
  localFrameIndex: number;
  sourceFrameIndex: number;
  timestampSec: number;
  path: string;
  sha256: string;
  width: number;
  height: number;
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
