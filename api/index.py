import os
import sys

# Allow importing the Flask backend package (`backend/app/...`) as `app`.
PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import create_app  # noqa: E402

app = create_app()

