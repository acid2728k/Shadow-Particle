# Shadow Particle

Interactive "shadow particle projection" inspired by teamLab: a person's silhouette + depth → particles that follow the body shape with trails, depth layering, and an atmospheric background.

## Architecture

```
┌──────────────────────┐   WebSocket (binary)   ┌──────────────────────────┐
│   Bridge (Node.js)   │ ────────────────────▶   │   Frontend (Vite/Three)  │
│                      │   depth + user mask      │                          │
│  • Mock generator    │   320×240 @ 30fps        │  • 3D particle renderer  │
│  • Real Kinect v1 *  │                          │  • Feedback trails       │
└──────────────────────┘                          │  • Background starfield  │
                                                  │  • lil-gui controls      │
                                                  └──────────────────────────┘
* = Windows-only via Kinect SDK v1.8
```

**Two-process design**: the bridge reads sensor data and streams binary frames;
the frontend renders everything in WebGL2 using Three.js.

### MotionSource abstraction

The frontend uses a `MotionSource` interface with two implementations:

| Source | Sensor | Depth | Mask |
|--------|--------|-------|------|
| `WebSocketStreamSource` | Kinect v1 via bridge | ✅ real | ✅ real (user index) |
| `WebcamSegmentationSource` | Webcam + MediaPipe | 🔶 pseudo (erosion) | ✅ ML segmentation |

Fallback order: **WebSocket → Webcam → background-only mode**.

## Quick Start

```bash
# Install everything (from project root)
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

## Modes

### 1. Mock mode (default for dev)

Bridge generates a swaying humanoid silhouette with synthetic depth.
No hardware required.

### 2. Webcam fallback

If the bridge is unreachable, the frontend automatically opens the webcam
and uses MediaPipe Selfie Segmentation for masking + pseudo-depth via
iterative erosion.

### 3. Real Kinect v1

**Kinect v1 (Xbox 360) only works on Windows with Kinect SDK v1.8.**

Recommended setup:

1. **Windows machine** with Kinect v1 connected
2. Install [Kinect SDK v1.8](https://www.microsoft.com/en-us/download/details.aspx?id=40278)
3. Run a bridge app (C# or Python) that reads depth + user index
   and sends them over the same binary WebSocket protocol
4. Point the frontend at the Windows machine's IP:
   ```
   ws://WINDOWS_IP:9876
   ```
   (update the URL in `WebSocketStreamSource` or add a query param)

The bridge protocol is documented in `shared/protocol/src/types.ts`.

## Debug View

Toggle **Debug → Show mask / depth** in the GUI panel to see the raw mask
and depth overlaid in the bottom-left corner.

## GUI Controls

| Folder | Parameter | Description |
|--------|-----------|-------------|
| Particles | Emit / frame | Particles emitted per frame |
| | Base size | Point sprite base size |
| | Decay rate | How fast particles die |
| | Spread | World-space spread multiplier |
| Depth | Near / Far (mm) | Depth clamp range |
| | Z spread | World Z range for depth mapping |
| | Size × depth | How much depth affects particle size |
| | Alpha × depth | How much depth affects particle brightness |
| Trails | Feedback | Trail decay strength (higher = longer trails) |
| Background | Opacity | Background starfield visibility |
| Debug | Show mask / depth | Toggle debug overlay |

## Project Structure

```
Shadow Particle/
├── package.json              # npm workspaces root
├── shared/protocol/          # Binary frame types + encode/decode
│   └── src/
├── apps/bridge/              # WebSocket server (mock or Kinect)
│   └── src/
│       ├── index.ts          # WS server, frame loop
│       ├── mock/             # Synthetic frame generator
│       └── kinect/           # Placeholder for real Kinect adapter
└── apps/frontend/            # Vite + Three.js + lil-gui
    └── src/
        ├── main.ts           # Entry point
        ├── motion/           # MotionSource interface + implementations
        ├── rendering/        # ParticleSystem, Starfield, TrailRenderer, SceneManager
        ├── gui/              # lil-gui control panel
        └── debug/            # Debug overlay (mask/depth visualiser)
```

## Next Steps

- [ ] Real Kinect v1 bridge (C# → WebSocket)
- [ ] Depth-based DOF (pseudo depth-of-field blur)
- [ ] Bloom post-processing (UnrealBloomPass)
- [ ] Skeleton tracking → particle interactions (hands attract/repel)
- [ ] Multi-user support (user index > 1)
- [ ] Color palettes / themes
- [ ] Audio reactivity
- [ ] Performance: GPU-based particle update (transform feedback / compute)
