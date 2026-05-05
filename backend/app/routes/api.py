"""
Compatibility shim for the API blueprint.

The real implementation lives in the `backend/app/routes/api/` package. This file exists
so legacy imports like `from backend.app.routes.api import api_bp` keep working.
"""

from __future__ import annotations

from .api import api_bp

__all__ = ["api_bp"]

