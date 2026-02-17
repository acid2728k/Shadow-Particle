import { Frame, FrameType, HEADER_SIZE } from './types.js';

/**
 * Decode a binary ArrayBuffer received over WebSocket into a typed Frame.
 */
export function decodeFrame(data: ArrayBuffer): Frame {
  if (data.byteLength < HEADER_SIZE) {
    throw new Error(`Frame too small: ${data.byteLength} < ${HEADER_SIZE}`);
  }

  const view = new DataView(data);
  const type = view.getUint8(0);
  const width = view.getUint16(1, true);
  const height = view.getUint16(3, true);
  const timestamp = view.getFloat64(5, true);

  switch (type) {
    case FrameType.DEPTH: {
      const payloadSize = width * height * 2;
      const depthBuffer = new ArrayBuffer(payloadSize);
      new Uint8Array(depthBuffer).set(new Uint8Array(data, HEADER_SIZE, payloadSize));
      return {
        type: FrameType.DEPTH,
        width,
        height,
        timestamp,
        depth: new Uint16Array(depthBuffer),
      };
    }

    case FrameType.USER_MASK: {
      const payloadSize = width * height;
      const mask = new Uint8Array(payloadSize);
      mask.set(new Uint8Array(data, HEADER_SIZE, payloadSize));
      return {
        type: FrameType.USER_MASK,
        width,
        height,
        timestamp,
        mask,
      };
    }

    case FrameType.SKELETON: {
      const jsonBytes = new Uint8Array(data, HEADER_SIZE);
      const json = new TextDecoder().decode(jsonBytes);
      return {
        type: FrameType.SKELETON,
        width,
        height,
        timestamp,
        joints: JSON.parse(json),
      };
    }

    default:
      throw new Error(`Unknown frame type: 0x${type.toString(16)}`);
  }
}
