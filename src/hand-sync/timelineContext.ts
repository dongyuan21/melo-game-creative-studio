import type { CompiledAction, CompiledTake, PresentationFrame, RhythmProfile } from '../domain/types';
import { compileTake, evaluateCompiledTake } from '../games/block-placement/presentation/presentationCompiler';

export interface FrameTimelineContext {
  sourceFrameIndex: number;
  localFrameIndex: number;
  presentation: PresentationFrame;
  activeAction: CompiledAction | null;
  atActionStart: boolean;
  atReleaseFrame: boolean;
  atCommitFrame: boolean;
  inDragSegment: boolean;
  inPostCommitFeedback: boolean;
}

export interface CompiledTimeline {
  compiled: CompiledTake;
  rhythm: RhythmProfile;
  fps: number;
  startSourceFrame: number;
  frameCount: number;
}

export function buildCompiledTimeline(input: {
  take: Parameters<typeof compileTake>[0];
  rhythm: RhythmProfile;
  fps: number;
  startSourceFrame: number;
  frameCount: number;
}): CompiledTimeline {
  const compiled = compileTake(input.take, input.rhythm, input.fps);
  return {
    compiled,
    rhythm: input.rhythm,
    fps: input.fps,
    startSourceFrame: input.startSourceFrame,
    frameCount: input.frameCount,
  };
}

function findActiveAction(compiled: CompiledTake, sourceFrame: number): CompiledAction | null {
  let active: CompiledAction | null = null;
  for (const item of compiled.actions) {
    if (sourceFrame < item.startFrame) break;
    active = item;
  }
  return active;
}

export function frameContextAt(timeline: CompiledTimeline, localIndex: number): FrameTimelineContext {
  const sourceFrameIndex = timeline.startSourceFrame + localIndex;
  const presentation = evaluateCompiledTake(timeline.compiled, sourceFrameIndex, timeline.rhythm);
  const activeAction = findActiveAction(timeline.compiled, sourceFrameIndex);
  const atActionStart = Boolean(activeAction && sourceFrameIndex === activeAction.startFrame);
  const atReleaseFrame = Boolean(activeAction && sourceFrameIndex === activeAction.releaseFrame);
  const atCommitFrame = Boolean(activeAction && sourceFrameIndex === activeAction.releaseFrame + 1);
  const inDragSegment = Boolean(
    activeAction &&
      sourceFrameIndex >= activeAction.startFrame &&
      sourceFrameIndex <= activeAction.releaseFrame,
  );
  const inPostCommitFeedback = Boolean(
    activeAction &&
      sourceFrameIndex > activeAction.releaseFrame &&
      sourceFrameIndex <= activeAction.endFrame &&
      !presentation.draggedPiece,
  );
  return {
    sourceFrameIndex,
    localFrameIndex: localIndex,
    presentation,
    activeAction,
    atActionStart,
    atReleaseFrame,
    atCommitFrame,
    inDragSegment,
    inPostCommitFeedback,
  };
}
