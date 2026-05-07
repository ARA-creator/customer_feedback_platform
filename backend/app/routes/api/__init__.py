import logging

from flask import Blueprint

logger = logging.getLogger(__name__)

# The frontend and tests expect API routes under `/api/...`.
# If you deploy behind a platform-level route prefix, keep that prefix aligned
# with this blueprint (i.e., do not double-prefix).
api_bp = Blueprint("api", __name__, url_prefix="/api")

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

