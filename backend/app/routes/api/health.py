import os
import time

from flask import jsonify
from sqlalchemy import text

from ...core.config import get_config
from ...core.database import engine
from ...services.gemini_client import gemini_sdk_available, gemini_sdk_error
from . import api_bp


@api_bp.route("/health", methods=["GET"])
def health():
    """
    Lightweight health endpoint.

    Vercel sometimes hides runtime logs; this endpoint surfaces the most common
    failure modes (cold start vs DB connectivity) via a fast `SELECT 1`.
    """
    cfg = get_config()
    started_at = time.time()
    db_ok = False
    db_error = None

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        db_error = repr(e)

    gemini_key_set = bool((os.getenv("GEMINI_API_KEY") or getattr(cfg, "GEMINI_API_KEY", "") or "").strip())
    sdk_ok = gemini_sdk_available()

    return (
        jsonify(
            {
                "ok": bool(db_ok),
                "db": {"ok": bool(db_ok), "error": db_error},
                "gemini": {
                    "api_key_configured": gemini_key_set,
                    "sdk_available": sdk_ok,
                    "ready": bool(gemini_key_set and sdk_ok),
                    "sdk_error": None if sdk_ok else (gemini_sdk_error() or "unknown")[:240],
                },
                "env": {
                    "APP_ENV": os.getenv("APP_ENV"),
                    "FLASK_ENV": os.getenv("FLASK_ENV"),
                    "config_ENV": getattr(cfg, "ENV", None),
                },
                "timing_ms": int((time.time() - started_at) * 1000),
            }
        ),
        200 if db_ok else 500,
    )

