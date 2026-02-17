import { decodeFrame, FrameType } from '@sp/protocol';
import type { MaskData, DepthData } from '@sp/protocol';
import type { MotionSource } from './MotionSource.js';

export class WebSocketStreamSource implements MotionSource {
  readonly name = 'WebSocket (Bridge)';
  private ws: WebSocket | null = null;
  private _ready = false;
  private _mask: MaskData | null = null;
  private _depth: DepthData | null = null;
  private url: string;

  get ready() {
    return this._ready;
  }

  constructor(url = 'ws://localhost:9876') {
    this.url = url;
  }

  init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ws?.close();
        reject(new Error('WebSocket connection timeout'));
      }, 3000);

      try {
        this.ws = new WebSocket(this.url);
        this.ws.binaryType = 'arraybuffer';

        this.ws.addEventListener('open', () => {
          clearTimeout(timeout);
          this._ready = true;
          console.log(`[WSSource] Connected to ${this.url}`);
          resolve();
        });

        this.ws.addEventListener('message', (ev: MessageEvent) => {
          if (!(ev.data instanceof ArrayBuffer)) return;
          try {
            const frame = decodeFrame(ev.data);
            if (frame.type === FrameType.DEPTH) {
              this._depth = {
                width: frame.width,
                height: frame.height,
                depth: frame.depth,
                timestamp: frame.timestamp,
              };
            } else if (frame.type === FrameType.USER_MASK) {
              this._mask = {
                width: frame.width,
                height: frame.height,
                mask: frame.mask,
                timestamp: frame.timestamp,
              };
            }
          } catch {
            /* skip malformed frames */
          }
        });

        this.ws.addEventListener('error', () => {
          clearTimeout(timeout);
          reject(new Error('WebSocket error'));
        });

        this.ws.addEventListener('close', () => {
          this._ready = false;
        });
      } catch (e) {
        clearTimeout(timeout);
        reject(e);
      }
    });
  }

  dispose() {
    this.ws?.close();
    this._ready = false;
  }

  getMaskFrame(): MaskData | null {
    return this._mask;
  }
  getDepthFrame(): DepthData | null {
    return this._depth;
  }
}
