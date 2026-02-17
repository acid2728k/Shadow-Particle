import { WebSocketServer, WebSocket } from 'ws';
import { encodeFrame, FrameType } from '@sp/protocol';
import { MockKinectSource } from './mock/MockKinectSource.js';

const PORT = parseInt(process.env.SP_BRIDGE_PORT || '9876', 10);
const FPS = parseInt(process.env.SP_BRIDGE_FPS || '30', 10);
const WIDTH = 320;
const HEIGHT = 240;

const wss = new WebSocketServer({ port: PORT });
const clients = new Set<WebSocket>();
const mock = new MockKinectSource(WIDTH, HEIGHT);

console.log(`\n  ╔══════════════════════════════════════════╗`);
console.log(`  ║   Shadow Particle · Bridge               ║`);
console.log(`  ╠══════════════════════════════════════════╣`);
console.log(`  ║  ws://localhost:${PORT}                   ║`);
console.log(`  ║  mode : MOCK  ${WIDTH}×${HEIGHT} @ ${FPS}fps          ║`);
console.log(`  ╚══════════════════════════════════════════╝\n`);

wss.on('connection', (ws, req) => {
  const addr = req.socket.remoteAddress;
  console.log(`[bridge] client connected (${addr})`);
  clients.add(ws);

  ws.on('close', () => {
    console.log(`[bridge] client disconnected (${addr})`);
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('[bridge] ws error', err.message);
    clients.delete(ws);
  });
});

function broadcast(data: ArrayBuffer) {
  const buf = Buffer.from(data);
  for (const c of clients) {
    if (c.readyState === WebSocket.OPEN) {
      c.send(buf);
    }
  }
}

setInterval(() => {
  if (clients.size === 0) return;

  const frame = mock.generate();

  broadcast(
    encodeFrame({
      type: FrameType.DEPTH,
      width: frame.width,
      height: frame.height,
      timestamp: frame.timestamp,
      depth: frame.depth,
    }),
  );

  broadcast(
    encodeFrame({
      type: FrameType.USER_MASK,
      width: frame.width,
      height: frame.height,
      timestamp: frame.timestamp,
      mask: frame.mask,
    }),
  );
}, 1000 / FPS);
