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
