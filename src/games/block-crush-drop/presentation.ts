import type { PresentationCompilerAdapter, CompiledFrameSource } from '../../game-runtime/frameSource';
import {
  PRESENTATION_PACKET_CONTRACT,
  PRESENTATION_PACKET_CONTRACT_VERSION,
  presentationHashIdentity,
  type PresentationPacket,
  type SemanticGameEvent,
} from '../../game-runtime/presentationPacket';
import { frameReplayIdentity } from '../../game-runtime/replayEnvelope';
import { stableHash } from '../../headless/stableHash';
import { BLOCK_CRUSH_DROP_GAME_ID, BLOCK_CRUSH_DROP_MODULE_VERSION } from './manifest';
import { cloneCrushWoodBoard, crushWoodRuntime, hashCrushWoodState } from './runtime';
import { crushWoodActionSchema, crushWoodStateSchema } from './schemas';
import type {
  CrushWoodActivePieceFrame,
  CrushWoodDirectorProfile,
  CrushWoodPhase,
  CrushWoodPieceId,
  CrushWoodPresentationPayload,
  CrushWoodResolution,
  CrushWoodState,
} from './types';

type CrushWoodCompileInput = Parameters<PresentationCompilerAdapter['compile']>[0];

export interface CrushWoodActionTrack {
  index: number;
  startFrame: number;
  endFrame: number;
  clearStartFrame: number | null;
  pieceId: CrushWoodPieceId;
  clearedRowCount: number;
}

interface CrushWoodCompileProgram {
  initialState: CrushWoodState;
  finalState: CrushWoodState;
  steps: CompiledCrushWoodStep[];
  profile: CrushWoodDirectorProfile;
  totalFrames: number;
  frameCursor: number;
}

export const CRUSH_WOOD_PRESENTATION_SCHEMA_ID = 'melo.block-crush.presentation-frame.v1';

export const DEFAULT_CRUSH_WOOD_DIRECTOR_PROFILE = {
  leadInFrames: 15,
  fallFrames: 28,
  impactFrames: 4,
  crushFrames: 18,
  collapseFrames: 14,
  settleFrames: 8,
  interActionGapFrames: 6,
  tailFrames: 30,
} as const satisfies CrushWoodDirectorProfile;

interface CompiledCrushWoodStep {
  index: number;
  startFrame: number;
  endFrame: number;
  resolution: CrushWoodResolution;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeInCubic(value: number): number {
  const t = clamp01(value);
  return t * t * t;
}

function finiteFrameCount(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3_600
    ? value
    : fallback;
}

export function resolveCrushWoodDirectorProfile(value: unknown): CrushWoodDirectorProfile {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    leadInFrames: finiteFrameCount(source.leadInFrames, DEFAULT_CRUSH_WOOD_DIRECTOR_PROFILE.leadInFrames),
    fallFrames: Math.max(1, finiteFrameCount(source.fallFrames, DEFAULT_CRUSH_WOOD_DIRECTOR_PROFILE.fallFrames)),
    impactFrames: Math.max(1, finiteFrameCount(source.impactFrames, DEFAULT_CRUSH_WOOD_DIRECTOR_PROFILE.impactFrames)),
    crushFrames: finiteFrameCount(source.crushFrames, DEFAULT_CRUSH_WOOD_DIRECTOR_PROFILE.crushFrames),
    collapseFrames: finiteFrameCount(source.collapseFrames, DEFAULT_CRUSH_WOOD_DIRECTOR_PROFILE.collapseFrames),
    settleFrames: Math.max(1, finiteFrameCount(source.settleFrames, DEFAULT_CRUSH_WOOD_DIRECTOR_PROFILE.settleFrames)),
    interActionGapFrames: finiteFrameCount(
      source.interActionGapFrames,
      DEFAULT_CRUSH_WOOD_DIRECTOR_PROFILE.interActionGapFrames,
    ),
    tailFrames: finiteFrameCount(source.tailFrames, DEFAULT_CRUSH_WOOD_DIRECTOR_PROFILE.tailFrames),
  };
}

