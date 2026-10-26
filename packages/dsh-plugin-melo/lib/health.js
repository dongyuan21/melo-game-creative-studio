import { existsSync } from 'node:fs';
import { runMelo, resolveMeloCliPath, ensureWritableDir } from './melo-cli.js';
import { mapErrorToZh } from './errors-zh.js';

const MIN_NODE = [22, 12];

function parseNodeVersion() {
  const match = /^v(\d+)\.(\d+)/.exec(process.version);
  if (!match) return { major: 0, minor: 0, ok: false };
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const ok = major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1]);
  return { major, minor, ok };
}

function findChromePath() {
  if (process.env.MELO_RENDER_FORCE_NO_CHROME === '1') return null;
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/local/bin/google-chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.filter(Boolean).find((candidate) => existsSync(candidate)) ?? null;
}

/**
 * @param {{ cwd?: string; meloPath?: string; probeOutDir?: string }} options
 */
export async function collectHealth(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const probeOutDir = options.probeOutDir ?? `${cwd}/melo-out`;
  const node = parseNodeVersion();
  const meloPath = options.meloPath !== undefined ? options.meloPath : resolveMeloCliPath();
  const chromePath = findChromePath();

  let capabilities = null;
  let capabilitiesError = null;
  if (meloPath) {
    const result = await runMelo(['capabilities'], { cwd, meloPath });
    if (result.json && result.json.ok) {
      capabilities = result.json.capabilities;
    } else {
      capabilitiesError = result.stderr || 'capabilities 未返回 JSON';
    }
  }

  let writable = false;
  let writableError = null;
  try {
    await ensureWritableDir(probeOutDir);
    writable = true;
  } catch (error) {
    writableError = error instanceof Error ? error.message : String(error);
  }

  const checks = [
    {
      id: 'node',
      ok: node.ok,
      label: 'Node.js',
      detail: node.ok
        ? `v${node.major}.${node.minor}（满足 >= 22.12）`
        : `${process.version} — 需要 Node >= 22.12`,
      fix: node.ok ? undefined : '升级 Node 或使用 nvm/fnm 安装 22.12+。',
    },
    {
      id: 'melo-cli',
      ok: Boolean(meloPath),
      label: 'Melo CLI',
      detail: meloPath ? meloPath : '未找到 dist-cli/cli/melo.js；请 build:cli 或设置 MELO_CLI_PATH',
      fix: meloPath ? undefined : '在 Melo 仓库运行 npm run build:cli，并 export MELO_CLI_PATH=…/dist-cli/cli/melo.js',
    },
    {
      id: 'capabilities',
      ok: Boolean(capabilities),
      label: 'melo capabilities',
      detail: capabilities
        ? `命令数：${capabilities.commands?.length ?? '—'}`
        : (capabilitiesError ?? '无法调用 capabilities'),
      fix: capabilities ? undefined : '确认 CLI 可执行且 JSON 输出正常。',
    },
    {
      id: 'chrome',
      ok: Boolean(chromePath),
      label: 'Chrome / Chromium',
      detail: chromePath ?? '未检测到 Chrome（出片将返回 CHROME_NOT_FOUND，工程仍可保留）',
      fix: chromePath ? undefined : '安装 Google Chrome，或设置 CHROME_PATH；无 Chrome 时仅生成工程与 frames.json。',
    },
    {
      id: 'out-dir',
      ok: writable,
      label: '可写输出目录',
      detail: writable ? probeOutDir : (writableError ?? '不可写'),
      fix: writable ? undefined : '换工作区路径或修正目录权限。',
    },
  ];

  const readyForProduce = checks.find((c) => c.id === 'node')?.ok
    && checks.find((c) => c.id === 'melo-cli')?.ok
    && checks.find((c) => c.id === 'capabilities')?.ok
    && checks.find((c) => c.id === 'out-dir')?.ok;

  const readyForRender = readyForProduce && checks.find((c) => c.id === 'chrome')?.ok;

  const lines = checks.map((check) => {
    const icon = check.ok ? '✅' : '⚠️';
    const fix = check.fix ? `\n   修复：${check.fix}` : '';
    return `${icon} ${check.label}：${check.detail}${fix}`;
  });

  const chromeGuide = mapErrorToZh('CHROME_NOT_FOUND');

  return {
    ok: Boolean(readyForProduce),
    readyForProduce: Boolean(readyForProduce),
    readyForRender: Boolean(readyForRender),
    checks,
    capabilities,
    meloCliPath: meloPath,
    chromePath,
    probeOutDir,
    cardZh: [
      '## Melo 环境健康卡（首次出片前建议查看）',
      '',
      ...lines,
      '',
      readyForRender
        ? '可以 produce + render 生成预览 MP4。'
        : `可以 produce 生成工程；出片需要 Chrome。${chromeGuide ? `\n${chromeGuide.zh} ${chromeGuide.hint}` : ''}`,
      '',
      '说明：CLI preview 画质 ≠ Placement Studio 商业审片；视觉终审请在 Studio 五条片单。',
    ].join('\n'),
  };
}
