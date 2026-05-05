#!/bin/bash
# Simple script to build Tailwind CSS
# Requires Tailwind CLI: https://tailwindcss.com/docs/installation

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# Download Tailwind CLI if not present
TAILWIND_BIN="./scripts/frontend/tailwindcss"
if [ ! -f "$TAILWIND_BIN" ]; then
    echo "Downloading Tailwind CLI..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -sLo "$TAILWIND_BIN" https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-x64
        chmod +x "$TAILWIND_BIN"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        curl -sLo "$TAILWIND_BIN" https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-macos-x64
        chmod +x "$TAILWIND_BIN"
    else
        echo "Unsupported OS. Please install Tailwind CLI manually."
        exit 1
    fi
fi

# Build CSS
"$TAILWIND_BIN" -c ./config/frontend/tailwind.backend-static.config.js -i ./backend/app/static/src/input.css -o ./backend/app/static/css/output.css --minify

echo "CSS built successfully to backend/app/static/css/output.css"
