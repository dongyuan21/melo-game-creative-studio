import {
  BufferTarget,
  CanvasSource,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  Quality,
} from 'mediabunny';
import type { CompiledFrameSource } from '../game-runtime/frameSource';
import type { PresentationPacket } from '../game-runtime/presentationPacket';
import type { GameRenderContract } from '../game-runtime/renderContract';
import { containMapping } from './composition';
import {
  assertBackendSupportsPacket,
  RenderBackendError,
  type RenderBackendAdapter,
} from './backendRegistry';
import {
  assertRenderResourcePolicy,
  type PlanBoundRenderPlan,
  type RenderResourcePolicy,
} from './resourcePolicy';
import { safeFileName } from '../utils/download';

export interface RenderProgress {
  phase: 'preparing' | 'rendering' | 'finalizing' | 'done';
  currentFrame: number;
  totalFrames: number;
  ratio: number;
  message: string;
}

export interface VideoRenderOutput {
  width: number;
  height: number;
  fps: number;
  quality: 'preview' | 'standard' | 'cinematic';
}

export interface VideoRenderJob {
  frameSource: CompiledFrameSource;
  backend: RenderBackendAdapter;
  output: VideoRenderOutput;
  projectName: string;
  takeName: string;
  resourcePolicy: RenderResourcePolicy;
  plan?: PlanBoundRenderPlan;
  renderContract?: GameRenderContract;
  signal?: AbortSignal;
  onProgress?: (progress: RenderProgress) => void;
}

export interface VideoRenderJobResult {
  blob: Blob;
  fileName: string;
  frameCount: number;
  durationSeconds: number;
  renderScale: number;
}

interface QualitySettings {
  bitrate: number;
  renderScale: number;
}

const QUALITY_SETTINGS: Record<VideoRenderOutput['quality'], QualitySettings> = {
  preview: { bitrate: 8_000_000, renderScale: 1 },
  standard: { bitrate: 14_000_000, renderScale: 1.35 },
  cinematic: { bitrate: 24_000_000, renderScale: 2 },
};

function report(callback: VideoRenderJob['onProgress'], progress: RenderProgress): void {
  callback?.(progress);
}

export function assertPacketMatchesFrameSource(
  packet: PresentationPacket,
  frameSource: CompiledFrameSource,
  requestedFrame: number,
): void {
  const identity = packet.identity;
  if (identity.gameId !== frameSource.gameId) {
    throw new RenderBackendError(
      'PACKET_GAME_MISMATCH',
      `Packet game ${identity.gameId} does not match frame source ${frameSource.gameId}.`,
      '$.identity.gameId',
    );
  }
  if (identity.takeId !== frameSource.takeId) {
    throw new RenderBackendError(
      'PACKET_TAKE_MISMATCH',
      `Packet take ${identity.takeId} does not match frame source ${frameSource.takeId}.`,
      '$.identity.takeId',
    );
  }
  if (identity.frameIndex !== requestedFrame) {
    throw new RenderBackendError(
      'PACKET_FRAME_MISMATCH',
      `Packet frameIndex ${identity.frameIndex} does not match requested frame ${requestedFrame}.`,
      '$.identity.frameIndex',
    );
  }
  if (identity.fps !== frameSource.fps) {
    throw new RenderBackendError(
      'PACKET_FPS_MISMATCH',
      `Packet fps ${identity.fps} does not match frame source fps ${frameSource.fps}.`,
      '$.identity.fps',
    );
  }
  if (identity.totalFrames !== frameSource.totalFrames) {
    throw new RenderBackendError(
      'PACKET_TOTAL_FRAMES_MISMATCH',
      `Packet totalFrames ${identity.totalFrames} does not match frame source ${frameSource.totalFrames}.`,
      '$.identity.totalFrames',
    );
  }
}

