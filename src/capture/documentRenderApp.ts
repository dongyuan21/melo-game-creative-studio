import { ensureDefaultHeadlessPlatform } from '../bootstrap/headlessBootstrap';
import { captureStillV2 } from './v2/captureStill';
import { compileFrameSourceFromDocument, validateStudioProjectDocumentV2 } from '../game-runtime/projectDocument';
import { createFrameRenderRequestV2 } from '../headless/frameRequestV2';
import { resolveDocumentRenderSetup } from '../rendering/documentRenderSetup';
import { limitCompiledFrameSource } from '../rendering/limitFrameSource';
import { executeVideoRenderJob } from '../rendering/renderJob';

interface DocumentRenderJob {
  contract: 'melo.document-render-job';
  contractVersion: '1.0.0';
  documentFile: string;
  takeId: string;
  quality: 'preview' | 'standard' | 'cinematic';
  maxFrames?: number;
  still: boolean;
  video: boolean;
  output: {
    width: number;
    height: number;
    fps: number;
    quality: 'preview' | 'standard' | 'cinematic';
  };
  artifacts: {
    video: string | null;
    still: string | null;
    report: string;
  };
}

interface CaptureReport {
  status: 'PASS' | 'FAIL';
  mode: string;
  startedAt: string;
  finishedAt?: string;
  rendered: boolean;
  code?: string;
  browser: string;
  webglRenderer: string | null;
  videoEncoder: boolean;
  tests: Array<{ name: string; status: 'PASS' | 'FAIL' | 'NOT_RUN'; detail?: string }>;
  frames: Array<{ id: string; path: string; sha256: string; width: number; height: number }>;
  videos: Array<{ id: string; path: string; sha256: string; bytes: number; frameCount: number; durationSeconds: number }>;
  planHashes: Array<{ frameSourceHash: string; takeId: string; totalFrames: number }>;
  errors: string[];
  gameId?: string;
  takeId?: string;
  backendId?: string;
}

const statusEl = document.createElement('pre');
statusEl.id = 'capture-status';
statusEl.textContent = 'document render starting…';
document.body.style.margin = '0';
document.body.style.background = '#05070d';
document.body.style.color = '#dce7ff';
document.body.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
document.body.append(statusEl);

const params = new URLSearchParams(location.search);
const autorun = params.get('autorun') !== '0';

function log(message: string): void {
  statusEl.textContent += `\n${message}`;
  console.info(message);
  void fetch('/__capture/progress', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: message,
  }).catch(() => undefined);
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function postArtifact(path: string, blob: Blob, meta: Record<string, unknown>): Promise<{ sha256?: string }> {
  const response = await fetch('/__capture/artifact', {
    method: 'POST',
    headers: {
      'x-artifact-path': path,
      'x-artifact-meta': JSON.stringify(meta),
    },
    body: blob,
  });
  if (!response.ok) throw new Error(`artifact upload failed: ${path} ${response.status}`);
  return response.json() as Promise<{ sha256?: string }>;
}

