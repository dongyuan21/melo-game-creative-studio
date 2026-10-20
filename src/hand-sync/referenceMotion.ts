import type { Take } from '../domain/types';

/** Bake reference stroke (bottom-right → top-left) into pointerPath for hand-sync exports. */
export function takeWithReferenceMotionPaths(take: Take): Take {
  return {
    ...take,
    actions: take.actions.map((action) => ({
      ...action,
      pointerPath: action.pointerPath.map((sample) => ({
        ...sample,
        x: 1 - sample.x,
      })),
    })),
  };
}
