import { GamePlatformError } from '../game-runtime/errors.js';
import { MeloHeadlessError } from '../headless/errors.js';

export function rethrowAsCliError(error: unknown, fallbackCode: string): never {
  if (error instanceof MeloHeadlessError) throw error;
  if (error instanceof GamePlatformError) {
    throw new MeloHeadlessError(error.code, error.message, {
      ...(error.path !== undefined ? { path: error.path } : {}),
      ...(error.details !== undefined ? { details: error.details } : {}),
    });
  }
  throw new MeloHeadlessError(
    fallbackCode,
    error instanceof Error ? error.message : String(error),
    { details: error instanceof Error ? error.message : error },
  );
}

export async function withCliErrors<T>(fallbackCode: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    rethrowAsCliError(error, fallbackCode);
  }
}
