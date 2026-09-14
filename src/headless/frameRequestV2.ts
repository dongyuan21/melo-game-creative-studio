import type { ContractIssue } from './contracts.js';
import { MELO_CONTRACT_VERSION } from './contracts.js';
import type { GameRenderContract } from '../game-runtime/renderContract.js';
import type { CompositionProfile } from '../rendering/composition.js';

export const FRAME_RENDER_REQUEST_V2_CONTRACT = 'melo.frame-render-request-v2' as const;

export interface FrameRenderRequestV2 {
  contract: typeof FRAME_RENDER_REQUEST_V2_CONTRACT;
  contractVersion: typeof MELO_CONTRACT_VERSION;
  gameId: string;
  moduleVersion: string;
  renderContractId: string;
  renderContractVersion: string;
  presentationSchemaId: string;
  compositionProfileId: string;
  passIds: string[];
  planId: string;
  planHash: string;
  takeId: string;
  frameIndex: number;
  fps: number;
  coordinateSpace: 'design' | 'video';
  targetPixels: { width: number; height: number };
}

function issue(code: string, message: string, path: string): ContractIssue {
  return { code, severity: 'error', message, path, recoverable: true };
}

export function createFrameRenderRequestV2(input: {
  gameId: string;
  moduleVersion: string;
  renderContract: GameRenderContract;
  presentationSchemaId: string;
  composition: CompositionProfile;
  passIds?: string[];
  planId: string;
  planHash: string;
  takeId: string;
  frameIndex: number;
  fps: number;
  renderer: string;
  coordinateSpace?: 'design' | 'video';
}): FrameRenderRequestV2 {
  const coordinateSpace = input.coordinateSpace ?? 'video';
  const targetPixels = coordinateSpace === 'video'
    ? input.composition.videoResolution
    : input.composition.designResolution;
  const backend = input.renderContract.backends[input.renderer];
  const passIds = input.passIds ?? (backend?.passes.filter((pass) => pass.required).map((pass) => pass.id) ?? []);
  return {
    contract: FRAME_RENDER_REQUEST_V2_CONTRACT,
    contractVersion: MELO_CONTRACT_VERSION,
    gameId: input.gameId,
    moduleVersion: input.moduleVersion,
    renderContractId: input.renderContract.id,
    renderContractVersion: input.renderContract.version,
    presentationSchemaId: input.presentationSchemaId,
    compositionProfileId: input.composition.id,
    passIds: [...passIds],
    planId: input.planId,
    planHash: input.planHash,
    takeId: input.takeId,
    frameIndex: input.frameIndex,
    fps: input.fps,
    coordinateSpace,
    targetPixels: { width: targetPixels.width, height: targetPixels.height },
  };
}

export function validateFrameRenderRequestV2(
  request: FrameRenderRequestV2,
  input: {
    renderContract: GameRenderContract;
    composition: CompositionProfile;
    renderer: string;
  },
): ContractIssue[] {
  const issues: ContractIssue[] = [];
  if (request.contract !== FRAME_RENDER_REQUEST_V2_CONTRACT) {
    issues.push(issue('FRAME_REQUEST_V2_CONTRACT', 'Unknown V2 frame render request contract.', '$.contract'));
  }
  if (request.gameId !== input.renderContract.gameId) {
    issues.push(issue(
      'FRAME_REQUEST_GAME_MISMATCH',
      `Request game ${request.gameId} does not match render contract ${input.renderContract.gameId}.`,
      '$.gameId',
    ));
  }
  if (request.renderContractId !== input.renderContract.id || request.renderContractVersion !== input.renderContract.version) {
    issues.push(issue(
      'FRAME_REQUEST_CONTRACT_MISMATCH',
      'Request render contract id/version does not match the registered contract.',
      '$.renderContractId',
    ));
  }
  if (request.compositionProfileId !== input.composition.id) {
    issues.push(issue(
      'FRAME_REQUEST_COMPOSITION_MISMATCH',
      `Request composition ${request.compositionProfileId} does not match ${input.composition.id}.`,
      '$.compositionProfileId',
    ));
  }
  if (input.composition.gameId !== request.gameId) {
    issues.push(issue(
      'FRAME_REQUEST_COMPOSITION_GAME',
      `Composition game ${input.composition.gameId} does not match request ${request.gameId}.`,
      '$.compositionProfileId',
    ));
  }
  const expected = request.coordinateSpace === 'video'
    ? input.composition.videoResolution
    : input.composition.designResolution;
  if (request.targetPixels.width !== expected.width || request.targetPixels.height !== expected.height) {
    issues.push(issue(
      'FRAME_PIXEL_SIZE_MISMATCH',
      `targetPixels must be ${expected.width}×${expected.height} for composition ${input.composition.id}.`,
      '$.targetPixels',
    ));
  }
  if (!Number.isInteger(request.frameIndex) || request.frameIndex < 0) {
    issues.push(issue('FRAME_INDEX_INVALID', 'frameIndex must be a non-negative integer.', '$.frameIndex'));
  }
  if (!Number.isFinite(request.fps) || request.fps <= 0) {
    issues.push(issue('FRAME_FPS_INVALID', 'fps must be positive.', '$.fps'));
  }
  const backend = input.renderContract.backends[input.renderer];
  if (!backend) {
    issues.push(issue(
      'FRAME_REQUEST_RENDERER_UNKNOWN',
      `Render contract does not declare backend ${input.renderer}.`,
      '$.renderer',
    ));
    return issues;
  }
  if (!backend.supportedPresentationSchemas.includes(request.presentationSchemaId)) {
    issues.push(issue(
      'FRAME_REQUEST_SCHEMA_UNSUPPORTED',
      `Presentation schema ${request.presentationSchemaId} is not supported by ${input.renderer}.`,
      '$.presentationSchemaId',
    ));
  }
  const known = new Set(backend.passes.map((pass) => pass.id));
  for (const passId of request.passIds) {
    if (!known.has(passId)) {
      issues.push(issue('FRAME_PASS_UNKNOWN', `Unknown pass ${passId} for this render contract.`, '$.passIds'));
    }
  }
  for (const pass of backend.passes) {
    if (pass.required && !request.passIds.includes(pass.id)) {
      issues.push(issue('FRAME_PASS_REQUIRED', `Required pass ${pass.id} is missing.`, '$.passIds'));
    }
  }
  return issues;
}
