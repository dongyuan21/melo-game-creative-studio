#!/usr/bin/env node

import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AssetRegistry,
  MELO_CAPABILITIES,
  MeloHeadlessError,
  compileMaterialRuntime,
  compileVariant,
  DESIGN_RESOLUTION,
  expandGoldenSceneCases,
  renderGoldenReportHtml,
  runQualityGate,
  summarizeCalibrationCases,
  validateAssetManifest,
  type AssetManifest,
  type CalibrationCase,
  type CreativeMaster,
  type GoldenBatchReport,
  type HeadlessRendererId,
  type MaterialPackManifest,
  type ResolvedRenderPlan,
  type VariantRecipe,
} from '../headless/index.js';
import { ensureDefaultHeadlessPlatform } from '../bootstrap/headlessBootstrap.js';
import { commandAgent, type AgentCommandInput } from './commands/agent.js';
import {
  commandAuthoringCatalog,
  commandDocumentCompile,
  commandDocumentEmit,
  commandProduce,
  commandProjectScaffold,
  commandSkin,
} from './commands/authoring.js';
import { commandProjectMigrate } from './commands/projectMigrate.js';
import { commandRender, type RenderCommandInput } from './commands/render.js';
import { commandTake, type TakeCommandInput } from './commands/take.js';

interface ParsedArgs {
  positionals: string[];
  flags: Map<string, string | boolean>;
}

const SCHEMAS: Record<string, string> = {
  'asset-manifest@1': 'asset-manifest.schema.json',
  'creative-master@1': 'creative-master.schema.json',
  'variant-recipe@1': 'variant-recipe.schema.json',
  'resolved-render-plan@1': 'resolved-render-plan.schema.json',
};

function parseArgs(values: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (!value.startsWith('--')) {
      positionals.push(value);
      continue;
    }
    const equals = value.indexOf('=');
    if (equals > 2) {
      flags.set(value.slice(2, equals), value.slice(equals + 1));
      continue;
    }
    const key = value.slice(2);
    const next = values[index + 1];
    if (next && !next.startsWith('--')) {
      flags.set(key, next);
      index += 1;
    } else {
      flags.set(key, true);
    }
  }
  return { positionals, flags };
}

function flagString(args: ParsedArgs, name: string, required = false): string | undefined {
  const value = args.flags.get(name);
  if (typeof value === 'string') return value;
  if (required) throw new MeloHeadlessError('CLI_ARGUMENT_REQUIRED', `--${name} is required.`, { path: `--${name}` });
  return undefined;
}

function flagNumber(args: ParsedArgs, name: string): number | undefined {
  const value = flagString(args, name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new MeloHeadlessError('CLI_ARGUMENT_INVALID', `--${name} must be numeric.`, { path: `--${name}` });
  return parsed;
}

function flagBoolean(args: ParsedArgs, name: string): boolean {
  return args.flags.get(name) === true;
}

async function readJson<T>(path: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (error) {
    throw new MeloHeadlessError('JSON_READ_FAILED', `Unable to read JSON file ${path}.`, {
      path,
      details: error instanceof Error ? error.message : error,
    });
  }
}

async function collectJsonFiles(root: string): Promise<string[]> {
  const info = await stat(root).catch(() => null);
  if (!info) throw new MeloHeadlessError('ASSET_PATH_NOT_FOUND', `Asset path ${root} does not exist.`, { path: root });
  if (info.isFile()) return extname(root).toLowerCase() === '.json' ? [root] : [];
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const child = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await collectJsonFiles(child));
    else if (entry.isFile() && extname(entry.name).toLowerCase() === '.json') files.push(child);
  }
  return files.sort();
}

async function loadRegistry(root: string): Promise<AssetRegistry> {
  const registry = new AssetRegistry();
  for (const file of await collectJsonFiles(root)) {
    const value = await readJson<unknown>(file);
    if (
      typeof value === 'object'
      && value !== null
      && (value as { contract?: unknown }).contract === 'melo.asset-manifest'
    ) {
      try {
        registry.register(value as AssetManifest);
      } catch (error) {
        if (error instanceof MeloHeadlessError) {
          throw new MeloHeadlessError(error.code, `${file}: ${error.message}`, {
            path: error.path ?? file,
            recoverable: error.recoverable,
            details: error.details,
          });
        }
        throw error;
      }
    }
  }
  return registry;
}

function schemaRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return resolve(dirname(currentFile), '../../schemas/headless');
}

async function commandSchema(args: ParsedArgs): Promise<unknown> {
  const action = args.positionals[0];
  if (action === 'list') return { ok: true, schemas: Object.keys(SCHEMAS).sort() };
  if (action === 'get') {
    const name = args.positionals[1];
    if (!name || !SCHEMAS[name]) {
      throw new MeloHeadlessError('SCHEMA_NOT_FOUND', `Unknown schema ${name ?? '(missing)'}.`, { path: 'schema' });
    }
    return { ok: true, name, schema: await readJson<unknown>(join(schemaRoot(), SCHEMAS[name])) };
  }
  throw new MeloHeadlessError('CLI_COMMAND_INVALID', 'Use `schema list` or `schema get <name>`.', { path: 'schema' });
}

async function commandAsset(args: ParsedArgs): Promise<unknown> {
  if (args.positionals[0] !== 'validate') {
    throw new MeloHeadlessError('CLI_COMMAND_INVALID', 'Use `asset validate <manifest.json>`.', { path: 'asset' });
  }
  const path = args.positionals[1];
  if (!path) throw new MeloHeadlessError('CLI_ARGUMENT_REQUIRED', 'Asset manifest path is required.', { path: 'asset' });
  const manifest = await readJson<unknown>(path);
  const issues = validateAssetManifest(manifest);
  return {
    ok: !issues.some((candidate) => candidate.severity === 'error'),
    file: resolve(path),
    issues,
  };
}

