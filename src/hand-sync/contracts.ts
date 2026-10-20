/** Subset of melo.hand-sync contracts (handoff v0.3 / 04_contracts.ts). */

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export type QuatXYZW = readonly [number, number, number, number];
export type Mat4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];
export type Hash = string;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type Phase = 'approach' | 'contact' | 'drag' | 'preview' | 'lift' | 'transfer' | 'exit';
export type TrackOrigin = 'recorded' | 'synthesized-from-action' | 'augmented-presentation';

export interface BoundaryEvent {
  readonly id: string;
  readonly kind: 'pointerdown' | 'commit' | 'cancel' | 'pointerup';
  readonly actionId: string | null;
  readonly pieceId: string | null;
  readonly source: TrackOrigin;
}

export interface PreviewState {
  readonly row: number;
  readonly col: number;
  readonly legal: boolean;
  readonly clearRows: readonly number[];
  readonly clearCols: readonly number[];
}

export type TouchTrackSource = 'pointer-path' | 'held-last-touch' | 'synthesized-hover';

export interface InteractionFrame {
  readonly frameIndex: number;
  readonly sourceFrameIndex?: number;
  readonly phase: Phase;
  readonly contact: boolean;
  readonly actionId: string | null;
  readonly pieceId: string | null;
  readonly origin: TrackOrigin;
  /** Normalized on output video image (top-left origin). Drives pen tip while in contact. */
  readonly touchVideoDeviceUv: Vec2;
  /** Game image UV inside letterbox; used for game-side verification only. */
  readonly touchGameImageUv: Vec2 | null;
  readonly touchTrackSource: TouchTrackSource;
  /** Post-commit / anchor-derived presentation pointer; never drives pen. */
  readonly presentationAnchorUv: Vec2 | null;
  readonly penHeightM: number;
  readonly preview: PreviewState | null;
  readonly events: readonly BoundaryEvent[];
  readonly sourcePresentationHash: Hash;
  readonly sourceStateHash: Hash;
}

export interface FrozenLayout {
  readonly gameImagePx: { readonly width: number; readonly height: number };
  readonly pixelConvention: 'continuous-image-edge-coordinates';
  readonly contentRectDeviceUv: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly displaySizeM: { readonly width: number; readonly height: number };
  readonly worldFromScreen: Mat4;
  readonly screenAxes: 'right-handed-x-right-y-up-z-out';
  readonly touchPlaneOffsetM: number;
  readonly sourceBackendId: string;
  readonly sourceLayoutHash: Hash;
  readonly mappingVersion: string;
  readonly designImagePx?: { readonly width: number; readonly height: number };
  readonly coordinateContract?: 'hand-sync-spatial-v0.4';
  readonly referenceMotion?: 'bottom-right-to-top-left';
}

export interface InteractionTrack {
  readonly schema: 'melo.hand-sync.interaction/0.3';
  readonly fps: { readonly num: number; readonly den: number };
  readonly frameCount: number;
  readonly frameIndexBase: 0;
  readonly timeMode: 'preserve' | 'joint-redesign';
  readonly frames: readonly InteractionFrame[];
  readonly layout: FrozenLayout;
}
