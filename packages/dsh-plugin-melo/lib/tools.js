import path from 'node:path';
import { buildProduceArgv, buildRenderArgv, runMelo, resolveMeloCliPath } from './melo-cli.js';
import { collectHealth } from './health.js';
import { mapErrorToZh } from './errors-zh.js';
import { pathTriple, pickMp4Path, presentMp4 } from './present-mp4.js';

function specToJsonSchema(spec) {
  const properties = {};
  const required = [];
  for (const [key, node] of Object.entries(spec)) {
    const { required: isRequired, ...rest } = node;
    properties[key] = rest;
    if (isRequired) required.push(key);
  }
  return { type: 'object', properties, ...(required.length ? { required } : {}) };
}

function defineTool(options) {
  return {
    name: options.name,
    description: options.description,
    parameters: specToJsonSchema(options.parameters),
    output: { schema: options.output.schema, render: options.output.render },
    execute: options.execute,
  };
}

function sessionCwd(ctx, session) {
  const header = session?.header;
  if (header && typeof header.cwd === 'string' && header.cwd) return header.cwd;
  return process.cwd();
}

function enrichResult(payload, sessionCwd, stage) {
  const base = payload && typeof payload === 'object' ? { ...payload } : { raw: payload };
  const code = typeof base.code === 'string' ? base.code : undefined;
  const guide = mapErrorToZh(code);
  const outDir = typeof base.outDir === 'string' ? base.outDir : undefined;
  let paths = null;
  if (outDir) {
    const mp4 = pickMp4Path(base, outDir);
    if (mp4) paths = pathTriple(mp4, sessionCwd);
  }
  return {
    stage,
    ...base,
    ...(guide ? { errorZh: guide.zh, errorHint: guide.hint, ...(guide.retry ? { retryHint: guide.retry } : {}) } : {}),
    ...(paths ?? {}),
    expectationNote: 'CLI preview 画质用于快速验收；商业级视觉请在 Placement Studio 五条片单审片。',
  };
}

const STUDIO_URL = 'http://127.0.0.1:4173';

/**
 * @param {import('./index.js').MeloPluginContext} ctx
 */
