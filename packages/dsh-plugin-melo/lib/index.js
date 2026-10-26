import { registerMeloTools } from './tools.js';
import { registerBundledSkills } from './skills-bundle.js';

export const name = '@melo-game/dsh-plugin-melo';
export const inject = ['tools', 'skills', 'sessionProjections'];

/**
 * @typedef {{ tools: { register: (tool: unknown) => void }; skills?: { register: (skill: unknown) => void }; sessionProjections?: unknown; logger?: { warn?: (msg: string) => void } }} MeloPluginContext
 */

export function apply(ctx) {
  registerMeloTools(ctx);
  registerBundledSkills(ctx);
}
