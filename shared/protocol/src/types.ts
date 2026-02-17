/* ── Frame types sent over WebSocket (binary) ── */

export const FrameType = {
  DEPTH: 0x01,
  USER_MASK: 0x02,
  SKELETON: 0x03,
} as const;

export type FrameTypeValue = (typeof FrameType)[keyof typeof FrameType];

/**
 * Binary header layout (little-endian):
 *   [type: u8][width: u16][height: u16][timestamp: f64]  = 13 bytes
 */
export const HEADER_SIZE = 13;

/* ── Typed frame payloads ── */

export interface DepthFrame {
  type: typeof FrameType.DEPTH;
  width: number;
  height: number;
  timestamp: number;
  depth: Uint16Array; // depth in mm, 0 = invalid
}

export interface UserMaskFrame {
  type: typeof FrameType.USER_MASK;
  width: number;
  height: number;
  timestamp: number;
  mask: Uint8Array; // 0 = background, 1..N = player index
}

export interface SkeletonJoint {
  id: number;
  x: number;
  y: number;
  z: number;
  confidence: number;
}

export interface SkeletonFrame {
  type: typeof FrameType.SKELETON;
  width: number;
  height: number;
  timestamp: number;
  joints: SkeletonJoint[];
}

export type Frame = DepthFrame | UserMaskFrame | SkeletonFrame;

/* ── Lightweight data containers used by MotionSource ── */

export interface MaskData {
  width: number;
  height: number;
  mask: Uint8Array;
  timestamp: number;
}

export interface DepthData {
  width: number;
  height: number;
  depth: Uint16Array;
  timestamp: number;
}
