/**
 * Placeholder for real Kinect v1 integration.
 *
 * Strategy (Windows only):
 *   1. Install Kinect SDK v1.8 on a Windows machine.
 *   2. Use a C#/.NET bridge that reads Kinect frames (depth + user index)
 *      and pushes them into the same WebSocket protocol this bridge defines.
 *   3. Alternatively, wrap libfreenect via native Node addon (ffi-napi)
 *      but note that libfreenect does NOT provide user segmentation —
 *      only raw depth. User index requires Kinect SDK v1 (Windows).
 *
 * When implementing:
 *   - Emit { depth: Uint16Array, mask: Uint8Array, width, height, timestamp }
 *     with the same shape as MockKinectSource.generate()
 *   - The bridge index.ts can swap MockKinectSource for this adapter
 *     based on an env flag or auto-detection.
 */
export class KinectAdapter {
  // TODO: implement real Kinect v1 data capture
  async init(): Promise<void> {
    throw new Error('KinectAdapter not yet implemented — use mock mode or webcam fallback');
  }
}