function actionDuration(profile: CrushWoodDirectorProfile, resolution: CrushWoodResolution): number {
  return profile.fallFrames
    + profile.impactFrames
    + (resolution.clearedRows.length > 0 ? profile.crushFrames + profile.collapseFrames : 0)
    + profile.settleFrames
    + profile.interActionGapFrames;
}

function phaseForStep(
  relativeFrame: number,
  profile: CrushWoodDirectorProfile,
  resolution: CrushWoodResolution,
): { phase: CrushWoodPhase; progress: number } {
  let cursor = 0;
  if (relativeFrame < cursor + profile.fallFrames) {
    return { phase: 'fall', progress: clamp01((relativeFrame - cursor) / Math.max(1, profile.fallFrames - 1)) };
  }
  cursor += profile.fallFrames;
  if (relativeFrame < cursor + profile.impactFrames) {
    return { phase: 'impact', progress: clamp01((relativeFrame - cursor) / Math.max(1, profile.impactFrames - 1)) };
  }
  cursor += profile.impactFrames;
  if (resolution.clearedRows.length > 0) {
    if (relativeFrame < cursor + profile.crushFrames) {
      return { phase: 'crush', progress: clamp01((relativeFrame - cursor) / Math.max(1, profile.crushFrames - 1)) };
    }
    cursor += profile.crushFrames;
    if (relativeFrame < cursor + profile.collapseFrames) {
      return { phase: 'collapse', progress: clamp01((relativeFrame - cursor) / Math.max(1, profile.collapseFrames - 1)) };
    }
    cursor += profile.collapseFrames;
  }
  if (relativeFrame < cursor + profile.settleFrames) {
    return { phase: 'settle', progress: clamp01((relativeFrame - cursor) / Math.max(1, profile.settleFrames - 1)) };
  }
  return { phase: 'idle', progress: 1 };
}

function eventsForPhase(
  phase: CrushWoodPhase,
  step: CompiledCrushWoodStep | undefined,
): SemanticGameEvent[] {
  if (!step) return [];
  const entityIds = step.resolution.placedCells.map((cell) => `cell-${cell.row}-${cell.col}`);
  if (phase === 'fall') {
    return [{
      id: `drop-${step.index}`,
      type: 'block-crush.drop',
      category: 'interaction',
      tags: ['drop', 'piece'],
      entityIds,
      payload: { action: step.resolution.action },
    }];
  }
  if (phase === 'impact') {
    return [{
      id: `impact-${step.index}`,
      type: 'block-crush.impact',
      category: 'commit',
      tags: ['drop', 'impact'],
      entityIds,
      payload: { landingRow: step.resolution.landingRow },
    }];
  }
  if (phase === 'crush') {
    return [{
      id: `crush-${step.index}`,
      type: 'block-crush.crush-resolved',
      category: 'resolve',
      tags: ['clear', 'fracture', 'wood'],
      entityIds: step.resolution.clearedCells.map((cell) => cell.cellId),
      payload: { rows: step.resolution.clearedRows, scoreDelta: step.resolution.scoreDelta },
    }];
  }
  if (phase === 'collapse') {
    return [{
      id: `collapse-${step.index}`,
      type: 'block-crush.collapse',
      category: 'reconfigure',
      tags: ['collapse', 'gravity'],
      entityIds: step.resolution.collapseMoves.map((move) => move.cellId),
      payload: { moves: step.resolution.collapseMoves.length },
    }];
  }
  if (phase === 'settle') {
    return [{
      id: `settle-${step.index}`,
      type: 'block-crush.settle',
      category: 'settle',
      tags: ['settle'],
      entityIds,
    }];
  }
  return [];
}

