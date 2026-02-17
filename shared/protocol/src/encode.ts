import { Frame, FrameType, HEADER_SIZE } from './types.js';

/**
 * Encode a Frame into a binary ArrayBuffer ready for WebSocket transmission.
 */
export function encodeFrame(frame: Frame): ArrayBuffer {
  let payloadBytes: Uint8Array;

  switch (frame.type) {
    case FrameType.DEPTH: {
      payloadBytes = new Uint8Array(
        frame.depth.buffer,
        frame.depth.byteOffset,
        frame.depth.byteLength,
      );
      break;
    }
    case FrameType.USER_MASK: {
      payloadBytes = frame.mask;
      break;
    }
    case FrameType.SKELETON: {
      payloadBytes = new TextEncoder().encode(JSON.stringify(frame.joints));
      break;
    }
  }

  const buffer = new ArrayBuffer(HEADER_SIZE + payloadBytes.length);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  view.setUint8(0, frame.type);
  view.setUint16(1, frame.width, true);
  view.setUint16(3, frame.height, true);
  view.setFloat64(5, frame.timestamp, true);

  bytes.set(payloadBytes, HEADER_SIZE);
  return buffer;
}