export function assertVideoRenderJobContract(job: VideoRenderJob): void {
  if (job.output.fps !== job.frameSource.fps) {
    throw new RenderBackendError(
      'OUTPUT_FPS_MISMATCH',
      `Job output fps ${job.output.fps} must equal frame source fps ${job.frameSource.fps}.`,
      '$.output.fps',
    );
  }
  assertRenderResourcePolicy(job.resourcePolicy, {
    ...(job.plan ? { plan: job.plan } : {}),
    ...(job.renderContract ? { renderContract: job.renderContract } : {}),
    backend: job.backend,
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Render canceled', 'AbortError');
}

function blitFrame(
  outputContext: CanvasRenderingContext2D,
  renderCanvas: HTMLCanvasElement,
  backend: RenderBackendAdapter,
  width: number,
  height: number,
): void {
  outputContext.fillStyle = '#05070d';
  outputContext.fillRect(0, 0, width, height);
  if (backend.letterboxFromDesign && backend.designResolution) {
    const mapping = containMapping(backend.designResolution, { width, height });
    outputContext.drawImage(
      renderCanvas,
      mapping.offsetX,
      mapping.offsetY,
      mapping.drawWidth,
      mapping.drawHeight,
    );
    return;
  }
  outputContext.drawImage(renderCanvas, 0, 0, width, height);
}

export async function executeVideoRenderJob(job: VideoRenderJob): Promise<VideoRenderJobResult> {
  assertVideoRenderJobContract(job);
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('当前 Chrome 未启用 WebCodecs VideoEncoder，无法在浏览器内导出 MP4。');
  }
  if (job.output.width % 2 !== 0 || job.output.height % 2 !== 0) {
    throw new Error('H.264 输出宽高必须是偶数。');
  }

  const warmupPacket = job.frameSource.evaluate(0);
  assertPacketMatchesFrameSource(warmupPacket, job.frameSource, 0);
  assertBackendSupportsPacket(job.backend, warmupPacket);

  const quality = QUALITY_SETTINGS[job.output.quality];
  const encodingQuality = new Quality({ bitrate: quality.bitrate });
  const codec = await getFirstEncodableVideoCodec(['avc'], {
    width: job.output.width,
    height: job.output.height,
    quality: encodingQuality,
  });
  if (codec !== 'avc') {
    throw new Error(
      `当前 Chrome/GPU 无法以 H.264 编码 ${job.output.width}×${job.output.height} 视频。请更新 Chrome、显卡驱动，或改用支持 AVC 的机器。`,
    );
  }

  const renderCanvas = document.createElement('canvas');
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = job.output.width;
  outputCanvas.height = job.output.height;
  const outputContext = outputCanvas.getContext('2d', { alpha: false });
  if (!outputContext) throw new Error('无法创建视频输出 Canvas。');
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = 'high';

  const resources = assertRenderResourcePolicy(job.resourcePolicy, {
    ...(job.plan ? { plan: job.plan } : {}),
    ...(job.renderContract ? { renderContract: job.renderContract } : {}),
    backend: job.backend,
  });
  const stage = job.backend.createStage(renderCanvas, resources);
  if (job.backend.letterboxFromDesign && job.backend.designResolution) {
    stage.resize(job.backend.designResolution.width, job.backend.designResolution.height, 1);
  } else {
    stage.resize(job.output.width, job.output.height, quality.renderScale);
  }

  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });
  const source = new CanvasSource(outputCanvas, {
    codec,
    quality: encodingQuality,
  });
  output.addVideoTrack(source, { frameRate: job.output.fps });
  output.setMetadataTags({
    title: `${job.projectName} · ${job.takeName}`,
    artist: 'Melo Game Creative Studio',
    comment: `Deterministic browser render · ${job.backend.renderer} · ${quality.renderScale}x supersampling`,
  });

  report(job.onProgress, {
    phase: 'preparing',
    currentFrame: 0,
    totalFrames: job.frameSource.totalFrames,
    ratio: 0,
    message: `正在预热材质、Shader 与编码器（${quality.renderScale}× 超采样）…`,
  });

  try {
    throwIfAborted(job.signal);
    await stage.warmup(warmupPacket);
    blitFrame(outputContext, renderCanvas, job.backend, job.output.width, job.output.height);
    await output.start();

    const frameDuration = 1 / job.output.fps;
    for (let frameIndex = 0; frameIndex < job.frameSource.totalFrames; frameIndex += 1) {
      throwIfAborted(job.signal);
      const packet = job.frameSource.evaluate(frameIndex);
      assertPacketMatchesFrameSource(packet, job.frameSource, frameIndex);
      assertBackendSupportsPacket(job.backend, packet);
      stage.renderAt(packet);
      blitFrame(outputContext, renderCanvas, job.backend, job.output.width, job.output.height);
      await source.add(frameIndex * frameDuration, frameDuration, {
        keyFrame: frameIndex % (job.output.fps * 2) === 0,
      });

      if (frameIndex % 3 === 0 || frameIndex === job.frameSource.totalFrames - 1) {
        report(job.onProgress, {
          phase: 'rendering',
          currentFrame: frameIndex + 1,
          totalFrames: job.frameSource.totalFrames,
          ratio: (frameIndex + 1) / job.frameSource.totalFrames,
          message: `逐帧渲染 ${frameIndex + 1} / ${job.frameSource.totalFrames}`,
        });
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }

    source.close();
    report(job.onProgress, {
      phase: 'finalizing',
      currentFrame: job.frameSource.totalFrames,
      totalFrames: job.frameSource.totalFrames,
      ratio: 1,
      message: '正在完成 H.264 编码与 MP4 封装…',
    });
    await output.finalize();
    const buffer = target.buffer;
    if (!buffer) throw new Error('视频编码完成，但没有得到输出缓冲区。');

    const blob = new Blob([buffer], { type: 'video/mp4' });
    const fileName = `${safeFileName(job.projectName)}-${safeFileName(job.takeName)}-${job.output.width}x${job.output.height}.mp4`;
    report(job.onProgress, {
      phase: 'done',
      currentFrame: job.frameSource.totalFrames,
      totalFrames: job.frameSource.totalFrames,
      ratio: 1,
      message: '视频已生成。',
    });
    return {
      blob,
      fileName,
      frameCount: job.frameSource.totalFrames,
      durationSeconds: job.frameSource.totalFrames / job.output.fps,
      renderScale: quality.renderScale,
    };
  } catch (error) {
    try {
      await output.cancel();
    } catch {
      // Ignore cleanup errors; the original render error is more useful.
    }
    throw error;
  } finally {
    stage.dispose();
  }
}
