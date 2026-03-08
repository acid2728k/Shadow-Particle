# Kinect Bridge (Python)

WebSocket server that streams **depth + user mask** from a **Kinect v1 (Xbox 360)** using **libfreenect**. Use this instead of the Node mock bridge when a Kinect is connected.

- **macOS**: libfreenect works; user segmentation is approximated from depth threshold (no Windows-style "player index").
- **Windows**: Prefer the official Kinect SDK v1.8 + C#/Node for real user index; this Python bridge can still be used with libfreenect if you install it.

## One-command setup and run (Mac)

From the **Shadow Particle** project root, in a terminal where **Homebrew** is available:

```bash
npm run dev:kinect
```

This script will:

1. Install **libfreenect** via Homebrew if missing
2. Install Python deps: **numpy**, **websockets**
3. Install **freenect** (Python bindings) if missing
4. Start the bridge on `ws://localhost:9876`

Then start the frontend (`npm run dev:frontend`) or refresh the app in the browser. **Do not run the Node mock bridge** (`npm run dev:bridge`) at the same time — only one process should use port 9876.

## Manual install and run

### 1. Install libfreenect

**macOS (Homebrew):**
```bash
brew install libfreenect
```

**Linux:** use your distro package (e.g. `libfreenect-dev`) or build from [OpenKinect/libfreenect](https://github.com/OpenKinect/libfreenect).

### 2. Python dependencies

```bash
cd apps/kinect-bridge
pip3 install -r requirements.txt
pip3 install freenect
```

(If `freenect` is not on PyPI, use the wrapper from the libfreenect repo under `wrappers/python`.)

### 3. Run

With the Kinect plugged in:

```bash
cd apps/kinect-bridge
./setup-and-run.sh
# or
python3 kinect_bridge.py
```

Defaults: `ws://localhost:9876`, 320×240 @ 30 fps.

## Options

- `--port 9876` — WebSocket port (default 9876).
- `--width 320 --height 240` — Output resolution (default 320×240; depth is resized if the device gives 640×480).
- `--near 800 --far 4000` — Depth range in mm for the mask (pixels in [near, far] = person).
- `--fps 30` — Target frame rate.

## Protocol

Same binary protocol as the Node bridge: 13-byte header (type, width, height, timestamp) + payload. Sends `DEPTH` (0x01) and `USER_MASK` (0x02) every frame. Mask is derived from depth threshold (no multi-user index on libfreenect).
