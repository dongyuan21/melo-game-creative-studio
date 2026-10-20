import type { PresentationFrame } from '../domain/types';
import { compileTake, evaluateCompiledTake } from '../games/block-placement/presentation/presentationCompiler';
import { captureRhythm, takeById, type CaptureTakeId } from '../games/block-placement/capture/suite';
import { blockPlacementPacketFromFrame } from '../games/block-placement/presentation/legacyPresentationAdapter';
import { stableHash } from '../headless/stableHash';
import type { BoundaryEvent, InteractionFrame, InteractionTrack, Phase } from './contracts';
import { frozenLayoutFromBlockPlacement, pointerToGameImageUv } from './layout';

function phaseForFrame(frame: PresentationFrame): Phase {
  if (frame.draggedPiece) return frame.draggedPiece.progress < 0.08 ? 'contact' : 'drag';
  if (frame.placementFeedback) return 'preview';
  if (frame.pointer?.pressed) return 'lift';
  return 'approach';
}

function boundaryEventsForFrame(
  frame: PresentationFrame,
  previous: PresentationFrame | null,
): BoundaryEvent[] {
  const events: BoundaryEvent[] = [];
  const pieceId = frame.draggedPiece?.piece.id ?? frame.hiddenPieceId ?? null;
  if (frame.draggedPiece && !previous?.draggedPiece) {
    events.push({
      id: `pointerdown-f${frame.frame}`,
      kind: 'pointerdown',
      actionId: null,
      pieceId,
      source: 'recorded',
    });
  }
  if (frame.placementFeedback && !previous?.placementFeedback) {
    events.push({
      id: `commit-f${frame.frame}`,
      kind: 'commit',
      actionId: null,
      pieceId,
      source: 'recorded',
    });
  }
  if (!frame.pointer?.pressed && previous?.pointer?.pressed && !frame.placementFeedback) {
    events.push({
      id: `pointerup-f${frame.frame}`,
      kind: 'pointerup',
      actionId: null,
      pieceId,
      source: 'recorded',
    });
  }
  return events;
}

function frameToInteraction(
  frame: PresentationFrame,
  previous: PresentationFrame | null,
  layout: ReturnType<typeof frozenLayoutFromBlockPlacement>,
): InteractionFrame {
  const pointer = frame.pointer ?? { x: 0.5, y: 0.88, pressed: false };
  const penDeviceUv: [number, number] = [pointer.x, pointer.y];
  const touchGameUv = pointerToGameImageUv([pointer.x, pointer.y], layout.contentRectDeviceUv);
  const contact = Boolean(frame.draggedPiece && frame.draggedPiece.progress > 0.02);
  const penHeightM = contact ? 0.0008 : pointer.pressed ? 0.012 : 0.028;
  const packet = blockPlacementPacketFromFrame('hand-sync', frame);
  return {
    frameIndex: frame.frame,
    phase: phaseForFrame(frame),
    contact,
    actionId: frame.draggedPiece ? `drag-${frame.frame}` : null,
    pieceId: frame.draggedPiece?.piece.id ?? null,
    origin: 'recorded',
    touchGameUv,
    penDeviceUv,
    penHeightM,
    preview: frame.draggedPiece
      ? {
          row: frame.draggedPiece.anchor.row,
          col: frame.draggedPiece.anchor.col,
          legal: true,
          clearRows: [],
          clearCols: [],
        }
      : null,
    events: boundaryEventsForFrame(frame, previous),
    sourcePresentationHash: packet.identity.presentationHash,
    sourceStateHash: stableHash(frame.snapshot),
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
  const compiled = compileTake(take, rhythm, fps);
  const layoutBase = frozenLayoutFromBlockPlacement();
  const layoutHash = stableHash(layoutBase);
  const layout = {
    ...layoutBase,
    pixelConvention: 'continuous-image-edge-coordinates' as const,
    screenAxes: 'right-handed-x-right-y-up-z-out' as const,
    touchPlaneOffsetM: 0,
    sourceBackendId: 'block-placement.fixed-camera-cinematic',
    sourceLayoutHash: layoutHash,
    mappingVersion: 'bcs-hand-pen-v0.3-a1',
  };

  const end = Math.min(compiled.totalFrames, options.startFrame + options.frameCount);
  const frames: InteractionFrame[] = [];
  let previous: PresentationFrame | null = null;
  for (let index = options.startFrame; index < end; index += 1) {
    const presentation = evaluateCompiledTake(compiled, index, rhythm);
    presentation.frame = index - options.startFrame;
    frames.push(frameToInteraction(presentation, previous, layoutBase));
    previous = presentation;
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
