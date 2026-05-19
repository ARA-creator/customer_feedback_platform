"""Shared overview time-window parsing (matches GET /api/analytics?time_window=)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple


def parse_overview_time_window(
    time_window: str,
    *,
    now: Optional[datetime] = None,
) -> Tuple[str, Optional[datetime], Optional[datetime], str, int]:
    """
    Returns (normalized_window, filter_from, filter_to, human_label, range_days_hint).
    filter_to is an exclusive upper bound when set (e.g. start of current week for last_week).
    """
    now = now or datetime.now(tz=timezone.utc)
    tw = (time_window or "all").strip().lower()
    if tw not in ("all", "today", "week", "last_week", "month"):
        tw = "all"

    filter_from: Optional[datetime] = None
    filter_to: Optional[datetime] = None
    label = "All time"
    range_days = 30

    if tw == "today":
        filter_from = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        label = "Today"
        range_days = 1
    elif tw == "week":
        filter_from = now - timedelta(days=7)
        label = "This week (last 7 days)"
        range_days = 7
    elif tw == "last_week":
        weekday = now.weekday()
        start_this_week = datetime(now.year, now.month, now.day, tzinfo=timezone.utc) - timedelta(days=weekday)
        filter_from = start_this_week - timedelta(days=7)
        filter_to = start_this_week
        label = "Last week (previous calendar week)"
        range_days = 7
    elif tw == "month":
        filter_from = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        label = "This month"
        range_days = min((now.date() - filter_from.date()).days + 1, 62)
    else:
        label = "All time (last 30 days for trends)"
        range_days = 30

    return tw, filter_from, filter_to, label, range_days
