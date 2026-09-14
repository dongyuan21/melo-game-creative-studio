import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  estimateOverlapPairs,
  FACE_LIBRARY,
  isStackProject,
  maxLayer,
  nextTileId,
  normalizeTile,
  STACK_STAGE,
  TEMPLATE_OPTIONS,
  type StackTemplateId,
  type StackTile,
} from './stackModel';
import {
  CHAIN_COMBO_UI_THEME_ID,
  createDefaultTapTileProject,
  ensureChainComboFaceTheme,
  isTapTileProjectV2,
  migrateTapTileStackProjectV1,
  parseTapTileProjectV2,
  projectAsLegacyView,
  projectStackTiles,
  randomizeChainComboFaceTheme,
  replaceProjectStackTiles,
  upgradeLegacyBuiltInThemeGlyphs,
  type TapTileDirectorTiming,
  type TapTileProjectV2,
  type TapTileTake,
} from './project';
import {
  alignStackTiles,
  type StackAlignmentCommand,
} from './stackAlignment';
import {
  solveSmartSnap,
  type SnapGuide,
  type SnapLocks,
} from './smartSnap';
import {
  makeSelectionRect,
  tileIdsInsideSelection,
  type StackPoint,
  type StackSelectionRect,
} from './stackSelection';
import {
  formatTapTileSnapGapPx,
  MAX_TAPTILE_SNAP_GAP_PX,
  MIN_TAPTILE_SNAP_GAP_PX,
  normalizeTapTileSnapGapPx,
} from './snapGap';
import { normalizeTapTileFaceOffset } from './faceOffset';
import {
  compileTapTileLevel,
  playableTapTileIds,
  solveTapTileTakeAnytime,
  tapTileStateHash,
  TAPTILE_SCENARIO_PROFILES,
  type TapTileScenarioProfileId,
  type TapTileSolveProgress,
  type TapTileSolveTerminationReason,
} from './gameplay';
import { GameplayStageOverlay } from './play/GameplayStage';
import {
  GameplayMatchEffects,
  type GameplayMatchEffect,
} from './play/GameplayMatchEffects';
import { GameplayTray } from './play/GameplayTray';
import { useGameplaySession } from './play/useGameplaySession';
import {
  normalizeTapTilePlayDisplayMode,
  TAPTILE_PLAY_DISPLAY_MODES,
  TAPTILE_PLAY_DISPLAY_STORAGE_KEY,
  tapTilePlayDisplayTreatment,
  type TapTilePlayDisplayMode,
} from './play/playDisplayMode';
import {
  resolveTileVisual,
  resolveTileVisualForMatchKey,
  validateSkinPack,
  type ResolvedTileVisual,
} from './visual';
import { TileVisual } from './visual/TileVisual';
import { compileTapTileTake, evaluateTapTileFrame } from './director';
import { DirectorTimeline } from './director/DirectorTimeline';
import { TapTileCanvasPreview, type TapTileCanvasPreviewState } from './render/TapTileCanvasPreview';
import {
  assertTapTileFrameProofsMatch,
  createTapTileRenderJob,
  preflightTapTileRenderJob,
  renderTapTileFrameProof,
  resolveTapTileVideoQualityProfile,
  selectTapTileRegressionFrames,
} from './render';
import { ensureTapTileProductionDefaults } from './production';
import { exportFixedFrameVideo, type FrameRenderProgress } from '../exporter/fixedFrameExporter';
import { safeFileName } from '../utils/download';
import { Toolbar } from '../components/Toolbar';
import type { StudioSessionMode } from '../studio/sessionTypes';
import { TapTileAssetPanel } from '../games/taptile-tray-match3/studio/TapTileAssetPanel';
import { TapTileInspector } from '../games/taptile-tray-match3/studio/TapTileInspector';
import { resolveTapTileBuiltinAssetUrl } from './assetUrl';
import { tapTileBoardDownwardShiftPx } from './trayLayout';
import {
  TAPTILE_WORKSPACE_MODES,
  tapTileShowsPlayOverlay,
  tapTileUsesDirectorCanvas,
  type TapTileWorkspaceMode,
} from './workspace/WorkspaceMode';
import './taptile-studio.css';
import './taptile-polish.css';
import '../games/taptile-tray-match3/studio/tapTileWorkspace.css';

function toSessionMode(mode: TapTileWorkspaceMode): StudioSessionMode {
  if (mode === 'play') return 'play';
  if (mode === 'export') return 'render';
  if (mode === 'replay' || mode === 'direct') return 'replay';
  return 'edit';
}

const AUTOSAVE_KEY_V2 = 'taptile-director-project/autosave/v2';
const AUTOSAVE_KEY_V1 = 'taptile-stack-studio/autosave/v1';
const TAPTILE_STUDIO_STYLE = {
  '--tpt-classic-tile-surface': `url("${resolveTapTileBuiltinAssetUrl('/assets/taptile/classic-tile-surface-v1.png')}")`,
} as CSSProperties;

const AGENT_SEARCH_STRENGTHS = [
  { id: 'fast', label: '快速', beamScale: 0.5, maxExpandedStates: 12_000, timeBudgetMs: 4_000 },
  { id: 'standard', label: '标准', beamScale: 1, maxExpandedStates: 60_000, timeBudgetMs: 12_000 },
  { id: 'deep', label: '深度', beamScale: 2, maxExpandedStates: 180_000, timeBudgetMs: 30_000 },
] as const;

type AgentSearchStrengthId = (typeof AGENT_SEARCH_STRENGTHS)[number]['id'];

interface AgentRunSummary {
  takeId: string;
  clearedTileCount: number;
  totalTileCount: number;
  theoreticalClearableTileCount: number;
  peakTrayOccupancy: number;
  provedMaximum: boolean;
  expandedStates: number;
  terminationReason?: TapTileSolveTerminationReason;
}

function agentBaseBeamWidth(profile: TapTileScenarioProfileId): number {
  if (profile === 'danger-rescue') return 800;
  if (profile === 'max-clear') return 120;
  if (profile === 'safe-win') return 80;
  return 260;
}

const STAGE_COPY = {
  edit: { title: '拆解并设计 2D 牌面', callout: '先造局，再试玩。', hint: '左侧选择模板与匹配组；在舞台上拖动、叠层。' },
  play: { title: '录制真人试玩', callout: '正在记录 Replay', hint: '点击可点牌进入 7 槽，只保存动作与 Seed。' },
  replay: { title: '导演与固定帧重放', callout: '先看 Take，再导出。', hint: '左侧选择 Take；右侧调节节奏并生成 1080×1920 MP4。' },
  render: { title: '导演与固定帧重放', callout: '正在导出成片', hint: '离线逐帧渲染进行中。' },
} as const;

interface HistoryState {
  past: TapTileProjectV2[];
  present: TapTileProjectV2;
  future: TapTileProjectV2[];
}

type HistoryAction =
  | { type: 'commit'; value: TapTileProjectV2 }
  | { type: 'replace'; value: TapTileProjectV2 }
  | { type: 'record-drag'; baseline: TapTileProjectV2 }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; value: TapTileProjectV2 };

function sameProject(left: TapTileProjectV2, right: TapTileProjectV2): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  if (action.type === 'commit') {
    if (sameProject(state.present, action.value)) return state;
    return {
      past: [...state.past.slice(-79), state.present],
      present: action.value,
      future: [],
    };
  }
  if (action.type === 'replace') return { ...state, present: action.value };
  if (action.type === 'record-drag') {
    if (sameProject(action.baseline, state.present)) return state;
    return {
      past: [...state.past.slice(-79), action.baseline],
      present: state.present,
      future: [],
    };
  }
  if (action.type === 'undo') {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future.slice(0, 79)],
    };
  }
  if (action.type === 'redo') {
    const next = state.future[0];
    if (!next) return state;
    return {
      past: [...state.past.slice(-79), state.present],
      present: next,
      future: state.future.slice(1),
    };
  }
  return { past: [], present: action.value, future: [] };
}

function upgradeLegacyTemplateFaceRuns(project: TapTileProjectV2): TapTileProjectV2 {
  if (project.takes.length > 0) return project;
  const templateId = project.authoring.templateId;
  const instances = project.level.tileInstances;
  const isUntouchedLegacyDistribution = instances.length > 0 && instances.every((tile, index) => {
    const expectedId = `${templateId}-${index + 1}`;
    const expectedFaceId = FACE_LIBRARY[Math.floor(index / 3) % FACE_LIBRARY.length]?.id;
    return tile.id === expectedId
      && project.visuals.archetypes[tile.archetypeId]?.matchKey === expectedFaceId;
  });
  if (!isUntouchedLegacyDistribution) return project;
  const shuffledTemplate = createDefaultTapTileProject(templateId);
  const archetypeByTileId = new Map(
    shuffledTemplate.level.tileInstances.map((tile) => [tile.id, tile.archetypeId]),
  );
  const upgraded = structuredClone(project);
  for (const tile of upgraded.level.tileInstances) {
    tile.archetypeId = archetypeByTileId.get(tile.id) ?? tile.archetypeId;
  }
  return upgraded;
}

function fitProjectBelowTopTray(project: TapTileProjectV2): TapTileProjectV2 {
  const upgraded = ensureChainComboFaceTheme(upgradeLegacyBuiltInThemeGlyphs(upgradeLegacyTemplateFaceRuns(project)));
  const shiftPx = tapTileBoardDownwardShiftPx(
    upgraded.level.tileInstances.map((tile) => tile.geometry),
    upgraded.stage.exportHeight,
  );
  if (shiftPx <= 0) return upgraded;
  const fitted = structuredClone(upgraded);
  for (const tile of fitted.level.tileInstances) tile.geometry.centerYPx += shiftPx;
  const fittedLevelHash = compileTapTileLevel(fitted).levelHash;
  fitted.takes = fitted.takes.map((take) => ({ ...take, levelHash: fittedLevelHash }));
  return fitted;
}

function initialProject(): TapTileProjectV2 {
  try {
    const storedV2 = window.localStorage.getItem(AUTOSAVE_KEY_V2);
    if (storedV2) {
      const parsed: unknown = JSON.parse(storedV2);
      if (isTapTileProjectV2(parsed)) return fitProjectBelowTopTray(ensureTapTileProductionDefaults(parseTapTileProjectV2(parsed)));
    }
    const storedV1 = window.localStorage.getItem(AUTOSAVE_KEY_V1);
    if (storedV1) {
      const parsed: unknown = JSON.parse(storedV1);
      if (isStackProject(parsed)) return fitProjectBelowTopTray(migrateTapTileStackProjectV1(parsed));
    }
  } catch {
    // A malformed local draft should never block the editor from opening.
  }
  return fitProjectBelowTopTray(createDefaultTapTileProject('hourglass'));
}

