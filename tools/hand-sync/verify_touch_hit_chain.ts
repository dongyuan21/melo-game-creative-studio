import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { captureRhythm } from '../../src/games/block-placement/capture/suite';
import { anchorForPieceAtDesignNorm, pickAtDesignNorm } from '../../src/games/block-placement/input/referenceHitTest';
import { canPlace, pieceCells } from '../../src/games/block-placement/runtime/gameEngine';
import { compileTake, evaluateCompiledTake } from '../../src/games/block-placement/presentation/presentationCompiler';
import { sha256CanonicalJson } from '../../src/hand-sync/provenance';
import {
  REFERENCE_BR_TL_PIECE_ID,
  REFERENCE_BR_TL_TARGET_ANCHOR,
  referenceBrTlTake,
} from '../../src/hand-sync/referenceLegalTake';
import { videoDeviceUvToPointerDesignUv } from '../../src/hand-sync/layout';

type InteractionRow = {
  frameIndex: number;
  sourceFrameIndex: number;
  contact?: boolean;
  pieceId?: string | null;
  actionId?: string | null;
  touchVideoDeviceUv: [number, number];
  preview?: { row: number; col: number; legal?: boolean } | null;
  events?: { kind: string; pieceId?: string | null; actionId?: string | null }[];
};

const bundleDir = resolve(process.argv[2] ?? '.');
const outPath = resolve(process.argv[3] ?? resolve(bundleDir, '../touch-hit-chain.json'));
const interaction = JSON.parse(readFileSync(resolve(bundleDir, 'interaction.json'), 'utf8'));
const bundleMeta = JSON.parse(readFileSync(resolve(bundleDir, 'bundle.json'), 'utf8'));
const take = referenceBrTlTake();
const rhythm = captureRhythm();
const compiled = compileTake(take, rhythm, 30);
const errors: string[] = [];

const expectedTakeHash = sha256CanonicalJson(take);
const exportedTakeHash = bundleMeta.source?.takeHash;
if (exportedTakeHash && exportedTakeHash !== expectedTakeHash) {
  errors.push(`bundle takeHash mismatch: ${exportedTakeHash} != ${expectedTakeHash}`);
}

const frames = interaction.frames as InteractionRow[];
const down = frames.find((f) => (f.events ?? []).some((e) => e.kind === 'pointerdown'));
const lastDrag = [...frames].reverse().find((f) => f.contact && f.actionId);
const commit = frames.find((f) => (f.events ?? []).some((e) => e.kind === 'commit'));
const afterCommit = commit ? frames.find((f) => f.frameIndex === commit.frameIndex + 1) : null;

if (!down || !lastDrag || !commit) errors.push('missing pointerdown, drag, or commit frame');

function designFromExportedTouch(row: InteractionRow): { x: number; y: number } {
  const [dx, dy] = videoDeviceUvToPointerDesignUv(row.touchVideoDeviceUv);
  return { x: dx, y: dy };
}

let pickOk = false;
let releaseOk = false;
let stateOk = false;
let commitIdentityOk = false;
let previewAtReleaseOk = false;

if (down && lastDrag && commit) {
  const pickDesign = designFromExportedTouch(down);
  const pick = pickAtDesignNorm(take.initial, pickDesign.x, pickDesign.y);
  pickOk = pick?.kind === 'piece' && pick.pieceId === REFERENCE_BR_TL_PIECE_ID;
  if (!pickOk) errors.push(`exported pointerdown pick failed: ${JSON.stringify(pick)} @ design ${JSON.stringify(pickDesign)}`);

  const releaseDesign = designFromExportedTouch(lastDrag);
  const releaseAnchor = anchorForPieceAtDesignNorm(
    take.initial,
    REFERENCE_BR_TL_PIECE_ID,
    releaseDesign.x,
    releaseDesign.y,
  );
  releaseOk =
    releaseAnchor?.row === REFERENCE_BR_TL_TARGET_ANCHOR.row &&
    releaseAnchor?.col === REFERENCE_BR_TL_TARGET_ANCHOR.col;
  if (!releaseOk) {
    errors.push(`exported last-drag anchor mismatch: ${JSON.stringify(releaseAnchor)} design ${JSON.stringify(releaseDesign)}`);
  }

  previewAtReleaseOk =
    lastDrag.preview?.legal === true &&
    lastDrag.preview.row === REFERENCE_BR_TL_TARGET_ANCHOR.row &&
    lastDrag.preview.col === REFERENCE_BR_TL_TARGET_ANCHOR.col;

  const commitEv = (commit.events ?? []).find((e) => e.kind === 'commit');
  const commitActionId = commit.actionId ?? commitEv?.actionId ?? null;
  const commitPieceId =
    commit.pieceId ?? commitEv?.pieceId ?? (commitActionId?.includes(REFERENCE_BR_TL_PIECE_ID) ? REFERENCE_BR_TL_PIECE_ID : null);
  commitIdentityOk =
    commitPieceId === REFERENCE_BR_TL_PIECE_ID && Boolean(commitActionId?.startsWith('ref-br-tl-'));
  if (!commitIdentityOk) errors.push('commit frame missing pieceId/actionId binding');

  const presAfter = evaluateCompiledTake(compiled, commit.sourceFrameIndex + 1, rhythm);
  const pieceAfter = presAfter.snapshot.pieces.find((p) => p.id === REFERENCE_BR_TL_PIECE_ID);
  const placedCells = pieceCells(
    take.initial.pieces.find((p) => p.id === REFERENCE_BR_TL_PIECE_ID)!,
    REFERENCE_BR_TL_TARGET_ANCHOR,
  );
  const boardOk = placedCells.every(({ row, col }) => {
    const line = presAfter.snapshot.board.cells[row];
    return line && line[col] !== null;
  });
  const pieceBefore = take.initial.pieces.find((p) => p.id === REFERENCE_BR_TL_PIECE_ID)!;
  stateOk = Boolean(
    pieceAfter?.used &&
      boardOk &&
      !canPlace(presAfter.snapshot.board, pieceBefore, REFERENCE_BR_TL_TARGET_ANCHOR),
  );
  if (!stateOk) errors.push('post-commit snapshot: piece not used or board cells missing');

  const firstDrag = frames.find((f) => f.contact && f.actionId);
  if (firstDrag?.preview?.legal && firstDrag.frameIndex <= (down.frameIndex ?? 0) + 2) {
    errors.push('early drag frame shows legal board preview before anchor resolves');
  }
}

const report = {
  schema: 'melo.hand-sync.touch-hit-chain/0.2',
  bundleDir,
  exportedTakeHash,
  expectedTakeHash,
  pieceId: REFERENCE_BR_TL_PIECE_ID,
  targetAnchor: REFERENCE_BR_TL_TARGET_ANCHOR,
  frames: {
    pointerdownLocal: down?.frameIndex ?? null,
    lastDragLocal: lastDrag?.frameIndex ?? null,
    commitLocal: commit?.frameIndex ?? null,
    afterCommitLocal: afterCommit?.frameIndex ?? null,
  },
  pickHitOk: pickOk,
  releaseAnchorOk: releaseOk,
  previewAtReleaseOk,
  commitIdentityOk,
  stateTransferOk: stateOk,
  pass: errors.length === 0,
  errors,
};
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ pass: report.pass, errors }, null, 2));
process.exit(report.pass ? 0 : 1);
