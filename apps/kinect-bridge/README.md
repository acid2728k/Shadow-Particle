# Kinect Bridge (Python)

WebSocket server that streams **depth + user mask** from a **Kinect v1 (Xbox 360)** using **libfreenect**. Use this instead of the Node mock bridge when a Kinect is connected.

- **macOS**: libfreenect works; user segmentation is approximated from depth threshold (no Windows-style "player index").
- **Windows**: Prefer the official Kinect SDK v1.8 + C#/Node for real user index; this Python bridge can still be used with libfreenect if you install it.

## Install

### 1. Install libfreenect

**macOS (Homebrew):**
```bash
brew install libfreenect
```

**Linux:** use your distro package (e.g. `libfreenect-dev`) or build from [OpenKinect/libfreenect](https://github.com/OpenKinect/libfreenect).

### 2. Python bindings for libfreenect

**Option A — system Python (often bundled with libfreenect):**
```bash
# After brew install libfreenect, check for Python module
python3 -c "import freenect; print('OK')"
```
If that fails, try Option B.

**Option B — pip (if a wrapper is on PyPI):**
```bash
pip install freenect
# or
pip install pyfreenect
```
(If neither exists, use the wrapper from the libfreenect repo under `wrappers/python`.)

### 3. Bridge dependencies

```bash
cd apps/kinect-bridge
pip install -r requirements.txt
```

## Run

With the Kinect plugged in:

```bash
cd apps/kinect-bridge
python kinect_bridge.py
```

Defaults: `ws://localhost:9876`, 320×240 @ 30 fps. The frontend connects to the same port, so it will receive real depth + mask when this bridge is running.

## Options

- `--port 9876` — WebSocket port (default 9876).
- `--width 320 --height 240` — Output resolution (default 320×240; depth is resized if the device gives 640×480).
- `--near 800 --far 4000` — Depth range in mm for the mask (pixels in [near, far] = person).
- `--fps 30` — Target frame rate.

## Protocol

Same binary protocol as the Node bridge: 13-byte header (type, width, height, timestamp) + payload. Sends `DEPTH` (0x01) and `USER_MASK` (0x02) every frame. Mask is derived from depth threshold (no multi-user index on libfreenect).
