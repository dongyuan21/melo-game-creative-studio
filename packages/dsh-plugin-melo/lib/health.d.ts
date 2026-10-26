export interface HealthCheckItem {
  id: string;
  ok: boolean;
  label: string;
  detail: string;
  fix?: string;
}

export interface HealthReport {
  ok: boolean;
  readyForProduce: boolean;
  readyForRender: boolean;
  checks: HealthCheckItem[];
  capabilities: unknown;
  meloCliPath: string | null;
  chromePath: string | null;
  probeOutDir: string;
  cardZh: string;
}

export declare function collectHealth(options?: {
  cwd?: string;
  meloPath?: string | null;
  probeOutDir?: string;
}): Promise<HealthReport>;
