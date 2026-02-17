/**
 * Generates synthetic depth + user-mask frames that resemble a human figure
 * swaying in front of a Kinect v1 (320x240 depth map, values in mm).
 */
export interface MockFrame {
  depth: Uint16Array;
  mask: Uint8Array;
  width: number;
  height: number;
  timestamp: number;
}

interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  baseDepth: number;
  depthRange: number;
}

export class MockKinectSource {
  private w: number;
  private h: number;
  private t0: number;

  constructor(width = 320, height = 240) {
    this.w = width;
    this.h = height;
    this.t0 = Date.now();
  }

  generate(): MockFrame {
    const { w, h } = this;
    const depth = new Uint16Array(w * h);
    const mask = new Uint8Array(w * h);
    const now = Date.now();
    const t = (now - this.t0) * 0.001; // seconds

    // Person center sways side-to-side
    const cx = w * (0.5 + 0.13 * Math.sin(t * 0.55));
    const cy = h * 0.46;

    const parts: Ellipse[] = [
      // Head
      { cx, cy: cy - h * 0.29, rx: w * 0.065, ry: w * 0.078, baseDepth: 1850, depthRange: 200 },
      // Neck
      { cx, cy: cy - h * 0.19, rx: w * 0.028, ry: h * 0.03, baseDepth: 1950, depthRange: 100 },
      // Torso
      { cx, cy: cy + h * 0.01, rx: w * 0.105, ry: h * 0.2, baseDepth: 2000, depthRange: 300 },
      // Left upper arm
      {
        cx: cx - w * 0.145 - Math.sin(t * 1.2) * w * 0.035,
        cy: cy - h * 0.04,
        rx: w * 0.033,
        ry: h * 0.11,
        baseDepth: 2100,
        depthRange: 180,
      },
      // Right upper arm
      {
        cx: cx + w * 0.145 + Math.sin(t * 1.2 + 1.0) * w * 0.035,
        cy: cy - h * 0.04,
        rx: w * 0.033,
        ry: h * 0.11,
        baseDepth: 2100,
        depthRange: 180,
      },
      // Left leg
      {
        cx: cx - w * 0.042 - Math.sin(t * 0.85) * w * 0.012,
        cy: cy + h * 0.33,
        rx: w * 0.04,
        ry: h * 0.2,
        baseDepth: 2050,
        depthRange: 200,
      },
      // Right leg
      {
        cx: cx + w * 0.042 + Math.sin(t * 0.85) * w * 0.012,
        cy: cy + h * 0.33,
        rx: w * 0.04,
        ry: h * 0.2,
        baseDepth: 2050,
        depthRange: 200,
      },
    ];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        for (const p of parts) {
          const dx = (x - p.cx) / p.rx;
          const dy = (y - p.cy) / p.ry;
          const d2 = dx * dx + dy * dy;
          if (d2 < 1.0) {
            const surfDepth = p.baseDepth + Math.floor(Math.sqrt(d2) * p.depthRange);
            if (mask[idx] === 0 || surfDepth < depth[idx]) {
              depth[idx] = surfDepth;
            }
            mask[idx] = 1;
          }
        }
      }
    }

    return { depth, mask, width: w, height: h, timestamp: now };
  }
}
