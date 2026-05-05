#!/bin/bash
# Helper script to start Flask with the virtual environment

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# Activate virtual environment
source .venv/bin/activate

# Run Flask
python backend/run.py