export function registerMeloTools(ctx) {
  const meloPath = resolveMeloCliPath();

  ctx.tools.register(defineTool({
    name: 'melo_health',
    description:
      'Melo 环境健康卡：Node、melo CLI、capabilities、Chrome、可写 out-dir。首次 produce/render 前应先调用。',
    parameters: {
      probeOutDir: { type: 'string', description: '可选：探测可写性的目录，默认 <会话>/melo-out' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: value.cardZh ?? JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const session = exec?.agent?.session;
      const cwd = session ? sessionCwd(ctx, session) : process.cwd();
      const probe = args.probeOutDir ? path.resolve(cwd, String(args.probeOutDir)) : undefined;
      const health = await collectHealth({ cwd, meloPath, probeOutDir: probe });
      return health;
    },
  }));

  ctx.tools.register(defineTool({
    name: 'melo_capabilities',
    description: '原始 melo capabilities JSON（与 `melo capabilities` 1:1）。',
    parameters: {},
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(_args, exec) {
      const session = exec?.agent?.session;
      const cwd = session ? sessionCwd(ctx, session) : process.cwd();
      const result = await runMelo(['capabilities'], { cwd, meloPath, signal: exec?.signal });
      if (!result.json) {
        return { ok: false, code: 'MELO_CLI_FAILED', stderr: result.stderr };
      }
      return result.json;
    },
  }));

  ctx.tools.register(defineTool({
    name: 'melo_produce',
    description:
      '零决策预览默认：block-placement + showcase + preview + 短 max-frames，out-dir 默认 melo-out/。'
      + ' 对应 `melo produce`（可加 --render）。成功出片时返回 MP4 绝对/相对路径并交给 deliverables 通道。',
    parameters: {
      gameId: { type: 'string', description: '默认 block-placement' },
      template: { type: 'string', description: '默认 showcase' },
      skin: { type: 'string', description: '可选皮肤 id' },
      seed: { type: 'number', description: '默认 1' },
      quality: { type: 'string', description: 'preview | standard | cinematic，默认 preview' },
      maxMoves: { type: 'number', description: '默认 5' },
      maxFrames: { type: 'number', description: '默认 48（预览用）' },
      outDir: { type: 'string', description: '相对会话 cwd，默认 melo-out' },
      render: { type: 'boolean', description: '为 true 时追加 --render（需要 Chrome）' },
      skipHealthCheck: { type: 'boolean', description: '跳过内置健康探测' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => {
        const lines = [];
        if (value.healthCard) lines.push(value.healthCard);
        lines.push(`阶段：${value.stage ?? 'produce'}`);
        if (value.mp4Absolute) lines.push(`MP4：${value.mp4Absolute}（${value.mp4WorkspaceRelative}）`);
        lines.push(JSON.stringify(value, null, 2));
        return [{ type: 'text', text: lines.join('\n\n') }];
      },
    },
    async execute(args, exec) {
      const session = exec?.agent?.session;
      const cwd = session ? sessionCwd(ctx, session) : process.cwd();
      let healthCard;
      if (!args.skipHealthCheck) {
        const health = await collectHealth({ cwd, meloPath });
        healthCard = health.cardZh;
        if (!health.readyForProduce) {
          return { ok: false, stage: 'health', healthCard, ...health };
        }
      }
      const { argv, outDir } = buildProduceArgv(args, cwd);
      const stages = ['scaffold', 'agent-play', 'document', ...(args.render ? ['render'] : [])];
      const result = await runMelo(argv, { cwd, meloPath, signal: exec?.signal });
      const payload = result.json ?? { ok: false, code: 'MELO_CLI_FAILED', stderr: result.stderr };
      const enriched = enrichResult({ ...payload, outDir: payload.outDir ?? outDir, healthCard, stages }, cwd, 'produce');
      const mp4 = pickMp4Path(enriched, outDir);
      if (mp4 && enriched.rendered) {
        Object.assign(enriched, pathTriple(mp4, cwd));
        presentMp4(ctx, exec, { absolutePath: mp4, title: 'Melo 预览 MP4' });
      }
      return enriched;
    },
  }));

  ctx.tools.register(defineTool({
    name: 'melo_render',
    description: '对已有 out-dir 工程调用 `melo render`；成功时交付 MP4 路径并走 deliverables 通道。',
    parameters: {
      outDir: { type: 'string', description: '相对会话 cwd，默认 melo-out' },
      documentPath: { type: 'string', description: '可选：覆盖 document.json 路径' },
      quality: { type: 'string', description: '默认 preview' },
      maxFrames: { type: 'number', description: '预览可设较小值' },
      takeId: { type: 'string', description: '可选 take id' },
      skipHealthCheck: { type: 'boolean', description: '跳过健康卡' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const session = exec?.agent?.session;
      const cwd = session ? sessionCwd(ctx, session) : process.cwd();
      if (!args.skipHealthCheck) {
        const health = await collectHealth({ cwd, meloPath });
        if (!health.readyForProduce) {
          return { ok: false, stage: 'health', healthCard: health.cardZh, ...health };
        }
      }
      const { argv, outDir } = buildRenderArgv(args, cwd);
      const result = await runMelo(argv, { cwd, meloPath, signal: exec?.signal });
      const payload = result.json ?? { ok: false, code: 'MELO_CLI_FAILED', stderr: result.stderr };
      const enriched = enrichResult({ ...payload, outDir: payload.outDir ?? outDir, stages: ['render'] }, cwd, 'render');
      const mp4 = pickMp4Path(enriched, outDir);
      if (mp4 && enriched.rendered) {
        Object.assign(enriched, pathTriple(mp4, cwd));
        presentMp4(ctx, exec, { absolutePath: mp4, title: 'Melo 渲染 MP4' });
      }
      return enriched;
    },
  }));

  ctx.tools.register(defineTool({
    name: 'melo_studio',
    description:
      '打印本地 Placement Studio URL（默认 npm run dev → http://127.0.0.1:4173）。不启动服务，仅给人类精修路径。',
    parameters: {
      urlOnly: { type: 'boolean', description: '只返回 URL 字符串' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: value.instructionsZh ?? value.url }],
    },
    async execute(args) {
      const url = STUDIO_URL;
      if (args.urlOnly) return { url };
      return {
        url,
        instructionsZh: [
          `Placement Studio：${url}`,
          '在 Melo 仓库根目录执行 `npm run dev` 启动 Vite（端口 4173）。',
          'Studio 用于商业级五条片单审片；CLI preview 仅作快速预览。',
        ].join('\n'),
      };
    },
  }));
}
