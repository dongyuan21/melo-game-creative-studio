import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ensureDefaultHeadlessPlatform } from '../../bootstrap/headlessBootstrap.js';
import { parseGameReplayEnvelope } from '../../game-runtime/projectParser.js';
import { compileFrameSourceFromDocument, validateStudioProjectDocumentV2 } from '../../game-runtime/projectDocument.js';
import type { GameReplayEnvelope } from '../../game-runtime/replayEnvelope.js';
import type { StudioProjectDocumentV2 } from '../../game-runtime/projectEnvelope.js';
import { MeloHeadlessError } from '../../headless/errors.js';
import { withCliErrors } from '../cliError.js';
import { commandRender, type RenderCommandInput } from './render.js';
import { createRenderRequest } from '../renderRequest.js';

async function writeJson(path: string, value: unknown): Promise<string> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return resolve(path);
}

function requireGameId(gameId: string | undefined): string {
  if (!gameId) throw new MeloHeadlessError('CLI_ARGUMENT_REQUIRED', '--game is required.', { path: '--game' });
  return gameId;
}

export interface AuthoringCatalogInput {
  gameId?: string;
}

export async function commandAuthoringCatalog(input: AuthoringCatalogInput): Promise<unknown> {
  return withCliErrors('AUTHORING_CATALOG_FAILED', async () => {
    const platform = ensureDefaultHeadlessPlatform();
    const games = input.gameId
      ? [platform.authoring.require(input.gameId).catalog()]
      : platform.authoring.list().slice().sort((left, right) => left.gameId.localeCompare(right.gameId));
    return { ok: true, rendered: false, games };
  });
}

export interface ProjectScaffoldInput {
  gameId?: string;
  template?: string;
  skin?: string;
  seed?: number;
  name?: string;
  out?: string;
}

