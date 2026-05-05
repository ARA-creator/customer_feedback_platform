#!/usr/bin/env bash
set -euo pipefail

# Backwards-compatible wrapper.
# The actual no-sudo Cloudflare quick tunnel helper lives in scripts/dev/.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${SCRIPT_DIR}/dev/cloudflared_quick_tunnel.sh" "$@"