function payloadFor(
  phase: CrushWoodPhase,
  progress: number,
  step: CompiledCrushWoodStep | undefined,
  initialState: CrushWoodState,
  finalState: CrushWoodState,
  seed: number,
): CrushWoodPresentationPayload {
  if (!step) {
    const state = phase === 'outcome' ? finalState : initialState;
    return {
      phase,
      phaseProgress: progress,
      actionIndex: phase === 'outcome' ? finalState.turn : -1,
      board: cloneCrushWoodBoard(state.board),
      beforeBoard: cloneCrushWoodBoard(state.board),
      placedBoard: cloneCrushWoodBoard(state.board),
      afterBoard: cloneCrushWoodBoard(state.board),
      activePiece: null,
      clearedRows: [],
      clearedCells: [],
      collapseMoves: [],
      queue: [...state.queue],
      queueIndex: state.queueIndex,
      score: state.score,
      scoreDelta: 0,
      targetScore: state.targetScore,
      linesCleared: state.linesCleared,
      remainingTimeMs: state.remainingTimeMs,
      status: state.status,
      skinId: state.skinId,
      debrisSeed: seed,
    };
  }

  const resolution = step.resolution;
  const before = resolution.before;
  const after = resolution.after;
  const committed = phase !== 'fall';
  const board = phase === 'fall'
    ? before.board
    : phase === 'impact' || phase === 'crush'
      ? resolution.placedBoard
      : after.board;
  const activePiece = phase === 'fall'
    ? {
        pieceId: resolution.action.pieceId,
        rotation: resolution.action.rotation,
        column: resolution.action.column,
        row: resolution.spawnRow + (resolution.landingRow - resolution.spawnRow) * easeInCubic(progress),
        shape: resolution.shape.map((point) => ({ ...point })),
      }
    : null;
  return {
    phase,
    phaseProgress: progress,
    actionIndex: step.index,
    board: cloneCrushWoodBoard(board),
    beforeBoard: cloneCrushWoodBoard(before.board),
    placedBoard: cloneCrushWoodBoard(resolution.placedBoard),
    afterBoard: cloneCrushWoodBoard(after.board),
    activePiece,
    clearedRows: [...resolution.clearedRows],
    clearedCells: resolution.clearedCells.map((cell) => ({ ...cell })),
    collapseMoves: resolution.collapseMoves.map((move) => ({
      cellId: move.cellId,
      from: { ...move.from },
      to: { ...move.to },
    })),
    queue: [...before.queue],
    queueIndex: committed ? after.queueIndex : before.queueIndex,
    score: committed ? after.score : before.score,
    scoreDelta: resolution.scoreDelta,
    targetScore: after.targetScore,
    linesCleared: committed ? after.linesCleared : before.linesCleared,
    remainingTimeMs: committed ? after.remainingTimeMs : before.remainingTimeMs,
    status: committed ? after.status : before.status,
    skinId: before.skinId,
    debrisSeed: seed + step.index * 7_919,
  };
}

function cameraPunch(phase: CrushWoodPhase, progress: number, clearedRowCount: number): number {
  if (phase === 'impact') return (1 - progress) * 0.45;
  if (phase === 'crush') return Math.sin(progress * Math.PI * 6) * (1 - progress) * (0.24 + clearedRowCount * 0.08);
  if (phase === 'collapse') return Math.sin(progress * Math.PI * 3) * (1 - progress) * 0.12;
  return 0;
}

export function crushWoodPayloadFromPacket(packet: PresentationPacket): CrushWoodPresentationPayload {
  if (packet.payloadSchemaId !== CRUSH_WOOD_PRESENTATION_SCHEMA_ID) {
    throw new Error(`Expected ${CRUSH_WOOD_PRESENTATION_SCHEMA_ID}, received ${packet.payloadSchemaId}.`);
  }
  return packet.payload as CrushWoodPresentationPayload;
}

