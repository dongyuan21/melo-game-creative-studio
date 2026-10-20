import type { Take } from '../domain/types';
import { referenceBrTlTake } from './referenceLegalTake';

/** @deprecated R7c+ uses {@link referenceBrTlTake} with validated pointer/anchor pairs. */
export function takeWithReferenceMotionPaths(take: Take): Take {
  return take;
}

export function handSyncExportTake(): Take {
  return referenceBrTlTake();
}
