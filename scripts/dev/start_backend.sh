#!/usr/bin/env bash
# Start Flask with the repo-root virtualenv (includes google-genai).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PY="$ROOT/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  echo "Missing $PY — create venv: python -m venv $ROOT/.venv && $ROOT/.venv/bin/pip install -r $ROOT/backend/requirements.txt" >&2
  exit 1
fi
cd "$ROOT/backend"
exec "$PY" run.py
