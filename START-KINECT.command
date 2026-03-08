#!/bin/bash
# Double-click this file in Finder to start the Kinect bridge
# (or run in Terminal from project root)
cd "$(dirname "$0")"
echo "Project folder: $(pwd)"
echo ""
if ! command -v brew &>/dev/null && [[ ! -x /opt/homebrew/bin/brew ]] && [[ ! -x /usr/local/bin/brew ]]; then
  echo "Homebrew not found. Install from https://brew.sh then double-click this file again."
  echo "Or run in Terminal: /usr/bin/open -a Terminal https://brew.sh"
  read -r -p "Press Enter to close..."
  exit 1
fi
npm run dev:kinect
echo ""
read -r -p "Press Enter to close..."
