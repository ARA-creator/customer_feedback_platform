
from app.services.insights_analytics import (
    _percentile,
    _hist_bins,
    _kpi_block,
    _build_benchmark,
    _breakdown_stats,
)


def test_percentile_p50_p90():
    vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    assert _percentile(vals, 0.5) == 5.5
    assert _percentile(vals, 0.9) == 9.1


def test_hist_bins_cover_all():
    h = _hist_bins([0.5, 3, 10, 50], [1, 4, 8, 24])
    assert sum(x["count"] for x in h) == 4


def test_kpi_and_benchmark():
    cur = [
        {"sentiment": "negative", "response_hours": 2.0, "breached": True, "escalated": False},
        {"sentiment": "positive", "response_hours": 4.0, "breached": False, "escalated": False},
    ]
    prior = [
        {"sentiment": "negative", "response_hours": 6.0, "breached": False, "escalated": True},
    ]
    b = _build_benchmark(cur, prior)
    assert b["current"]["volume"] == 2
    assert b["prior"]["volume"] == 1
    assert "deltas" in b


def test_breakdown_stats():
    items = [
        {"channel": "email", "response_hours": 1.0, "resolution_hours": 2.0, "breached": False, "escalated": False, "closed": True},
        {"channel": "email", "response_hours": 3.0, "resolution_hours": None, "breached": True, "escalated": True, "closed": False},
        {"channel": "whatsapp", "response_hours": 2.0, "resolution_hours": 5.0, "breached": False, "escalated": False, "closed": True},
    ]
    rows = _breakdown_stats(items, "channel")
    assert rows[0]["key"] == "email"
    assert rows[0]["count"] == 2
    assert rows[0]["breach_count"] == 1
