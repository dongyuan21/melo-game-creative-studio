import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { stableHash } from '../headless/stableHash';
import type { RhythmProfile } from '../domain/types';

export function sha256Bytes(buffer: Buffer | string): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function sha256Utf8File(path: string): string {
  return sha256Bytes(readFileSync(path));
}

/** Canonical JSON (stable key order not guaranteed — use stableHash for semantic identity). */
export function sha256CanonicalJson(value: unknown): string {
  return sha256Bytes(Buffer.from(stableHash(value), 'utf8'));
}

export function gitCommit(): string {
  return spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim() || 'unknown';
}

export function gitDirtyPatchHash(): string | null {
  const diff = spawnSync('git', ['diff', '--binary', 'HEAD'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' });
  const combined = `${diff.stdout}\n---UNTRACKED---\n${untracked.stdout}`;
  if (!diff.stdout.trim() && !untracked.stdout.trim()) return null;
  return sha256Bytes(combined);
}

export function directorConfigHash(rhythm: RhythmProfile, fps: number): string {
  return stableHash({ rhythm, fps, mode: 'preserve' });
}
