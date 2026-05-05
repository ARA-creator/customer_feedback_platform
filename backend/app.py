"""
Vercel Flask entrypoint.

Vercel's Flask/Python runtime looks for an entry file like `app.py` and expects
an `app` object to be exported. We delegate to the existing application factory.
"""

from backend.app import create_app

app = create_app()

