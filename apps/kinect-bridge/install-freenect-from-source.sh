#!/usr/bin/env bash
# Install freenect Python bindings from libfreenect source (PyPI package is broken).
set -e
cd "$(dirname "$0")"
SCRIPT_DIR="$(pwd)"

echo "  Building freenect Python bindings from source..."
echo "  (PyPI package is broken; libfreenect must be installed: brew install libfreenect)"
echo ""

# Find brew prefix for libfreenect
BREW_PREFIX=""
if [[ -d /opt/homebrew ]]; then BREW_PREFIX=/opt/homebrew
elif [[ -d /usr/local ]]; then BREW_PREFIX=/usr/local
fi
if [[ -z "$BREW_PREFIX" ]] || [[ ! -f "$BREW_PREFIX/lib/libfreenect.dylib" ]]; then
  echo "  libfreenect not found. Run: brew install libfreenect"
  exit 1
fi
echo "  Using libfreenect from: $BREW_PREFIX"

# Build deps (Cython 0.29.x required — libfreenect setup.py breaks with Cython 3.x)
python3 -m pip install --user 'Cython>=0.29,<3' numpy 2>/dev/null || true
export CFLAGS="-I$BREW_PREFIX/include"
export LDFLAGS="-L$BREW_PREFIX/lib"
export CPATH="$BREW_PREFIX/include"
export LIBRARY_PATH="$BREW_PREFIX/lib"

SRC_DIR="$SCRIPT_DIR/.libfreenect-src"
if [[ ! -d "$SRC_DIR/wrappers/python" ]]; then
  echo "  Cloning libfreenect..."
  rm -rf "$SRC_DIR"
  git clone --depth 1 https://github.com/OpenKinect/libfreenect.git "$SRC_DIR"
fi
cd "$SRC_DIR/wrappers/python"
echo "  Building and installing (may take a minute)..."
python3 setup.py build_ext --include-dirs="$BREW_PREFIX/include" --library-dirs="$BREW_PREFIX/lib"
python3 setup.py install --user
cd "$SCRIPT_DIR"
echo ""
if python3 -c "import freenect; print('OK')" 2>/dev/null; then
  echo "  ✓ freenect installed successfully."
else
  echo "  Import still failed. Try: cd $SRC_DIR/wrappers/python && python3 setup.py install --user"
  exit 1
fi
