"""
Per-tab API bearer sessions.

Each browser tab stores its own access token in sessionStorage so multiple users
can stay signed in on the same origin without sharing the Flask session cookie.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from ..models import UserApiSession


def hash_api_token(raw: str) -> str:
    return hashlib.sha256(str(raw or "").encode("utf-8")).hexdigest()


def create_api_session(db: Session, user_id: int) -> Tuple[str, str]:
    """Create a session row; returns (raw_access_token, csrf_token)."""
    raw = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(32)
    now = datetime.now(tz=timezone.utc)
    db.add(
        UserApiSession(
            user_id=int(user_id),
            token_hash=hash_api_token(raw),
            csrf_token=csrf,
            last_used_at=now,
        )
    )
    db.flush()
    return raw, csrf


def resolve_api_session(db: Session, raw_token: str) -> Optional[UserApiSession]:
    if not raw_token:
        return None
    row = (
        db.query(UserApiSession)
        .filter(
            UserApiSession.token_hash == hash_api_token(raw_token),
            UserApiSession.revoked_at.is_(None),
        )
        .first()
    )
    if not row:
        return None
    now = datetime.now(tz=timezone.utc)
    row.last_used_at = now
    return row


def csrf_for_api_session(db: Session, raw_token: str) -> Optional[str]:
    row = resolve_api_session(db, raw_token)
    if not row:
        return None
    return str(row.csrf_token or "") or None


def revoke_api_session(db: Session, raw_token: str) -> bool:
    if not raw_token:
        return False
    row = (
        db.query(UserApiSession)
        .filter(
            UserApiSession.token_hash == hash_api_token(raw_token),
            UserApiSession.revoked_at.is_(None),
        )
        .first()
    )
    if not row:
        return False
    row.revoked_at = datetime.now(tz=timezone.utc)
    return True
