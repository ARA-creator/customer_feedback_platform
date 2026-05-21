"""Notify platform admins about user/org activity (in-app)."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import desc, func

from ..models import Notification, User
from ..routes.api._helpers import _notif_publish, _safe_json_dumps
from .notification_policy import (
    get_notification_prefs,
    platform_admin_user_ids,
    prefs_allow,
    should_deliver_notification,
)

logger = logging.getLogger(__name__)


def _serialize_notification(row: Notification) -> dict:
    from ..routes.api.feedback import _serialize_notification

    return _serialize_notification(row)


def notify_platform_admins(
    db,
    *,
    title: str,
    body: str,
    href: str = "admin_activity",
    meta: Optional[Dict[str, Any]] = None,
    exclude_user_id: Optional[int] = None,
) -> int:
    """Create admin_user_event notifications for platform admins only."""
    admin_ids = platform_admin_user_ids(db)
    if exclude_user_id:
        admin_ids.discard(int(exclude_user_id))

    created_for: List[int] = []
    meta_json = _safe_json_dumps(meta or {}) or "{}"

    for admin_id in sorted(admin_ids):
        try:
            prefs = get_notification_prefs(db, admin_id, is_admin=True)
            if not should_deliver_notification(prefs, notification_type="admin_user_event", is_admin=True):
                continue
            n = Notification(
                user_id=admin_id,
                type="admin_user_event",
                title=str(title or "Admin activity")[:255],
                body=str(body or "")[:2000],
                href=str(href or "admin_activity")[:255],
                meta=meta_json,
            )
            db.add(n)
            created_for.append(admin_id)
        except Exception:
            logger.exception("Failed to queue admin notification for user_id=%s", admin_id)
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