export async function commandProjectScaffold(input: ProjectScaffoldInput): Promise<unknown> {
  return withCliErrors('PROJECT_SCAFFOLD_FAILED', async () => {
    const gameId = requireGameId(input.gameId);
    const adapter = ensureDefaultHeadlessPlatform().authoring.require(gameId);
    const result = adapter.scaffold({
      seed: input.seed ?? 1,
      ...(input.template !== undefined ? { template: input.template } : {}),
      ...(input.skin !== undefined ? { skin: input.skin } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
    });
    const out = input.out ? await writeJson(input.out, result.config) : null;
    return {
      ok: true,
      rendered: false,
      gameId,
      templateId: result.templateId,
      skinId: result.skinId,
      config: result.config,
      notes: result.notes,
      catalog: result.catalog,
      out,
    };
  });
}

export interface SkinCommandInput {
  action: string | undefined;
  gameId?: string;
  config?: unknown;
  skin?: string;
  out?: string;
}

export async function commandSkin(input: SkinCommandInput): Promise<unknown> {
  return withCliErrors('SKIN_COMMAND_FAILED', async () => {
    const platform = ensureDefaultHeadlessPlatform();
    if (input.action === 'list') {
      const games = input.gameId
        ? [platform.authoring.require(input.gameId).catalog()]
        : platform.authoring.list().slice().sort((left, right) => left.gameId.localeCompare(right.gameId));
      return {
        ok: true,
        rendered: false,
        skins: games.map((item) => ({ gameId: item.gameId, skins: item.skins })),
      };
    }
    if (input.action !== 'apply') {
      throw new MeloHeadlessError('CLI_COMMAND_INVALID', 'Use `skin list` or `skin apply --game <id> --config <file> --skin <id>`.', { path: 'skin' });
    }
    const gameId = requireGameId(input.gameId);
    if (input.config === undefined) {
      throw new MeloHeadlessError('CLI_ARGUMENT_REQUIRED', '--config is required.', { path: '--config' });
    }
    if (!input.skin) throw new MeloHeadlessError('CLI_ARGUMENT_REQUIRED', '--skin is required.', { path: '--skin' });
    const result = platform.authoring.require(gameId).applySkin(input.config, input.skin);
    const out = input.out ? await writeJson(input.out, result.config) : null;
    return {
      ok: true,
      rendered: false,
      gameId,
      skinId: result.skinId,
      config: result.config,
      notes: result.notes,
      out,
    };
  });
}

export interface DocumentEmitInput {
  gameId?: string;
  config?: unknown;
  take?: unknown;
  skin?: string;
  seed?: number;
  name?: string;
  quality?: 'preview' | 'standard' | 'cinematic';
  out?: string;
}

export async function commandDocumentEmit(input: DocumentEmitInput): Promise<unknown> {
  return withCliErrors('DOCUMENT_EMIT_FAILED', async () => {
    const gameId = requireGameId(input.gameId);
    const platform = ensureDefaultHeadlessPlatform();
    if (input.config === undefined) {
      throw new MeloHeadlessError('CLI_ARGUMENT_REQUIRED', '--config is required.', { path: '--config' });
    }
    const document = platform.authoring.require(gameId).emitDocument({
      config: input.config,
      seed: input.seed ?? 1,
      ...(input.take !== undefined ? { takes: [parseGameReplayEnvelope(input.take)] } : { takes: [] }),
      ...(input.skin !== undefined ? { skin: input.skin } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.quality !== undefined ? { quality: input.quality } : {}),
    });
    validateStudioProjectDocumentV2(document, platform.games);
    const out = input.out ? await writeJson(input.out, document) : null;
    return { ok: true, rendered: false, gameId, document, out };
  });
}

export interface DocumentCompileInput {
  document?: unknown;
  takeId?: string;
  fps?: number;
  out?: string;
}

export async function commandDocumentCompile(input: DocumentCompileInput): Promise<unknown> {
  return withCliErrors('DOCUMENT_COMPILE_FAILED', async () => {
    if (input.document === undefined) {
      throw new MeloHeadlessError('CLI_ARGUMENT_REQUIRED', '--document is required.', { path: '--document' });
    }
    const platform = ensureDefaultHeadlessPlatform();
    const validated = validateStudioProjectDocumentV2(input.document, platform.games);
    const takeId = input.takeId ?? validated.takes[0]?.takeId;
    if (!takeId) {
      throw new MeloHeadlessError('DOCUMENT_HAS_NO_TAKE', 'Studio document has no take to compile.', { path: 'document.takes' });
    }
    const fps = input.fps ?? validated.production.output.fps;
    const source = compileFrameSourceFromDocument(validated, platform, {
      takeId,
      directorProfile: validated.direction?.rhythm ?? {},
      fps,
    });
    const frames = {
      gameId: source.gameId,
      takeId: source.takeId,
      fps: source.fps,
      totalFrames: source.totalFrames,
      frameSourceHash: source.frameSourceHash,
      rendered: false,
      note: 'Node compiles the presentation source only. Pixel frames and MP4 require `melo render` (Chrome/WebCodecs).',
    };
    const out = input.out ? await writeJson(input.out, frames) : null;
    return { ok: true, rendered: false, frames, out };
  });
}

export interface ProduceInput {
  gameId?: string;
  template?: string;
  skin?: string;
  seed?: number;
  name?: string;
  profile?: string;
  maxMoves?: number;
  beamWidth?: number;
  maxExpandedStates?: number;
  quality?: 'preview' | 'standard' | 'cinematic';
  outDir?: string;
  render?: boolean;
  maxFrames?: number;
  chromePath?: string | null;
}

export async function commandProduce(input: ProduceInput): Promise<unknown> {
  return withCliErrors('PRODUCE_FAILED', async () => {
    const gameId = requireGameId(input.gameId);
    if (!input.outDir) throw new MeloHeadlessError('CLI_ARGUMENT_REQUIRED', '--out-dir is required.', { path: '--out-dir' });
    const platform = ensureDefaultHeadlessPlatform();
    const authoring = platform.authoring.require(gameId);
    const agent = platform.agents.require(gameId);
    const seed = input.seed ?? 1;
    let scaffold = authoring.scaffold({
      seed,
      ...(input.template !== undefined ? { template: input.template } : {}),
      ...(input.skin !== undefined ? { skin: input.skin } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
    });
    if (input.skin) {
      const skinned = authoring.applySkin(scaffold.config, input.skin);
      scaffold = {
        ...scaffold,
        config: skinned.config,
        skinId: skinned.skinId,
        notes: [...scaffold.notes, ...skinned.notes],
      };
    }
    const runRequest = {
      config: scaffold.config,
      seed,
      ...(input.profile !== undefined ? { profile: input.profile } : {}),
      ...(input.maxMoves !== undefined ? { maxMoves: input.maxMoves } : {}),
      ...((input.beamWidth !== undefined || input.maxExpandedStates !== undefined)
        ? {
            options: {
              ...(input.beamWidth !== undefined ? { beamWidth: input.beamWidth } : {}),
              ...(input.maxExpandedStates !== undefined ? { maxExpandedStates: input.maxExpandedStates } : {}),
            },
          }
        : {}),
    };
    const agentResult = await Promise.resolve(agent.run(runRequest));
    const takes: GameReplayEnvelope[] = agentResult.validation.valid ? [agentResult.replay] : [];
    const document: StudioProjectDocumentV2 = authoring.emitDocument({
      config: scaffold.config,
      seed,
      takes,
      skin: scaffold.skinId,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.quality !== undefined ? { quality: input.quality } : {}),
    });
    validateStudioProjectDocumentV2(document, platform.games);

    let frames: {
      gameId: string;
      takeId: string;
      fps: number;
      totalFrames: number;
      frameSourceHash: string;
      rendered: false;
      note: string;
    } | null = null;
    if (document.takes[0]) {
      const source = compileFrameSourceFromDocument(document, platform, {
        takeId: document.takes[0].takeId,
        directorProfile: document.direction?.rhythm ?? {},
        fps: document.production.output.fps,
      });
      frames = {
        gameId: source.gameId,
        takeId: source.takeId,
        fps: source.fps,
        totalFrames: source.totalFrames,
        frameSourceHash: source.frameSourceHash,
        rendered: false,
        note: 'Node compiles the presentation source only. Pixel frames and MP4 require `melo render` (Chrome/WebCodecs).',
      };
    }

    const renderRequest = createRenderRequest({
      rendered: false,
      gameId,
      takeId: document.takes[0]?.takeId ?? null,
      output: document.production.output,
      files: {
        config: 'config.json',
        take: document.takes[0] ? 'take.json' : null,
        document: 'document.json',
        frames: frames ? 'frames.json' : null,
      },
      reason: 'CLI Node runtime does not encode video. Run `melo render --out-dir …` (Chrome/WebCodecs) or omit --render.',
      code: 'NOT_RUN',
    });

    const directory = input.outDir;
    await mkdir(directory, { recursive: true });
    const files = {
      config: await writeJson(join(directory, 'config.json'), scaffold.config),
      document: await writeJson(join(directory, 'document.json'), document),
      renderRequest: await writeJson(join(directory, 'render-request.json'), renderRequest),
      ...(document.takes[0] ? { take: await writeJson(join(directory, 'take.json'), document.takes[0]) } : {}),
      ...(frames ? { frames: await writeJson(join(directory, 'frames.json'), frames) } : {}),
    };

    let render: unknown = null;
    let finalRequest = renderRequest;
    if (input.render) {
      if (!document.takes[0]) {
        render = {
          ok: false,
          rendered: false,
          recoverable: true,
          code: 'DOCUMENT_HAS_NO_TAKE',
        };
      } else {
        const renderInput: RenderCommandInput = { outDir: directory };
        if (input.quality !== undefined) renderInput.quality = input.quality;
        if (input.maxFrames !== undefined) renderInput.maxFrames = input.maxFrames;
        if (input.chromePath !== undefined) renderInput.chromePath = input.chromePath;
        render = await commandRender(renderInput);
        if (render && typeof render === 'object' && 'renderRequest' in render) {
          finalRequest = (render as { renderRequest: typeof renderRequest }).renderRequest;
        }
      }
    }

    return {
      ok: agentResult.validation.valid,
      rendered: Boolean(render && typeof render === 'object' && 'rendered' in render && (render as { rendered: unknown }).rendered),
      gameId,
      templateId: scaffold.templateId,
      skinId: scaffold.skinId,
      status: agentResult.status,
      validation: agentResult.validation,
      ...(agentResult.metrics !== undefined ? { metrics: agentResult.metrics } : {}),
      notes: scaffold.notes,
      frames,
      renderRequest: finalRequest,
      ...(render !== null ? { render } : {}),
      outDir: resolve(directory),
      files,
    };
  });
}
