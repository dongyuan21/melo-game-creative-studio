export interface Mp4PathTriple {
  mp4Absolute: string;
  mp4WorkspaceRelative: string;
}

export declare function presentMp4(
  ctx: unknown,
  exec: unknown,
  file: { absolutePath: string; title?: string },
): void;

export declare function pickMp4Path(payload: unknown, outDir: string): string | null;

export declare function pathTriple(absolute: string, sessionCwd: string): Mp4PathTriple;
