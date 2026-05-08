"""
Vercel Serverless Function entrypoint for the Flask API.

Vercel's Python runtime routes requests based on files in the `api/` directory.
We expose the Flask WSGI `app` there and use a rewrite in `vercel.json` so that
all `/api/*` requests are handled by this single function.
"""

from main import app  # noqa: F401

