import logging
import os

from flask import Blueprint

logger = logging.getLogger(__name__)

# NOTE:
# - Locally, the backend serves API routes under `/api/*`.
# - On Vercel Services, the backend service is mounted under `/api`, so adding
#   another `/api` prefix would result in `/api/api/*`.
_ON_VERCEL = bool(os.getenv("VERCEL"))
api_bp = Blueprint("api", __name__, url_prefix="" if _ON_VERCEL else "/api")

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

