#!/usr/bin/env python3
"""
Shadow Particle — Kinect v1 bridge (libfreenect).
Streams depth + mask over WebSocket on port 9876 (same protocol as Node bridge).
Mask is derived from depth threshold (no user index on libfreenect).
"""

import argparse
import asyncio
import struct
import time
from threading import Thread, Lock

try:
    import numpy as np
except ImportError:
    print("Install numpy: pip install numpy")
    raise

try:
    import websockets
except ImportError:
    print("Install websockets: pip install websockets")
    raise

# Optional: freenect (libfreenect Python bindings)
FREENECT_AVAILABLE = False
try:
    import freenect
    FREENECT_AVAILABLE = True
except ImportError:
    pass

# Protocol constants (match shared/protocol)
HEADER_SIZE = 13
FRAME_DEPTH = 0x01
FRAME_MASK = 0x02
DEFAULT_NEAR_MM = 800
DEFAULT_FAR_MM = 4000


def encode_frame(frame_type: int, width: int, height: int, timestamp: float, payload: bytes) -> bytes:
    """Encode one frame: 13-byte header (little-endian) + payload."""
    header = struct.pack("<BHHd", frame_type, width, height, timestamp)
    return header + payload


def depth_to_mask(depth_flat: "np.ndarray", near_mm: int, far_mm: int) -> "np.ndarray":
    """Build a binary mask: 1 where near_mm <= depth <= far_mm and depth valid."""
    valid = (depth_flat > 0) & (depth_flat >= near_mm) & (depth_flat <= far_mm)
    return valid.astype(np.uint8)


def resize_depth(depth: "np.ndarray", out_w: int, out_h: int) -> "np.ndarray":
    """Simple 2x downsample if needed (e.g. 640x480 -> 320x240)."""
    h, w = depth.shape
    if w == out_w and h == out_h:
        return depth.flatten()
    if w == 2 * out_w and h == 2 * out_h:
        return depth[::2, ::2].flatten()
    y = np.linspace(0, h - 1, out_h).astype(int)
    x = np.linspace(0, w - 1, out_w).astype(int)
    return depth[np.ix_(y, x)].flatten()


def kinect_thread(
    out_w: int,
    out_h: int,
    near_mm: int,
    far_mm: int,
    fps: float,
    latest_holder: dict,
    lock: Lock,
    stop_event: object,
) -> None:
    """Background thread: grab depth from Kinect, build mask, update latest_holder."""
    if not FREENECT_AVAILABLE:
        with lock:
            latest_holder["error"] = "freenect not available (install libfreenect + Python bindings)"
        return

    interval = 1.0 / fps
    while not getattr(stop_event, "is_set", lambda: False)():
        try:
            out = freenect.sync_get_depth()
            depth = out[0] if isinstance(out, (tuple, list)) else out
            if depth is None:
                time.sleep(interval)
                continue
            depth = np.asarray(depth, dtype=np.float32, copy=False)
            # libfreenect depth is often 11-bit (0–2047); scale to approximate mm
            dmax = float(depth.max())
            if dmax > 0 and dmax < 3000:
                depth = np.clip(depth * 2.0, 0, 65535)
            depth = depth.astype(np.uint16)

            depth_flat = resize_depth(depth, out_w, out_h)
            mask = depth_to_mask(depth_flat, near_mm, far_mm)
            ts = time.time()
            with lock:
                latest_holder["depth"] = depth_flat.tobytes()
                latest_holder["mask"] = mask.tobytes()
                latest_holder["w"] = out_w
                latest_holder["h"] = out_h
                latest_holder["ts"] = ts
                latest_holder.pop("error", None)
        except Exception as e:
            with lock:
                latest_holder["error"] = str(e)
        time.sleep(interval)


async def broadcast_loop(
    clients: set,
    latest_holder: dict,
    lock: Lock,
    out_w: int,
    out_h: int,
    fps: float,
) -> None:
    """Every 1/fps seconds, take latest frame and send to all clients."""
    interval = 1.0 / fps
    while True:
        await asyncio.sleep(interval)
        with lock:
            if "error" in latest_holder:
                continue
            depth_b = latest_holder.get("depth")
            mask_b = latest_holder.get("mask")
            w = latest_holder.get("w", out_w)
            h = latest_holder.get("h", out_h)
            ts = latest_holder.get("ts", 0.0)
        if not depth_b or not mask_b or not clients:
            continue
        depth_frame = encode_frame(FRAME_DEPTH, w, h, ts, depth_b)
        mask_frame = encode_frame(FRAME_MASK, w, h, ts, mask_b)
        dead = set()
        for ws in clients:
            try:
                await ws.send(depth_frame)
                await ws.send(mask_frame)
            except Exception:
                dead.add(ws)
        for ws in dead:
            clients.discard(ws)


async def handler(websocket, path, clients: set) -> None:
    clients.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
        clients.discard(websocket)


def main() -> None:
    parser = argparse.ArgumentParser(description="Shadow Particle Kinect bridge (libfreenect)")
    parser.add_argument("--port", type=int, default=9876, help="WebSocket port")
    parser.add_argument("--width", type=int, default=320, help="Output width")
    parser.add_argument("--height", type=int, default=240, help="Output height")
    parser.add_argument("--near", type=int, default=DEFAULT_NEAR_MM, help="Near plane mm for mask")
    parser.add_argument("--far", type=int, default=DEFAULT_FAR_MM, help="Far plane mm for mask")
    parser.add_argument("--fps", type=float, default=30.0, help="Target FPS")
    args = parser.parse_args()

    if not FREENECT_AVAILABLE:
        print("freenect not found. Install libfreenect and Python bindings:")
        print("  brew install libfreenect")
        print("  pip install -r requirements.txt")
        print("  (If needed, use the Python wrapper from libfreenect repo wrappers/python)")
        raise SystemExit(1)

    latest_holder: dict = {}
    lock = Lock()
    stop_event = type("Stop", (), {"is_set": lambda: False})()

    t = Thread(
        target=kinect_thread,
        args=(args.width, args.height, args.near, args.far, args.fps, latest_holder, lock, stop_event),
        daemon=True,
    )
    t.start()

    # Give the thread one frame to fill
    time.sleep(0.2)
    with lock:
        if "error" in latest_holder:
            print("Kinect error:", latest_holder["error"])
            raise SystemExit(1)

    clients = set()

    async def handler_bind(ws, path):
        await handler(ws, path, clients)

    async def main_async():
        async with websockets.serve(handler_bind, "0.0.0.0", args.port, ping_interval=None):
            print(f"\n  Shadow Particle · Kinect Bridge")
            print(f"  ws://localhost:{args.port}  ({args.width}×{args.height} @ {args.fps} fps)\n")
            asyncio.create_task(
                broadcast_loop(clients, latest_holder, lock, args.width, args.height, args.fps)
            )
            await asyncio.Future()

    asyncio.run(main_async())


if __name__ == "__main__":
    main()
