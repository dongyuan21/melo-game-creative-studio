import type { PresentationCompilerAdapter, CompiledFrameSource } from '../../game-runtime/frameSource';
import {
  PRESENTATION_PACKET_CONTRACT,
  PRESENTATION_PACKET_CONTRACT_VERSION,
  presentationHashIdentity,
  type PresentationPacket,
  type SemanticEventCategory,
  type SemanticGameEvent,
} from '../../game-runtime/presentationPacket';
import { frameReplayIdentity } from '../../game-runtime/replayEnvelope';
import { stableHash } from '../../headless/stableHash';
import { compileTapTileTake, evaluateTapTileFrame, type CompiledTapTileTake, type TapTilePresentationFrame } from '../../taptile/director';
import { tapTileStateHash, type TapTileSemanticEvent } from '../../taptile/gameplay';
import {
  DEFAULT_DIRECTOR_PROFILES,
  parseTapTileProjectV2,
  type TapTileDirectorProfile,
  type TapTileProjectV2,
  type TapTileTake,
} from '../../taptile/project';
import { TAPTILE_TRAY_MATCH3_GAME_ID, TAPTILE_TRAY_MATCH3_MODULE_VERSION } from './manifest';
import { tapTileTrayMatch3Runtime } from './runtime';
import { tapTileTakeFromReplay } from './takeEnvelope';
import type { TapTileRuntimeState } from './types';

export const TAPTILE_PRESENTATION_SCHEMA_ID = 'melo.taptile-tray-match3.presentation-frame.v1';

export interface TapTilePresentationPayload {
  frame: TapTilePresentationFrame;
  project: TapTileProjectV2;
  profileId: string;
}

type TapTileCompileInput = Parameters<PresentationCompilerAdapter['compile']>[0];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function resolveTapTileDirectorProfile(
  project: TapTileProjectV2,
  directorProfile: unknown,
): TapTileDirectorProfile {
  if (typeof directorProfile === 'string') {
    return project.director.profiles[directorProfile]
      ?? DEFAULT_DIRECTOR_PROFILES[directorProfile]
      ?? project.director.profiles[project.director.selectedProfileId]
      ?? DEFAULT_DIRECTOR_PROFILES['human-natural']!;
  }
  if (isRecord(directorProfile)) {
    const id = typeof directorProfile.id === 'string' ? directorProfile.id : undefined;
    const base = (id ? project.director.profiles[id] ?? DEFAULT_DIRECTOR_PROFILES[id] : undefined)
      ?? project.director.profiles[project.director.selectedProfileId]
      ?? DEFAULT_DIRECTOR_PROFILES['human-natural']!;
    if (isRecord(directorProfile.timing) || typeof directorProfile.globalSpeed === 'number') {
      return {
        ...base,
        ...(id ? { id } : {}),
        ...(typeof directorProfile.name === 'string' ? { name: directorProfile.name } : {}),
        ...(typeof directorProfile.globalSpeed === 'number' ? { globalSpeed: directorProfile.globalSpeed } : {}),
        ...(typeof directorProfile.betweenActionFrames === 'number'
          ? { betweenActionFrames: directorProfile.betweenActionFrames }
          : {}),
        timing: {
          ...base.timing,
          ...(isRecord(directorProfile.timing) ? directorProfile.timing as unknown as TapTileDirectorProfile['timing'] : {}),
        },
      };
    }
    return base;
  }
  return project.director.profiles[project.director.selectedProfileId]
    ?? DEFAULT_DIRECTOR_PROFILES['human-natural']!;
}

function eventCategory(type: TapTileSemanticEvent['type']): SemanticEventCategory {
  if (type === 'tap.accepted' || type === 'tap.rejected') return 'interaction';
  if (type === 'match.resolved') return 'resolve';
  if (type === 'tray.warning') return 'detect';
  if (type === 'game.won' || type === 'game.lost') return 'outcome';
  return 'reconfigure';
}

function eventEntityIds(event: TapTileSemanticEvent): string[] {
  if ('tileId' in event && typeof event.tileId === 'string') return [event.tileId];
  if (event.type === 'match.resolved' || event.type === 'tiles.unlocked') return [...event.tileIds];
  return [];
}

