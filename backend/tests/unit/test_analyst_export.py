import csv
import io
from datetime import datetime, timedelta, timezone

from app.core.security import encrypt_text
from app.database import SessionLocal
from app.models import Feedback, FeedbackWorkflow, User
from app.services.analyst_export import build_analyst_export_csv, build_analyst_export_bundle


def _insert_feedback(*, source="email", sentiment="negative", category="claims", message="Delay issue", days_ago=1):
    db = SessionLocal()
    try:
        now = datetime.now(tz=timezone.utc)
        row = Feedback(
            source=source,
            message_encrypted=encrypt_text(message),
            sentiment_label=sentiment,
            category=category,
            priority=100,
            tags='["speed_delays"]',
            channel_metadata='{"customer_tier":"gold","insurance_tags":["speed_delays"]}',
            created_at=now - timedelta(days=days_ago),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
    finally:
        db.close()


def _ensure_test_user():
    db = SessionLocal()
    try:
        user = db.query(User).first()
        if user:
            return user
        user = User(email="analyst_export_test@example.com", full_name="Export Tester", is_active=True)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    finally:
        db.close()


def test_analyst_export_csv_is_single_tidy_file(app):
    fb = _insert_feedback()
    db = SessionLocal()
    try:
        user = _ensure_test_user()
        wf = FeedbackWorkflow(
            feedback_id=fb.id,
            assigned_user_id=user.id,
            status="open",
            escalation_level=1,
        )
        db.add(wf)
        db.commit()

        csv_text, filename = build_analyst_export_csv(db, user, {"feedback.view_all"}, {"time_window": "all"})
    finally:
        db.close()

    assert filename.endswith(".csv")
    records = list(csv.DictReader(io.StringIO(csv_text)))
    assert len(records) >= 1
    row = next(r for r in records if r["feedback_id"] == str(fb.id))
    assert row["channel"] == "email"
    assert row["sentiment"] == "negative"
    assert row["category"] == "claims"
    assert "delivery delays" in row["theme"]
    assert row["customer_segment"] == "gold"
    assert row["escalation_flag"] == "true"
    assert set(records[0].keys()) == {
        "feedback_id",
        "date_received",
        "channel",
        "customer_segment",
        "sentiment",
        "priority",
        "theme",
        "category",
        "feedback_text",
        "assigned_to",
        "status",
        "response_time_hours",
        "resolution_time_hours",
        "escalation_flag",
    }


def test_analyst_export_strips_html_from_feedback_text(app):
    html = (
        "<html><body><p>Claim delayed again</p>"
        "<table><tr><td>Get it on Google Play</td></tr></table>"
        "<!-- end footer --></body></html>"
    )
    fb = _insert_feedback(message=html)
    db = SessionLocal()
    try:
        user = _ensure_test_user()
        csv_text, _filename = build_analyst_export_csv(db, user, {"feedback.view_all"}, {"time_window": "all"})
    finally:
        db.close()

    row = next(r for r in csv.DictReader(io.StringIO(csv_text)) if r["feedback_id"] == str(fb.id))
    assert "<html>" not in row["feedback_text"]
    assert "<table>" not in row["feedback_text"]
    assert "Claim delayed again" in row["feedback_text"]
    assert "Get it on Google Play" in row["feedback_text"]
