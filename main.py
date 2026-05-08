"""
Vercel Python entrypoint.

Some Vercel setups ignore `vercel.json` experimentalServices and fall back to
zero-config Python detection, which expects an `app` object in `main.py` at the
project root. This file delegates to the real backend app factory in `backend/`.
"""

import os
import sys

PROJECT_ROOT = os.path.dirname(__file__)
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import create_app  # noqa: E402

app = create_app()