function initialPlayDisplayMode(): TapTilePlayDisplayMode {
  try {
    return normalizeTapTilePlayDisplayMode(window.localStorage.getItem(TAPTILE_PLAY_DISPLAY_STORAGE_KEY));
  } catch {
    return 'all';
  }
}

interface DragSession {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  baseline: TapTileProjectV2;
  positions: Map<string, { x: number; y: number }>;
  locks: SnapLocks;
  guides: SnapGuide[];
  axisLock: 'x' | 'y' | null;
}

interface MarqueeSession {
  pointerId: number;
  start: StackPoint;
  baselineSelection: string[];
  additive: boolean;
  moved: boolean;
}

const cloneProject = (project: TapTileProjectV2): TapTileProjectV2 => structuredClone(project);

function downloadProject(project: TapTileProjectV2): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${project.name.replace(/[\\/:*?"<>|]/g, '-')}.taptile-project.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function faceGlyph(project: TapTileProjectV2, faceId: string): string {
  try {
    const visual = resolveTileVisualForMatchKey(project, faceId, project.visuals.selectedThemeId, 'hud-preview');
    const glyph = visual.renderedFace.parts.find((part) => part.source.kind === 'glyph')?.source;
    return glyph?.kind === 'glyph' ? glyph.value : '▣';
  } catch {
    return '⚠';
  }
}

function faceAccent(faceId: string): string {
  return FACE_LIBRARY.find((face) => face.id === faceId)?.accent ?? '#ffc946';
}

function visibleFaceName(visual: ResolvedTileVisual): string {
  const nameParts = visual.faceAssembly.name.split(' · ').map((part) => part.trim()).filter(Boolean);
  return nameParts.at(-1) ?? visual.faceAssembly.name;
}

export function TapTileStackStudio() {
  const [history, dispatch] = useReducer(historyReducer, undefined, () => ({
    past: [],
    present: initialProject(),
    future: [],
  }));
  const project = history.present;
  const projectRef = useRef(project);
  projectRef.current = project;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedRef = useRef(selectedIds);
  selectedRef.current = selectedIds;
  const [layerFocus, setLayerFocus] = useState<number | 'all'>('all');
  const [autosaveLabel, setAutosaveLabel] = useState('已自动保存');
  const [notice, setNotice] = useState('拖动任意牌块开始编辑');
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [snapTargetIds, setSnapTargetIds] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<StackSelectionRect | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragSession | null>(null);
  const marqueeRef = useRef<MarqueeSession | null>(null);
  const snapClearTimerRef = useRef<number | null>(null);
  const rejectClearTimerRef = useRef<number | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<TapTileWorkspaceMode>('edit');
  const [playDisplayMode, setPlayDisplayMode] = useState<TapTilePlayDisplayMode>(initialPlayDisplayMode);
  const [rejectedTileId, setRejectedTileId] = useState<string | null>(null);
  const [liveMatchEffects, setLiveMatchEffects] = useState<GameplayMatchEffect[]>([]);
  const liveMatchTimersRef = useRef<Map<string, number>>(new Map());
  const [agentProfile, setAgentProfile] = useState<TapTileScenarioProfileId>('max-clear');
  const [agentSearchStrength, setAgentSearchStrength] = useState<AgentSearchStrengthId>('standard');
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentProgress, setAgentProgress] = useState<TapTileSolveProgress | null>(null);
  const [, setAgentRunSummary] = useState<AgentRunSummary | null>(null);
  const agentSearchAbortRef = useRef<AbortController | null>(null);
  const [directorFrame, setDirectorFrame] = useState(0);
  const [directorPlaying, setDirectorPlaying] = useState(false);
  const [selectedDirectorActionId, setSelectedDirectorActionId] = useState<string | null>(null);
  const [directorPreviewState, setDirectorPreviewState] = useState<TapTileCanvasPreviewState | null>(null);
  const [tapTileExportProgress, setTapTileExportProgress] = useState<FrameRenderProgress | null>(null);
  const [tapTileExportError, setTapTileExportError] = useState('');
  const [tapTileExportResult, setTapTileExportResult] = useState<{
    url: string;
    fileName: string;
    bytes: number;
    frameCount: number;
    durationSeconds: number;
    verifiedFrame: number;
    verifiedPixelHash: string;
    renderIdentityHash: string;
    containerVerified: boolean;
    actualFps: number;
    actualVideoBitrate: number;
    minimumVisualPsnrDb: number;
  } | null>(null);
  const tapTileExportAbortRef = useRef<AbortController | null>(null);
  const gameplay = useGameplaySession();
  const sessionMode = toSessionMode(workspaceMode);

  const commit = useCallback((mutate: (draft: TapTileProjectV2) => void): void => {
    const next = cloneProject(projectRef.current);
    mutate(next);
    next.revision += 1;
    next.updatedAt = new Date().toISOString();
    dispatch({ type: 'commit', value: next });
  }, []);

  const tiles = useMemo(() => projectStackTiles(project), [project]);
  const compiledLevel = useMemo(() => compileTapTileLevel(project), [project]);
  const selectedDirectorTake = useMemo(
    () => project.takes.find((take) => take.id === project.selectedTakeId) ?? project.takes.at(-1) ?? null,
    [project.selectedTakeId, project.takes],
  );
  const selectedDirectorProfile = project.director.profiles[project.director.selectedProfileId] ?? null;
  const compiledDirector = useMemo(() => {
    if (!selectedDirectorTake || !selectedDirectorProfile) return null;
    try {
      return compileTapTileTake(compiledLevel, selectedDirectorTake, selectedDirectorProfile, {
        seed: project.director.seed,
        fps: project.render.fps,
        actionOverrides: project.director.actionOverrides,
      });
    } catch {
      return null;
    }
  }, [compiledLevel, project.director.actionOverrides, project.director.seed, project.render.fps, selectedDirectorProfile, selectedDirectorTake]);
  const directorPresentation = useMemo(
    () => compiledDirector ? evaluateTapTileFrame(compiledDirector, directorFrame) : null,
    [compiledDirector, directorFrame],
  );
  const renderRegressionFrames = useMemo(
    () => compiledDirector ? selectTapTileRegressionFrames(compiledDirector) : [],
    [compiledDirector],
  );
  const directorPreviewReady = directorPreviewState?.status === 'ready'
    && directorPreviewState.proof?.frameNumber === directorPresentation?.frameNumber;
  const selectedSkinCompatibility = useMemo(
    () => validateSkinPack(project, project.visuals.selectedThemeId),
    [project],
  );
  const matchGroupPreviews = useMemo(() => {
    const resolved = FACE_LIBRARY.map((face, index) => {
      try {
        const visual = resolveTileVisualForMatchKey(project, face.id, project.visuals.selectedThemeId, 'hud-preview');
        return { face, index, visual, visibleName: visibleFaceName(visual) };
      } catch {
        return { face, index, visual: null, visibleName: face.label };
      }
    });
    const visibleNameCounts = new Map<string, number>();
    for (const preview of resolved) {
      visibleNameCounts.set(preview.visibleName, (visibleNameCounts.get(preview.visibleName) ?? 0) + 1);
    }
    return resolved.map((preview) => ({
      ...preview,
      label: visibleNameCounts.get(preview.visibleName) === 1
        ? preview.visibleName
        : `分组 ${String(preview.index + 1).padStart(2, '0')}`,
    }));
  }, [project]);
  const displayState = workspaceMode === 'play'
    ? gameplay.gameState
    : workspaceMode === 'replay'
      ? gameplay.replayState
      : workspaceMode === 'direct'
        ? directorPresentation?.gameState ?? null
        : null;
  const displayedBoardIds = useMemo(
    () => new Set(displayState?.boardIds ?? tiles.map((tile) => tile.id)),
    [displayState, tiles],
  );
  const displayedTiles = useMemo(
    () => tiles.filter((tile) => displayedBoardIds.has(tile.id)),
    [displayedBoardIds, tiles],
  );
  const displayedPlayableIds = useMemo(() => new Set(
    displayState
      ? playableTapTileIds(compiledLevel, displayState)
      : compiledLevel.initialPlayableIds,
  ), [compiledLevel, displayState]);

  const selectedTiles = useMemo(
    () => tiles.filter((tile) => selectedIds.includes(tile.id)),
    [tiles, selectedIds],
  );
  const primaryTile = selectedTiles.at(-1) ?? null;
  const highestLayer = maxLayer(tiles);
  const usedLayers = useMemo(
    () => [...new Set(tiles.map((tile) => tile.layer))].sort((left, right) => left - right),
    [tiles],
  );
  const layerRanks = useMemo(
    () => new Map(usedLayers.map((layer, index) => [layer, index])),
    [usedLayers],
  );
  const overlapPairs = useMemo(() => estimateOverlapPairs(tiles), [tiles]);

  useEffect(() => {
    if (!compiledDirector) return;
    setDirectorFrame((current) => Math.min(current, compiledDirector.totalFrames - 1));
  }, [compiledDirector]);

  useEffect(() => {
    if (!directorPlaying || !compiledDirector || !tapTileUsesDirectorCanvas(workspaceMode)) return undefined;
    if (directorFrame >= compiledDirector.totalFrames - 1) {
      setDirectorPlaying(false);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setDirectorFrame((current) => Math.min(compiledDirector.totalFrames - 1, current + 1));
    }, 1000 / Math.max(1, project.render.fps));
    return () => window.clearTimeout(timer);
  }, [compiledDirector, directorFrame, directorPlaying, project.render.fps, workspaceMode]);

  useEffect(() => () => {
    tapTileExportAbortRef.current?.abort();
    if (tapTileExportResult?.url) URL.revokeObjectURL(tapTileExportResult.url);
  }, [tapTileExportResult?.url]);

  useEffect(() => () => {
    agentSearchAbortRef.current?.abort();
  }, [compiledLevel.levelHash]);

  const clearLiveMatchEffects = useCallback((): void => {
    for (const timer of liveMatchTimersRef.current.values()) window.clearTimeout(timer);
    liveMatchTimersRef.current.clear();
    setLiveMatchEffects([]);
  }, []);

  useEffect(() => () => {
    for (const timer of liveMatchTimersRef.current.values()) window.clearTimeout(timer);
    liveMatchTimersRef.current.clear();
  }, []);

  const visibleTileIds = useMemo(
    () => tiles
      .filter((tile) => layerFocus === 'all' || tile.layer === layerFocus)
      .map((tile) => tile.id),
    [layerFocus, tiles],
  );

  useEffect(() => {
    setAutosaveLabel('正在保存…');
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(AUTOSAVE_KEY_V2, JSON.stringify(project));
        setAutosaveLabel('已自动保存');
      } catch {
        setAutosaveLabel('自动保存不可用');
      }
    }, 240);
    return () => window.clearTimeout(timer);
  }, [project]);

  useEffect(() => {
    try {
      window.localStorage.setItem(TAPTILE_PLAY_DISPLAY_STORAGE_KEY, playDisplayMode);
    } catch {
      // A blocked preference store should not affect the gameplay session.
    }
  }, [playDisplayMode]);

  useEffect(() => () => {
    if (snapClearTimerRef.current !== null) window.clearTimeout(snapClearTimerRef.current);
    if (rejectClearTimerRef.current !== null) window.clearTimeout(rejectClearTimerRef.current);
  }, []);

  useEffect(() => {
    if (layerFocus !== 'all' && !usedLayers.includes(layerFocus)) setLayerFocus('all');
  }, [layerFocus, usedLayers]);

  const updateSelected = useCallback((mutate: (tile: StackTile) => StackTile): void => {
    if (workspaceMode !== 'edit') return;
    const ids = new Set(selectedRef.current);
    if (ids.size === 0) return;
    commit((draft) => {
      const nextTiles = projectStackTiles(draft).map((tile) => ids.has(tile.id)
        ? normalizeTile(mutate(tile))
        : tile);
      replaceProjectStackTiles(draft, nextTiles);
    });
  }, [commit, workspaceMode]);

  const deleteSelected = useCallback((): void => {
    if (workspaceMode !== 'edit') return;
    const ids = new Set(selectedRef.current);
    if (ids.size === 0) return;
    commit((draft) => {
      replaceProjectStackTiles(draft, projectStackTiles(draft).filter((tile) => !ids.has(tile.id)));
    });
    setSelectedIds([]);
    setNotice(`已删除 ${ids.size} 张牌`);
  }, [commit, workspaceMode]);

  const duplicateSelected = useCallback((): void => {
    if (workspaceMode !== 'edit') return;
    const ids = new Set(selectedRef.current);
    if (ids.size === 0) return;
    const newIds: string[] = [];
    commit((draft) => {
      const draftTiles = projectStackTiles(draft);
      const additions = draftTiles
        .filter((tile) => ids.has(tile.id))
        .map((tile, index) => {
          const id = `${nextTileId(projectAsLegacyView(draft))}-${index + 1}`;
          newIds.push(id);
          return normalizeTile({
            ...tile,
            id,
            x: tile.x + 14,
            y: tile.y + 14,
            layer: tile.layer + 1,
            locked: false,
          });
        });
      replaceProjectStackTiles(draft, [...draftTiles, ...additions]);
    });
    setSelectedIds(newIds);
    setNotice(`已复制 ${newIds.length} 张牌`);
  }, [commit, workspaceMode]);

  const alignSelection = useCallback((command: StackAlignmentCommand, label: string, minimum: number): void => {
    if (workspaceMode !== 'edit') return;
    const ids = [...selectedRef.current];
    if (ids.length < minimum) {
      setNotice(minimum === 3 ? '等距分布至少需要选中 3 张牌' : '对齐至少需要选中 2 张牌');
      return;
    }
    const idSet = new Set(ids);
    commit((draft) => {
      const aligned = alignStackTiles(projectStackTiles(draft), idSet, command)
        .map((tile) => idSet.has(tile.id) ? normalizeTile(tile) : tile);
      replaceProjectStackTiles(draft, aligned);
    });
    setNotice(`已完成${label}`);
  }, [commit, workspaceMode]);

  const selectAllVisible = useCallback((): void => {
    const ids = projectStackTiles(projectRef.current)
      .filter((tile) => layerFocus === 'all' || tile.layer === layerFocus)
      .map((tile) => tile.id);
    setSelectedIds(ids);
    setNotice(layerFocus === 'all' ? `已全选 ${ids.length} 张牌` : `已选中第 ${layerFocus + 1} 层的 ${ids.length} 张牌`);
  }, [layerFocus]);

  const clearSelection = useCallback((): void => {
    setSelectedIds([]);
    setMarquee(null);
    marqueeRef.current = null;
    setNotice('已取消选择');
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select')) return;
      if (workspaceMode !== 'edit') {
        if (tapTileUsesDirectorCanvas(workspaceMode) && compiledDirector && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
          event.preventDefault();
          setDirectorPlaying(false);
          setDirectorFrame((current) => Math.max(
            0,
            Math.min(compiledDirector.totalFrames - 1, current + (event.key === 'ArrowRight' ? 1 : -1)),
          ));
        } else if (workspaceMode === 'replay' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
          event.preventDefault();
          gameplay.seekReplay(gameplay.replayIndex + (event.key === 'ArrowRight' ? 1 : -1));
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setDirectorPlaying(false);
          setWorkspaceMode('edit');
          setNotice('已返回编辑模式');
        }
        return;
      }
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
        return;
      }
      if (command && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        dispatch({ type: 'redo' });
        return;
      }
      if (command && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      if (command && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        selectAllVisible();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        clearSelection();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelected();
        return;
      }
      const delta = event.shiftKey ? 10 : 2;
      const movement = event.key === 'ArrowLeft'
        ? { x: -delta, y: 0 }
        : event.key === 'ArrowRight'
          ? { x: delta, y: 0 }
          : event.key === 'ArrowUp'
            ? { x: 0, y: -delta }
            : event.key === 'ArrowDown'
              ? { x: 0, y: delta }
              : null;
      if (movement) {
        event.preventDefault();
        updateSelected((tile) => ({ ...tile, x: tile.x + movement.x, y: tile.y + movement.y }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearSelection, compiledDirector, deleteSelected, duplicateSelected, gameplay, selectAllVisible, updateSelected, workspaceMode]);

  const chooseTemplate = (templateId: StackTemplateId): void => {
    if (workspaceMode !== 'edit') return;
    const next = createDefaultTapTileProject(templateId);
    next.name = project.name;
    next.authoring.material = project.authoring.material;
    next.authoring.sceneTheme = project.authoring.sceneTheme;
    next.authoring.snap = project.authoring.snap;
    next.authoring.snapGapPx = project.authoring.snapGapPx;
    next.authoring.showLayerBadges = project.authoring.showLayerBadges;
    next.authoring.faceOffsetX = project.authoring.faceOffsetX;
    next.authoring.faceOffsetY = project.authoring.faceOffsetY;
    next.visuals.selectedThemeId = project.visuals.selectedThemeId;
    dispatch({ type: 'commit', value: next });
    setSelectedIds([]);
    setLayerFocus('all');
    setNotice(`${TEMPLATE_OPTIONS.find((option) => option.id === templateId)?.label ?? ''}模板已载入 · 牌面已安全打散`);
  };

  const chooseFace = (faceId: string): void => {
    if (workspaceMode !== 'edit') return;
    if (selectedRef.current.length > 0) {
      updateSelected((tile) => ({ ...tile, faceId }));
      setNotice(`已替换 ${selectedRef.current.length} 张牌的牌面`);
      return;
    }
    let newId = '';
    commit((draft) => {
      const draftTiles = projectStackTiles(draft);
      newId = nextTileId(projectAsLegacyView(draft));
      const count = draftTiles.length;
      const nextTile = normalizeTile({
        id: newId,
        x: STACK_STAGE.width / 2 + ((count % 3) - 1) * 18,
        y: 410 + ((count % 5) - 2) * 12,
        layer: draftTiles.length === 0 ? 0 : maxLayer(draftTiles) + 1,
        rotation: 0,
        scale: 1,
        faceId,
        locked: false,
      });
      replaceProjectStackTiles(draft, [...draftTiles, nextTile]);
    });
    setSelectedIds([newId]);
    setNotice('已在画布中央新增牌块');
  };

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>, tile: StackTile): void => {
    event.stopPropagation();
    if (tile.locked) {
      setNotice('这张牌已锁定，请先在右侧解锁');
      return;
    }
    const nextSelection = event.shiftKey
      ? selectedIds.includes(tile.id)
        ? selectedIds.filter((id) => id !== tile.id)
        : [...selectedIds, tile.id]
      : selectedIds.includes(tile.id)
        ? selectedIds
        : [tile.id];
    setSelectedIds(nextSelection);
    if (event.shiftKey) return;
    event.preventDefault();
    if (snapClearTimerRef.current !== null) {
      window.clearTimeout(snapClearTimerRef.current);
      snapClearTimerRef.current = null;
    }
    setSnapGuides([]);
    setSnapTargetIds([]);
    const ids = new Set(nextSelection);
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      baseline: cloneProject(projectRef.current),
      positions: new Map(projectStackTiles(projectRef.current)
        .filter((candidate) => ids.has(candidate.id))
        .map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }])),
      locks: { x: null, y: null },
      guides: [],
      axisLock: null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const session = dragRef.current;
    const stage = stageRef.current;
    if (!session || !stage || session.pointerId !== event.pointerId) return;
    event.preventDefault();
    const rect = stage.getBoundingClientRect();
    let rawDx = ((event.clientX - session.startClientX) / Math.max(1, rect.width)) * STACK_STAGE.width;
    let rawDy = ((event.clientY - session.startClientY) / Math.max(1, rect.height)) * STACK_STAGE.height;
    if (event.shiftKey) {
      if (session.axisLock === null && Math.hypot(rawDx, rawDy) >= 4) {
        session.axisLock = Math.abs(rawDx) >= Math.abs(rawDy) ? 'x' : 'y';
      }
    } else {
      session.axisLock = null;
    }
    if (session.axisLock === 'x') rawDy = 0;
    if (session.axisLock === 'y') rawDx = 0;

    const snapped = solveSmartSnap({
      tiles: projectStackTiles(session.baseline),
      movingIds: [...session.positions.keys()],
      rawDx,
      rawDy,
      enabled: session.baseline.authoring.snap && !event.altKey,
      snapGapPx: session.baseline.authoring.snapGapPx,
      previousLocks: session.locks,
      threshold: (9 * STACK_STAGE.width) / Math.max(1, rect.width),
      releaseThreshold: (18 * STACK_STAGE.width) / Math.max(1, rect.width),
    });
    session.locks = snapped.locks;
    session.guides = snapped.guides;
    const next = cloneProject(session.baseline);
    const movedTiles = projectStackTiles(next).map((tile) => {
      const start = session.positions.get(tile.id);
      return start ? normalizeTile({ ...tile, x: start.x + snapped.dx, y: start.y + snapped.dy }) : tile;
    });
    replaceProjectStackTiles(next, movedTiles);
    next.updatedAt = new Date().toISOString();
    dispatch({ type: 'replace', value: next });
    setSnapGuides(snapped.guides);
    setSnapTargetIds(snapped.targetIds);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const session = dragRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const finalProject = cloneProject(projectRef.current);
    replaceProjectStackTiles(finalProject, projectStackTiles(finalProject).map((tile) => normalizeTile(tile)));
    finalProject.revision += 1;
    finalProject.updatedAt = new Date().toISOString();
    dispatch({ type: 'replace', value: finalProject });
    dispatch({ type: 'record-drag', baseline: session.baseline });
    dragRef.current = null;
    const labels = [...new Set(session.guides.map((guide) => guide.label))];
    setNotice(labels.length > 0
      ? `已吸附：${labels.join(' + ')}`
      : `已移动 ${session.positions.size} 张牌`);
    snapClearTimerRef.current = window.setTimeout(() => {
      setSnapGuides([]);
      setSnapTargetIds([]);
      snapClearTimerRef.current = null;
    }, labels.length > 0 ? 520 : 0);
  };

  const clientToStagePoint = (clientX: number, clientY: number): StackPoint | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(STACK_STAGE.width, ((clientX - rect.left) / Math.max(1, rect.width)) * STACK_STAGE.width)),
      y: Math.max(0, Math.min(STACK_STAGE.height, ((clientY - rect.top) / Math.max(1, rect.height)) * STACK_STAGE.height)),
    };
  };

  const beginMarquee = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement;
    if (event.button !== 0 || (event.target !== event.currentTarget && !target.closest('.tpt-scene-background'))) return;
    const start = clientToStagePoint(event.clientX, event.clientY);
    if (!start) return;
    event.preventDefault();
    const baselineSelection = event.shiftKey ? [...selectedRef.current] : [];
    marqueeRef.current = {
      pointerId: event.pointerId,
      start,
      baselineSelection,
      additive: event.shiftKey,
      moved: false,
    };
    if (!event.shiftKey) setSelectedIds([]);
    setMarquee(makeSelectionRect(start, start));
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveMarquee = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const session = marqueeRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const current = clientToStagePoint(event.clientX, event.clientY);
    if (!current) return;
    event.preventDefault();
    const rect = makeSelectionRect(session.start, current);
    if (!session.moved && Math.hypot(current.x - session.start.x, current.y - session.start.y) >= 4) {
      session.moved = true;
    }
    setMarquee(rect);
    if (!session.moved) return;
    const inside = tileIdsInsideSelection(projectStackTiles(projectRef.current), rect, layerFocus);
    setSelectedIds(session.additive ? [...new Set([...session.baselineSelection, ...inside])] : inside);
  };

  const finishMarquee = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const session = marqueeRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    marqueeRef.current = null;
    setMarquee(null);
    if (session.moved) {
      setNotice(`已框选 ${selectedRef.current.length} 张牌；拖动任意选中牌可整体移动`);
    } else if (!session.additive) {
      setNotice('已取消选择');
    }
  };

  const setAuthoringOption = <Key extends keyof TapTileProjectV2['authoring']>(
    key: Key,
    value: TapTileProjectV2['authoring'][Key],
  ): void => {
    if (workspaceMode === 'play' || workspaceMode === 'replay') return;
    commit((draft) => {
      draft.authoring[key] = value;
    });
  };

  const setProjectName = (name: string): void => commit((draft) => {
    draft.name = name;
  });

  const setSnapGapPx = (value: number): void => {
    const snapGapPx = normalizeTapTileSnapGapPx(value);
    setAuthoringOption('snapGapPx', snapGapPx);
    setNotice(`同层牌吸附缝隙已设为 ${formatTapTileSnapGapPx(snapGapPx)}`);
  };

  const setVisualTheme = (themeId: string): void => {
    if (!project.visuals.themes[themeId]) return;
    commit((draft) => {
      draft.visuals.selectedThemeId = themeId;
      if (themeId === CHAIN_COMBO_UI_THEME_ID) {
        randomizeChainComboFaceTheme(draft, `${draft.id}:${draft.revision + 1}`);
      }
    });
    setNotice(themeId === CHAIN_COMBO_UI_THEME_ID
      ? '已随机换成连消彩绘牌面；相同牌仍共用同一图案，匹配分组、阻挡图和 Take 不变'
      : '只更换牌面分组；匹配分组、阻挡图和 Take 不变');
  };

  const rerollChainComboFaces = (): void => {
    commit((draft) => {
      draft.visuals.selectedThemeId = CHAIN_COMBO_UI_THEME_ID;
      randomizeChainComboFaceTheme(draft, `${draft.id}:${draft.revision + 1}:reroll`);
    });
    setNotice('已重新随机连消彩绘牌面；三消关系未改变');
  };

  const setDirectorProfile = (profileId: string): void => {
    if (!project.director.profiles[profileId]) return;
    commit((draft) => {
      draft.director.selectedProfileId = profileId;
    });
    setDirectorFrame(0);
    setNotice(`已切换导演 Profile：${project.director.profiles[profileId]?.name ?? profileId}；玩法哈希不变`);
  };

  const setDirectorSeed = (seed: number): void => {
    commit((draft) => {
      draft.director.seed = Math.max(0, Math.trunc(seed));
    });
  };

  const patchDirectorTiming = (patch: Partial<TapTileDirectorTiming> & { betweenActionFrames?: number }): void => {
    commit((draft) => {
      const id = draft.director.selectedProfileId;
      const current = draft.director.profiles[id];
      if (!current) return;
      const { betweenActionFrames, ...timingPatch } = patch;
      draft.director.profiles[id] = {
        ...current,
        ...(betweenActionFrames !== undefined ? { betweenActionFrames } : {}),
        timing: { ...current.timing, ...timingPatch },
      };
    });
  };

  const showDirectorTake = (take: TapTileTake, options?: { play?: boolean; notice?: string }): void => {
    const validation = gameplay.openReplay(compiledLevel, take);
    setWorkspaceMode('direct');
    setDirectorFrame(0);
    setDirectorPlaying(Boolean(options?.play) && validation.valid);
    setNotice(options?.notice ?? (validation.valid
      ? `导演时间线已打开：${take.name}`
      : validation.issues[0]?.message ?? 'Take 无效'));
  };

  const seekDirectorFrame = (frame: number): void => {
    if (!tapTileUsesDirectorCanvas(workspaceMode)) {
      setWorkspaceMode('direct');
      setDirectorPlaying(false);
    }
    setDirectorFrame(frame);
  };

  const toggleDirectorPlayback = (): void => {
    if (!compiledDirector) return;
    if (!tapTileUsesDirectorCanvas(workspaceMode)) {
      setWorkspaceMode('direct');
      if (directorFrame >= compiledDirector.totalFrames - 1) setDirectorFrame(0);
      setDirectorPlaying(true);
      return;
    }
    if (!directorPlaying && directorFrame >= compiledDirector.totalFrames - 1) setDirectorFrame(0);
    setDirectorPlaying((current) => !current);
  };

  const cancelPlay = (): void => {
    clearLiveMatchEffects();
    setDirectorPlaying(false);
    setWorkspaceMode('edit');
    setNotice('已取消本次试玩，未保存 Take');
  };

  const setRenderQuality = (quality: TapTileProjectV2['render']['quality']): void => {
    commit((draft) => {
      draft.render.quality = quality;
    });
  };

  const selectTake = (takeId: string): void => {
    const take = project.takes.find((candidate) => candidate.id === takeId);
    if (!take) return;
    commit((draft) => {
      draft.selectedTakeId = takeId;
    });
    showDirectorTake(take, { notice: `已打开 Take：${take.name}` });
  };

  const deleteTake = (takeId: string): void => {
    commit((draft) => {
      draft.takes = draft.takes.filter((take) => take.id !== takeId);
      if (draft.selectedTakeId === takeId) {
        const nextId = draft.takes.at(-1)?.id;
        if (nextId) draft.selectedTakeId = nextId;
        else delete draft.selectedTakeId;
      }
    });
    setNotice('Take 已删除');
  };

  const enterDirectorReplay = (): void => {
    const take = project.takes.find((candidate) => candidate.id === project.selectedTakeId) ?? project.takes.at(-1);
    if (!take) {
      setNotice('还没有可回放的 Take；请先完成一次试玩并保存');
      return;
    }
    showDirectorTake(take, {
      notice: compiledDirector
        ? `导演时间线已编译：${compiledDirector.totalFrames} 帧`
        : `已打开 Take：${take.name}`,
    });
  };

  const setDirectorTimingOverride = (
    actionId: string,
    key: keyof TapTileDirectorTiming,
    value: number,
  ): void => {
    if (!Number.isFinite(value)) return;
    commit((draft) => {
      draft.director.actionOverrides[actionId] = {
        ...draft.director.actionOverrides[actionId],
        [key]: Math.max(0, Math.round(value)),
      };
    });
    setNotice(`已覆盖动作 ${actionId} 的 ${key}`);
  };

  const resetDirectorTimingOverride = (actionId: string): void => {
    commit((draft) => {
      delete draft.director.actionOverrides[actionId];
    });
    setNotice(`已重置动作 ${actionId} 的节奏覆盖`);
  };

  const beginTapTileExport = async (): Promise<void> => {
    if (!compiledDirector || !selectedDirectorTake || tapTileExportAbortRef.current) {
      if (!compiledDirector) setNotice('导出前需要一个有效 Take 与导演时间线');
      return;
    }
    const previewProof = directorPreviewState?.status === 'ready'
      && directorPreviewState.proof?.frameNumber === directorPresentation?.frameNumber
      ? directorPreviewState.proof
      : null;
    if (!previewProof) {
      setTapTileExportError('正式预览帧尚未完成，无法证明导演画面与导出一致。请等待当前帧显示“已锁定”。');
      setNotice('请等待正式预览帧渲染完成后再导出');
      return;
    }
    if (tapTileExportResult?.url) URL.revokeObjectURL(tapTileExportResult.url);
    setTapTileExportResult(null);
    setTapTileExportError('');
    setWorkspaceMode('export');
    setDirectorPlaying(false);
    setTapTileExportProgress({ phase: 'preparing', currentFrame: 0, totalFrames: compiledDirector.totalFrames, ratio: 0, message: '正在核对导演画面与正式导出像素…' });
    const controller = new AbortController();
    tapTileExportAbortRef.current = controller;
    const job = createTapTileRenderJob(project, compiledLevel, compiledDirector);
    try {
      const exportProof = await renderTapTileFrameProof(job, previewProof.frameNumber);
      assertTapTileFrameProofsMatch(previewProof, exportProof);
      const preflight = await preflightTapTileRenderJob(job);
      if (!preflight.valid) throw new Error(preflight.issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n'));
      const fileName = `${safeFileName(project.name)}-${safeFileName(selectedDirectorTake.name)}-${compiledDirector.profileId}-1080x1920.mp4`;
      const qualityProfile = resolveTapTileVideoQualityProfile(project.render.quality);
      const result = await exportFixedFrameVideo(job, {
        bitrate: qualityProfile.videoBitrate,
        renderScale: qualityProfile.renderScale,
        fileName,
        signal: controller.signal,
        onProgress: setTapTileExportProgress,
        keyFrameIntervalSeconds: qualityProfile.keyFrameIntervalSeconds,
        visualVerification: { frameIndexes: renderRegressionFrames.map((frame) => frame.frameNumber) },
        metadata: {
          title: `${project.name} · ${selectedDirectorTake.name}`,
          artist: 'Melo Game Creative Studio',
          comment: `TapTile deterministic render · ${preflight.identity.levelHash} · ${preflight.identity.finalStateHash} · ${preflight.identity.skinHash} · ${preflight.identity.directorHash} · frame ${exportProof.frameNumber} ${exportProof.pixelHash}`,
        },
      });
      const url = URL.createObjectURL(result.blob);
      setTapTileExportResult({
        url,
        fileName: result.fileName,
        bytes: result.blob.size,
        frameCount: result.frameCount,
        durationSeconds: result.durationSeconds,
        verifiedFrame: exportProof.frameNumber,
        verifiedPixelHash: exportProof.pixelHash,
        renderIdentityHash: exportProof.renderIdentityHash,
        containerVerified: result.verification.containerReadable,
        actualFps: result.verification.averageFrameRate,
        actualVideoBitrate: result.verification.averageVideoBitrate,
        minimumVisualPsnrDb: Math.min(...(result.verification.visual?.samples.map((sample) => sample.psnrDb) ?? [0])),
      });
      setNotice(`MP4 已完成：${result.frameCount} 帧 · ${result.durationSeconds.toFixed(2)} 秒 · 导演/导出像素校验通过`);
    } catch (error) {
      const canceled = error instanceof DOMException && error.name === 'AbortError';
      setTapTileExportError(canceled ? '导出已取消；工程和 Take 未改变。' : error instanceof Error ? error.message : String(error));
      setNotice(canceled ? '已安全取消导出' : '导出失败；工程未发生修改');
      await job.dispose?.();
    } finally {
      tapTileExportAbortRef.current = null;
    }
  };

  const cancelTapTileExport = (): void => {
    tapTileExportAbortRef.current?.abort();
  };

  const beginPlay = (): void => {
    if (!compiledLevel.validation.valid) {
      setWorkspaceMode('validate');
      const firstError = compiledLevel.validation.issues.find((issue) => issue.severity === 'error');
      setNotice(firstError ? `${firstError.code}：${firstError.message}` : '关卡未通过验证');
      return;
    }
    if (!selectedSkinCompatibility.valid) {
      const firstError = selectedSkinCompatibility.issues.find((issue) => issue.severity === 'error');
      setNotice(firstError ? `${firstError.code}：${firstError.message}` : '当前视觉主题无法清楚表达匹配分组');
      return;
    }
    setDirectorPlaying(false);
    clearLiveMatchEffects();
    gameplay.begin(compiledLevel);
    setSelectedIds([]);
    setWorkspaceMode('play');
    setNotice(`试玩已冻结关卡 ${compiledLevel.levelHash}`);
  };

  const saveCurrentTake = (): void => {
    const token = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${gameplay.recordedActions.length}`;
    const take = gameplay.finish(`take-${token}`, `真人 Take ${project.takes.length + 1}`);
    if (!take) {
      setNotice('至少完成一次合法点击后才能保存 Take');
      return;
    }
    commit((draft) => {
      draft.takes.push(take);
      draft.selectedTakeId = take.id;
    });
    showDirectorTake(take, {
      notice: `Take 已保存并通过确定性重放：${take.finalStateHash}`,
    });
  };

  const generateAgentTake = async (): Promise<void> => {
    if (agentBusy) {
      agentSearchAbortRef.current?.abort();
      setNotice('正在停止搜索；如已有三消，将直接采用当前最佳安全轨迹…');
      return;
    }
    if (!compiledLevel.validation.valid) {
      setWorkspaceMode('validate');
      setNotice('Agent 只接受通过关卡校验的编译结果');
      return;
    }
    const controller = new AbortController();
    agentSearchAbortRef.current = controller;
    setAgentBusy(true);
    setAgentProgress(null);
    const strength = AGENT_SEARCH_STRENGTHS.find((candidate) => candidate.id === agentSearchStrength)
      ?? AGENT_SEARCH_STRENGTHS[1];
    const beamWidth = Math.max(1, Math.round(agentBaseBeamWidth(agentProfile) * strength.beamScale));
    const searchLevelHash = compiledLevel.levelHash;
    setNotice(`Agent 正在按“${TAPTILE_SCENARIO_PROFILES.find((profile) => profile.id === agentProfile)?.name ?? agentProfile}”搜索 · ${strength.label}强度…`);
    try {
      const result = await solveTapTileTakeAnytime(compiledLevel, {
        profile: agentProfile,
        seed: project.director.seed,
        beamWidth,
        maxExpandedStates: strength.maxExpandedStates,
        timeBudgetMs: strength.timeBudgetMs,
        yieldEvery: 256,
        signal: controller.signal,
        onProgress: (progress) => {
          if (agentSearchAbortRef.current === controller) setAgentProgress(progress);
        },
      });
      if (compileTapTileLevel(projectRef.current).levelHash !== searchLevelHash) {
        setNotice('关卡在搜索期间已改变，旧轨迹已安全丢弃');
        return;
      }
      if ((result.status !== 'solved' && result.status !== 'partial') || !result.take || !result.validation?.valid) {
        setNotice(result.diagnostic ?? 'Agent 在当前搜索预算内未找到目标路径');
        return;
      }
      commit((draft) => {
        draft.takes = draft.takes.filter((take) => take.id !== result.take!.id);
        draft.takes.push(result.take!);
        draft.selectedTakeId = result.take!.id;
      });
      if (agentProfile === 'max-clear' && result.metrics) {
        setAgentRunSummary({
          takeId: result.take.id,
          clearedTileCount: result.metrics.clearedTileCount,
          totalTileCount: compiledLevel.initialBoardIds.length,
          theoreticalClearableTileCount: result.metrics.theoreticalClearableTileCount,
          peakTrayOccupancy: result.metrics.peakTrayOccupancy,
          provedMaximum: result.metrics.provedMaximum,
          expandedStates: result.expandedStates,
          ...(result.terminationReason ? { terminationReason: result.terminationReason } : {}),
        });
      } else {
        setAgentRunSummary(null);
      }
      const stoppedLabel = result.terminationReason === 'canceled'
        ? ' · 已停止并采用当前最佳'
        : result.terminationReason === 'time-budget'
          ? ' · 时间预算内最佳'
          : result.metrics?.provedMaximum
            ? ' · 已证明达到数量上限'
            : ' · 当前搜索预算内最佳';
      showDirectorTake(result.take, {
        play: true,
        notice: agentProfile === 'max-clear' && result.metrics
          ? `最大消除轨迹已生成：${result.metrics.clearedTileCount}/${compiledLevel.initialBoardIds.length} 张 · 理论上限 ${result.metrics.theoreticalClearableTileCount} · 槽位峰值 ${result.metrics.peakTrayOccupancy}/7${stoppedLabel}`
          : `${result.take.name} 已由正式引擎重放验证 · ${result.expandedStates} 个展开状态`,
      });
    } catch (error) {
      setNotice(error instanceof Error ? `Agent 搜索失败：${error.message}` : 'Agent 搜索失败');
    } finally {
      if (agentSearchAbortRef.current === controller) {
        agentSearchAbortRef.current = null;
        setAgentBusy(false);
      }
    }
  };

  const switchWorkspaceMode = (mode: TapTileWorkspaceMode): void => {
    if (!tapTileUsesDirectorCanvas(mode)) setDirectorPlaying(false);
    if (mode === 'play') {
      beginPlay();
      return;
    }
    if (mode === 'replay') {
      enterDirectorReplay();
      return;
    }
    clearLiveMatchEffects();
    setWorkspaceMode(mode);
    if (mode === 'validate') {
      const errors = compiledLevel.validation.issues.filter((issue) => issue.severity === 'error').length;
      setNotice(errors === 0 ? `关卡有效 · ${compiledLevel.levelHash}` : `发现 ${errors} 个阻塞错误`);
    } else if (mode === 'direct') {
      setDirectorFrame(0);
      setNotice(compiledDirector ? `导演时间线已编译：${compiledDirector.totalFrames} 帧` : '还没有有效 Take；请先试玩保存或让 Agent 生成');
    } else if (mode === 'export') {
      setDirectorFrame(0);
      setNotice(compiledDirector ? '导出会冻结当前 Skin 与 Director，并输出 1080×1920、30fps H.264 MP4' : '导出前需要已保存 Take');
    } else {
      setNotice('已返回可编辑工程；试玩状态未写回布局');
    }
  };

  const tapGameplayTile = (event: ReactPointerEvent<HTMLButtonElement>, tile: StackTile): void => {
    event.preventDefault();
    event.stopPropagation();
    const rect = stageRef.current?.getBoundingClientRect();
    const transition = gameplay.tapTile(tile.id, rect ? {
      x: (event.clientX - rect.left) / Math.max(1, rect.width),
      y: (event.clientY - rect.top) / Math.max(1, rect.height),
    } : undefined);
    if (!transition) return;
    if (!transition.accepted) {
      setRejectedTileId(tile.id);
      if (rejectClearTimerRef.current !== null) window.clearTimeout(rejectClearTimerRef.current);
      rejectClearTimerRef.current = window.setTimeout(() => setRejectedTileId(null), 420);
      setNotice(transition.rejectReason === 'blocked'
        ? `不可点击：仍被 ${(transition.blockerIds ?? []).join('、')} 阻挡`
        : `点击被拒绝：${transition.rejectReason}`);
      return;
    }
    if (transition.matchedTileIds.length > 0) {
      const effect: GameplayMatchEffect = {
        id: transition.action.id,
        tileIds: [...transition.matchedTileIds],
        slotIndexes: transition.matchedTileIds.map((tileId) => transition.trayAfterInsert.indexOf(tileId)),
      };
      setLiveMatchEffects((current) => [...current.filter((candidate) => candidate.id !== effect.id), effect]);
      const previousTimer = liveMatchTimersRef.current.get(effect.id);
      if (previousTimer !== undefined) window.clearTimeout(previousTimer);
      liveMatchTimersRef.current.set(effect.id, window.setTimeout(() => {
        liveMatchTimersRef.current.delete(effect.id);
        setLiveMatchEffects((current) => current.filter((candidate) => candidate.id !== effect.id));
      }, 820));
    }
    if (transition.terminal === 'won') setNotice('关卡胜利；请保存 Take');
    else if (transition.terminal === 'lost') setNotice('槽位结算后失败；可保存失败 Take 或重新开始');
    else if (transition.matchedTileIds.length > 0) setNotice(`已完成三消：${transition.matchedTileIds.join('、')}`);
    else if (transition.newlyUnlockedTileIds.length > 0) setNotice(`新解锁 ${transition.newlyUnlockedTileIds.length} 张牌`);
    else setNotice(`已记录动作 ${gameplay.recordedActions.length + 1}`);
  };

  const selectValidationTile = (event: ReactPointerEvent<HTMLButtonElement>, tile: StackTile): void => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedIds((current) => event.shiftKey
      ? current.includes(tile.id) ? current.filter((id) => id !== tile.id) : [...current, tile.id]
      : [tile.id]);
  };

  const updatePairOverride = (kind: 'ignored' | 'forced'): void => {
    const pair = tiles.filter((tile) => selectedIds.includes(tile.id));
    if (pair.length !== 2) {
      setNotice('请用 Shift 选择两张不同层级的牌');
      return;
    }
    const [lower, upper] = [...pair].sort((left, right) => left.layer - right.layer);
    if (!lower || !upper || lower.layer === upper.layer) {
      setNotice('同层牌不互相阻挡；请先调整层级');
      return;
    }
    const edge = { blockerId: upper.id, blockedId: lower.id };
    commit((draft) => {
      const target = draft.level.blockerOverrides[kind];
      const exists = target.some((candidate) => candidate.blockerId === edge.blockerId && candidate.blockedId === edge.blockedId);
      draft.level.blockerOverrides[kind] = exists
        ? target.filter((candidate) => candidate.blockerId !== edge.blockerId || candidate.blockedId !== edge.blockedId)
        : [...target, edge];
      const other = kind === 'ignored' ? 'forced' : 'ignored';
      draft.level.blockerOverrides[other] = draft.level.blockerOverrides[other]
        .filter((candidate) => candidate.blockerId !== edge.blockerId || candidate.blockedId !== edge.blockedId);
    });
    setNotice(`${kind === 'ignored' ? '忽略' : '强制'}阻挡 ${upper.id} → ${lower.id} 已切换`);
  };

  const importProject = async (file: File): Promise<void> => {
    const parsed: unknown = JSON.parse(await file.text());
    const imported = isTapTileProjectV2(parsed)
      ? ensureTapTileProductionDefaults(parseTapTileProjectV2(parsed))
      : isStackProject(parsed)
        ? migrateTapTileStackProjectV1(parsed)
        : null;
    if (!imported) throw new Error('不是可识别的 TapTile V2 或旧版工程。');
    const next = fitProjectBelowTopTray(imported);
    dispatch({ type: 'commit', value: next });
    setSelectedIds([]);
    setLayerFocus('all');
    setNotice(isTapTileProjectV2(parsed) ? 'V2 工程已导入' : '旧工程已迁移为 V2；原文件未改动');
  };

  const liveTrayCount = displayState?.trayIds.length ?? 0;
  const liveStatus = displayState?.status ?? (compiledLevel.validation.valid ? 'ready' : 'blocked');

  return (
    <div
      className={`studio-app taptile-studio tpt-studio is-${sessionMode} mode-${workspaceMode} debug-${workspaceMode === 'play' ? 'normal' : project.authoring.debugView} theme-${project.authoring.sceneTheme} material-${project.authoring.material}`}
      style={TAPTILE_STUDIO_STYLE}
      data-level-hash={compiledLevel.levelHash}
      data-state-hash={displayState ? tapTileStateHash(displayState) : ''}
      data-selected-theme={project.visuals.selectedThemeId}
      data-director-profile={compiledDirector?.profileId ?? ''}
      data-director-frame={directorPresentation?.frameNumber ?? ''}
      data-play-display-mode={playDisplayMode}
      data-face-offset-x={project.authoring.faceOffsetX}
      data-face-offset-y={project.authoring.faceOffsetY}
    >
      <Toolbar
        projectName={project.name}
        mode={sessionMode}
        hasTake={project.takes.length > 0}
        playEnabled={compiledLevel.validation.valid && selectedSkinCompatibility.valid}
        agentEnabled={compiledLevel.validation.valid}
        onProjectName={setProjectName}
        onEdit={() => switchWorkspaceMode('edit')}
        onPlay={beginPlay}
        onReplay={enterDirectorReplay}
        onAgent={() => { void generateAgentTake(); }}
        onExportProject={() => downloadProject(project)}
        onImportProject={importProject}
      />

      <main className="studio-workspace">
        <TapTileAssetPanel
          project={project}
          matchGroupPreviews={matchGroupPreviews}
          selectedSkinCompatibility={selectedSkinCompatibility}
          selectedTakeId={selectedDirectorTake?.id ?? null}
          setupEditable={workspaceMode === 'edit'}
          takesLocked={workspaceMode === 'play' || workspaceMode === 'export'}
          lookLocked={workspaceMode === 'play' || workspaceMode === 'replay' || workspaceMode === 'direct'}
          onTemplate={chooseTemplate}
          onSceneTheme={(id) => setAuthoringOption('sceneTheme', id)}
          onVisualTheme={setVisualTheme}
          onRerollFaces={rerollChainComboFaces}
          onMaterial={(id) => setAuthoringOption('material', id)}
          onFaceOffset={(axis, value) => {
            setAuthoringOption(
              axis === 'x' ? 'faceOffsetX' : 'faceOffsetY',
              normalizeTapTileFaceOffset(value),
            );
          }}
          onChooseFace={chooseFace}
          onSelectTake={selectTake}
          onDeleteTake={deleteTake}
        />

        <section className="stage-column">
          <div className="stage-header">
            <div>
              <span className="eyebrow">REFERENCE-FIRST CREATIVE CANVAS</span>
              <h1>{STAGE_COPY[sessionMode].title}</h1>
            </div>
            <div className="stage-metrics">
              <span><strong>{tiles.length}</strong>牌块</span>
              <span><strong>{usedLayers.length}</strong>层</span>
              <span><strong>{selectedDirectorTake?.actions.length ?? gameplay.recordedActions.length}</strong>动作</span>
            </div>
          </div>
          <div className="tpt-stage-toolbar">
            <div className="tpt-tool-group tpt-authoring-tools">
              <button disabled={workspaceMode !== 'edit' || history.past.length === 0} onClick={() => dispatch({ type: 'undo' })} title="Ctrl+Z">↶ 撤销</button>
              <button disabled={workspaceMode !== 'edit' || history.future.length === 0} onClick={() => dispatch({ type: 'redo' })} title="Ctrl+Y">↷ 重做</button>
              <button
                className={`tpt-magnet-button${project.authoring.snap ? ' is-active' : ''}`}
                disabled={workspaceMode !== 'edit'}
                onClick={() => {
                  setAuthoringOption('snap', !project.authoring.snap);
                  setSnapGuides([]);
                  setSnapTargetIds([]);
                }}
                title="识别中心、边缘、两牌中线与等距轨道"
              ><span aria-hidden="true">⌁</span> 智能吸附</button>
              <div className="tpt-snap-gap-control" role="group" aria-label="同层牌吸附缝隙">
                <span>缝隙</span>
                <button
                  type="button"
                  disabled={workspaceMode !== 'edit' || project.authoring.snapGapPx <= MIN_TAPTILE_SNAP_GAP_PX}
                  onClick={() => setSnapGapPx(project.authoring.snapGapPx - 1)}
                  title="最终成片中的吸附缝隙减小 1 像素"
                >−1</button>
                <button
                  type="button"
                  className={project.authoring.snapGapPx === 0 ? 'is-default' : ''}
                  disabled={workspaceMode !== 'edit'}
                  onClick={() => setSnapGapPx(0)}
                  title="恢复最终成片默认缝隙 0 像素"
                >{formatTapTileSnapGapPx(project.authoring.snapGapPx)}</button>
                <button
                  type="button"
                  disabled={workspaceMode !== 'edit' || project.authoring.snapGapPx >= MAX_TAPTILE_SNAP_GAP_PX}
                  onClick={() => setSnapGapPx(project.authoring.snapGapPx + 1)}
                  title="最终成片中的吸附缝隙增大 1 像素"
                >+1</button>
              </div>
              <button onClick={selectAllVisible} disabled={workspaceMode !== 'edit' || visibleTileIds.length === 0} title="Ctrl+A">全选</button>
              <button onClick={clearSelection} disabled={selectedIds.length === 0} title="Esc">取消选择</button>
              <button onClick={duplicateSelected} disabled={workspaceMode !== 'edit' || selectedIds.length === 0}>＋ 复制</button>
              <button onClick={deleteSelected} disabled={workspaceMode !== 'edit' || selectedIds.length === 0}>⌫ 删除</button>
              <button
                onClick={() => updateSelected((tile) => ({ ...tile, layer: tile.layer + 1 }))}
                disabled={workspaceMode !== 'edit' || selectedIds.length === 0}
              >层 +1</button>
              <button
                onClick={() => updateSelected((tile) => ({ ...tile, layer: Math.max(0, tile.layer - 1) }))}
                disabled={workspaceMode !== 'edit' || selectedIds.length === 0}
              >层 −1</button>
            </div>
            <div className={`tpt-snap-readout${snapGuides.length > 0 ? ' is-active' : ''}`} aria-live="polite">
              <i aria-hidden="true">⌁</i>
              <span>{snapGuides.length > 0
                ? [...new Set(snapGuides.map((guide) => guide.label))].join(' · ')
                : project.authoring.snap ? `等待吸附 · ${formatTapTileSnapGapPx(project.authoring.snapGapPx)}` : '吸附已关闭'}</span>
            </div>
            <div className="tpt-tool-group tpt-layer-filter">
              <span>查看</span>
              <button className={layerFocus === 'all' ? 'is-active' : ''} onClick={() => setLayerFocus('all')}>全部</button>
              {usedLayers.map((layer) => (
                <button key={layer} className={layerFocus === layer ? 'is-active' : ''} onClick={() => setLayerFocus(layer)}>{layer + 1}</button>
              ))}
              {workspaceMode === 'play' ? (
                <div className="tpt-play-display-control" role="group" aria-label="试玩显示模式">
                  <span>试玩显示</span>
                  {TAPTILE_PLAY_DISPLAY_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      data-play-display-option={mode.id}
                      className={playDisplayMode === mode.id ? 'is-active' : ''}
                      aria-pressed={playDisplayMode === mode.id}
                      title={mode.description}
                      onClick={() => {
                        setPlayDisplayMode(mode.id);
                        setNotice(mode.description);
                      }}
                    >{mode.label}</button>
                  ))}
                </div>
              ) : (
                <select
                  aria-label="调试视图"
                  value={project.authoring.debugView}
                  onChange={(event) => setAuthoringOption('debugView', event.target.value as TapTileProjectV2['authoring']['debugView'])}
                  disabled={workspaceMode === 'replay'}
                >
                  <option value="normal">普通</option>
                  <option value="playability">可点击态</option>
                  <option value="blockers">阻挡关系</option>
                  <option value="single-layer">单层</option>
                </select>
              )}
            </div>
          </div>

          {(!compiledLevel.validation.valid || workspaceMode === 'validate') && (
            <div className={`tpt-validation-banner${compiledLevel.validation.valid ? ' is-valid' : ' is-invalid'}`}>
              <strong>{compiledLevel.validation.valid ? '关卡有效，可以试玩' : '关卡存在阻塞错误'}</strong>
              <span>{compiledLevel.validation.statistics.tileCount} 张牌 · {compiledLevel.validation.statistics.edgeCount} 条阻挡边 · {compiledLevel.validation.statistics.playableCount} 张初始可点</span>
              <small>{compiledLevel.levelHash}</small>
            </div>
          )}

          <div className="stage-frame tpt-stage-shell">
            <div
              ref={stageRef}
              className={`phone-frame tpt-phone-stage${tapTileUsesDirectorCanvas(workspaceMode) && compiledDirector && directorPresentation ? ' is-canvas-authoritative' : ''}`}
              data-render-source={tapTileUsesDirectorCanvas(workspaceMode) && compiledDirector ? 'fixed-frame-canvas' : 'interactive-dom'}
              onPointerDown={workspaceMode === 'edit' ? beginMarquee : undefined}
              onPointerMove={workspaceMode === 'edit' ? moveMarquee : undefined}
              onPointerUp={workspaceMode === 'edit' ? finishMarquee : undefined}
              onPointerCancel={workspaceMode === 'edit' ? finishMarquee : undefined}
            >
              <div className="tpt-scene-background" aria-hidden="true">
                <i className="scene-cloud cloud-one" />
                <i className="scene-cloud cloud-two" />
                <i className="scene-island island-one" />
                <i className="scene-island island-two" />
              </div>
              <div className="tpt-hud" aria-hidden="true">
                <button tabIndex={-1}>↶</button>
                <button tabIndex={-1}>⚙</button>
                <strong>LEVEL 07</strong>
                <div className="tpt-logo"><span>TAP</span><b>TILE</b></div>
              </div>
              {displayState ? (
                <GameplayTray
                  trayIds={displayState.trayIds}
                  status={displayState.status}
                  renderTile={(tileId) => {
                    const archetypeId = compiledLevel.tiles[tileId]?.archetypeId;
                    return archetypeId
                      ? <TileVisual visual={resolveTileVisual(project, archetypeId, project.visuals.selectedThemeId, 'tray')} />
                      : <span className="tpt-face-missing">!</span>;
                  }}
                />
              ) : (
                <GameplayTray trayIds={[]} status="playing" renderTile={() => null} />
              )}
              {workspaceMode === 'play' && (
                <GameplayMatchEffects
                  effects={liveMatchEffects}
                  stageWidth={project.stage.exportWidth}
                  stageHeight={project.stage.exportHeight}
                  renderTile={(tileId) => {
                    const archetypeId = compiledLevel.tiles[tileId]?.archetypeId;
                    return archetypeId
                      ? <TileVisual visual={resolveTileVisual(project, archetypeId, project.visuals.selectedThemeId, 'match-ghost')} />
                      : null;
                  }}
                />
              )}
              <div className="tpt-safe-area" aria-hidden="true"><span>游戏区域</span></div>

              {(workspaceMode === 'validate' || (workspaceMode !== 'play' && project.authoring.debugView === 'blockers')) && (
                <svg className="tpt-blocker-graph" viewBox={`0 0 ${STACK_STAGE.width} ${STACK_STAGE.height}`} aria-hidden="true">
                  <defs>
                    <marker id="tpt-blocker-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                      <path d="M0,0 L7,3.5 L0,7 Z" />
                    </marker>
                  </defs>
                  {compiledLevel.blockerEdges.map((edge) => {
                    const blocker = tiles.find((tile) => tile.id === edge.blockerId);
                    const blocked = tiles.find((tile) => tile.id === edge.blockedId);
                    if (!blocker || !blocked) return null;
                    const emphasized = selectedIds.length === 0 || selectedIds.includes(edge.blockerId) || selectedIds.includes(edge.blockedId);
                    return (
                      <line
                        key={`${edge.blockerId}-${edge.blockedId}`}
                        data-blocker-id={edge.blockerId}
                        data-blocked-id={edge.blockedId}
                        x1={blocker.x}
                        y1={blocker.y}
                        x2={blocked.x}
                        y2={blocked.y}
                        className={`${edge.source === 'forced' ? 'is-forced' : 'is-automatic'}${emphasized ? ' is-emphasized' : ''}`}
                        markerEnd="url(#tpt-blocker-arrow)"
                      />
                    );
                  })}
                </svg>
              )}

              {marquee && (
                <div
                  className="tpt-selection-marquee"
                  style={{
                    left: `${(marquee.left / STACK_STAGE.width) * 100}%`,
                    top: `${(marquee.top / STACK_STAGE.height) * 100}%`,
                    width: `${(marquee.width / STACK_STAGE.width) * 100}%`,
                    height: `${(marquee.height / STACK_STAGE.height) * 100}%`,
                  }}
                  aria-hidden="true"
                />
              )}

              {snapGuides.map((guide) => (
                <div
                  key={`${guide.axis}-${guide.kind}-${guide.value}`}
                  className={`tpt-snap-guide is-${guide.axis} kind-${guide.kind}`}
                  data-snap-kind={guide.kind}
                  style={guide.axis === 'x'
                    ? { left: `${(guide.value / STACK_STAGE.width) * 100}%` }
                    : { top: `${(guide.value / STACK_STAGE.height) * 100}%` }}
                  aria-hidden="true"
                >
                  <span>{guide.label}</span>
                </div>
              ))}

              <div className="tpt-board-layer">
              {displayedTiles.map((tile) => {
                const layerRank = layerRanks.get(tile.layer) ?? 0;
                const dimmed = layerFocus !== 'all' && tile.layer !== layerFocus;
                const shadowOffsetY = 3.2 + Math.min(4, layerRank) * 0.6;
                const shadowOpacity = 0.62 + Math.min(4, layerRank) * 0.055;
                return (
                  <span
                    key={`depth-shadow-${tile.id}`}
                    className={`tpt-tile-depth-shadow material-${project.authoring.material}${dimmed ? ' is-dimmed' : ''}`}
                    data-depth-layer={tile.layer}
                    style={{
                      left: `${(tile.x / STACK_STAGE.width) * 100}%`,
                      top: `${(tile.y / STACK_STAGE.height) * 100}%`,
                      width: `${((STACK_STAGE.tileSize * tile.scale) / STACK_STAGE.width) * 100}%`,
                      zIndex: 100 + layerRank * 2,
                      transform: `translate(-50%, -50%) rotate(${tile.rotation}deg) translate(1%, ${shadowOffsetY}%) scale(0.97)`,
                      '--tile-depth-shadow-blur': `${1.4 + Math.min(4, layerRank) * 0.3}px`,
                      '--tile-depth-shadow-opacity': shadowOpacity,
                    } as CSSProperties}
                    aria-hidden="true"
                  />
                );
              })}
              {displayedTiles.map((tile) => {
                const selected = selectedIds.includes(tile.id);
                const dimmed = layerFocus !== 'all' && tile.layer !== layerFocus;
                const snapTarget = snapTargetIds.includes(tile.id);
                const playable = displayedPlayableIds.has(tile.id);
                const playTreatment = tapTilePlayDisplayTreatment(playDisplayMode, playable);
                const related = primaryTile
                  ? (compiledLevel.blockersByTile[primaryTile.id] ?? []).includes(tile.id)
                    || (compiledLevel.dependentsByTile[primaryTile.id] ?? []).includes(tile.id)
                  : false;
                const archetypeId = compiledLevel.tiles[tile.id]?.archetypeId;
                const tileVisual = archetypeId
                  ? resolveTileVisual(project, archetypeId, project.visuals.selectedThemeId, 'board')
                  : null;
                return (
                  <button
                    key={tile.id}
                    type="button"
                    data-tile-id={tile.id}
                    data-match-key={tile.faceId}
                    data-playable={playable ? 'true' : 'false'}
                    className={`stack-tile${selected ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}${tile.locked ? ' is-locked' : ''}${snapTarget ? ' is-snap-target' : ''}${playable ? ' is-playable' : ' is-game-blocked'}${workspaceMode === 'play' && playTreatment.dimmed ? ' is-play-display-dimmed' : ''}${workspaceMode === 'play' && playTreatment.highlighted ? ' is-play-display-highlighted' : ''}${related ? ' is-blocker-related' : ''}${rejectedTileId === tile.id ? ' is-rejected' : ''}`}
                    aria-label={`${faceGlyph(project, tile.faceId)} 第 ${tile.layer + 1} 层`}
                    style={{
                      left: `${(tile.x / STACK_STAGE.width) * 100}%`,
                      top: `${(tile.y / STACK_STAGE.height) * 100}%`,
                      width: `${((STACK_STAGE.tileSize * tile.scale) / STACK_STAGE.width) * 100}%`,
                      zIndex: 101 + (layerRanks.get(tile.layer) ?? 0) * 2,
                      transform: `translate(-50%, -50%) rotate(${tile.rotation}deg)`,
                      '--tile-accent': faceAccent(tile.faceId),
                    } as React.CSSProperties}
                    onPointerDown={(event) => {
                      if (workspaceMode === 'edit') beginDrag(event, tile);
                      else if (workspaceMode === 'validate') selectValidationTile(event, tile);
                      else if (workspaceMode === 'play') tapGameplayTile(event, tile);
                      else event.preventDefault();
                    }}
                    onPointerMove={workspaceMode === 'edit' ? moveDrag : undefined}
                    onPointerUp={workspaceMode === 'edit' ? finishDrag : undefined}
                    onPointerCancel={workspaceMode === 'edit' ? finishDrag : undefined}
                    onDoubleClick={(event) => {
                      if (workspaceMode !== 'edit') return;
                      event.stopPropagation();
                      if (!selectedIds.includes(tile.id)) setSelectedIds([tile.id]);
                      window.setTimeout(duplicateSelected, 0);
                    }}
                  >
                    <span
                      className="tile-body"
                      style={tileVisual ? {
                        backgroundColor: tileVisual.bodyStyle.fill,
                        backgroundImage: tileVisual.bodyAsset?.uri ? `url("${tileVisual.bodyAsset.uri}")` : undefined,
                        borderRadius: `${tileVisual.bodyStyle.cornerRadiusPx / 2.5}px`,
                        borderWidth: `${Math.max(1, tileVisual.bodyStyle.borderWidthPx / 2.5)}px`,
                      } : undefined}
                    >
                      {tileVisual ? <TileVisual visual={tileVisual} /> : <span className="tpt-face-missing">!</span>}
                    </span>
                    {project.authoring.showLayerBadges && <small className="tile-layer-badge">{tile.layer + 1}</small>}
                    {tile.locked && <small className="tile-lock-badge">●</small>}
                  </button>
                );
              })}
              </div>
              {tapTileShowsPlayOverlay(workspaceMode) && displayState ? (
                <GameplayStageOverlay
                  state={displayState}
                  warning={displayState.status === 'playing' && displayState.trayIds.length === 6}
                />
              ) : null}
              {tapTileUsesDirectorCanvas(workspaceMode) && compiledDirector && directorPresentation && (
                <TapTileCanvasPreview
                  project={project}
                  level={compiledLevel}
                  compiledTake={compiledDirector}
                  frameNumber={directorPresentation.frameNumber}
                  onStateChange={setDirectorPreviewState}
                />
              )}
            </div>
            {workspaceMode === 'edit' && (
              <div className="stage-callout">
                <strong>{STAGE_COPY.edit.callout}</strong>
                <span>{STAGE_COPY.edit.hint}</span>
              </div>
            )}
          {workspaceMode === 'play' && gameplay.gameState && (
            <div
              className="play-session-bar"
              data-mode="play"
              data-agent-busy={agentBusy ? 'true' : 'false'}
              data-agent-expanded-states={agentProgress?.expandedStates ?? 0}
              data-agent-best-cleared={agentProgress?.bestClearedTileCount ?? 0}
              data-match-count={gameplay.transitions.filter((transition) => transition.matchedTileIds.length > 0).length}
              data-unlock-count={gameplay.transitions.reduce((total, transition) => total + transition.newlyUnlockedTileIds.length, 0)}
            >
              <div>
                <span className={agentBusy ? 'tpt-agent-search-dot' : 'recording-dot'} />
                <strong>{agentBusy ? 'Agent 正在规划' : '正在记录 Replay'}</strong>
                <span data-agent-progress={agentBusy ? 'true' : undefined}>
                  {agentBusy && agentProgress
                    ? `深度 ${agentProgress.depth}/${agentProgress.maxDepth} · ${agentProgress.expandedStates.toLocaleString()} 状态`
                    : `${gameplay.recordedActions.length} 个动作 · 槽位 ${gameplay.gameState.trayIds.length}/7`}
                </span>
              </div>
              <div>
                <select data-agent-profile value={agentProfile} disabled={agentBusy} onChange={(event) => setAgentProfile(event.target.value as TapTileScenarioProfileId)} aria-label="Agent 剧情">
                  {TAPTILE_SCENARIO_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                </select>
                <select data-agent-search-strength value={agentSearchStrength} disabled={agentBusy} onChange={(event) => setAgentSearchStrength(event.target.value as AgentSearchStrengthId)} aria-label="搜索强度">
                  {AGENT_SEARCH_STRENGTHS.map((strength) => <option key={strength.id} value={strength.id}>{strength.label}</option>)}
                </select>
                <button type="button" className="button-secondary" data-action={agentBusy ? 'cancel-agent-take' : 'generate-agent-take'} data-active={agentBusy ? 'true' : undefined} onClick={generateAgentTake}>
                  {agentBusy ? '停止并采用最佳' : 'Agent 生成'}
                </button>
                <button type="button" className="button-secondary" onClick={() => { clearLiveMatchEffects(); gameplay.restart(); }}>重新开始</button>
                <button type="button" className="button-secondary" onClick={cancelPlay}>取消</button>
                <button type="button" className="button-primary" onClick={saveCurrentTake} disabled={gameplay.recordedActions.length === 0}>结束并保存 Take</button>
              </div>
            </div>
          )}
          </div>

        </section>

        <TapTileInspector
          project={project}
          compiledLevel={compiledLevel}
          liveTrayCount={liveTrayCount}
          liveStatus={liveStatus}
          workspaceMode={workspaceMode}
          workspaceModeLabel={TAPTILE_WORKSPACE_MODES.find((mode) => mode.id === workspaceMode)?.label ?? workspaceMode}
          selectedTake={selectedDirectorTake}
          compiledDirector={compiledDirector}
          directorFrame={directorPresentation?.frameNumber ?? directorFrame}
          directorPreviewState={directorPreviewState}
          directorPreviewReady={directorPreviewReady}
          primaryTile={primaryTile}
          selectedIds={selectedIds}
          highestLayer={highestLayer}
          setupEditable={workspaceMode === 'edit'}
          locked={workspaceMode === 'play' || workspaceMode === 'export'}
          exportProgress={tapTileExportProgress}
          exportError={tapTileExportError}
          exportResult={tapTileExportResult}
          exportRunning={Boolean(tapTileExportAbortRef.current)}
          renderRegressionFrames={renderRegressionFrames}
          onDirectorProfile={setDirectorProfile}
          onDirectorTiming={patchDirectorTiming}
          onDirectorSeed={setDirectorSeed}
          onRenderQuality={setRenderQuality}
          onDirectorFrame={seekDirectorFrame}
          onExportVideo={beginTapTileExport}
          onCancelExport={cancelTapTileExport}
          onUpdateSelected={updateSelected}
          onAlign={alignSelection}
          onPairOverride={updatePairOverride}
          onSelectIssueTile={(tileId, message) => {
            setSelectedIds([tileId]);
            setNotice(message);
          }}
          onSnap={(enabled) => setAuthoringOption('snap', enabled)}
          onShowLayerBadges={(enabled) => setAuthoringOption('showLayerBadges', enabled)}
          onCommitProject={commit}
          onImportProject={(next) => {
            dispatch({ type: 'reset', value: fitProjectBelowTopTray(ensureTapTileProductionDefaults(next)) });
            setSelectedIds([]);
            setLayerFocus('all');
          }}
          onNotice={setNotice}
        />
      </main>

      {compiledDirector ? (
        <DirectorTimeline
          compiled={compiledDirector}
          currentFrame={directorPresentation?.frameNumber ?? 0}
          playing={directorPlaying}
          locked={workspaceMode === 'play' || workspaceMode === 'export'}
          selectedActionId={selectedDirectorActionId}
          actionOverrides={project.director.actionOverrides}
          onSeek={seekDirectorFrame}
          onToggle={toggleDirectorPlayback}
          onSelectAction={setSelectedDirectorActionId}
          onTimingOverride={setDirectorTimingOverride}
          onResetOverride={resetDirectorTimingOverride}
        />
      ) : (
        <section className="timeline" aria-label="Replay 事件时间线">
          <div className="timeline-controls">
            <button type="button" disabled aria-label="播放">▶</button>
            <div>
              <strong>Replay Director</strong>
              <span>尚未选择 Take</span>
            </div>
          </div>
          <div className="timeline-track-wrap">
            <div className="timeline-ruler">
              {Array.from({ length: 7 }, (_, index) => (
                <span key={index} style={{ left: `${(index / 6) * 100}%` }}>0s</span>
              ))}
            </div>
            <div className="timeline-track">
              <div className="timeline-playhead" style={{ left: '0%' }} />
            </div>
          </div>
        </section>
      )}

      <footer className="status-bar">
        <span className="status-dot" />
        <strong>{{ edit: '编辑牌面', play: '真人试玩', replay: '导演回放', render: '导出成片' }[sessionMode]}</strong>
        <span>{tiles.length} 张牌</span>
        <span>{usedLayers.length} 层</span>
        <span>{overlapPairs} 处遮挡</span>
        {selectedIds.length > 0 && <span>{selectedIds.length} 已选</span>}
        <span className="status-spacer" />
        <span>{autosaveLabel}</span>
        <span>Canvas 2D</span>
        <span>432×768 → 1080×1920</span>
      </footer>
    </div>
  );
}
