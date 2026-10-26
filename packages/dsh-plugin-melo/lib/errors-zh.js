/** @typedef {{ zh: string; hint: string; retry?: string }} MeloErrorGuide */

const GUIDES = {
  CHROME_NOT_FOUND: {
    zh: '未找到 Google Chrome / Chromium，无法编码 MP4。',
    hint: '安装 Chrome，或设置环境变量 CHROME_PATH 指向可执行文件；工程文件仍会保留，可稍后 melo_render。',
    retry: '安装 Chrome 后调用 melo_render，或在本机 Placement Studio 做商业级审片。',
  },
  CLI_ARGUMENT_REQUIRED: {
    zh: 'CLI 缺少必填参数。',
    hint: '对照工具 schema 或官方 Skill 补全参数。',
  },
  PRODUCE_FAILED: {
    zh: 'produce 流水线失败。',
    hint: '先 melo_health 检查环境，再查看 JSON 中的 validation / code。',
    retry: '可减小 maxMoves 或换 seed 后重试。',
  },
  RENDER_FAILED: {
    zh: 'Chrome 出片失败。',
    hint: '查看 out-dir 内 chrome-capture.json 与 errors 字段。',
    retry: '缩短 maxFrames 或换 preview 质量后重试 melo_render。',
  },
  NOT_RENDERED: {
    zh: '出片未生成 MP4。',
    hint: 'rendered 为 false；检查 render-request.json。',
  },
  DOCUMENT_HAS_NO_TAKE: {
    zh: '工程没有有效 Take，无法出片。',
    hint: 'Agent 试玩未通过校验；换 seed 或调 maxMoves 后重新 produce。',
  },
  MELO_CLI_NOT_FOUND: {
    zh: '找不到 melo CLI 可执行文件。',
    hint: '在 Melo 仓库执行 npm run build:cli，并设置 MELO_CLI_PATH 或把 melo 加入 PATH。',
  },
  MELO_CLI_FAILED: {
    zh: 'melo CLI 执行失败。',
    hint: '查看 stderr 与返回 JSON 的 code / message。',
  },
  NODE_VERSION_LOW: {
    zh: 'Node 版本过低。',
    hint: 'Melo 需要 Node >= 22.12。',
  },
  OUT_DIR_NOT_WRITABLE: {
    zh: '输出目录不可写。',
    hint: '换会话工作区下的 melo-out/ 或检查磁盘权限。',
  },
};

/**
 * @param {string | undefined} code
 * @returns {MeloErrorGuide | null}
 */
export function mapErrorToZh(code) {
  if (!code) return null;
  return GUIDES[code] ?? {
    zh: `错误码：${code}`,
    hint: '参阅 docs/dsh/README.md 或 skills/melo-diagnose。',
  };
}
