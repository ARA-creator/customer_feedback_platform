"""
Vercel Flask entrypoint inside the Flask package directory.

Vercel's Flask detector looks for `app/index.py` (among others). Our codebase
already uses `backend/app/` as the Flask package (`create_app` lives in
`backend/app/__init__.py`). This file sits alongside that package so the
detector finds `app` without colliding with a top-level `app.py` module name.
"""

from app import create_app

app = create_app()
