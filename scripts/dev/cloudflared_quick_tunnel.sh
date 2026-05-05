#!/usr/bin/env bash
set -euo pipefail

# No-sudo helper to expose local port 5000 to the internet using
# Cloudflare Tunnel "quick tunnel" mode.
#
# Usage:
#   bash scripts/cloudflared_quick_tunnel.sh
#
# Requirements:
#   - curl
#   - your Flask backend running on http://127.0.0.1:5000

PORT="${1:-5000}"
BIN_DIR="${HOME}/bin"
BIN_PATH="${BIN_DIR}/cloudflared"

mkdir -p "${BIN_DIR}"

if [[ ! -x "${BIN_PATH}" ]]; then
  echo "Downloading cloudflared to ${BIN_PATH} (no sudo)..."
  curl -L -o "${BIN_PATH}" \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
  chmod +x "${BIN_PATH}"
fi

echo "Starting Cloudflare quick tunnel -> http://127.0.0.1:${PORT}"
echo "Look for the public URL (https://*.trycloudflare.com) in the output."
"${BIN_PATH}" tunnel --url "http://127.0.0.1:${PORT}"

