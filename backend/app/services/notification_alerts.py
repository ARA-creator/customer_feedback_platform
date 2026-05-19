"""Broadcast in-app notifications to users (anomaly alerts, etc.)."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from sqlalchemy import desc, func

from ..models import Notification, NotificationPreference, User
from ..routes.api._helpers import _notif_publish, _safe_json_dumps, _user_permission_keys

logger = logging.getLogger(__name__)


def _prefs_for_user(db, user_id: int, *, is_admin: bool) -> dict:
    from ..routes.api.feedback import _get_notification_prefs

    return _get_notification_prefs(db, user_id, is_admin=is_admin)


def _is_admin_user(db, user_id: int, perms: set[str]) -> bool:
    from ..routes.api.feedback import _is_admin_ui

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    return _is_admin_ui(user, perms)


def _serialize_notification(row: Notification) -> dict:
    from ..routes.api.feedback import _serialize_notification

    return _serialize_notification(row)


def notify_users_anomaly_alert(
    db,
    *,
    n_type: str,
    title: str,
    body: str,
    href: str = "inbox",
    meta: Optional[Dict[str, Any]] = None,
) -> int:
    """
    Create anomaly notifications for active users who opted in (non-admins default on).
    Returns count of notifications created.
    """
    meta_json = _safe_json_dumps(meta or {}) or "{}"
    users = db.query(User).filter(User.deleted_at.is_(None)).filter(User.is_active.is_(True)).all()
    created_for: list[int] = []

    for user in users or []:
        try:
            perms = _user_permission_keys(db, user.id)
            is_admin = _is_admin_user(db, user.id, perms)
            prefs = _prefs_for_user(db, user.id, is_admin=is_admin)
            if not prefs.get("anomaly_alerts", True):
                continue
            n = Notification(
                user_id=user.id,
                type=str(n_type or "anomaly_alert"),
                title=str(title or "Anomaly alert")[:255],
                body=str(body or "")[:2000],
                href=str(href or "inbox")[:255],
                meta=meta_json,
            )
            db.add(n)
            created_for.append(user.id)
        except Exception:
            logger.exception("Failed to queue anomaly notification for user_id=%s", getattr(user, "id", None))
            continue

    if not created_for:
        return 0

    db.commit()
    for uid in created_for:
        try:
            unread = (
                db.query(func.count(Notification.id))
                .filter(Notification.user_id == uid)
                .filter(Notification.read_at.is_(None))
                .scalar()
                or 0
            )
            last = (
                db.query(Notification)
                .filter(Notification.user_id == uid)
                .order_by(desc(Notification.created_at), desc(Notification.id))
                .first()
            )
            _notif_publish(
                uid,
                {
                    "type": "notification.created",
                    "notification": _serialize_notification(last) if last else None,
                    "unread": int(unread),
                },
            )
        except Exception:
            pass
    return len(created_for)
