import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRuntimeId } from '../../../domain/runtimeId';
import type { CompiledFrameSource } from '../../../game-runtime/frameSource';
import type { PresentationPacket } from '../../../game-runtime/presentationPacket';
import { parseStudioProjectDocumentV2 } from '../../../game-runtime/projectParser';
import type { GameReplayEnvelope } from '../../../game-runtime/replayEnvelope';
import { executeVideoRenderJob, type RenderProgress, type VideoRenderOutput } from '../../../rendering/renderJob';
import type { StudioSessionMode } from '../../../studio/sessionTypes';
import { downloadBlob, safeFileName } from '../../../utils/download';
import { createCrushWoodAgentReplay, createCrushWoodReplay } from '../agent';
import {
  CRUSH_WOOD_DEFAULT_QUEUE,
  createCrushWoodReferenceConfig,
  crushWoodRowsForPreset,
  matchCrushWoodBoardPreset,
  setCrushWoodCell,
  toggleCrushWoodCell,
  type CrushWoodBoardPresetId,
} from '../levels';
import { BLOCK_CRUSH_DROP_GAME_ID } from '../manifest';
import {
  crushWoodPayloadFromPacket,
  DEFAULT_CRUSH_WOOD_DIRECTOR_PROFILE,
  liveCrushWoodPacket,
  resolveCrushWoodDirectorProfile,
  type CrushWoodActionTrack,
} from '../presentation';
import {
  compileCrushWoodTake,
  createCrushWoodDocument,
  createCrushWoodReferenceReplay,
  CRUSH_WOOD_REFERENCE_TAKE_ID,
} from '../project';
import { createCrushWoodCinematicBackendAdapter } from '../render/cinematicBackendAdapter';
import {
  currentCrushWoodPiece,
  findCrushWoodLandingRow,
  legalCrushWoodActions,
  crushWoodRuntime,
  hashCrushWoodState,
} from '../runtime';
import { crushWoodConfigSchema } from '../schemas';
import { crushWoodShape, uniqueCrushWoodRotations } from '../shapes';
import type {
  CrushWoodAction,
  CrushWoodActivePieceFrame,
  CrushWoodConfig,
  CrushWoodDirectorProfile,
  CrushWoodPieceId,
  CrushWoodPresentationPayload,
  CrushWoodSkinId,
  CrushWoodState,
} from '../types';

export const CRUSH_WOOD_STUDIO_FPS = 30;

export const CRUSH_WOOD_PHASE_LABELS: Record<CrushWoodPresentationPayload['phase'], string> = {
  idle: '待机',
  fall: '落块',
  impact: '撞击',
  crush: '粉碎',
  collapse: '坍落',
  settle: '稳定',
  outcome: '结算',
};

export const CRUSH_WOOD_STATUS_LABELS: Record<CrushWoodPresentationPayload['status'], string> = {
  playing: '进行中',
  won: '过关',
  'game-over': '失败',
};

export const CRUSH_WOOD_MODE_LABELS: Record<StudioSessionMode, string> = {
  edit: '牌面编辑',
  play: '真人试玩录制',
  replay: '导演回放',
  render: '离线逐帧渲染',
};

interface ExportState {
  running: boolean;
  progress: RenderProgress | null;
  error: string | null;
}

interface RecordingSession {
  initial: CrushWoodState;
  actions: CrushWoodAction[];
  state: CrushWoodState;
}

function ghostPiece(state: CrushWoodState, column: number, rotation: 0 | 1 | 2 | 3): CrushWoodActivePieceFrame | null {
  if (state.status !== 'playing') return null;
  const pieceId = currentCrushWoodPiece(state);
  const shape = crushWoodShape(pieceId, rotation);
  const landingRow = findCrushWoodLandingRow(state.board, shape, column);
  if (landingRow === null) return null;
  return { pieceId, rotation, column, row: landingRow, shape };
}

function parseImportedDocument(data: unknown): {
  name: string;
  config: CrushWoodConfig;
  seed: number;
  directorProfile: CrushWoodDirectorProfile;
  quality: VideoRenderOutput['quality'];
  takes: GameReplayEnvelope[];
} {
  const document = parseStudioProjectDocumentV2(data);
  if (document.game.game.id !== BLOCK_CRUSH_DROP_GAME_ID) {
    throw new Error('不是 Crush Wooood 工程。');
  }
  const config = crushWoodConfigSchema.parse(document.game.config.data);
  const quality = document.production.output.quality;
  return {
    name: document.name,
    config,
    seed: document.takes[0]?.seed ?? 29_980,
    directorProfile: resolveCrushWoodDirectorProfile(document.direction?.rhythm),
    quality: quality === 'preview' || quality === 'standard' || quality === 'cinematic' ? quality : 'cinematic',
    takes: document.takes,
  };
}

