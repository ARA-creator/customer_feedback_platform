import logging

from flask import Blueprint

logger = logging.getLogger(__name__)

# On Vercel Services, the backend is mounted under `/api` via `routePrefix`,
# so the blueprint should not add another `/api` layer (which would become `/api/api/...`).
# Locally (without Services), requests should still be made to `/api/...` because the
# frontend uses `/api` as its base URL.
api_bp = Blueprint("api", __name__, url_prefix="")

# Import route modules so decorators register on api_bp.
# These modules may be populated incrementally during the refactor.
from . import admin as _admin  # noqa: F401,E402
from . import analytics as _analytics  # noqa: F401,E402
from . import auth as _auth  # noqa: F401,E402
from . import customers as _customers  # noqa: F401,E402
from . import feedback as _feedback  # noqa: F401,E402
from . import policies as _policies  # noqa: F401,E402
from . import releases as _releases  # noqa: F401,E402

__all__ = ["api_bp"]

