"""Shared working-day / working-hour window for analytics heatmaps (UTC)."""

from __future__ import annotations

# Monday=0 … Friday=4
WORKING_DOW = frozenset(range(0, 5))
WORKING_HOUR_START = 8
WORKING_HOUR_END = 18  # exclusive — hours 8..17


def is_working_slot(dow: int, hour: int) -> bool:
    return int(dow) in WORKING_DOW and WORKING_HOUR_START <= int(hour) < WORKING_HOUR_END
