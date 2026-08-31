"""Shared working-day / working-hour window for analytics and SLA (UTC)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

# Monday=0 … Friday=4
WORKING_DOW = frozenset(range(0, 5))
WORKING_HOUR_START = 8
WORKING_HOUR_END = 18  # exclusive — hours 8..17
WORKING_HOURS_PER_DAY = WORKING_HOUR_END - WORKING_HOUR_START


def is_working_slot(dow: int, hour: int) -> bool:
    return int(dow) in WORKING_DOW and WORKING_HOUR_START <= int(hour) < WORKING_HOUR_END


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _py_weekday(dt: datetime) -> int:
    return dt.weekday()


def elapsed_working_seconds(start: datetime, end: datetime) -> float:
    """Elapsed seconds counting only Mon–Fri 08:00–17:59 UTC."""
    s = _ensure_utc(start)
    e = _ensure_utc(end)
    if e <= s:
        return 0.0

    total = 0.0
    cursor = s
    while cursor < e:
        dow = _py_weekday(cursor)
        hour = cursor.hour
        if is_working_slot(dow, hour):
            hour_end = cursor.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
            day_work_end = cursor.replace(hour=WORKING_HOUR_END, minute=0, second=0, microsecond=0)
            seg_end = min(hour_end, day_work_end, e)
            total += (seg_end - cursor).total_seconds()
            cursor = seg_end
        else:
            cursor = _skip_to_next_working_start(cursor)
    return total


def _skip_to_next_working_start(dt: datetime) -> datetime:
    dt = _ensure_utc(dt)
    dow = _py_weekday(dt)
    if dow in WORKING_DOW and dt.hour < WORKING_HOUR_START:
        return dt.replace(hour=WORKING_HOUR_START, minute=0, second=0, microsecond=0)
    probe = (dt + timedelta(days=1)).replace(hour=WORKING_HOUR_START, minute=0, second=0, microsecond=0)
    for _ in range(14):
        if _py_weekday(probe) in WORKING_DOW:
            return probe
        probe += timedelta(days=1)
    return probe
