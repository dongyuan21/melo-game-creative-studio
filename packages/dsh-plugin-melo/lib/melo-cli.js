import { existsSync } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_MELO = resolve(PLUGIN_ROOT, '../../dist-cli/cli/melo.js');

/**
 * @returns {string | null}
 */
export function resolveMeloCliPath() {
  const fromEnv = process.env.MELO_CLI_PATH;
  if (fromEnv && existsSync(fromEnv)) return resolve(fromEnv);
  if (existsSync(REPO_MELO)) return REPO_MELO;
  return null;
}

/**
 * @param {string[]} argv
 * @param {{ cwd?: string; signal?: AbortSignal; meloPath?: string }} options
 */
export function runMelo(argv, options = {}) {
  const meloPath = options.meloPath ?? resolveMeloCliPath();
  if (!meloPath) {
    return Promise.resolve({
      ok: false,
      code: 'MELO_CLI_NOT_FOUND',
      stdout: '',
      stderr: 'Set MELO_CLI_PATH or build dist-cli/cli/melo.js in the Melo repository.',
      json: null,
    });
  }
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [meloPath, ...argv], {
      cwd: options.cwd ?? process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: options.signal,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr?.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', (error) => {
      resolvePromise({
        ok: false,
        code: 'MELO_CLI_FAILED',
        stdout,
        stderr: error.message,
        json: null,
      });
    });
    child.on('close', (code) => {
      const trimmed = stdout.trim();
      let json = null;
      if (trimmed) {
        try {
          json = JSON.parse(trimmed);
        } catch {
          json = null;
        }
      }
      resolvePromise({
        ok: code === 0 && json !== null,
        exitCode: code ?? 1,
        stdout,
        stderr,
        json,
      });
    });
  });
}

/**
 * @param {string} directory
 */
export async function ensureWritableDir(directory) {
  await mkdir(directory, { recursive: true });
  const probe = join(directory, '.melo-write-probe');
  await writeFile(probe, 'ok', 'utf8');
  await access(probe);
}

/**
 * @param {Record<string, unknown>} input
 * @param {string} sessionCwd
 */
export function buildProduceArgv(input, sessionCwd) {
  const outDir = typeof input.outDir === 'string' && input.outDir
    ? resolve(sessionCwd, input.outDir)
    : resolve(sessionCwd, 'melo-out');
  const argv = [
    'produce',
    '--game', String(input.gameId ?? 'block-placement'),
    '--template', String(input.template ?? 'showcase'),
    '--seed', String(input.seed ?? 1),
    '--quality', String(input.quality ?? 'preview'),
    '--max-moves', String(input.maxMoves ?? 5),
    '--max-frames', String(input.maxFrames ?? 48),
    '--out-dir', outDir,
  ];
  if (input.skin) argv.push('--skin', String(input.skin));
  if (input.render === true) argv.push('--render');
  if (input.name) argv.push('--name', String(input.name));
  if (input.profile) argv.push('--profile', String(input.profile));
  return { argv, outDir };
}

/**
 * @param {Record<string, unknown>} input
 * @param {string} sessionCwd
 */
export function buildRenderArgv(input, sessionCwd) {
  const outDir = typeof input.outDir === 'string' && input.outDir
    ? resolve(sessionCwd, input.outDir)
    : resolve(sessionCwd, 'melo-out');
  const argv = [
    'render',
    '--out-dir', outDir,
    '--quality', String(input.quality ?? 'preview'),
  ];
  if (input.documentPath) {
    argv.push('--document', resolve(sessionCwd, String(input.documentPath)));
  }
  if (input.maxFrames !== undefined) argv.push('--max-frames', String(input.maxFrames));
  if (input.takeId) argv.push('--take-id', String(input.takeId));
  return { argv, outDir };
}

export { PLUGIN_ROOT };
