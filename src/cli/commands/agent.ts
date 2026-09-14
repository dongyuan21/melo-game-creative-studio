import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ensureDefaultHeadlessPlatform } from '../../bootstrap/headlessBootstrap.js';
import { MeloHeadlessError } from '../../headless/errors.js';
import { withCliErrors } from '../cliError.js';
import type { GameAgentRunRequest } from '../../game-runtime/agentAdapter.js';
import type { GameAgentRunResult } from '../../game-runtime/agentAdapter.js';

export interface AgentCommandInput {
  action: string | undefined;
  gameId?: string;
  config?: unknown;
  seed?: number;
  profile?: string;
  maxMoves?: number;
  beamWidth?: number;
  maxExpandedStates?: number;
  out?: string;
}

function buildRunRequest(input: AgentCommandInput): GameAgentRunRequest {
  const options: Record<string, unknown> = {};
  if (input.beamWidth !== undefined) options.beamWidth = input.beamWidth;
  if (input.maxExpandedStates !== undefined) options.maxExpandedStates = input.maxExpandedStates;
  const request: GameAgentRunRequest = {
    seed: input.seed ?? 1,
  };
  if (input.config !== undefined) request.config = input.config;
  if (input.profile !== undefined) request.profile = input.profile;
  if (input.maxMoves !== undefined) request.maxMoves = input.maxMoves;
  if (Object.keys(options).length > 0) request.options = options;
  return request;
}

function agentRunPayload(gameId: string, result: GameAgentRunResult, out: string | null) {
  return {
    ok: result.validation.valid,
    rendered: false,
    gameId,
    status: result.status,
    replay: result.replay,
    validation: result.validation,
    ...(result.metrics !== undefined ? { metrics: result.metrics } : {}),
    ...(result.diagnostic !== undefined ? { diagnostic: result.diagnostic } : {}),
    out,
  };
}

export async function commandAgent(input: AgentCommandInput): Promise<unknown> {
  return withCliErrors('AGENT_COMMAND_FAILED', async () => {
    const platform = ensureDefaultHeadlessPlatform();
    if (input.action === 'list') {
      return {
        ok: true,
        rendered: false,
        agents: platform.agents.list().slice().sort((left, right) => left.gameId.localeCompare(right.gameId)),
      };
    }
    if (input.action !== 'run') {
      throw new MeloHeadlessError(
        'CLI_COMMAND_INVALID',
        'Use `agent list` or `agent run --game <id>`.',
        { path: 'agent' },
      );
    }
    if (!input.gameId) {
      throw new MeloHeadlessError('CLI_ARGUMENT_REQUIRED', '--game is required.', { path: '--game' });
    }
    const adapter = platform.agents.require(input.gameId);
    const result = await Promise.resolve(adapter.run(buildRunRequest(input)));
    const out = input.out;
    if (out) {
      await writeFile(out, `${JSON.stringify(result.replay, null, 2)}\n`, 'utf8');
    }
    return agentRunPayload(input.gameId, result, out ? resolve(out) : null);
  });
}