export function useCrushWoodModel() {
  const [projectName, setProjectNameState] = useState('Crush Wooood · golden-embossed');
  const [config, setConfig] = useState<CrushWoodConfig>(() => createCrushWoodReferenceConfig());
  const [seed, setSeedState] = useState(29_980);
  const [directorProfile, setDirectorProfileState] = useState<CrushWoodDirectorProfile>({
    ...DEFAULT_CRUSH_WOOD_DIRECTOR_PROFILE,
  });
  const [quality, setQuality] = useState<VideoRenderOutput['quality']>('cinematic');
  const [takes, setTakes] = useState<GameReplayEnvelope[]>(() => {
    const initial = crushWoodRuntime.createInitialState(createCrushWoodReferenceConfig(), 29_980);
    return [createCrushWoodReferenceReplay(hashCrushWoodState(initial), 29_980)];
  });
  const [selectedTakeId, setSelectedTakeId] = useState<string | null>(CRUSH_WOOD_REFERENCE_TAKE_ID);
  const [mode, setMode] = useState<StudioSessionMode>('edit');
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [playRotation, setPlayRotation] = useState<0 | 1 | 2 | 3>(0);
  const [recording, setRecording] = useState<RecordingSession | null>(null);
  const [selectedQueueSlot, setSelectedQueueSlot] = useState(0);
  const [exportState, setExportState] = useState<ExportState>({
    running: false,
    progress: null,
    error: null,
  });
  const canvasExportAbort = useRef<AbortController | null>(null);
  const playbackStartedAt = useRef<number | null>(null);
  const playbackStartedFrame = useRef(0);
  const frameRef = useRef(0);
  frameRef.current = frame;

  const initialState = useMemo(() => crushWoodRuntime.createInitialState(config, seed), [config, seed]);
  const selectedTake = takes.find((take) => take.takeId === selectedTakeId) ?? takes[0] ?? null;
  const compiled = useMemo(() => {
    if (!selectedTake) return null;
    const document = createCrushWoodDocument(config, {
      seed,
      takes,
      directorProfile,
      quality,
    });
    try {
      return compileCrushWoodTake(document, selectedTake.takeId, directorProfile, CRUSH_WOOD_STUDIO_FPS);
    } catch {
      return null;
    }
  }, [config, directorProfile, quality, seed, selectedTake, takes]);
  const frameSource: CompiledFrameSource | null = compiled?.frameSource ?? null;
  const tracks: CrushWoodActionTrack[] = compiled?.tracks ?? [];
  const liveState = mode === 'play' && recording ? recording.state : initialState;
  const ghost = useMemo(() => {
    if (mode !== 'play' || !recording || hoverCol === null) return null;
    return ghostPiece(recording.state, hoverCol, playRotation);
  }, [hoverCol, mode, playRotation, recording]);
  const displayPacket: PresentationPacket = useMemo(() => {
    if ((mode === 'replay' || mode === 'render') && frameSource) {
      return frameSource.evaluate(frame);
    }
    return liveCrushWoodPacket(liveState, {
      fps: CRUSH_WOOD_STUDIO_FPS,
      phase: ghost ? 'fall' : liveState.status === 'playing' ? 'idle' : 'outcome',
      activePiece: ghost,
    });
  }, [frame, frameSource, ghost, liveState, mode]);
  const payload = useMemo(() => crushWoodPayloadFromPacket(displayPacket), [displayPacket]);
  const locked = mode === 'play' || mode === 'render' || exportState.running;
  const setupEditable = mode === 'edit';
  const boardPreset = matchCrushWoodBoardPreset(config.initialRows);

  useEffect(() => {
    setFrame(0);
    playbackStartedAt.current = null;
  }, [frameSource]);

  useEffect(() => {
    if (!playing || mode !== 'replay' || !frameSource) {
      playbackStartedAt.current = null;
      return undefined;
    }
    let animationFrame = 0;
    playbackStartedAt.current = null;
    const tick = (now: number): void => {
      if (playbackStartedAt.current === null) {
        playbackStartedAt.current = now;
        playbackStartedFrame.current = frameRef.current;
      }
      const elapsedFrames = Math.floor(((now - playbackStartedAt.current) / 1_000) * CRUSH_WOOD_STUDIO_FPS);
      const next = playbackStartedFrame.current + elapsedFrames;
      if (next >= frameSource.totalFrames) {
        setFrame(frameSource.totalFrames - 1);
        setPlaying(false);
        playbackStartedAt.current = null;
        return;
      }
      setFrame(next);
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [frameSource, mode, playing]);

  const clearTakesForSetup = useCallback((): void => {
    setTakes([]);
    setSelectedTakeId(null);
    setFrame(0);
    setPlaying(false);
  }, []);

  const setProjectName = useCallback((name: string): void => {
    if (mode === 'play' || mode === 'render') return;
    setProjectNameState(name);
  }, [mode]);

  const setSkinId = useCallback((skinId: CrushWoodSkinId): void => {
    if (mode === 'play' || mode === 'render') return;
    setConfig((current) => ({ ...current, skinId }));
  }, [mode]);

  const setSeed = useCallback((next: number): void => {
    if (!setupEditable) return;
    setSeedState(Math.max(0, Math.min(2_147_483_647, Math.trunc(next || 0))));
  }, [setupEditable]);

  const setDirectorProfile = useCallback((patch: Partial<CrushWoodDirectorProfile>): void => {
    if (mode === 'play' || mode === 'render') return;
    setDirectorProfileState((current) => ({ ...current, ...patch }));
    setPlaying(false);
  }, [mode]);

  const setTargetScore = useCallback((targetScore: number): void => {
    if (!setupEditable) return;
    setConfig((current) => ({ ...current, targetScore: Math.max(1, Math.trunc(targetScore || 1)) }));
    clearTakesForSetup();
  }, [clearTakesForSetup, setupEditable]);

  const applyBoardPreset = useCallback((id: CrushWoodBoardPresetId): void => {
    if (!setupEditable) return;
    setConfig((current) => {
      if (id === 'reference') {
        const next = createCrushWoodReferenceConfig(current.skinId);
        const initial = crushWoodRuntime.createInitialState(next, seed);
        setTakes([createCrushWoodReferenceReplay(hashCrushWoodState(initial), seed)]);
        setSelectedTakeId(CRUSH_WOOD_REFERENCE_TAKE_ID);
        return next;
      }
      return {
        ...current,
        levelId: `studio-${id}-21x34`,
        initialRows: crushWoodRowsForPreset(id),
        queue: [...CRUSH_WOOD_DEFAULT_QUEUE],
        targetScore: 500,
        startingTimeMs: 120_000,
      };
    });
    if (id !== 'reference') clearTakesForSetup();
    setSelectedQueueSlot(0);
  }, [clearTakesForSetup, seed, setupEditable]);

  const paintCell = useCallback((row: number, col: number, fill?: '#' | '.'): void => {
    if (!setupEditable) return;
    setConfig((current) => {
      const initialRows = fill === undefined
        ? toggleCrushWoodCell(current.initialRows, row, col)
        : setCrushWoodCell(current.initialRows, row, col, fill);
      if (initialRows === current.initialRows) return current;
      return { ...current, initialRows };
    });
    clearTakesForSetup();
  }, [clearTakesForSetup, setupEditable]);

  const setQueuePiece = useCallback((slot: number, pieceId: CrushWoodPieceId): void => {
    if (!setupEditable) return;
    setConfig((current) => {
      const queue = [...current.queue];
      if (!queue[slot]) return current;
      queue[slot] = pieceId;
      return { ...current, queue };
    });
    clearTakesForSetup();
  }, [clearTakesForSetup, setupEditable]);

  const addQueuePiece = useCallback((pieceId: CrushWoodPieceId): void => {
    if (!setupEditable || config.queue.length >= 24) return;
    setConfig((current) => ({ ...current, queue: [...current.queue, pieceId] }));
    setSelectedQueueSlot(config.queue.length);
    clearTakesForSetup();
  }, [clearTakesForSetup, config.queue.length, setupEditable]);

  const removeQueuePiece = useCallback((slot: number): void => {
    if (!setupEditable || config.queue.length <= 1) return;
    setConfig((current) => ({ ...current, queue: current.queue.filter((_, index) => index !== slot) }));
    setSelectedQueueSlot((current) => Math.max(0, Math.min(current, config.queue.length - 2)));
    clearTakesForSetup();
  }, [clearTakesForSetup, config.queue.length, setupEditable]);

  const enterEdit = useCallback((): void => {
    if (mode === 'play' || mode === 'render') return;
    setRecording(null);
    setPlaying(false);
    setMode('edit');
  }, [mode]);

  const beginHumanPlay = useCallback((): void => {
    if (mode === 'play' || mode === 'render') return;
    const initial = crushWoodRuntime.createInitialState(config, seed);
    setRecording({ initial, actions: [], state: initial });
    setPlayRotation(uniqueCrushWoodRotations(currentCrushWoodPiece(initial))[0] ?? 0);
    setHoverCol(null);
    setPlaying(false);
    setMode('play');
  }, [config, mode, seed]);

  const cancelHumanPlay = useCallback((): void => {
    setRecording(null);
    setHoverCol(null);
    setMode('edit');
  }, []);

  const undoHumanPlacement = useCallback((): void => {
    setRecording((current) => {
      if (!current || current.actions.length === 0) return current;
      const actions = current.actions.slice(0, -1);
      let state = current.initial;
      for (const [stepIndex, action] of actions.entries()) {
        state = crushWoodRuntime.stateAfter(crushWoodRuntime.resolve(state, action, { seed, stepIndex }));
      }
      setPlayRotation(uniqueCrushWoodRotations(currentCrushWoodPiece(state))[0] ?? 0);
      return { ...current, actions, state };
    });
  }, [seed]);

  const rotatePlayPiece = useCallback((): void => {
    if (!recording || recording.state.status !== 'playing') return;
    const pieceId = currentCrushWoodPiece(recording.state);
    const rotations = uniqueCrushWoodRotations(pieceId);
    const index = Math.max(0, rotations.indexOf(playRotation));
    setPlayRotation(rotations[(index + 1) % rotations.length] ?? 0);
  }, [playRotation, recording]);

  const dropAtColumn = useCallback((column: number): void => {
    setRecording((current) => {
      if (!current || current.state.status !== 'playing') return current;
      const pieceId = currentCrushWoodPiece(current.state);
      const action: CrushWoodAction = { pieceId, column, rotation: playRotation };
      const legal = legalCrushWoodActions(current.state).some(
        (candidate) => candidate.column === column && candidate.rotation === playRotation && candidate.pieceId === pieceId,
      );
      if (!legal) return current;
      const after = crushWoodRuntime.stateAfter(
        crushWoodRuntime.resolve(current.state, action, { seed, stepIndex: current.actions.length }),
      );
      if (after.status === 'playing') {
        setPlayRotation(uniqueCrushWoodRotations(currentCrushWoodPiece(after))[0] ?? 0);
      }
      return { ...current, actions: [...current.actions, action], state: after };
    });
  }, [playRotation, seed]);

  const finishHumanTake = useCallback((): void => {
    if (!recording || recording.actions.length === 0) {
      cancelHumanPlay();
      return;
    }
    const replay = createCrushWoodReplay(
      hashCrushWoodState(recording.initial),
      seed,
      recording.actions,
      'human',
      createRuntimeId('human'),
    );
    setTakes((current) => [...current, replay]);
    setSelectedTakeId(replay.takeId);
    setRecording(null);
    setHoverCol(null);
    setMode('replay');
    setFrame(0);
    setPlaying(true);
  }, [cancelHumanPlay, recording, seed]);

  const enterReplay = useCallback((): void => {
    if (mode === 'play' || mode === 'render') return;
    if (!selectedTakeId && takes[0]) setSelectedTakeId(takes[0].takeId);
    if (takes.length === 0) return;
    setRecording(null);
    setPlaying(false);
    setMode('replay');
  }, [mode, selectedTakeId, takes]);

  const runAgent = useCallback((): void => {
    if (mode === 'play' || mode === 'render') return;
    const replay = createCrushWoodAgentReplay(config, seed);
    if (replay.actions.length === 0) {
      window.alert('当前牌面没有可落点，机器试玩未产生 Take。');
      return;
    }
    setTakes((current) => [...current, replay]);
    setSelectedTakeId(replay.takeId);
    setMode('replay');
    setFrame(0);
    setPlaying(true);
  }, [config, mode, seed]);

  const selectTake = useCallback((takeId: string): void => {
    if (mode === 'play' || mode === 'render') return;
    setSelectedTakeId(takeId);
    setFrame(0);
    setPlaying(false);
    setMode('replay');
  }, [mode]);

  const deleteTake = useCallback((takeId: string): void => {
    if (mode === 'play' || mode === 'render') return;
    setTakes((current) => {
      const next = current.filter((take) => take.takeId !== takeId);
      if (selectedTakeId === takeId) {
        setSelectedTakeId(next[0]?.takeId ?? null);
        setFrame(0);
        setMode(next.length > 0 ? 'replay' : 'edit');
        setPlaying(false);
      }
      return next;
    });
  }, [mode, selectedTakeId]);

  const seek = useCallback((next: number): void => {
    if (!frameSource || mode === 'play' || mode === 'render') return;
    setPlaying(false);
    setMode('replay');
    setFrame(Math.max(0, Math.min(frameSource.totalFrames - 1, Math.round(next))));
    playbackStartedAt.current = null;
  }, [frameSource, mode]);

  const togglePlayback = useCallback((): void => {
    if (!frameSource || mode === 'play' || mode === 'render') return;
    if (frameRef.current >= frameSource.totalFrames - 1) setFrame(0);
    setMode('replay');
    setPlaying((value) => !value);
    playbackStartedAt.current = null;
  }, [frameSource, mode]);

  const exportProject = useCallback((): void => {
    if (mode === 'play' || mode === 'render') return;
    const document = createCrushWoodDocument(config, {
      name: projectName,
      seed,
      directorProfile,
      quality,
      takes,
    });
    downloadBlob(
      new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' }),
      `${safeFileName(projectName)}.melo.json`,
    );
  }, [config, directorProfile, mode, projectName, quality, seed, takes]);

  const importProject = useCallback(async (file: File): Promise<void> => {
    if (mode === 'play' || mode === 'render' || exportState.running) {
      throw new Error('试玩录制或视频渲染期间不能导入项目。');
    }
    const parsed = parseImportedDocument(JSON.parse(await file.text()));
    setProjectNameState(parsed.name);
    setConfig(parsed.config);
    setSeedState(parsed.seed);
    setDirectorProfileState(parsed.directorProfile);
    setQuality(parsed.quality);
    setTakes(parsed.takes);
    setSelectedTakeId(parsed.takes[0]?.takeId ?? null);
    setSelectedQueueSlot(0);
    setRecording(null);
    setPlaying(false);
    setFrame(0);
    setMode('edit');
  }, [exportState.running, mode]);

  const exportVideo = useCallback(async (): Promise<void> => {
    if (!frameSource || !selectedTake || exportState.running || mode === 'play') return;
    setPlaying(false);
    const controller = new AbortController();
    canvasExportAbort.current = controller;
    const previous = mode;
    setMode('render');
    setExportState({ running: true, progress: null, error: null });
    try {
      const result = await executeVideoRenderJob({
        frameSource,
        backend: createCrushWoodCinematicBackendAdapter(),
        output: { width: 1080, height: 1920, fps: CRUSH_WOOD_STUDIO_FPS, quality },
        projectName,
        takeName: selectedTake.takeId,
        resourcePolicy: {
          mode: 'procedural-no-assets',
          reason: 'Crush Wood reference skin is generated deterministically by its game-owned cinematic renderer.',
        },
        signal: controller.signal,
        onProgress: (progress) => setExportState({ running: true, progress, error: null }),
      });
      downloadBlob(result.blob, result.fileName);
      setExportState({ running: false, progress: null, error: null });
    } catch (error) {
      const canceled = error instanceof DOMException && error.name === 'AbortError';
      setExportState({
        running: false,
        progress: null,
        error: canceled ? null : error instanceof Error ? error.message : String(error),
      });
    } finally {
      canvasExportAbort.current = null;
      setMode(previous === 'render' ? 'replay' : previous);
    }
  }, [exportState.running, frameSource, mode, projectName, quality, selectedTake]);

  const cancelExport = useCallback((): void => {
    canvasExportAbort.current?.abort();
  }, []);

  return {
    projectName,
    mode,
    config,
    skinId: config.skinId,
    seed,
    directorProfile,
    quality,
    boardPreset,
    selectedQueueSlot,
    takes,
    selectedTakeId: selectedTake?.takeId ?? null,
    frame,
    playing,
    frameSource,
    payload,
    displayPacket,
    tracks,
    exportState,
    locked,
    setupEditable,
    hoverCol,
    playRotation,
    recordingCount: recording?.actions.length ?? 0,
    recordingStatus: recording?.state.status ?? null,
    setProjectName,
    setSkinId,
    setSeed,
    setDirectorProfile,
    setQuality,
    setTargetScore,
    applyBoardPreset,
    paintCell,
    setSelectedQueueSlot,
    setQueuePiece,
    addQueuePiece,
    removeQueuePiece,
    enterEdit,
    beginHumanPlay,
    cancelHumanPlay,
    undoHumanPlacement,
    rotatePlayPiece,
    dropAtColumn,
    setHoverCol,
    finishHumanTake,
    enterReplay,
    runAgent,
    selectTake,
    deleteTake,
    seek,
    togglePlayback,
    exportProject,
    importProject,
    exportVideo,
    cancelExport,
  };
}
