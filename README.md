# Shadow Particle

Interactive "shadow particle projection" inspired by teamLab: a person's silhouette + depth becomes particles that follow the body with trails, depth layering, and a customizable atmospheric background. Supports **Kinect 360** (Mac via libfreenect, Windows via SDK), **mock mode**, and **webcam + MediaPipe** fallback.

## Architecture

```
┌─────────────────────────────┐   WebSocket (binary)   ┌──────────────────────────┐
│  Bridge                      │   depth + mask         │   Frontend (Vite/Three)  │
│  • Node: mock generator      │   320×240 @ 30fps  ──▶ │  • 3D particle renderer  │
│  • Python: Kinect (Mac/Linux)│                        │  • Feedback trails       │
│  • Windows: Kinect SDK v1.8 │                        │  • Background starfield  │
└─────────────────────────────┘                        │  • lil-gui controls      │
                                                       └──────────────────────────┘
```

**Two-process design**: the bridge reads sensor data and streams binary frames over WebSocket;
the frontend renders everything in WebGL2 using Three.js.

### MotionSource abstraction

The frontend uses a `MotionSource` interface with two implementations:

| Source | Sensor | Depth | Mask |
|--------|--------|-------|------|
| `WebSocketStreamSource` | Kinect v1 via bridge | ✅ real | ✅ real (user index on Windows; depth-threshold on Mac) |
| `WebcamSegmentationSource` | Webcam + MediaPipe | 🔶 pseudo (erosion) | ✅ ML segmentation |

Fallback order: **WebSocket → Webcam → background-only mode**.

## Quick Start

```bash
# Install everything (from project root)
cd "Shadow Particle"
npm install

# Terminal 1 — start bridge (mock Kinect)
npm run dev:bridge

# Terminal 2 — start frontend
npm run dev:frontend
```

Open **http://localhost:5173** — you should see a humanoid silhouette made of glowing particles with trails and a starfield background.

### Run both together

```bash
npm run dev
```

### Webcam mode (no bridge)

Stop the bridge (or don't start it). The frontend will auto-fallback to your webcam + MediaPipe segmentation after a 3-second timeout. The browser will ask for camera permission.

## Modes

### 1. Mock mode (default for dev)

Bridge generates a swaying humanoid silhouette with synthetic depth (head, torso, arms, legs).
No hardware required. Useful for tuning visuals.

### 2. Webcam fallback

If the bridge is unreachable, the frontend automatically opens the webcam
and uses MediaPipe Selfie Segmentation for masking + pseudo-depth via
iterative erosion (center of body = closer, edges = further).

### 3. Real Kinect v1

#### Kinect 360 on macOS (libfreenect + Python bridge)

Use the **Python Kinect bridge** in this repo. It uses [libfreenect](https://github.com/OpenKinect/libfreenect) and speaks the same WebSocket protocol on port 9876. The mask is built from a **depth threshold** (no multi-user index on Mac).

1. Install libfreenect and Python deps:
   ```bash
   brew install libfreenect
   cd apps/kinect-bridge
   pip install -r requirements.txt
   pip install freenect   # or use the Python wrapper from libfreenect repo
   ```
2. Plug in the Kinect, then run the bridge:
   ```bash
   python kinect_bridge.py
   ```
3. Start the frontend as usual (`npm run dev:frontend`). It will connect to `ws://localhost:9876` and show real depth + mask.

Options: `--port`, `--width`, `--height`, `--near`, `--far`, `--fps`. See `apps/kinect-bridge/README.md`.

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
- **Dual color pickers**: near color (warm) and far color (cool), interpolated by depth
- **Per-particle intensity** control prevents additive-blending whiteout
- **Animation speed** controls turbulence, velocity, and scatter
- ~15% of particles are "aura" type: larger, dimmer, longer-lived, slower — creating a natural glow halo
- Depth-based effects: size, alpha, and color all modulated by Z distance

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
├── shared/protocol/          # Binary frame types + encode/decode
│   └── src/
│       ├── types.ts          # Frame types, MaskData, DepthData
│       ├── encode.ts         # Frame → ArrayBuffer
│       ├── decode.ts         # ArrayBuffer → Frame
│       └── index.ts
├── apps/bridge/              # Node WebSocket server (mock)
│   └── src/
│       ├── index.ts          # WS server on :9876, frame loop
│       ├── mock/             # MockKinectSource — synthetic humanoid
│       └── kinect/           # KinectAdapter placeholder (Windows SDK)
├── apps/kinect-bridge/       # Python WebSocket server (real Kinect on Mac/Linux)
│   ├── kinect_bridge.py      # libfreenect → depth + mask → WS :9876
│   ├── requirements.txt
│   └── README.md
└── apps/frontend/            # Vite + Three.js + lil-gui
    └── src/
        ├── main.ts           # Entry point, animation loop
        ├── motion/           # MotionSource interface
        │   ├── MotionSource.ts
        │   ├── WebSocketStreamSource.ts
        │   └── WebcamSegmentationSource.ts
        ├── rendering/
        │   ├── ParticleSystem.ts      # 80K particle pool, 4 shapes, depth coloring
        │   ├── BackgroundStarfield.ts # 10K pool, 4 shapes, dual colors, twinkle
        │   ├── TrailRenderer.ts       # Ping-pong feedback + filmic tonemap
        │   └── SceneManager.ts        # Orchestration, source negotiation
        ├── gui/
        │   └── controls.ts            # AppParams + lil-gui setup
        └── debug/
            └── DebugOverlay.ts        # Mask + depth visualiser
```

## Tech Stack

- **Frontend**: Vite + TypeScript + Three.js (WebGL2) + lil-gui
- **Bridge**: Node.js + ws + tsx
- **Segmentation fallback**: @mediapipe/tasks-vision (Selfie Segmenter)
- **Monorepo**: npm workspaces
- **Protocol**: Custom binary WebSocket (shared TypeScript package)

## Next Steps

- [ ] Real Kinect v1 bridge (C# → WebSocket on Windows)
- [ ] Depth-based DOF (pseudo depth-of-field blur)
- [ ] Bloom post-processing (UnrealBloomPass)
- [ ] Skeleton tracking → particle interactions (hands attract/repel)
- [ ] Multi-user support (user index > 1)
- [ ] Preset system (save/load parameter combinations)
- [ ] Audio reactivity
- [ ] Performance: GPU-based particle update (transform feedback / compute)
