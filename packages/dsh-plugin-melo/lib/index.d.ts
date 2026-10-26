export declare const name: string;
export declare const inject: string[];

export interface MeloPluginContext {
  tools: { register: (tool: unknown) => void };
  skills?: { register: (skill: unknown) => void };
  sessionProjections?: unknown;
  logger?: { warn?: (msg: string) => void };
}

export declare function apply(ctx: MeloPluginContext): void;
