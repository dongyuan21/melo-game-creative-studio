import type { OutputSpec } from '../headless/contracts.js';

export const RENDER_REQUEST_CONTRACT = 'melo.render-request' as const;
export const DOCUMENT_RENDER_JOB_CONTRACT = 'melo.document-render-job' as const;

export interface RenderRequestFiles {
  config?: string | null;
  take?: string | null;
  document: string;
  frames?: string | null;
  job?: string | null;
  video?: string | null;
  still?: string | null;
  report?: string | null;
}

export interface RenderRequest {
  contract: typeof RENDER_REQUEST_CONTRACT;
  contractVersion: '1.0.0';
  rendered: boolean;
  gameId: string;
  takeId: string | null;
  output: OutputSpec;
  files: RenderRequestFiles;
  reason?: string;
  code?: string;
  encoder?: string;
}

export interface DocumentRenderJob {
  contract: typeof DOCUMENT_RENDER_JOB_CONTRACT;
  contractVersion: '1.0.0';
  documentFile: string;
  takeId: string;
  quality: OutputSpec['quality'];
  still: boolean;
  video: boolean;
  output: OutputSpec;
  artifacts: {
    video: string | null;
    still: string | null;
    report: string;
  };
  maxFrames?: number;
}

export function createRenderRequest(input: {
  rendered: boolean;
  gameId: string;
  takeId: string | null;
  output: OutputSpec;
  files: RenderRequestFiles;
  reason?: string;
  code?: string;
  encoder?: string;
}): RenderRequest {
  const request: RenderRequest = {
    contract: RENDER_REQUEST_CONTRACT,
    contractVersion: '1.0.0',
    rendered: input.rendered,
    gameId: input.gameId,
    takeId: input.takeId,
    output: input.output,
    files: input.files,
  };
  if (input.reason !== undefined) request.reason = input.reason;
  if (input.code !== undefined) request.code = input.code;
  if (input.encoder !== undefined) request.encoder = input.encoder;
  return request;
}

export function createDocumentRenderJob(input: {
  takeId: string;
  quality: OutputSpec['quality'];
  output: OutputSpec;
  still?: boolean;
  video?: boolean;
  maxFrames?: number;
}): DocumentRenderJob {
  const still = input.still !== false;
  const video = input.video !== false;
  const job: DocumentRenderJob = {
    contract: DOCUMENT_RENDER_JOB_CONTRACT,
    contractVersion: '1.0.0',
    documentFile: 'document.json',
    takeId: input.takeId,
    quality: input.quality,
    still,
    video,
    output: input.output,
    artifacts: {
      video: video ? 'video.mp4' : null,
      still: still ? 'preview.png' : null,
      report: 'chrome-capture.json',
    },
  };
  if (input.maxFrames !== undefined) job.maxFrames = input.maxFrames;
  return job;
}
