import path from 'node:path';

/**
 * Append deliverables/presented for an MP4 (same channel as official present / video-preview).
 * @param {unknown} ctx
 * @param {unknown} exec
 * @param {{ absolutePath: string; title?: string }} file
 */
export function presentMp4(ctx, exec, file) {
  try {
    const agent = exec?.agent;
    const session = agent?.session;
    if (!session || !ctx.sessionProjections || typeof session.append !== 'function') return;
    const boundary = ctx.sessionProjections.stateOf(session, 'turnBoundary');
    if (!boundary || !Number.isInteger(boundary.lastTurn)) return;
    session.append('deliverables/presented', {
      turn: boundary.lastTurn,
      callId: exec.callId ?? 'melo',
      files: [{
        path: file.absolutePath,
        description: file.title ?? `🎬 ${path.basename(file.absolutePath)}`,
        ...(file.title ? { title: file.title } : {}),
      }],
    });
  } catch {
    /* presentation is best-effort */
  }
}

/**
 * @param {unknown} payload
 * @param {string} outDir
 * @returns {string | null}
 */
export function pickMp4Path(payload, outDir) {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload;
  const videos = record.videos;
  if (Array.isArray(videos) && videos[0] && typeof videos[0].path === 'string') {
    return path.resolve(String(videos[0].path));
  }
  const render = record.render;
  if (render && typeof render === 'object') {
    const fromRender = pickMp4Path(render, outDir);
    if (fromRender) return fromRender;
  }
  const candidate = path.join(outDir, 'video.mp4');
  return candidate;
}

/**
 * @param {string} absolute
 * @param {string} sessionCwd
 */
export function pathTriple(absolute, sessionCwd) {
  const relative = path.relative(sessionCwd, absolute);
  return {
    mp4Absolute: absolute,
    mp4WorkspaceRelative: relative.startsWith('..') ? absolute : relative,
  };
}
