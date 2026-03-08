# Shadow Particle

Immersive real-time particle installation inspired by teamLab: a person's silhouette captured by a **Kinect 360** becomes thousands of glowing particles that fill the body, float upward, and leave long luminous trails when moving — all against a deep dark starfield background. Designed for **live installation and interactive exhibitions**.

## Architecture

```
┌─────────────────────────────┐   WebSocket (binary)   ┌──────────────────────────────┐
│  Bridge                      │   depth + mask         │   Frontend (Vite / Three.js) │
│  • Python: Kinect v1 (Mac)   │   320×240 @ 30 fps ──▶ │  • 80 K particle pool        │
│  • Node: mock generator      │                        │  • Ping-pong feedback trails │
│  • Windows: Kinect SDK v1.8  │                        │  • Background starfield      │
└─────────────────────────────┘                        │  • lil-gui live controls     │
                                                       └──────────────────────────────┘
```

**Two-process design**: the Python bridge reads the Kinect sensor and streams binary depth + mask frames over WebSocket. The frontend renders everything in WebGL2 using Three.js.

### Motion source

The frontend connects exclusively to the Kinect bridge (`ws://localhost:XXXX`). If the bridge is offline, the app shows the background and retries the connection every 3 seconds — no webcam fallback, no camera permission prompt.

| Source | Description |
|--------|-------------|
| `WebSocketStreamSource` | Kinect v1 via Python bridge — real depth + silhouette mask |

## Quick Start

**Important:** run all commands from the project root. If the project is in `Desktop/Shadow Particle`, run first:
```bash
cd ~/Desktop/Shadow Particle
```
Or drag the project folder into the Terminal window to paste the full path.

```bash
# Install dependencies (once)
npm install

# Terminal 1 — mock bridge (no Kinect)
npm run dev:bridge

# Terminal 2 — frontend
npm run dev:frontend
```

Open **http://localhost:XXXX** — you should see a particle silhouette and starfield background.

### Running with Kinect 360 (Mac)