async function postJson(path: string, body: unknown): Promise<void> {
  await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function loadWorkspaceJson<T>(file: string): Promise<T> {
  const response = await fetch(`/__capture/workspace/${file}`);
  if (!response.ok) throw new Error(`Unable to load workspace file ${file} (${response.status}).`);
  return response.json() as Promise<T>;
}

function webglRendererName(): string | null {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  if (!gl) return null;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  if (!info) return gl.getParameter(gl.RENDERER);
  return String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
}

async function run(): Promise<CaptureReport> {
  const report: CaptureReport = {
    status: 'PASS',
    mode: 'document-render',
    startedAt: new Date().toISOString(),
    rendered: false,
    browser: navigator.userAgent,
    webglRenderer: webglRendererName(),
    videoEncoder: typeof VideoEncoder === 'function',
    tests: [],
    frames: [],
    videos: [],
    planHashes: [],
    errors: [],
  };
  try {
    const job = await loadWorkspaceJson<DocumentRenderJob>('render-job.json');
    if (job.contract !== 'melo.document-render-job') {
      throw new Error(`Unknown render job contract ${String(job.contract)}`);
    }
    const platform = ensureDefaultHeadlessPlatform();
    const rawDocument = await loadWorkspaceJson<unknown>(job.documentFile);
    const project = validateStudioProjectDocumentV2(rawDocument, platform.games);
    const compiled = compileFrameSourceFromDocument(project, platform, {
      takeId: job.takeId,
      directorProfile: project.direction?.rhythm ?? {},
      fps: job.output.fps,
    });
    const source = job.maxFrames !== undefined
      ? limitCompiledFrameSource(compiled, job.maxFrames)
      : compiled;
    const warmup = source.evaluate(0);
    const lookPackId = project.production.lookPackRef.id;
    const setup = resolveDocumentRenderSetup({
      gameId: source.gameId,
      presentationSchemaId: warmup.payloadSchemaId,
      renderContracts: platform.renderContracts.list(),
      ...(lookPackId ? { lookPackId } : {}),
    });
    report.gameId = source.gameId;
    report.takeId = source.takeId;
    report.backendId = setup.backend.id;
    report.planHashes.push({
      frameSourceHash: source.frameSourceHash,
      takeId: source.takeId,
      totalFrames: source.totalFrames,
    });
    log(`${source.gameId} ${setup.backend.id} ${source.totalFrames}f @ ${source.fps}fps`);

    const output = {
      width: setup.composition.videoResolution.width,
      height: setup.composition.videoResolution.height,
      fps: source.fps,
      quality: job.quality,
    };

    if (job.still && job.artifacts.still) {
      const request = createFrameRenderRequestV2({
        gameId: source.gameId,
        moduleVersion: project.game.game.moduleVersion,
        renderContract: setup.renderContract,
        presentationSchemaId: warmup.payloadSchemaId,
        composition: setup.composition,
        planId: `document-render.${source.gameId}`,
        planHash: source.frameSourceHash,
        takeId: source.takeId,
        frameIndex: 0,
        fps: source.fps,
        renderer: setup.backend.renderer,
        coordinateSpace: 'video',
      });
      const canvas = globalThis.document.createElement('canvas');
      const captured = await captureStillV2(canvas, {
        request,
        frameSource: source,
        backend: setup.backend,
        composition: setup.composition,
        renderContract: setup.renderContract,
        resourcePolicy: setup.resourcePolicy,
      });
      const posted = await postArtifact(job.artifacts.still, captured.blob, {
        width: captured.width,
        height: captured.height,
        gameId: source.gameId,
        takeId: source.takeId,
        frameIndex: 0,
      });
      const sha256 = posted.sha256 ?? await sha256Hex(await captured.blob.arrayBuffer());
      report.frames.push({
        id: 'preview',
        path: job.artifacts.still,
        sha256,
        width: captured.width,
        height: captured.height,
      });
      report.tests.push({
        name: 'document-still',
        status: 'PASS',
        detail: `${captured.width}x${captured.height}`,
      });
      log(`still ${job.artifacts.still} ${sha256.slice(0, 12)}`);
    }

    if (job.video && job.artifacts.video) {
      if (typeof VideoEncoder === 'undefined') {
        throw Object.assign(new Error('Chrome WebCodecs VideoEncoder is not available.'), { code: 'WECODECS_UNAVAILABLE' });
      }
      const result = await executeVideoRenderJob({
        frameSource: source,
        backend: setup.backend,
        output,
        projectName: source.gameId,
        takeName: source.takeId,
        resourcePolicy: setup.resourcePolicy,
        renderContract: setup.renderContract,
        onProgress: (progress) => {
          if (progress.phase === 'rendering' || progress.phase === 'done') {
            log(progress.message);
          }
        },
      });
      const posted = await postArtifact(job.artifacts.video, result.blob, {
        frameCount: result.frameCount,
        durationSeconds: result.durationSeconds,
        fileName: result.fileName,
        gameId: source.gameId,
        takeId: source.takeId,
      });
      const sha256 = posted.sha256 ?? await sha256Hex(await result.blob.arrayBuffer());
      report.videos.push({
        id: 'take',
        path: job.artifacts.video,
        sha256,
        bytes: result.blob.size,
        frameCount: result.frameCount,
        durationSeconds: result.durationSeconds,
      });
      report.rendered = true;
      report.tests.push({
        name: 'document-video',
        status: 'PASS',
        detail: `${result.frameCount} frames ${result.blob.size} bytes`,
      });
      log(`video ${job.artifacts.video} ${sha256.slice(0, 12)}`);
    }
  } catch (error) {
    report.status = 'FAIL';
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : undefined;
    if (code) report.code = code;
    report.errors.push(error instanceof Error ? error.stack ?? error.message : String(error));
    log(String(error));
  }
  report.finishedAt = new Date().toISOString();
  window.__DOCUMENT_RENDER_DONE__ = report;
  await postJson('/__capture/done', report);
  log(`done ${report.status} rendered=${String(report.rendered)}`);
  return report;
}

declare global {
  interface Window {
    __DOCUMENT_RENDER_DONE__?: CaptureReport;
  }
}

if (autorun) {
  void run();
} else {
  statusEl.textContent = 'document render loaded (autorun=0)';
}
