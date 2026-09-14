import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { ensureDefaultHeadlessPlatform } from '../../bootstrap/headlessBootstrap.js';
import { compileFrameSourceFromDocument, validateStudioProjectDocumentV2 } from '../../game-runtime/projectDocument.js';
import { MeloHeadlessError } from '../../headless/errors.js';
import { listRenderBackends } from '../../rendering/backendRegistry.js';
import { listCompositionProfiles } from '../../rendering/compositionRegistry.js';
import { resolveDocumentRenderSetup } from '../../rendering/documentRenderSetup.js';
import { findChromePath, findRepoRoot } from '../chrome.js';
import { withCliErrors } from '../cliError.js';
import {
  createDocumentRenderJob,
  createRenderRequest,
  type DocumentRenderJob,
  type RenderRequest,
} from '../renderRequest.js';

export interface RenderCommandInput {
  document?: unknown;
  documentPath?: string;
  outDir?: string;
  takeId?: string;
  quality?: 'preview' | 'standard' | 'cinematic';
  maxFrames?: number;
  still?: boolean;
  video?: boolean;
  timeoutMs?: number;
  chromePath?: string | null;
  list?: boolean;
}

async function writeJson(path: string, value: unknown): Promise<string> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return resolve(path);
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function summarizeSetup() {
  const platform = ensureDefaultHeadlessPlatform();
  return {
    backends: listRenderBackends().map((item) => ({
      id: item.id,
      renderer: item.renderer,
      schemas: [...item.supportedPresentationSchemas],
    })).sort((left, right) => left.id.localeCompare(right.id)),
    compositions: listCompositionProfiles().map((item) => ({
      id: item.id,
      gameId: item.gameId,
      videoResolution: item.videoResolution,
    })).sort((left, right) => left.gameId.localeCompare(right.gameId)),
    renderContracts: platform.renderContracts.list().map((item) => ({
      id: item.id,
      version: item.version,
      gameId: item.gameId,
    })).sort((left, right) => left.gameId.localeCompare(right.gameId)),
  };
}

function chromeMissingRequest(input: {
  gameId: string;
  takeId: string | null;
  output: RenderRequest['output'];
  files: RenderRequest['files'];
}): RenderRequest {
  return createRenderRequest({
    rendered: false,
    gameId: input.gameId,
    takeId: input.takeId,
    output: input.output,
    files: input.files,
    code: 'CHROME_NOT_FOUND',
    reason: 'Google Chrome / Chromium was not found. Node does not encode MP4; install Chrome or skip --render.',
  });
}

function spawnDocumentRender(repoRoot: string, workspace: string, timeoutMs: number): Promise<{
  status: string;
  code?: string;
  reason?: string;
  rendered?: boolean;
  errors?: string[];
  videos?: Array<{ path: string; sha256: string; bytes: number; frameCount: number; durationSeconds: number }>;
  frames?: Array<{ path: string; sha256: string; width: number; height: number }>;
  backendId?: string;
  gameId?: string;
  takeId?: string;
}> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      [join(repoRoot, 'scripts/document-render.mjs'), '--workspace', workspace, '--timeout-ms', String(timeoutMs)],
      {
        cwd: repoRoot,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => {
      stderr.push(chunk);
      const text = String(chunk);
      if (/\[capture\]|ERROR|FATAL|VideoEncoder|WebGL/.test(text)) process.stderr.write(text);
    });
    child.on('error', rejectPromise);
    child.on('exit', (code) => {
      const text = Buffer.concat(stdout).toString('utf8').trim();
      const lastLine = text.split('\n').filter(Boolean).at(-1) ?? '';
      try {
        resolvePromise(JSON.parse(lastLine) as never);
      } catch (error) {
        rejectPromise(new Error(
          `document-render exited ${code}: ${lastLine || Buffer.concat(stderr).toString('utf8') || (error instanceof Error ? error.message : String(error))}`,
        ));
      }
    });
  });
}

