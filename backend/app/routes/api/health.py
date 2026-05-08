import os
import time

from flask import jsonify
from sqlalchemy import text

from ...core.config import get_config
from ...core.database import engine
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

    return (
        jsonify(
            {
                "ok": bool(db_ok),
                "db": {"ok": bool(db_ok), "error": db_error},
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