export function liveCrushWoodPacket(
  state: CrushWoodState,
  options: {
    takeId?: string;
    fps?: number;
    phase?: CrushWoodPhase;
    activePiece?: CrushWoodActivePieceFrame | null;
  } = {},
): PresentationPacket {
  const payload: CrushWoodPresentationPayload = {
    phase: options.phase ?? 'idle',
    phaseProgress: 1,
    actionIndex: state.turn - 1,
    board: cloneCrushWoodBoard(state.board),
    beforeBoard: cloneCrushWoodBoard(state.board),
    placedBoard: cloneCrushWoodBoard(state.board),
    afterBoard: cloneCrushWoodBoard(state.board),
    activePiece: options.activePiece ?? null,
    clearedRows: [],
    clearedCells: [],
    collapseMoves: [],
    queue: [...state.queue],
    queueIndex: state.queueIndex,
    score: state.score,
    scoreDelta: 0,
    targetScore: state.targetScore,
    linesCleared: state.linesCleared,
    remainingTimeMs: state.remainingTimeMs,
    status: state.status,
    skinId: state.skinId,
    debrisSeed: 0,
  };
  return {
    contract: PRESENTATION_PACKET_CONTRACT,
    contractVersion: PRESENTATION_PACKET_CONTRACT_VERSION,
    identity: {
      gameId: BLOCK_CRUSH_DROP_GAME_ID,
      moduleVersion: BLOCK_CRUSH_DROP_MODULE_VERSION,
      takeId: options.takeId ?? 'live',
      frameIndex: 0,
      fps: options.fps ?? 30,
      totalFrames: 1,
      stateHash: hashCrushWoodState(state),
      presentationHash: stableHash(payload),
    },
    semanticEvents: [],
    feedback: { cameraPunch: 0, screenShake: { x: 0, y: 0 }, exposurePulse: 0 },
    payloadSchemaId: CRUSH_WOOD_PRESENTATION_SCHEMA_ID,
    payload,
  };
}

function compileCrushWoodProgram(input: CrushWoodCompileInput): CrushWoodCompileProgram {
  const initialState = crushWoodStateSchema.parse(input.project.initialState.data);
  const profile = resolveCrushWoodDirectorProfile(input.directorProfile);
  let cursor = initialState;
  let frameCursor = profile.leadInFrames;
  const steps: CompiledCrushWoodStep[] = [];
  for (const [index, envelope] of input.replay.actions.entries()) {
    const action = crushWoodActionSchema.parse(envelope.action);
    const resolution = crushWoodRuntime.resolve(cursor, action, { seed: input.replay.seed, stepIndex: index });
    const duration = actionDuration(profile, resolution);
    steps.push({ index, startFrame: frameCursor, endFrame: frameCursor + duration, resolution });
    cursor = crushWoodRuntime.stateAfter(resolution);
    frameCursor += duration;
  }
  return {
    initialState,
    finalState: cursor,
    steps,
    profile,
    frameCursor,
    totalFrames: Math.max(1, frameCursor + profile.tailFrames),
  };
}

export function compileCrushWoodActionTracks(input: CrushWoodCompileInput): CrushWoodActionTrack[] {
  const program = compileCrushWoodProgram(input);
  return program.steps.map((step) => ({
    index: step.index,
    startFrame: step.startFrame,
    endFrame: step.endFrame,
    clearStartFrame: step.resolution.clearedRows.length > 0
      ? step.startFrame + program.profile.fallFrames + program.profile.impactFrames
      : null,
    pieceId: step.resolution.action.pieceId,
    clearedRowCount: step.resolution.clearedRows.length,
  }));
}