function semanticEventsAt(compiled: CompiledTapTileTake, frameIndex: number): SemanticGameEvent[] {
  return compiled.events
    .filter((event) => frameIndex >= event.frame && frameIndex < event.endFrame)
    .map((event) => ({
      id: event.id,
      type: event.event.type,
      category: eventCategory(event.event.type),
      tags: [event.event.type.split('.')[0] ?? event.event.type],
      entityIds: eventEntityIds(event.event),
      payload: event.event,
    }));
}

export function tapTilePayloadFromPacket(packet: PresentationPacket): TapTilePresentationPayload {
  if (packet.payloadSchemaId !== TAPTILE_PRESENTATION_SCHEMA_ID) {
    throw new Error(`Expected ${TAPTILE_PRESENTATION_SCHEMA_ID}, received ${packet.payloadSchemaId}.`);
  }
  return packet.payload as TapTilePresentationPayload;
}

function compileTapTileProgram(input: TapTileCompileInput): {
  project: TapTileProjectV2;
  take: TapTileTake;
  compiled: CompiledTapTileTake;
  profile: TapTileDirectorProfile;
  initialState: TapTileRuntimeState;
} {
  const project = parseTapTileProjectV2(input.project.config.data);
  const initialState = tapTileTrayMatch3Runtime.createInitialState(project, input.replay.seed);
  const take = tapTileTakeFromReplay(initialState.level, input.replay);
  const profile = resolveTapTileDirectorProfile(project, input.directorProfile);
  const compiled = compileTapTileTake(initialState.level, take, profile, {
    seed: input.replay.seed,
    fps: input.fps,
    actionOverrides: project.director.actionOverrides,
  });
  return { project, take, compiled, profile, initialState };
}

export const tapTilePresentationAdapter: PresentationCompilerAdapter = {
  gameId: TAPTILE_TRAY_MATCH3_GAME_ID,
  compile(input): CompiledFrameSource {
    const { project, compiled, profile, initialState } = compileTapTileProgram(input);
    const frameSourceHash = stableHash({
      replay: frameReplayIdentity(input.replay, { rhythm: profile, fps: input.fps, totalFrames: compiled.totalFrames }),
      initialStateHash: tapTileTrayMatch3Runtime.hashState(initialState),
      finalStateHash: compiled.finalStateHash,
      directorId: compiled.id,
      profileId: compiled.profileId,
    });
    return {
      gameId: TAPTILE_TRAY_MATCH3_GAME_ID,
      takeId: input.replay.takeId,
      fps: input.fps,
      totalFrames: compiled.totalFrames,
      frameSourceHash,
      evaluate(frameIndex): PresentationPacket {
        const clamped = Math.max(0, Math.min(compiled.totalFrames - 1, Math.round(frameIndex)));
        const frame = evaluateTapTileFrame(compiled, clamped);
        const semanticEvents = semanticEventsAt(compiled, clamped);
        const payload: TapTilePresentationPayload = {
          frame,
          project,
          profileId: compiled.profileId,
        };
        const punch = Math.abs(frame.camera.zoom - 1) * 8
          + Math.hypot(frame.camera.xPx, frame.camera.yPx) / 40;
        return {
          contract: PRESENTATION_PACKET_CONTRACT,
          contractVersion: PRESENTATION_PACKET_CONTRACT_VERSION,
          identity: {
            gameId: TAPTILE_TRAY_MATCH3_GAME_ID,
            moduleVersion: TAPTILE_TRAY_MATCH3_MODULE_VERSION,
            takeId: input.replay.takeId,
            frameIndex: clamped,
            fps: input.fps,
            totalFrames: compiled.totalFrames,
            stateHash: `${compiled.levelHash}:${tapTileStateHash(frame.gameState)}`,
            presentationHash: stableHash(presentationHashIdentity({
              frameIndex: clamped,
              fps: input.fps,
              totalFrames: compiled.totalFrames,
              payload: {
                frameNumber: frame.frameNumber,
                gameState: frame.gameState,
                profileId: compiled.profileId,
                themeId: project.visuals.selectedThemeId,
                activeEventIds: frame.activeEventIds,
              },
              semanticEvents,
              cameraPunch: punch,
            })),
          },
          semanticEvents,
          feedback: {
            cameraPunch: punch,
            screenShake: { x: frame.camera.xPx, y: frame.camera.yPx },
            exposurePulse: frame.effects.some((effect) => effect.kind === 'match') ? (1 - frame.progress) * 0.18 : 0,
          },
          payloadSchemaId: TAPTILE_PRESENTATION_SCHEMA_ID,
          payload,
        };
      },
    };
  },
};
