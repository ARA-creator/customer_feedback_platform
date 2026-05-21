"""
Who receives which in-app notifications.

- Non-admin users: feedback-related alerts only (new feedback, assignments, anomalies).
- Platform admins: admin user/activity events plus optional feedback (opt-in).
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, Optional, Set

from sqlalchemy.orm import Query

from ..models import Notification, NotificationPreference, Permission, Role, RolePermission, User, UserRole
from ..services.metadata_normalization import safe_json_loads

PLATFORM_ADMIN_PERMISSIONS = frozenset(
    {
        "admin.manage_users",
        "admin.manage_roles",
        "admin.manage_integrations",
    }
)

# In-app notification types shown to non-admin users.
FEEDBACK_NOTIFICATION_TYPES = frozenset(
    {
        "new_feedback",
        "assigned_to_me",
        "anomaly_alert",
        "anomaly",
    }
)

# Admin-only in-app notification types.
ADMIN_NOTIFICATION_TYPES = frozenset(
    {
        "admin_user_event",
    }
)

ADMIN_HREF_VIEWS = frozenset(
    {
        "admin_users",
        "admin_roles",
        "admin_integrations",
        "admin_overview",
        "admin_reply_approvals",
        "admin_activity",
        "admin_db",
        "admin_enterprise_auth",
        "admin_release_impact",
        "channels",
    }
)


def is_platform_admin(*, perms: Set[str], user: Optional[User] = None) -> bool:
    if PLATFORM_ADMIN_PERMISSIONS & perms:
        return True
    if user and str(getattr(user, "role", "") or "").lower() == "super_admin":
        return True
    return False


def platform_admin_user_ids(db) -> Set[int]:
    ids: Set[int] = set()
    rows = (
        db.query(UserRole.user_id)
        .join(Role, Role.id == UserRole.role_id)
        .join(RolePermission, RolePermission.role_id == Role.id)
        .join(Permission, Permission.id == RolePermission.permission_id)
        .filter(Permission.key.in_(list(PLATFORM_ADMIN_PERMISSIONS)))
        .all()
    )
    for r in rows:
        if r and r[0]:
            ids.add(int(r[0]))
    super_rows = db.query(User.id).filter(User.role.ilike("super_admin")).all()
    for r in super_rows:
        if r and r[0]:
            ids.add(int(r[0]))
    return ids


def notification_visible_to_user(row: Notification, *, is_admin: bool) -> bool:
    ntype = str(getattr(row, "type", "") or "").strip().lower()
    if ntype in ADMIN_NOTIFICATION_TYPES:
        return is_admin
    if ntype in FEEDBACK_NOTIFICATION_TYPES:
        return True
    # Unknown legacy types: admins see all; agents only feedback-like inbox links.
    if is_admin:
        return True
    href = str(getattr(row, "href", "") or "").strip().lower()
    return href in ("inbox", "overview", "insights", "customer", "") or href.startswith("inbox")


def filter_notifications_for_user(
    rows: Iterable[Notification],
    *,
    is_admin: bool,
) -> list[Notification]:
    return [r for r in rows if notification_visible_to_user(r, is_admin=is_admin)]


def apply_notification_visibility_filter(q: Query, *, is_admin: bool) -> Query:
    if is_admin:
        return q
    return q.filter(Notification.type.in_(list(FEEDBACK_NOTIFICATION_TYPES)))


def default_notification_prefs(*, is_admin: bool) -> Dict[str, bool]:
    return {
        "new_feedback": not is_admin,
        "assigned_to_me": True,
        "realtime": True,
        "anomaly_alerts": not is_admin,
        **({"admin_user_events": True} if is_admin else {}),
    }


def get_notification_prefs(db, user_id: int, *, is_admin: bool) -> Dict[str, bool]:
    row = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
    base = safe_json_loads(row.prefs) if row and row.prefs else {}
    defaults = default_notification_prefs(is_admin=is_admin)
    out = {**defaults}
    for k, v in (base or {}).items():
        if k in defaults:
            out[k] = bool(v)
    return out


def prefs_allow(prefs: dict, key: str) -> bool:
    return bool((prefs or {}).get(key, False))


def href_allowed_for_user(href: str, *, is_admin: bool) -> bool:
    view = str(href or "").strip()
    if not view:
        return False
    if view in ADMIN_HREF_VIEWS:
        return is_admin
    return True
