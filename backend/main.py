"""
Vercel Flask entrypoint (backend service).

Vercel's Flask detector accepts names like main.py, wsgi.py, index.py in certain
folders — `backend/index.py` is not in the documented search list, but
`backend/main.py` is.

See: https://vercel.com/docs/frameworks/backend/flask#exporting-the-flask-application
"""

import os
import sys

# Ensure `backend/` is on sys.path even when the function
# working directory isn't the backend root (observed on some deployments).
BACKEND_DIR = os.path.dirname(__file__)
if BACKEND_DIR and BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import create_app  # noqa: E402

app = create_app()
