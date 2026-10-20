import type { PlacementAction, PointerSample, Take } from '../domain/types';

/** Reference live-action stroke on output video: bottom-right → top-left (device UV). */
export function referencePointerPath(durationFrames: number): PointerSample[] {
  const mid = Math.round(durationFrames * 0.5);
  const end = durationFrames;
  return [
    { frameOffset: 0, x: 0.84, y: 0.88 },
    { frameOffset: Math.max(1, Math.round(end * 0.35)), x: 0.62, y: 0.55 },
    { frameOffset: mid, x: 0.46, y: 0.32 },
    { frameOffset: end, x: 0.14, y: 0.15 },
  ];
}

/** Hand-sync exports: authoritative touch stroke (decoupled from grid anchor Y). */
export function takeWithReferenceMotionPaths(take: Take): Take {
  return {
    ...take,
    actions: take.actions.map((action: PlacementAction) => ({
      ...action,
      pointerPath: referencePointerPath(action.durationFrames),
    })),
  };
}
