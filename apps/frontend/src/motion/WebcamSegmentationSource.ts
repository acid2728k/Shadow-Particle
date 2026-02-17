import type { MaskData, DepthData } from '@sp/protocol';
import type { MotionSource } from './MotionSource.js';

/**
 * Fallback motion source: webcam + MediaPipe Selfie Segmentation → mask.
 * Pseudo-depth is synthesised via iterative erosion (center of body = closer).
 */
export class WebcamSegmentationSource implements MotionSource {
  readonly name = 'Webcam + MediaPipe';
  private _ready = false;
  private video: HTMLVideoElement | null = null;
  private offscreen: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private segmenter: any = null;
  private _mask: MaskData | null = null;
  private _depth: DepthData | null = null;
  private fw = 320;
  private fh = 240;
  private rafId = 0;
  private processing = false;

  get ready() {
    return this._ready;
  }

  async init(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    });

    this.video = document.createElement('video');
    this.video.srcObject = stream;
    this.video.setAttribute('playsinline', '');
    this.video.muted = true;
    await this.video.play();

    this.offscreen = document.createElement('canvas');
    this.offscreen.width = this.fw;
    this.offscreen.height = this.fh;
    this.ctx = this.offscreen.getContext('2d', { willReadFrequently: true })!;

    try {
      const vision = await import('@mediapipe/tasks-vision');
      const fileset = await vision.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );
      this.segmenter = await vision.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
          delegate: 'GPU',
        },
        outputCategoryMask: true,
        runningMode: 'VIDEO',
      });
      console.log('[WebcamSource] MediaPipe segmenter loaded');
    } catch (e) {
      console.warn('[WebcamSource] MediaPipe unavailable — using luminance threshold', e);
    }

    this._ready = true;
    this.loop();
  }

  /* ── per-frame processing ── */

  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop);
    if (this.processing || !this.video || !this.ctx) return;
    if (this.video.readyState < 2) return;
    this.processing = true;

    const now = performance.now();

    this.ctx.drawImage(this.video, 0, 0, this.fw, this.fh);

    let mask: Uint8Array;

    if (this.segmenter) {
      mask = this.segmentMediaPipe(now);
    } else {
      mask = this.segmentThreshold();
    }

    this._mask = { width: this.fw, height: this.fh, mask, timestamp: now };
    this._depth = this.pseudoDepth(mask);

    this.processing = false;
  };

  private segmentMediaPipe(ts: number): Uint8Array {
    const result = this.segmenter.segmentForVideo(this.offscreen!, ts);
    const mask = new Uint8Array(this.fw * this.fh);
    if (result?.categoryMask) {
      const raw = result.categoryMask.getAsUint8Array();
      for (let i = 0; i < mask.length; i++) {
        // selfie_segmenter: category 0 = person in some builds, non-zero = bg
        mask[i] = raw[i] === 0 ? 1 : 0;
      }
      result.categoryMask.close();
    }
    result?.close();
    return mask;
  }

  private segmentThreshold(): Uint8Array {
    const img = this.ctx!.getImageData(0, 0, this.fw, this.fh);
    const mask = new Uint8Array(this.fw * this.fh);
    for (let i = 0; i < mask.length; i++) {
      const lum =
        img.data[i * 4] * 0.299 + img.data[i * 4 + 1] * 0.587 + img.data[i * 4 + 2] * 0.114;
      mask[i] = lum < 100 ? 1 : 0;
    }
    return mask;
  }

  /* ── pseudo depth via iterative erosion ── */

  private pseudoDepth(mask: Uint8Array): DepthData {
    const w = this.fw;
    const h = this.fh;
    const depth = new Uint16Array(w * h);
    const NEAR = 1500;
    const FAR = 2800;
    const LAYERS = 10;
    const step = (FAR - NEAR) / LAYERS;

    for (let i = 0; i < w * h; i++) {
      if (mask[i] > 0) depth[i] = FAR;
    }

    let cur = new Uint8Array(mask);
    for (let L = 0; L < LAYERS; L++) {
      const eroded = new Uint8Array(w * h);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (
            cur[i] > 0 &&
            cur[i - 1] > 0 &&
            cur[i + 1] > 0 &&
            cur[i - w] > 0 &&
            cur[i + w] > 0
          ) {
            eroded[i] = 1;
          }
        }
      }
      for (let i = 0; i < w * h; i++) {
        if (eroded[i] > 0) depth[i] = FAR - (L + 1) * step;
      }
      cur = eroded;
    }

    return { width: w, height: h, depth, timestamp: this._mask?.timestamp ?? 0 };
  }

  dispose() {
    cancelAnimationFrame(this.rafId);
    if (this.video?.srcObject) {
      (this.video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    }
    this.segmenter?.close();
    this._ready = false;
  }

  getMaskFrame(): MaskData | null {
    return this._mask;
  }
  getDepthFrame(): DepthData | null {
    return this._depth;
  }
}
