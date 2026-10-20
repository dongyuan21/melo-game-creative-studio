import { applyPlacement } from '../games/block-placement/runtime/gameEngine';
import { captureRhythm, takeById, type CaptureTakeId } from '../games/block-placement/capture/suite';
import { blockPlacementPacketFromFrame } from '../games/block-placement/presentation/legacyPresentationAdapter';
import { stableHash } from '../headless/stableHash';
import type { BoundaryEvent, InteractionFrame, InteractionTrack, Phase, TrackOrigin, Vec2 } from './contracts';
import { frozenLayoutFromBlockPlacement, devicePointerToGameImageUv, penDeviceUvToScreenLocalM } from './layout';
import { buildCompiledTimeline, frameContextAt } from './timelineContext';

const AIR_HOVER_DEVICE_UV: Vec2 = [0.5, 0.88];
const PEN_HOVER_HEIGHT_M = 0.018;
const PEN_CONTACT_HEIGHT_M = 0;

function trackOriginForFrame(ctx: ReturnType<typeof frameContextAt>, clipStartsMidAction: boolean): TrackOrigin {
  if (ctx.atActionStart) return 'recorded';
  if (clipStartsMidAction && ctx.localFrameIndex === 0) return 'synthesized-from-action';
  if (ctx.inDragSegment) return 'recorded';
  if (ctx.inPostCommitFeedback) return 'recorded';
  return 'synthesized-from-action';
}

function phaseForContext(ctx: ReturnType<typeof frameContextAt>): Phase {
  if (ctx.inDragSegment) {
    return ctx.atActionStart ? 'contact' : 'drag';
  }
  if (ctx.inPostCommitFeedback) return 'transfer';
  if (ctx.presentation.pointer?.pressed) return 'lift';
  return 'approach';
}

function boundaryEventsForContext(
  ctx: ReturnType<typeof frameContextAt>,
  previous: ReturnType<typeof frameContextAt> | null,
  clipStartsMidAction: boolean,
): BoundaryEvent[] {
  const events: BoundaryEvent[] = [];
  const actionId = ctx.activeAction?.action.id ?? null;
  const pieceId = ctx.presentation.draggedPiece?.piece.id ?? ctx.presentation.hiddenPieceId ?? null;
  const origin = trackOriginForFrame(ctx, clipStartsMidAction);

  if (ctx.atActionStart && !clipStartsMidAction) {
    events.push({
      id: `${actionId}:pointerdown`,
      kind: 'pointerdown',
      actionId,
      pieceId,
      source: 'recorded',
    });
  }

  if (ctx.atCommitFrame && previous && !previous.inPostCommitFeedback) {
    events.push({
      id: `${actionId}:commit`,
      kind: 'commit',
      actionId,
      pieceId,
      source: 'recorded',
    });
  }

  if (previous?.inDragSegment && !ctx.inDragSegment && ctx.atCommitFrame) {
    events.push({
      id: `${actionId}:pointerup`,
      kind: 'pointerup',
      actionId,
      pieceId,
      source: 'recorded',
    });
  }

  return events;
}

function resolvePointer(ctx: ReturnType<typeof frameContextAt>, previous: ReturnType<typeof frameContextAt> | null): {
  penDeviceUv: Vec2;
  origin: TrackOrigin;
} {
  const p = ctx.presentation.pointer;
  if (p) {
    return { penDeviceUv: [p.x, p.y], origin: 'recorded' };
  }
  if (previous?.presentation.pointer) {
    const steps = Math.max(1, ctx.sourceFrameIndex - previous.sourceFrameIndex);
    const t = 1 / steps;
    const from = previous.presentation.pointer;
    return {
      penDeviceUv: [
        from.x + (AIR_HOVER_DEVICE_UV[0] - from.x) * t,
        from.y + (AIR_HOVER_DEVICE_UV[1] - from.y) * t,
      ],
      origin: 'synthesized-from-action',
    };
  }
  return { penDeviceUv: AIR_HOVER_DEVICE_UV, origin: 'synthesized-from-action' };
}

