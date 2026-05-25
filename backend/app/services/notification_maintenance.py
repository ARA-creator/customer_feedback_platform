"""Periodic notification housekeeping."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..models import Notification


def current_month_start_utc(now: datetime | None = None) -> datetime:
    now = now or datetime.now(tz=timezone.utc)
    return datetime(now.year, now.month, 1, tzinfo=timezone.utc)


def archive_read_notifications_before_month(db: Session, *, month_start: datetime | None = None) -> int:
    """
    Remove read notifications from before the current calendar month (UTC).
    Unread items are kept regardless of age.
    """
    start = month_start or current_month_start_utc()
    deleted = (
        db.query(Notification)
        .filter(Notification.read_at.isnot(None))
        .filter(Notification.read_at < start)
        .delete(synchronize_session=False)
    )
    db.commit()
    return int(deleted or 0)