1. Plug in the Kinect.
2. From the project root, start the bridge with one command:
   ```bash
   npm run dev:kinect
   ```
   Or double-click **START-KINECT.command** in the project root (install Homebrew from https://brew.sh first if needed).
3. In another terminal from the same folder: `npm run dev:frontend`. Refresh the app in the browser.

### Run both together

```bash
npm run dev
```

### No bridge available

If the Kinect bridge is not running, the app displays the background starfield and automatically retries the WebSocket connection every 3 seconds. As soon as the bridge starts, the frontend reconnects without needing a page reload.

## Modes

### 1. Mock mode (default for dev)

Bridge generates a swaying humanoid silhouette with synthetic depth (head, torso, arms, legs).
No hardware required. Useful for tuning visuals.

### 2. Real Kinect v1

#### Kinect 360 on macOS (libfreenect + Python bridge)

Use the **Python Kinect bridge** in this repo. It uses [libfreenect](https://github.com/OpenKinect/libfreenect) and streams the same binary WebSocket protocol on port 9876. The mask is built from a depth threshold (no multi-user index on Mac via libfreenect).

**One command** (from project root, in a terminal where Homebrew is available):

```bash
npm run dev:kinect
```

This installs libfreenect (if needed), Python deps, and starts the bridge. Then run the frontend in another terminal (`npm run dev:frontend`) or refresh the app. **Do not run the Node mock bridge** at the same time — only one process on port 9876.

If the setup script reports *freenect not found* (PyPI package is broken), run `./apps/kinect-bridge/install-freenect-from-source.sh` once, then `npm run dev:kinect` again.

**Depth format**: the bridge first tries `DEPTH_MM` (direct millimetres) and falls back to 11-bit disparity with automatic inversion + scaling so near/far thresholds always mean real metres.  
**Mirror**: the depth image is flipped horizontally so left/right matches the person's natural perspective.  
Manual install and options: see `apps/kinect-bridge/README.md` (`--port`, `--width`, `--height`, `--near`, `--far`, `--fps`).

#### Kinect 360 on Windows (Kinect SDK v1.8)

For **real user segmentation** (player index) you need the official SDK on Windows:

1. **Windows machine** with Kinect v1 connected
2. Install [Kinect SDK v1.8](https://www.microsoft.com/en-us/download/details.aspx?id=40278)
3. Run a bridge (C# or Node) that reads depth + user index and sends the same binary WebSocket protocol
4. Point the frontend at the Windows machine's IP: `ws://WINDOWS_IP:9876`

The bridge protocol is documented in `shared/protocol/src/types.ts`.

## Visual Features

### Foreground particles (body)

- Particles emitted from the silhouette mask with depth-based Z positioning
- **4 sparkle shapes**: dots, 4-point stars, dust (gaussian glow), bokeh (rings)
- **2D color gradient**: color blends across both **depth** (near=warm, far=cool) and **height** (head=warm, feet=cool) simultaneously — creating rich, vivid color variation across the entire body silhouette
- **Upward drift physics**: particles spawn at body positions and float upward with randomised scatter, mimicking the teamLab "stardust escaping the body" aesthetic
- ~18% of particles are "aura" type: larger, slower, longer-lived — producing a soft outer glow halo
- Depth-based effects: size, alpha, and color all modulated by Z distance
- **Render architecture**: particles rendered into a dedicated ping-pong feedback buffer (separate from background) — prevents background accumulation into the trail system

### Rendering pipeline

```
Background scene ──► clear screen + render directly (no feedback accumulation)
Particle scene   ──► feedback RT: (prev × decay) + new particles
                 ──► filmic tone-map + additive composite onto background
```

This separation ensures the background starfield is always clean and dark while the particle trails can be long and bright without whitewashing the scene.

### Trails

- Feedback-buffer trail system (ping-pong render targets with configurable decay)
- Filmic tone-mapping in the display pass to prevent highlight blowout
- Trail strength adjustable in real-time

### Background

- Up to 10,000 atmospheric sparkles (density adjustable live via `drawRange`)
- **Static mode**: particles stay in place, twinkle with per-particle phase offsets
- **Animated mode**: particles drift slowly with configurable speed
- **4 sparkle shapes**: dots, stars, dust, bokeh (same as foreground)
- **Dual color pickers** with random per-particle mix
- Parallax effect: background shifts subtly based on person's position centroid
- Size, opacity, and animation speed all adjustable

## Debug View

Toggle **Debug → Show mask / depth** in the GUI panel to see the raw mask
and depth map overlaid in the bottom-left corner (mask on the left, depth on the right).

### Troubleshooting when using Kinect

If the overlay stays black even though the app shows "source: WebSocket (Bridge)":

1. **Browser console** (F12 → Console): look for:
   - `[WSSource] frame received DEPTH 320 x 240` and `... MASK 320 x 240` — frames are arriving and decoding; if you see these, the issue may be all-zero depth (sensor not seeing the scene yet, or no one in range).
   - `[WSSource] decode failed` — protocol mismatch (wrong frame size or format); the error message will show expected vs actual byte lengths.

2. **Bridge terminal**: when a client connects you should see:
   - `[bridge] sending frames: DEPTH 153600 bytes, MASK 76800 bytes, 320x240`
   - A few lines like `[bridge] depth: min=..., max=..., nonzero=...; mask sum=...` — if `nonzero=0` and `mask sum=0`, the Kinect is returning no valid depth (wait a few seconds for the sensor to warm up, or step into the camera’s view).

3. **Port in use**: if something else is on port 9876, stop it (e.g. `kill $(lsof -t -i :9876)`) and restart the bridge.

## GUI Controls

### Particles (foreground)

| Parameter | Range | Description |
|-----------|-------|-------------|
| Sparkle type | dots / stars / dust / bokeh | Shape of body particles |
| Color near | color picker | Color for close particles |
| Color far | color picker | Color for distant particles |
| Emit / frame | 50–2500 | Particles spawned per frame |
| Base size | 0.5–8 | Point sprite base size |
| Intensity | 0.02–0.5 | Per-particle brightness (prevents whiteout) |
| Anim speed | 0.1–3.0 | Turbulence and velocity multiplier |
| Decay rate | 0.1–2.0 | How fast particles fade and die |
| Spread | 1–8 | World-space spread of the silhouette |

### Depth

| Parameter | Range | Description |
|-----------|-------|-------------|
| Near (mm) | 400–2500 | Depth clamp near plane |
| Far (mm) | 1500–6000 | Depth clamp far plane |
| Z spread | 0.5–6 | World Z range for depth mapping |
| Size × depth | 0–1 | How much depth affects particle size |
| Alpha × depth | 0–1 | How much depth affects particle brightness |

### Trails

| Parameter | Range | Description |
|-----------|-------|-------------|
| Feedback | 0.80–0.995 | Trail decay (higher = longer trails) |

### Background

| Parameter | Range | Description |
|-----------|-------|-------------|
| Mode | static / animated | Stationary twinkle or drifting particles |
| Sparkle type | dots / stars / dust / bokeh | Shape of background sparkles |
| Sparkle size | 0.5–10 | Size of background particles |
| Anim speed | 0–3 | Drift speed and twinkle frequency |
| Color 1 | color picker | Primary sparkle color |
| Color 2 | color picker | Secondary sparkle color |
| Density | 500–10000 | Number of visible background particles |
| Opacity | 0–1 | Overall background brightness |

### Debug

| Parameter | Description |
|-----------|-------------|
| Show mask / depth | Toggle debug overlay (bottom-left corner) |

## WebSocket Protocol

Binary frames with 13-byte header (little-endian):

```
[type: u8][width: u16][height: u16][timestamp: f64]  +  payload
```

| Type | ID | Payload |
|------|----|---------|
| DEPTH | 0x01 | `Uint16Array` — depth in mm, 0 = invalid |
| USER_MASK | 0x02 | `Uint8Array` — 0 = background, 1..N = player index |
| SKELETON | 0x03 | JSON-encoded joint array |

See `shared/protocol/src/types.ts` for full type definitions.

## Project Structure

```
Shadow Particle/
├── package.json              # npm workspaces root
├── README.md
├── START-KINECT.command      # Double-click launcher (Mac Finder)
├── shared/protocol/          # Binary frame types + encode/decode
│   └── src/
│       ├── types.ts          # Frame types, MaskData, DepthData
│       ├── encode.ts         # Frame → ArrayBuffer
│       ├── decode.ts         # ArrayBuffer → Frame (with payload-size validation)
│       └── index.ts
├── apps/bridge/              # Node WebSocket server (mock, no hardware needed)
│   └── src/
│       ├── index.ts          # WS server on :9876, frame loop
│       └── mock/             # MockKinectSource — synthetic humanoid silhouette
├── apps/kinect-bridge/       # Python WebSocket server (real Kinect v1 on Mac/Linux)
│   ├── kinect_bridge.py      # libfreenect → DEPTH_MM/11-bit → mirror → mask → WS :9876
│   ├── setup-and-run.sh      # One-shot: install deps + run bridge
│   ├── install-freenect-from-source.sh  # Build freenect from source (PyPI broken)
│   ├── requirements.txt
│   └── README.md
└── apps/frontend/            # Vite + Three.js + lil-gui
    └── src/
        ├── main.ts           # Entry point, animation loop
        ├── motion/
        │   ├── MotionSource.ts
        │   └── WebSocketStreamSource.ts   # Kinect-only, auto-reconnect every 3 s
        ├── rendering/
        │   ├── ParticleSystem.ts     # 80 K pool, 4 shapes, 2D depth+height color
        │   ├── BackgroundStarfield.ts # 10 K pool, 4 shapes, dual colors, twinkle
        │   ├── TrailRenderer.ts      # Ping-pong feedback + filmic tone-map
        │   └── SceneManager.ts       # Separate bg/particle scenes, auto-reconnect
        ├── gui/
        │   └── controls.ts           # AppParams + lil-gui setup
        └── debug/
            └── DebugOverlay.ts       # Mask + depth visualiser
```

## Tech Stack

- **Frontend**: Vite + TypeScript + Three.js (WebGL2) + lil-gui
- **Kinect bridge**: Python 3 + libfreenect + numpy + websockets
- **Mock bridge**: Node.js + ws + tsx
- **Monorepo**: npm workspaces
- **Protocol**: Custom binary WebSocket (shared TypeScript package)

## Next Steps

- [ ] Windows: real Kinect SDK v1.8 bridge (C# → WebSocket)
- [ ] Depth-based DOF (pseudo depth-of-field blur on far particles)
- [ ] Bloom post-processing (UnrealBloomPass)
- [ ] Skeleton tracking → particle interactions (hands attract/repel)
- [ ] Multi-user support (multiple silhouettes)
- [ ] Preset system (save/load parameter combinations)
- [ ] Audio reactivity (microphone → particle burst)
- [ ] Performance: GPU-based particle update (transform feedback / compute shader)
