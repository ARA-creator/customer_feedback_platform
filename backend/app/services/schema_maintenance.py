"""Lightweight schema patches for columns/tables missing from older deployments."""

from __future__ import annotations

import logging

from sqlalchemy import text

from ..models import AuditLog

logger = logging.getLogger(__name__)


def ensure_users_profile_json_column(db) -> None:
    """Add users.profile_json when SQLAlchemy model expects it but DB predates the column."""
    try:
        bind = db.get_bind()
        dialect = getattr(bind.dialect, "name", "") or ""
        if dialect in {"postgresql", "postgres"}:
            db.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_json TEXT'))
        elif dialect == "sqlite":
            rows = db.execute(text("PRAGMA table_info(users)")).fetchall()
            cols = {row[1] for row in rows} if rows else set()
            if "profile_json" not in cols:
                db.execute(text("ALTER TABLE users ADD COLUMN profile_json TEXT"))
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to ensure users.profile_json column")


def ensure_audit_logs_table(db) -> None:
    """Create audit_logs if an older deployment predates the AuditLog model."""
    try:
        bind = db.get_bind()
        AuditLog.__table__.create(bind=bind, checkfirst=True)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to ensure audit_logs table")
