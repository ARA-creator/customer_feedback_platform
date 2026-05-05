"""
Vercel Flask entrypoint (backend service).

Important: this file is intentionally named `index.py` (not `app.py`) to avoid
colliding with the existing `app/` package directory.
"""

from app import create_app

app = create_app()

