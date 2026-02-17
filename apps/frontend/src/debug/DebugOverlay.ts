import type { MaskData, DepthData } from '@sp/protocol';

/**
 * Small fixed-position canvas that visualises raw mask + depth for diagnostics.
 * Toggle via GUI → Debug → showDebug.
 */
export class DebugOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private visible = false;
  private readonly W = 320;
  private readonly H = 120;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    Object.assign(this.canvas.style, {
      position: 'fixed',
      bottom: '10px',
      left: '10px',
      zIndex: '150',
      border: '1px solid #333',
      borderRadius: '4px',
      display: 'none',
      imageRendering: 'pixelated',
      background: '#000',
    } as CSSStyleDeclaration);
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  setVisible(v: boolean) {
    if (v === this.visible) return;
    this.visible = v;
    this.canvas.style.display = v ? 'block' : 'none';
  }

  update(mask: MaskData | null, depth: DepthData | null) {
    if (!this.visible) return;

    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.W, this.H);

    const halfW = this.W / 2;

    // Draw mask (left half)
    if (mask) {
      this.drawMask(mask, 0, 0, halfW, this.H);
    }

    // Draw depth (right half)
    if (depth) {
      this.drawDepth(depth, halfW, 0, halfW, this.H);
    }

    this.ctx.fillStyle = '#fff';
    this.ctx.font = '9px monospace';
    this.ctx.fillText('MASK', 4, 10);
    this.ctx.fillText('DEPTH', halfW + 4, 10);
  }

  private drawMask(m: MaskData, ox: number, oy: number, tw: number, th: number) {
    const img = this.ctx.createImageData(tw, th);
    const sx = m.width / tw;
    const sy = m.height / th;
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const mx = (x * sx) | 0;
        const my = (y * sy) | 0;
        const v = m.mask[my * m.width + mx] > 0 ? 255 : 0;
        const i = (y * tw + x) * 4;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    }
    this.ctx.putImageData(img, ox, oy);
  }

  private drawDepth(d: DepthData, ox: number, oy: number, tw: number, th: number) {
    const img = this.ctx.createImageData(tw, th);
    const sx = d.width / tw;
    const sy = d.height / th;
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const dx = (x * sx) | 0;
        const dy = (y * sy) | 0;
        const raw = d.depth[dy * d.width + dx];
        // Map 800..4000mm → 0..255
        const v = raw === 0 ? 0 : Math.max(0, Math.min(255, ((raw - 800) / 3200) * 255));
        const i = (y * tw + x) * 4;
        img.data[i] = 0;
        img.data[i + 1] = v | 0;
        img.data[i + 2] = (v * 0.7) | 0;
        img.data[i + 3] = 255;
      }
    }
    this.ctx.putImageData(img, ox, oy);
  }
}