export async function commandRender(input: RenderCommandInput): Promise<unknown> {
  return withCliErrors('RENDER_FAILED', async () => {
    if (input.list) {
      return { ok: true, rendered: false, ...summarizeSetup() };
    }

    const outDir = input.outDir
      ?? (input.documentPath ? dirname(input.documentPath) : undefined);
    if (!outDir) {
      throw new MeloHeadlessError(
        'CLI_ARGUMENT_REQUIRED',
        'Use `render --out-dir <dir>` or `render --document <file.json>`.',
        { path: '--out-dir' },
      );
    }
    await mkdir(outDir, { recursive: true });
    const documentPath = join(outDir, 'document.json');
    let documentValue = input.document;
    if (documentValue === undefined && input.documentPath) {
      documentValue = await readJson(input.documentPath);
      if (resolve(input.documentPath) !== resolve(documentPath)) {
        await copyFile(input.documentPath, documentPath);
      }
    }
    if (documentValue === undefined) {
      documentValue = await readJson(documentPath);
    } else if (!input.documentPath || resolve(input.documentPath) !== resolve(documentPath)) {
      await writeJson(documentPath, documentValue);
    }

    const platform = ensureDefaultHeadlessPlatform();
    const document = validateStudioProjectDocumentV2(documentValue, platform.games);
    const takeId = input.takeId ?? document.takes[0]?.takeId;
    if (!takeId) {
      throw new MeloHeadlessError('DOCUMENT_HAS_NO_TAKE', 'Studio document has no take to render.', { path: 'document.takes' });
    }
    const quality = input.quality ?? document.production.output.quality;
    const fps = document.production.output.fps;
    const source = compileFrameSourceFromDocument(document, platform, {
      takeId,
      directorProfile: document.direction?.rhythm ?? {},
      fps,
    });
    const warmup = source.evaluate(0);
    const lookPackId = document.production.lookPackRef.id;
    const setup = resolveDocumentRenderSetup({
      gameId: source.gameId,
      presentationSchemaId: warmup.payloadSchemaId,
      renderContracts: platform.renderContracts.list(),
      ...(lookPackId ? { lookPackId } : {}),
    });
    const output = {
      width: setup.composition.videoResolution.width,
      height: setup.composition.videoResolution.height,
      fps: source.fps,
      quality,
    };
    const jobInput: Parameters<typeof createDocumentRenderJob>[0] = {
      takeId,
      quality,
      output,
      still: input.still !== false,
      video: input.video !== false,
    };
    if (input.maxFrames !== undefined) jobInput.maxFrames = input.maxFrames;
    const job: DocumentRenderJob = createDocumentRenderJob(jobInput);
    const jobPath = await writeJson(join(outDir, 'render-job.json'), job);
    const files: RenderRequest['files'] = {
      document: 'document.json',
      job: 'render-job.json',
      take: document.takes[0] ? 'take.json' : null,
      frames: 'frames.json',
      video: job.artifacts.video,
      still: job.artifacts.still,
      report: 'chrome-capture.json',
    };

    const encodedFrames = input.maxFrames !== undefined ? Math.min(input.maxFrames, source.totalFrames) : source.totalFrames;
    const timeoutMs = input.timeoutMs ?? Math.min(25 * 60_000, 60_000 + encodedFrames * 4_000);

    const chromePath = input.chromePath === undefined ? findChromePath() : input.chromePath;
    if (!chromePath) {
      const renderRequest = chromeMissingRequest({
        gameId: source.gameId,
        takeId,
        output,
        files,
      });
      const renderRequestPath = await writeJson(join(outDir, 'render-request.json'), renderRequest);
      return {
        ok: false,
        rendered: false,
        recoverable: true,
        code: 'CHROME_NOT_FOUND',
        gameId: source.gameId,
        takeId,
        backendId: setup.backend.id,
        totalFrames: source.totalFrames,
        encodedFrames,
        renderRequest,
        outDir: resolve(outDir),
        files: { ...files, renderRequest: renderRequestPath, job: jobPath },
      };
    }

    const repoRoot = findRepoRoot();
    const report = await spawnDocumentRender(repoRoot, resolve(outDir), timeoutMs);
    const rendered = report.status === 'PASS' && report.rendered === true;
    const code = report.status === 'NOT_RUN'
      ? (report.code ?? 'CHROME_NOT_FOUND')
      : report.status === 'FAIL'
        ? (report.code ?? 'RENDER_FAILED')
        : rendered
          ? undefined
          : 'NOT_RENDERED';
    const renderRequest = createRenderRequest({
      rendered,
      gameId: source.gameId,
      takeId,
      output,
      files,
      ...(rendered
        ? { encoder: 'chrome-webcodecs' }
        : {
            code: code ?? 'NOT_RENDERED',
            reason: report.reason
              ?? report.errors?.[0]
              ?? 'Chrome capture finished without an MP4.',
          }),
    });
    const renderRequestPath = await writeJson(join(outDir, 'render-request.json'), renderRequest);
    const recoverable = report.status === 'NOT_RUN';
    return {
      ok: rendered,
      rendered,
      recoverable,
      ...(code !== undefined ? { code } : {}),
      gameId: source.gameId,
      takeId,
      backendId: report.backendId ?? setup.backend.id,
      totalFrames: source.totalFrames,
      encodedFrames,
      videos: report.videos ?? [],
      frames: report.frames ?? [],
      errors: report.errors ?? [],
      renderRequest,
      outDir: resolve(outDir),
      files: { ...files, renderRequest: renderRequestPath, job: jobPath },
    };
  });
}
