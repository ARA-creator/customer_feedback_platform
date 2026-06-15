from datetime import datetime, timezone

from app.core.security import encrypt_text
from app.database import SessionLocal
from app.models import Feedback, User, UserFeedbackInboxState
from app.services.inbox_state import apply_inbox_tab_filter, count_inbox_tabs


def test_inbox_tab_filter_read_unread(app):
    db = SessionLocal()
    try:
        user = User(email="inbox_tab_test@example.com", full_name="Tab Tester", is_active=True)
        db.add(user)
        db.commit()
        db.refresh(user)

        read_fb = Feedback(source="email", message_encrypted=encrypt_text("read one"), created_at=datetime.now(tz=timezone.utc))
        unread_fb = Feedback(source="email", message_encrypted=encrypt_text("unread one"), created_at=datetime.now(tz=timezone.utc))
        db.add_all([read_fb, unread_fb])
        db.commit()
        db.refresh(read_fb)
        db.refresh(unread_fb)

        db.add(
            UserFeedbackInboxState(
                user_id=user.id,
                feedback_id=read_fb.id,
                read_at=datetime.now(tz=timezone.utc),
            )
        )
        db.commit()

        base = db.query(Feedback).filter(Feedback.deleted_at.is_(None))
        counts = count_inbox_tabs(db, user.id, base)
        assert counts["all"] == 2
        assert counts["read"] == 1
        assert counts["unread"] == 1

        unread_rows = apply_inbox_tab_filter(base, db, user.id, "unread").all()
        assert len(unread_rows) == 1
        assert unread_rows[0].id == unread_fb.id

        read_rows = apply_inbox_tab_filter(base, db, user.id, "read").all()
        assert len(read_rows) == 1
        assert read_rows[0].id == read_fb.id
    finally:
        db.close()
