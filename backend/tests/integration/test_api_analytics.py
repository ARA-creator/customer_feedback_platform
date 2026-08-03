from datetime import datetime, timedelta, timezone

from app.core.security import encrypt_text
from app.database import SessionLocal
from app.models import Feedback


def _insert_feedback(*, source: str, created_at: datetime, sentiment_label: str = "positive"):
    db = SessionLocal()
    try:
        row = Feedback(
            source=source,
            message_encrypted=encrypt_text("Test feedback message"),
            sentiment_label=sentiment_label,
            created_at=created_at,
        )
        db.add(row)
        db.commit()
        return row.id
    finally:
        db.close()


def test_analytics_all_time_counts_entire_history(client):
    now = datetime.now(tz=timezone.utc)
    recent_ids = [
        _insert_feedback(source="email", created_at=now - timedelta(days=1)),
        _insert_feedback(source="email", created_at=now - timedelta(days=10)),
    ]
    old_id = _insert_feedback(source="email", created_at=now - timedelta(days=45))

    res = client.get("/analytics?time_window=all")
    assert res.status_code == 200
    data = res.get_json()

    assert data["time_window"] == "all"
    assert data["metrics"]["total_feedback"] == 3
    assert len(recent_ids) == 2
    assert old_id is not None


def test_analytics_all_time_channel_trends_include_older_channels(client):
    """All-time must not clip channel trends to the last 30 days."""
    now = datetime.now(tz=timezone.utc)
    _insert_feedback(source="email", created_at=now - timedelta(days=2))
    _insert_feedback(source="whatsapp", created_at=now - timedelta(days=45))
    _insert_feedback(source="facebook", created_at=now - timedelta(days=60))

    res = client.get("/analytics?time_window=all")
    assert res.status_code == 200
    data = res.get_json()
    st = data.get("source_trends") or {}
    sources = set(st.get("sources") or [])
    assert "email" in sources
    assert "whatsapp" in sources
    assert "facebook" in sources

    totals = {}
    for row in st.get("data") or []:
        for k, v in row.items():
            if k == "date":
                continue
            totals[k] = totals.get(k, 0) + int(v or 0)
    assert totals.get("whatsapp", 0) >= 1
    assert totals.get("facebook", 0) >= 1
