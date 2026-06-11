from datetime import datetime, timezone

from app.services.analytics_time_window import parse_overview_time_window


def test_all_time_has_no_date_bounds():
    now = datetime(2026, 6, 11, 12, 0, tzinfo=timezone.utc)
    tw, filter_from, filter_to, label, range_days = parse_overview_time_window("all", now=now)

    assert tw == "all"
    assert filter_from is None
    assert filter_to is None
    assert label == "All time"
    assert range_days == 30


def test_today_has_start_bound_only():
    now = datetime(2026, 6, 11, 15, 30, tzinfo=timezone.utc)
    tw, filter_from, filter_to, label, _range_days = parse_overview_time_window("today", now=now)

    assert tw == "today"
    assert filter_from == datetime(2026, 6, 11, 0, 0, tzinfo=timezone.utc)
    assert filter_to is None
    assert label == "Today"
