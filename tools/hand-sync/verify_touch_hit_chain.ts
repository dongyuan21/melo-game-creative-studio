import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { captureRhythm } from '../../src/games/block-placement/capture/suite';
import { anchorForPieceAtDesignNorm, pickAtDesignNorm } from '../../src/games/block-placement/input/referenceHitTest';
import { compileTake, evaluateCompiledTake } from '../../src/games/block-placement/presentation/presentationCompiler';
import { applyPlacement } from '../../src/games/block-placement/runtime/gameEngine';
import {
  REFERENCE_BR_TL_PIECE_ID,
  REFERENCE_BR_TL_TARGET_ANCHOR,
  referenceBrTlTake,
} from '../../src/hand-sync/referenceLegalTake';

const bundleDir = resolve(process.argv[2] ?? '.');
const outPath = resolve(process.argv[3] ?? resolve(bundleDir, '../touch-hit-chain.json'));
const interaction = JSON.parse(readFileSync(resolve(bundleDir, 'interaction.json'), 'utf8'));
const take = referenceBrTlTake();
const rhythm = captureRhythm();
const compiled = compileTake(take, rhythm, 30);
const errors: string[] = [];

const down = interaction.frames.find((f: { events?: { kind: string }[] }) =>
  (f.events ?? []).some((e) => e.kind === 'pointerdown'),
);
const lastDrag = [...interaction.frames].reverse().find(
  (f: { contact?: boolean; actionId?: string }) => f.contact && f.actionId,
);
const commit = interaction.frames.find((f: { events?: { kind: string }[] }) =>
  (f.events ?? []).some((e) => e.kind === 'commit'),
);

if (!down || !lastDrag || !commit) errors.push('missing pointerdown, drag, or commit frame');

let pickOk = false;
let releaseOk = false;
let stateOk = false;
let pickPieceId: string | null = null;
let releaseAnchor: { row: number; col: number } | null = null;

if (down && lastDrag) {
  const pres = evaluateCompiledTake(compiled, down.sourceFrameIndex, rhythm);
  const ptr = pres.pointer;
  if (!ptr) errors.push('pointerdown frame missing presentation pointer');
  else {
    const pick = pickAtDesignNorm(take.initial, ptr.x, ptr.y);
    pickOk = pick?.kind === 'piece' && pick.pieceId === REFERENCE_BR_TL_PIECE_ID;
    pickPieceId = pick?.kind === 'piece' ? pick.pieceId : null;
    if (!pickOk) errors.push(`pointerdown pick failed: ${JSON.stringify(pick)}`);
  }

  const presEnd = evaluateCompiledTake(compiled, lastDrag.sourceFrameIndex, rhythm);
  const ptrEnd = presEnd.pointer;
  if (!ptrEnd) errors.push('last drag missing pointer');
  else {
    releaseAnchor = anchorForPieceAtDesignNorm(take.initial, REFERENCE_BR_TL_PIECE_ID, ptrEnd.x, ptrEnd.y);
    releaseOk =
      releaseAnchor?.row === REFERENCE_BR_TL_TARGET_ANCHOR.row &&
      releaseAnchor?.col === REFERENCE_BR_TL_TARGET_ANCHOR.col;
    if (!releaseOk) errors.push(`release anchor mismatch: ${JSON.stringify(releaseAnchor)}`);
  }
}

const action = take.actions[0];
const placed = applyPlacement(take.initial, action);
stateOk = Boolean(placed);
if (!stateOk) errors.push('applyPlacement failed on take action');

const report = {
  schema: 'melo.hand-sync.touch-hit-chain/0.1',
  pieceId: pickPieceId ?? REFERENCE_BR_TL_PIECE_ID,
  targetAnchor: REFERENCE_BR_TL_TARGET_ANCHOR,
  pickHitOk: pickOk,
  releaseAnchorOk: releaseOk,
  releaseAnchor,
  stateTransferOk: stateOk,
  commitLocalFrame: commit?.frameIndex ?? null,
  pass: errors.length === 0,
  errors,
};
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ pass: report.pass, errors }, null, 2));
process.exit(report.pass ? 0 : 1);