function previewForContext(ctx: ReturnType<typeof frameContextAt>): InteractionFrame['preview'] {
  if (!ctx.inDragSegment || !ctx.activeAction) return null;
  const { action, transition } = ctx.activeAction;
  const piece = transition.before.pieces.find((candidate) => candidate.id === action.pieceId);
  if (!piece) return null;
  const trial = applyPlacement(transition.before, action);
  const legal = trial !== null;
  return {
    row: action.anchor.row,
    col: action.anchor.col,
    legal,
    clearRows: trial?.clear.rows ?? [],
    clearCols: trial?.clear.cols ?? [],
  };
}

export interface BuildTrackOptions {
  takeId: CaptureTakeId;
  startFrame: number;
  frameCount: number;
  fps?: number;
  timeMode?: 'preserve' | 'joint-redesign';
}

export function buildInteractionTrack(options: BuildTrackOptions): InteractionTrack {
  const fps = options.fps ?? 30;
  const rhythm = captureRhythm();
  const take = takeById(options.takeId);
  const timeline = buildCompiledTimeline({
    take,
    rhythm,
    fps,
    startSourceFrame: options.startFrame,
    frameCount: options.frameCount,
  });
  const layoutBase = frozenLayoutFromBlockPlacement();
  const layoutHash = stableHash({
    ...layoutBase,
    mappingVersion: 'bcs-hand-pen-v0.3-a2',
  });
  const layout = {
    ...layoutBase,
    pixelConvention: 'continuous-image-edge-coordinates' as const,
    screenAxes: 'right-handed-x-right-y-up-z-out' as const,
    sourceBackendId: 'block-placement.fixed-camera-cinematic',
    sourceLayoutHash: layoutHash,
    mappingVersion: 'bcs-hand-pen-v0.3-a2',
  };

  const clipStartsMidAction = Boolean(
    timeline.compiled.actions.some(
      (action) =>
        options.startFrame > action.startFrame && options.startFrame <= action.releaseFrame,
    ),
  );

  const frames: InteractionFrame[] = [];
  let previousCtx: ReturnType<typeof frameContextAt> | null = null;
  for (let local = 0; local < options.frameCount; local += 1) {
    const ctx = frameContextAt(timeline, local);
    const presentation = { ...ctx.presentation, frame: local };
    const { penDeviceUv, origin: pointerOrigin } = resolvePointer(ctx, previousCtx);
    const touchGameUv = devicePointerToGameImageUv(penDeviceUv, layout.contentRectDeviceUv);
    const contact = ctx.inDragSegment;
    const penHeightM = contact ? PEN_CONTACT_HEIGHT_M : PEN_HOVER_HEIGHT_M;
    const packet = blockPlacementPacketFromFrame(take.id, presentation);
    const trackOrigin: TrackOrigin =
      pointerOrigin === 'recorded' ? trackOriginForFrame(ctx, clipStartsMidAction) : pointerOrigin;

    frames.push({
      frameIndex: local,
      phase: phaseForContext(ctx),
      contact,
      actionId: ctx.inDragSegment ? ctx.activeAction?.action.id ?? null : null,
      pieceId: ctx.presentation.draggedPiece?.piece.id ?? ctx.presentation.hiddenPieceId ?? null,
      origin: trackOrigin,
      touchGameUv,
      penDeviceUv,
      penHeightM,
      preview: previewForContext(ctx),
      events: boundaryEventsForContext(ctx, previousCtx, clipStartsMidAction),
      sourcePresentationHash: packet.identity.presentationHash,
      sourceStateHash: stableHash(presentation.snapshot),
    });
    previousCtx = ctx;
  }

  return {
    schema: 'melo.hand-sync.interaction/0.2',
    fps: { num: fps, den: 1 },
    frameCount: frames.length,
    frameIndexBase: 0,
    timeMode: options.timeMode ?? 'preserve',
    frames,
    layout,
  };
}
