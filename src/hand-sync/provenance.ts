import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { stableHash, stableStringify } from '../headless/stableHash';
import type { RhythmProfile } from '../domain/types';

export function sha256Bytes(buffer: Buffer | string): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function sha256Utf8File(path: string): string {
  return sha256Bytes(readFileSync(path));
}

/** Canonical JSON (stable key order not guaranteed — use stableHash for semantic identity). */
export function sha256CanonicalJson(value: unknown): string {
  return sha256Bytes(Buffer.from(stableStringify(value), 'utf8'));
}

export function gitCommit(): string {
  return spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim() || 'unknown';
}

const HAND_SYNC_DIR_PREFIXES = ['src/hand-sync/', 'tools/hand-sync/', 'scripts/hand-sync'];

function hashUntrackedHandSyncFiles(): string {
  const list = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).stdout
    .split('\n')
    .filter((line) => HAND_SYNC_DIR_PREFIXES.some((prefix) => line.startsWith(prefix)));
  const chunks: string[] = [];
  for (const rel of list) {
    try {
      chunks.push(rel, readFileSync(rel, 'utf8'));
    } catch {
      chunks.push(rel, 'UNREADABLE');
    }
  }
  return sha256Bytes(chunks.join('\n'));
}

export function gitDirtyPatchHash(): string | null {
  const diff = spawnSync('git', ['diff', '--binary', 'HEAD'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1022048 });
  const untrackedContent = hashUntrackedHandSyncFiles();
  const hasUntracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard', 'src/hand-sync', 'tools/hand-sync'], {
    encoding: 'utf8',
  }).stdout.trim();
  if (!diff.stdout.trim() && !hasUntracked) return null;
  return sha256Bytes(`${diff.stdout}\n---UNTRACKED-HANDSYNC---\n${untrackedContent}`);
}

export function directorConfigHash(rhythm: RhythmProfile, fps: number): string {
  return stableHash({ rhythm, fps, mode: 'preserve' });
}
