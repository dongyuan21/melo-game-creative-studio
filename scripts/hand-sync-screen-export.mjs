#!/usr/bin/env node
import { resolve } from 'node:path';
import { runBrowserCapture } from './browser-capture.mjs';

const bundleDir = process.argv[2];
if (!bundleDir) {
  console.error('Usage: hand-sync-screen-export.mjs <bundleDir>');
  process.exit(2);
}
const takeId = process.env.HAND_SYNC_TAKE_ID ?? 'consecutive';
const durationSec = process.env.HAND_SYNC_DURATION_SEC ?? '5';
const query = `autorun=1&takeId=${takeId}&durationSec=${durationSec}`;
const artifactRoot = resolve(bundleDir);
const report = await runBrowserCapture({
  mode: 'smoke',
  page: '/tools/hand-sync-screen-capture.html',
  query,
  wipe: false,
  updateReviewManifest: false,
  artifactRoot,
  artifactPathMode: 'artifact-root',
  reportDir: artifactRoot,
  reportFile: 'screen-export-report.json',
  timeoutMs: 600_000,
});
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exit(1);
