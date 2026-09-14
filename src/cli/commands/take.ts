import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ensureDefaultHeadlessPlatform } from '../../bootstrap/headlessBootstrap.js';
import { parseGameReplayEnvelope, validateGameReplay } from '../../game-runtime/index.js';
import { MeloHeadlessError } from '../../headless/errors.js';
import { withCliErrors } from '../cliError.js';

export interface TakeCommandInput {
  action: string | undefined;
  gameId?: string;
  take: unknown;
  config?: unknown;
  out?: string;
}

export async function commandTake(input: TakeCommandInput): Promise<unknown> {
  return withCliErrors('TAKE_COMMAND_FAILED', async () => {
    if (input.action !== 'validate') {
      throw new MeloHeadlessError(
        'CLI_COMMAND_INVALID',
        'Use `take validate --take <file.json> [--game <id>] [--config <file.json>]`.',
        { path: 'take' },
      );
    }
    const platform = ensureDefaultHeadlessPlatform();
    const replay = parseGameReplayEnvelope(input.take);
    const gameId = input.gameId ?? replay.gameId;
    const definition = platform.games.require(gameId);
    const adapter = platform.agents.get(gameId);
    const config = input.config !== undefined
      ? input.config
      : adapter?.defaultConfig();
    if (config === undefined) {
      throw new MeloHeadlessError(
        'CLI_ARGUMENT_REQUIRED',
        `--config is required because ${gameId} has no agent adapter default.`,
        { path: '--config' },
      );
    }
    const validation = validateGameReplay(definition, config, replay);
    const payload = {
      ok: validation.valid,
      rendered: false,
      gameId,
      replay,
      validation,
      out: null as string | null,
    };
    if (input.out) {
      await writeFile(input.out, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      payload.out = resolve(input.out);
    }
    return payload;
  });
}
