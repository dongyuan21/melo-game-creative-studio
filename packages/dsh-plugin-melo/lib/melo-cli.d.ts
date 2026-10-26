export declare const PLUGIN_ROOT: string;

export declare function resolveMeloCliPath(): string | null;

export interface MeloCliRunResult {
  ok: boolean;
  code?: string;
  exitCode?: number;
  stdout: string;
  stderr: string;
  json: unknown | null;
}

export declare function runMelo(
  argv: string[],
  options?: { cwd?: string; signal?: AbortSignal; meloPath?: string },
): Promise<MeloCliRunResult>;

export declare function ensureWritableDir(directory: string): Promise<void>;

export interface ProduceArgvInput {
  gameId?: string;
  template?: string;
  skin?: string;
  seed?: number;
  quality?: string;
  maxMoves?: number;
  maxFrames?: number;
  outDir?: string;
  render?: boolean;
  name?: string;
  profile?: string;
}

export interface RenderArgvInput {
  outDir?: string;
  documentPath?: string;
  quality?: string;
  maxFrames?: number;
  takeId?: string;
}

export declare function buildProduceArgv(
  input: ProduceArgvInput,
  sessionCwd: string,
): { argv: string[]; outDir: string };

export declare function buildRenderArgv(
  input: RenderArgvInput,
  sessionCwd: string,
): { argv: string[]; outDir: string };
