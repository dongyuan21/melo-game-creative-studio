import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBrowserCapture } from './browser-capture.mjs';

const full = process.env.MELO_CAPTURE_FULL === '1' || process.argv.includes('--full');
const report = await runBrowserCapture({ mode: full ? 'full' : 'smoke' });
const crush = report.status === 'NOT_RUN'
  ? { status: 'NOT_RUN', frames: [] }
  : await runBrowserCapture({
    mode: 'smoke',
    page: '/tools/crush-diag-capture.html',
    wipe: false,
    reportFile: 'crush-diag.json',
    timeoutMs: 120_000,
  });
const out = new URL('../review-package/run/browser-e2e.json', import.meta.url);
mkdirSync(dirname(fileURLToPath(out)), { recursive: true });
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
const skipAllowed = process.env.CI !== 'true' && process.env.Melo_ALLOW_E2E_SKIP === '1';
const blockOk = report.status === 'PASS' || (report.status === 'NOT_RUN' && skipAllowed);
const crushOk = crush.status === 'PASS'
  || (crush.status === 'NOT_RUN' && (skipAllowed || report.status === 'NOT_RUN'));
const ok = blockOk && crushOk;
console.log(JSON.stringify({
  ok,
  status: report.status,
  crushStatus: crush.status,
  mode: report.mode,
  reason: report.reason,
  frames: report.frames?.length ?? 0,
  crushFrames: crush.frames?.length ?? 0,
  videos: report.videos?.length ?? 0,
  renderer: report.webglRenderer ?? report.renderer ?? 'unknown',
}, null, 2));
if (!ok) process.exit(1);
