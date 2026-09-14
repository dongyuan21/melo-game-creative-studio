import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function findChromePath(): string | null {
  if (process.env.MELO_RENDER_FORCE_NO_CHROME === '1') return null;
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/local/bin/google-chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.filter((candidate): candidate is string => Boolean(candidate))
    .find((candidate) => existsSync(candidate)) ?? null;
}

export function findRepoRoot(fromUrl = import.meta.url): string {
  const starts = [
    process.cwd(),
    resolve(dirname(fileURLToPath(fromUrl))),
  ];
  for (const start of starts) {
    let directory = start;
    for (let index = 0; index < 10; index += 1) {
      if (
        existsSync(resolve(directory, 'scripts/document-render.mjs'))
        && existsSync(resolve(directory, 'tools/document-render.html'))
      ) {
        return directory;
      }
      const parent = resolve(directory, '..');
      if (parent === directory) break;
      directory = parent;
    }
  }
  throw new Error('Unable to locate the Melo Game Creative Studio repository root (scripts/document-render.mjs).');
}
