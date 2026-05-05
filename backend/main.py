"""
Vercel Flask entrypoint (backend service).

Vercel's Flask detector accepts names like main.py, wsgi.py, index.py in certain
folders — `backend/index.py` is not in the documented search list, but
`backend/main.py` is.

See: https://vercel.com/docs/frameworks/backend/flask#exporting-the-flask-application
"""

from app import create_app

app = create_app()
