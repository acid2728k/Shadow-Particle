#!/usr/bin/env bash
# Shadow Particle — Kinect bridge: install deps (if needed) and run.
set -e
cd "$(dirname "$0")"

echo "  Shadow Particle · Kinect bridge setup"
echo "  --------------------------------------"

# 1. libfreenect (system) — find brew
BREW=""
if command -v brew &>/dev/null; then BREW=brew
elif [[ -x /opt/homebrew/bin/brew ]]; then BREW=/opt/homebrew/bin/brew
elif [[ -x /usr/local/bin/brew ]]; then BREW=/usr/local/bin/brew
fi
if [[ -z "$BREW" ]]; then
  echo "  Homebrew not found. Install from https://brew.sh then run: npm run dev:kinect"
  exit 1
fi
if ! $BREW list libfreenect &>/dev/null 2>&1; then
  echo "  Installing libfreenect (required for Kinect 360 on Mac)..."
  $BREW install libfreenect
fi
echo "  ✓ libfreenect"

# 2. Python deps
if ! python3 -c "import numpy" 2>/dev/null; then
  echo "  Installing Python deps (numpy, websockets)..."
  pip3 install -r requirements.txt
fi
if ! python3 -c "import websockets" 2>/dev/null; then
  pip3 install -r requirements.txt
fi
echo "  ✓ numpy, websockets"

# 3. freenect Python bindings (PyPI package is broken — use source build)
if ! python3 -c "import freenect" 2>/dev/null; then
  echo "  freenect not found. Building from libfreenect source..."
  if [[ -f "$(dirname "$0")/install-freenect-from-source.sh" ]]; then
    chmod +x "$(dirname "$0")/install-freenect-from-source.sh" 2>/dev/null
    "$(dirname "$0")/install-freenect-from-source.sh" || true
  fi
fi
if ! python3 -c "import freenect" 2>/dev/null; then
  echo ""
  echo "  freenect still not found. Run manually:"
  echo "    cd apps/kinect-bridge && ./install-freenect-from-source.sh"
  echo ""
  exit 1
fi
echo "  ✓ freenect"

echo "  --------------------------------------"
echo "  Starting Kinect bridge on ws://localhost:9876"
echo "  Plug in Kinect 360 and refresh the app in the browser."
echo ""

exec python3 kinect_bridge.py "$@"