async function commandVariant(args: ParsedArgs): Promise<unknown> {
  if (args.positionals[0] !== 'compile') {
    throw new MeloHeadlessError('CLI_COMMAND_INVALID', 'Use `variant compile --master … --recipe … --assets …`.', { path: 'variant' });
  }
  const masterPath = flagString(args, 'master', true)!;
  const recipePath = flagString(args, 'recipe', true)!;
  const assetsPath = flagString(args, 'assets', true)!;
  const renderer = (flagString(args, 'renderer') ?? 'fixed-camera-cinematic') as HeadlessRendererId;
  if (!MELO_CAPABILITIES.renderers.includes(renderer)) {
    throw new MeloHeadlessError('RENDERER_UNSUPPORTED', `Renderer ${renderer} is not supported.`, { path: '--renderer' });
  }
  const registry = await loadRegistry(assetsPath);
  const master = await readJson<CreativeMaster>(masterPath);
  const recipe = await readJson<VariantRecipe>(recipePath);
  const plan = compileVariant(master, recipe, registry, {
    renderer,
    requireHashes: flagBoolean(args, 'require-hashes'),
  });
  const out = flagString(args, 'out');
  if (out) await writeFile(out, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  return { ok: true, registryAssets: registry.size, out: out ? resolve(out) : null, plan };
}

async function commandQuality(args: ParsedArgs): Promise<unknown> {
  if (args.positionals[0] !== 'check') {
    throw new MeloHeadlessError('CLI_COMMAND_INVALID', 'Use `quality check --plan …`.', { path: 'quality' });
  }
  const planPath = flagString(args, 'plan', true)!;
  const plan = await readJson<ResolvedRenderPlan>(planPath);
  const maxTextureMemoryMiB = flagNumber(args, 'max-texture-mib');
  const maxTriangleCount = flagNumber(args, 'max-triangles');
  const maxPluginMemoryMiB = flagNumber(args, 'max-plugin-mib');
  const report = runQualityGate(plan, {
    strict: flagBoolean(args, 'strict'),
    requireHashes: flagBoolean(args, 'require-hashes'),
    ...(maxTextureMemoryMiB !== undefined ? { maxTextureMemoryMiB } : {}),
    ...(maxTriangleCount !== undefined ? { maxTriangleCount } : {}),
    ...(maxPluginMemoryMiB !== undefined ? { maxPluginMemoryMiB } : {}),
  });
  const out = flagString(args, 'out');
  if (out) await writeFile(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return { ok: report.passed, out: out ? resolve(out) : null, report };
}

async function commandMaterial(args: ParsedArgs): Promise<unknown> {
  if (args.positionals[0] !== 'compile') {
    throw new MeloHeadlessError('CLI_COMMAND_INVALID', 'Use `material compile --pack …`.', { path: 'material' });
  }
  const packPath = flagString(args, 'pack', true)!;
  const pack = await readJson<MaterialPackManifest>(packPath);
  const descriptor = compileMaterialRuntime({ pack });
  const out = flagString(args, 'out');
  if (out) await writeFile(out, `${JSON.stringify(descriptor, null, 2)}\n`, 'utf8');
  return {
    ok: true,
    rendered: false,
    resourcesReady: descriptor.maps.length === 0,
    out: out ? resolve(out) : null,
    descriptor,
  };
}

async function commandGolden(args: ParsedArgs): Promise<unknown> {
  if (args.positionals[0] !== 'batch') {
    throw new MeloHeadlessError('CLI_COMMAND_INVALID', 'Use `golden batch --index …`.', { path: 'golden' });
  }
  const indexPath = flagString(args, 'index', true)!;
  const index = await readJson<{
    sourceVideoSha256?: string;
    scenes: Array<{ id: string; startFrame: number; peakFrame: number; endFrame: number; purpose: string }>;
  }>(indexPath);
  const targetTakeHash = flagString(args, 'target-take-hash');
  const correspondence = targetTakeHash ? 'exact-replay' as const : 'isolated-presentation' as const;
  const unresolvedReasons = [
    'Reference source video is not in the public repository.',
    ...(targetTakeHash
      ? []
      : ['No target Take hash; correspondence is isolated-presentation, not exact-replay.']),
  ];
  const cases = expandGoldenSceneCases(index.scenes, {
    correspondence,
    reviewStatus: 'BLOCKED',
    unresolvedReasons,
    ...(index.sourceVideoSha256 ? { referenceMediaHash: `sha256:${index.sourceVideoSha256}` } : {}),
    sourceFps: 60,
    targetFps: 30,
    ...(targetTakeHash !== undefined ? { targetTakeHash } : {}),
  });
  const report: GoldenBatchReport = {
    contract: 'melo.golden-batch-report',
    contractVersion: '1.0.0',
    generatedAt: 'not-a-wall-clock-render',
    designResolution: { width: DESIGN_RESOLUTION.width, height: DESIGN_RESOLUTION.height },
    cases: cases.map((item: CalibrationCase) => ({
      case: item,
      identity: `${item.id}:${item.correspondence}:${item.targetFrame}`,
    })),
    summary: summarizeCalibrationCases(cases),
  };
  const out = flagString(args, 'out');
  const htmlOut = flagString(args, 'html');
  if (out) await writeFile(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (htmlOut) await writeFile(htmlOut, renderGoldenReportHtml(report), 'utf8');
  return { ok: true, rendered: false, out: out ? resolve(out) : null, html: htmlOut ? resolve(htmlOut) : null, report };
}

async function commandProject(args: ParsedArgs): Promise<unknown> {
  if (args.positionals[0] === 'scaffold') {
    const input: Parameters<typeof commandProjectScaffold>[0] = {};
    const gameId = flagString(args, 'game');
    const template = flagString(args, 'template');
    const skin = flagString(args, 'skin');
    const seed = flagNumber(args, 'seed');
    const name = flagString(args, 'name');
    const out = flagString(args, 'out');
    if (gameId !== undefined) input.gameId = gameId;
    if (template !== undefined) input.template = template;
    if (skin !== undefined) input.skin = skin;
    if (seed !== undefined) input.seed = seed;
    if (name !== undefined) input.name = name;
    if (out !== undefined) input.out = out;
    return commandProjectScaffold(input);
  }
  if (args.positionals[0] !== 'migrate') {
    throw new MeloHeadlessError(
      'CLI_COMMAND_INVALID',
      'Use `project scaffold --game <id>` or `project migrate <project.json>`.',
      { path: 'project' },
    );
  }
  const path = args.positionals[1];
  if (!path) throw new MeloHeadlessError('CLI_ARGUMENT_REQUIRED', 'Project path is required.', { path: 'project' });
  return commandProjectMigrate(path, flagString(args, 'out'));
}

async function execute(argv: string[]): Promise<unknown> {
  ensureDefaultHeadlessPlatform();
  const [command, ...rest] = argv;
  const args = parseArgs(rest);
  if (command === 'capabilities') return { ok: true, capabilities: MELO_CAPABILITIES };
  if (command === 'schema') return commandSchema(args);
  if (command === 'asset') return commandAsset(args);
  if (command === 'variant') return commandVariant(args);
  if (command === 'quality') return commandQuality(args);
  if (command === 'material') return commandMaterial(args);
  if (command === 'golden') return commandGolden(args);
  if (command === 'project') return commandProject(args);
  if (command === 'agent') {
    const input: AgentCommandInput = { action: args.positionals[0] };
    const gameId = flagString(args, 'game');
    const seed = flagNumber(args, 'seed');
    const profile = flagString(args, 'profile');
    const maxMoves = flagNumber(args, 'max-moves');
    const beamWidth = flagNumber(args, 'beam-width');
    const maxExpandedStates = flagNumber(args, 'max-expanded-states');
    const out = flagString(args, 'out');
    const config = flagString(args, 'config');
    if (gameId !== undefined) input.gameId = gameId;
    if (seed !== undefined) input.seed = seed;
    if (profile !== undefined) input.profile = profile;
    if (maxMoves !== undefined) input.maxMoves = maxMoves;
    if (beamWidth !== undefined) input.beamWidth = beamWidth;
    if (maxExpandedStates !== undefined) input.maxExpandedStates = maxExpandedStates;
    if (out !== undefined) input.out = out;
    if (config !== undefined) input.config = await readJson(config);
    return commandAgent(input);
  }
  if (command === 'take') {
    if (args.positionals[0] !== 'validate') {
      throw new MeloHeadlessError(
        'CLI_COMMAND_INVALID',
        'Use `take validate --take <file.json> [--game <id>] [--config <file.json>]`.',
        { path: 'take' },
      );
    }
    const takePath = flagString(args, 'take', true)!;
    const input: TakeCommandInput = {
      action: 'validate',
      take: await readJson(takePath),
    };
    const gameId = flagString(args, 'game');
    const config = flagString(args, 'config');
    const out = flagString(args, 'out');
    if (gameId !== undefined) input.gameId = gameId;
    if (config !== undefined) input.config = await readJson(config);
    if (out !== undefined) input.out = out;
    return commandTake(input);
  }
  if (command === 'authoring') {
    if (args.positionals[0] !== 'catalog') {
      throw new MeloHeadlessError('CLI_COMMAND_INVALID', 'Use `authoring catalog [--game <id>]`.', { path: 'authoring' });
    }
    const catalogInput: Parameters<typeof commandAuthoringCatalog>[0] = {};
    const gameId = flagString(args, 'game');
    if (gameId !== undefined) catalogInput.gameId = gameId;
    return commandAuthoringCatalog(catalogInput);
  }
  if (command === 'skin') {
    const skinInput: Parameters<typeof commandSkin>[0] = { action: args.positionals[0] };
    const gameId = flagString(args, 'game');
    const skin = flagString(args, 'skin');
    const out = flagString(args, 'out');
    const config = flagString(args, 'config');
    if (gameId !== undefined) skinInput.gameId = gameId;
    if (skin !== undefined) skinInput.skin = skin;
    if (out !== undefined) skinInput.out = out;
    if (config !== undefined) skinInput.config = await readJson(config);
    return commandSkin(skinInput);
  }
  if (command === 'document') {
    if (args.positionals[0] === 'emit') {
      const emitInput: Parameters<typeof commandDocumentEmit>[0] = {};
      const gameId = flagString(args, 'game');
      const config = flagString(args, 'config', true);
      const take = flagString(args, 'take');
      const skin = flagString(args, 'skin');
      const seed = flagNumber(args, 'seed');
      const name = flagString(args, 'name');
      const quality = flagString(args, 'quality');
      const out = flagString(args, 'out');
      if (gameId !== undefined) emitInput.gameId = gameId;
      emitInput.config = await readJson(config!);
      if (take !== undefined) emitInput.take = await readJson(take);
      if (skin !== undefined) emitInput.skin = skin;
      if (seed !== undefined) emitInput.seed = seed;
      if (name !== undefined) emitInput.name = name;
      if (quality === 'preview' || quality === 'standard' || quality === 'cinematic') emitInput.quality = quality;
      if (out !== undefined) emitInput.out = out;
      return commandDocumentEmit(emitInput);
    }
    if (args.positionals[0] !== 'compile') {
      throw new MeloHeadlessError(
        'CLI_COMMAND_INVALID',
        'Use `document emit --game <id> --config <file>` or `document compile --document <file>`.',
        { path: 'document' },
      );
    }
    const compileInput: Parameters<typeof commandDocumentCompile>[0] = {
      document: await readJson(flagString(args, 'document', true)!),
    };
    const takeId = flagString(args, 'take-id');
    const fps = flagNumber(args, 'fps');
    const out = flagString(args, 'out');
    if (takeId !== undefined) compileInput.takeId = takeId;
    if (fps !== undefined) compileInput.fps = fps;
    if (out !== undefined) compileInput.out = out;
    return commandDocumentCompile(compileInput);
  }
  if (command === 'produce') {
    const produceInput: Parameters<typeof commandProduce>[0] = {};
    const gameId = flagString(args, 'game');
    const template = flagString(args, 'template');
    const skin = flagString(args, 'skin');
    const seed = flagNumber(args, 'seed');
    const name = flagString(args, 'name');
    const profile = flagString(args, 'profile');
    const maxMoves = flagNumber(args, 'max-moves');
    const beamWidth = flagNumber(args, 'beam-width');
    const maxExpandedStates = flagNumber(args, 'max-expanded-states');
    const quality = flagString(args, 'quality');
    const outDir = flagString(args, 'out-dir');
    const maxFrames = flagNumber(args, 'max-frames');
    if (gameId !== undefined) produceInput.gameId = gameId;
    if (template !== undefined) produceInput.template = template;
    if (skin !== undefined) produceInput.skin = skin;
    if (seed !== undefined) produceInput.seed = seed;
    if (name !== undefined) produceInput.name = name;
    if (profile !== undefined) produceInput.profile = profile;
    if (maxMoves !== undefined) produceInput.maxMoves = maxMoves;
    if (beamWidth !== undefined) produceInput.beamWidth = beamWidth;
    if (maxExpandedStates !== undefined) produceInput.maxExpandedStates = maxExpandedStates;
    if (quality === 'preview' || quality === 'standard' || quality === 'cinematic') produceInput.quality = quality;
    if (outDir !== undefined) produceInput.outDir = outDir;
    if (maxFrames !== undefined) produceInput.maxFrames = maxFrames;
    if (flagBoolean(args, 'render')) produceInput.render = true;
    return commandProduce(produceInput);
  }
  if (command === 'render') {
    const renderInput: RenderCommandInput = {};
    if (flagBoolean(args, 'list')) renderInput.list = true;
    const documentPath = flagString(args, 'document');
    const outDir = flagString(args, 'out-dir');
    const takeId = flagString(args, 'take-id');
    const quality = flagString(args, 'quality');
    const maxFrames = flagNumber(args, 'max-frames');
    const timeoutMs = flagNumber(args, 'timeout-ms');
    if (documentPath !== undefined) renderInput.documentPath = documentPath;
    if (outDir !== undefined) renderInput.outDir = outDir;
    if (takeId !== undefined) renderInput.takeId = takeId;
    if (quality === 'preview' || quality === 'standard' || quality === 'cinematic') renderInput.quality = quality;
    if (maxFrames !== undefined) renderInput.maxFrames = maxFrames;
    if (timeoutMs !== undefined) renderInput.timeoutMs = timeoutMs;
    if (flagBoolean(args, 'still-only')) renderInput.video = false;
    return commandRender(renderInput);
  }
  throw new MeloHeadlessError(
    'CLI_COMMAND_INVALID',
    'Commands: capabilities, schema list|get, asset validate, variant compile, quality check, material compile, golden batch, project scaffold|migrate, authoring catalog, skin list|apply, agent list|run, take validate, document emit|compile, produce, render.',
    { path: command ?? '(missing command)' },
  );
}

try {
  const result = await execute(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (
    typeof result === 'object'
    && result !== null
    && 'ok' in result
    && (result as { ok: unknown }).ok === false
  ) process.exitCode = 1;
} catch (error) {
  const normalized = error instanceof MeloHeadlessError
    ? {
        code: error.code,
        message: error.message,
        ...(error.path !== undefined ? { path: error.path } : {}),
        recoverable: error.recoverable,
        ...(error.details !== undefined ? { details: error.details } : {}),
      }
    : {
        code: 'UNEXPECTED_ERROR',
        message: error instanceof Error ? error.message : String(error),
        recoverable: false,
      };
  process.stderr.write(`${JSON.stringify({ ok: false, error: normalized }, null, 2)}\n`);
  process.exitCode = 1;
}
