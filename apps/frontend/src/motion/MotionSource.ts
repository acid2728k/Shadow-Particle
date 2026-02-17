import type { MaskData, DepthData } from '@sp/protocol';

/**
 * Abstract interface for anything that provides silhouette mask + depth.
 * Implementations: WebSocketStreamSource (Kinect bridge) and WebcamSegmentationSource (fallback).
 */
export interface MotionSource {
  readonly name: string;
  readonly ready: boolean;
  init(): Promise<void>;
  dispose(): void;
  getMaskFrame(): MaskData | null;
  getDepthFrame(): DepthData | null;
}