export const crushWoodPresentationAdapter: PresentationCompilerAdapter = {
  gameId: BLOCK_CRUSH_DROP_GAME_ID,
  compile(input): CompiledFrameSource {
    const { initialState, finalState, steps, profile, totalFrames, frameCursor } = compileCrushWoodProgram(input);
    const frameSourceHash = stableHash({
      replay: frameReplayIdentity(input.replay, { rhythm: profile, fps: input.fps, totalFrames }),
      initialStateHash: hashCrushWoodState(initialState),
      finalStateHash: hashCrushWoodState(finalState),
      resolutions: steps.map((step) => ({
        action: step.resolution.action,
        landingRow: step.resolution.landingRow,
        clearedRows: step.resolution.clearedRows,
        scoreDelta: step.resolution.scoreDelta,
      })),
    });

    return {
      gameId: BLOCK_CRUSH_DROP_GAME_ID,
      takeId: input.replay.takeId,
      fps: input.fps,
      totalFrames,
      frameSourceHash,
      evaluate(frameIndex): PresentationPacket {
        const clamped = Math.max(0, Math.min(totalFrames - 1, Math.round(frameIndex)));
        const step = steps.find((candidate) => clamped >= candidate.startFrame && clamped < candidate.endFrame);
        let phase: CrushWoodPhase;
        let progress: number;
        if (clamped < profile.leadInFrames) {
          phase = 'idle';
          progress = profile.leadInFrames <= 1 ? 1 : clamped / (profile.leadInFrames - 1);
        } else if (step) {
          const local = clamped - step.startFrame;
          const resolved = phaseForStep(local, profile, step.resolution);
          phase = resolved.phase;
          progress = resolved.progress;
        } else if (clamped >= frameCursor) {
          phase = finalState.status === 'playing' ? 'idle' : 'outcome';
          progress = profile.tailFrames <= 1 ? 1 : (clamped - frameCursor) / Math.max(1, profile.tailFrames - 1);
        } else {
          phase = 'idle';
          progress = 1;
        }
        const preceding = steps.filter((candidate) => candidate.endFrame <= clamped).at(-1);
        const activeStep = step ?? preceding;
        const payload = payloadFor(phase, clamp01(progress), step, initialState, finalState, input.replay.seed);
        const semanticEvents = eventsForPhase(phase, activeStep);
        if (phase === 'outcome') {
          semanticEvents.push({
            id: `outcome-${input.replay.takeId}`,
            type: finalState.status === 'won' ? 'block-crush.level-complete' : 'block-crush.game-over',
            category: 'outcome',
            tags: [finalState.status],
            entityIds: [],
            payload: { score: finalState.score, linesCleared: finalState.linesCleared },
          });
        }
        const punch = cameraPunch(phase, clamp01(progress), step?.resolution.clearedRows.length ?? 0);
        const state = phase === 'fall' && step ? step.resolution.before : step?.resolution.after ?? finalState;
        return {
          contract: PRESENTATION_PACKET_CONTRACT,
          contractVersion: PRESENTATION_PACKET_CONTRACT_VERSION,
          identity: {
            gameId: BLOCK_CRUSH_DROP_GAME_ID,
            moduleVersion: BLOCK_CRUSH_DROP_MODULE_VERSION,
            takeId: input.replay.takeId,
            frameIndex: clamped,
            fps: input.fps,
            totalFrames,
            stateHash: hashCrushWoodState(state),
            presentationHash: stableHash(presentationHashIdentity({
              frameIndex: clamped,
              fps: input.fps,
              totalFrames,
              payload,
              semanticEvents,
              cameraPunch: punch,
            })),
          },
          semanticEvents,
          feedback: {
            cameraPunch: punch,
            screenShake: phase === 'crush'
              ? { x: Math.sin(clamped * 2.17) * (1 - progress) * 2.5, y: Math.cos(clamped * 1.63) * (1 - progress) * 2 }
              : { x: 0, y: 0 },
            exposurePulse: phase === 'crush' ? (1 - progress) * 0.22 : 0,
          },
          payloadSchemaId: CRUSH_WOOD_PRESENTATION_SCHEMA_ID,
          payload,
        };
      },
    };
  },
};
