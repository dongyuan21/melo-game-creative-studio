import { compileTake, evaluateCompiledTake } from '../../../director/presentationCompiler';
import type { PresentationFrame, RhythmProfile, Take } from '../../../domain/types';
import type { CompiledFrameSource, PresentationCompilerAdapter } from '../../../game-runtime/frameSource';
import type { GameProjectEnvelope } from '../../../game-runtime/projectEnvelope';
import {
  PRESENTATION_PACKET_CONTRACT,
  PRESENTATION_PACKET_CONTRACT_VERSION,
  presentationHashIdentity,
  type PresentationPacket,
  type SemanticGameEvent,
} from '../../../game-runtime/presentationPacket';
import type { GameReplayEnvelope } from '../../../game-runtime/replayEnvelope';
import { stableHash } from '../../../headless/stableHash';
import { hashBlockPlacementState } from '../legacyRuntime';
import { BLOCK_PLACEMENT_GAME_ID, BLOCK_PLACEMENT_MODULE_VERSION } from '../manifest';
import { takeFromBlockPlacementReplay } from '../migrations/blockPlacementV1';

export const BLOCK_PLACEMENT_PRESENTATION_SCHEMA_ID = 'melo.block-placement.presentation-frame.v1';

function eventsFromFrame(frame: PresentationFrame): SemanticGameEvent[] {
  const events: SemanticGameEvent[] = [];
  if (frame.draggedPiece) {
    events.push({
      id: `drag-${frame.frame}-${frame.draggedPiece.piece.id}`,
      type: 'block-placement.drag',
      category: 'interaction',
      tags: ['pointer'],
      entityIds: [frame.draggedPiece.piece.id],
    });
  }
  if (frame.placementFeedback) {
    events.push({
      id: `commit-${frame.frame}`,
      type: 'block-placement.placement-committed',
      category: 'commit',
      tags: ['placement'],
      entityIds: frame.placementFeedback.cells.map((cell) => `${cell.row}:${cell.col}`),
      payload: { placementPoints: frame.placementFeedback.placementPoints },
    });
  }
  if (frame.clearing) {
    const clear = frame.clearing.clear;
    if (clear.rows.length > 0 && clear.cols.length > 0) {
      events.push({
        id: `cross-${frame.frame}`,
        type: 'block-placement.cross-cleared',
        category: 'resolve',
        tags: ['clear', 'cross'],
        entityIds: [...clear.rows.map((row) => `row:${row}`), ...clear.cols.map((col) => `col:${col}`)],
      });
    } else if (clear.rows.length > 0 || clear.cols.length > 0) {
      events.push({
        id: `line-${frame.frame}`,
        type: 'block-placement.line-cleared',
        category: 'resolve',
        tags: ['clear'],
        entityIds: [
          ...clear.rows.map((row) => `row:${row}`),
          ...clear.cols.map((col) => `col:${col}`),
        ],
      });
    }
  }
  if (frame.snapshot.status === 'game-over') {
    events.push({
      id: `over-${frame.frame}`,
      type: 'block-placement.game-over',
      category: 'outcome',
      tags: ['terminal'],
      entityIds: [],
    });
  }
  return events;
}

function packetFromFrame(input: {
  takeId: string;
  frame: PresentationFrame;
}): PresentationPacket {
  const totalFrames = input.frame.totalFrames ?? 1;
  const semanticEvents = eventsFromFrame(input.frame);
  const feedback: PresentationPacket['feedback'] = { cameraPunch: input.frame.cameraPunch };
  const identityBody = presentationHashIdentity({
    frameIndex: input.frame.frame,
    fps: input.frame.fps,
    totalFrames,
    payload: input.frame,
    semanticEvents,
    cameraPunch: input.frame.cameraPunch,
  });
  return {
    contract: PRESENTATION_PACKET_CONTRACT,
    contractVersion: PRESENTATION_PACKET_CONTRACT_VERSION,
    identity: {
      gameId: BLOCK_PLACEMENT_GAME_ID,
      moduleVersion: BLOCK_PLACEMENT_MODULE_VERSION,
      takeId: input.takeId,
      frameIndex: input.frame.frame,
      fps: input.frame.fps,
      totalFrames,
      stateHash: hashBlockPlacementState(input.frame.snapshot),
      presentationHash: stableHash(identityBody),
    },
    semanticEvents,
    feedback,
    payloadSchemaId: BLOCK_PLACEMENT_PRESENTATION_SCHEMA_ID,
    payload: input.frame,
  };
}

export function blockPlacementFrameFromPacket(packet: PresentationPacket): PresentationFrame {
  if (packet.payloadSchemaId !== BLOCK_PLACEMENT_PRESENTATION_SCHEMA_ID) {
    throw new Error(`Unsupported presentation schema ${packet.payloadSchemaId}`);
  }
  return packet.payload as PresentationFrame;
}

export function blockPlacementPacketFromFrame(takeId: string, frame: PresentationFrame): PresentationPacket {
  return packetFromFrame({ takeId, frame });
}

export function compileBlockPlacementFrameSource(input: {
  take: Take;
  rhythm: RhythmProfile;
  fps: number;
}): CompiledFrameSource {
  const compiled = compileTake(input.take, input.rhythm, input.fps);
  const frameSourceHash = stableHash({
    gameId: BLOCK_PLACEMENT_GAME_ID,
    takeId: input.take.id,
    fps: compiled.fps,
    totalFrames: compiled.totalFrames,
    initialStateHash: hashBlockPlacementState(compiled.initial),
    finalStateHash: hashBlockPlacementState(compiled.final),
    actions: compiled.actions.map((item) => ({
      id: item.action.id,
      startFrame: item.startFrame,
      releaseFrame: item.releaseFrame,
      clearStartFrame: item.clearStartFrame,
      clearEndFrame: item.clearEndFrame,
      endFrame: item.endFrame,
    })),
  });
  return {
    gameId: BLOCK_PLACEMENT_GAME_ID,
    takeId: input.take.id,
    fps: compiled.fps,
    totalFrames: compiled.totalFrames,
    frameSourceHash,
    evaluate(frameIndex) {
      const frame = evaluateCompiledTake(compiled, frameIndex, input.rhythm);
      return packetFromFrame({ takeId: input.take.id, frame });
    },
  };
}

export const blockPlacementPresentationAdapter: PresentationCompilerAdapter = {
  gameId: BLOCK_PLACEMENT_GAME_ID,
  compile(input: {
    project: GameProjectEnvelope;
    replay: GameReplayEnvelope;
    directorProfile: unknown;
    fps: number;
  }) {
    const take = takeFromBlockPlacementReplay(input.project, input.replay);
    return compileBlockPlacementFrameSource({
      take,
      rhythm: input.directorProfile as RhythmProfile,
      fps: input.fps,
    });
  },
};
