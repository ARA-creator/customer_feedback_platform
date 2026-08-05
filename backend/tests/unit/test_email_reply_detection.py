from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.services.email_reply_detection import (
    apply_sent_emails_to_feedback,
    mark_feedback_replied,
    parse_email_header_datetime,
)


def test_parse_email_header_datetime_rfc2822_with_tz():
    dt = parse_email_header_datetime("Tue, 15 Jul 2024 14:30:00 +0000")
    assert dt is not None
    assert dt.tzinfo is not None
    assert dt.year == 2024
    assert dt.month == 7
    assert dt.day == 15
    assert dt.hour == 14
    assert dt.minute == 30


def test_parse_email_header_datetime_rfc2822_offset():
    dt = parse_email_header_datetime("Tue, 15 Jul 2024 10:30:00 -0400")
    assert dt is not None
    assert dt.utcoffset() == timedelta(hours=-4)
    as_utc = dt.astimezone(timezone.utc)
    assert as_utc.hour == 14


def test_parse_email_header_datetime_iso_fallback():
    dt = parse_email_header_datetime("2024-07-15T14:30:00Z")
    assert dt is not None
    assert dt.tzinfo is not None
    assert dt.hour == 14


def test_parse_email_header_datetime_naive_iso_assumes_utc():
    dt = parse_email_header_datetime("2024-07-15T14:30:00")
    assert dt is not None
    assert dt.tzinfo == timezone.utc


def test_parse_email_header_datetime_invalid_or_empty():
    assert parse_email_header_datetime(None) is None
    assert parse_email_header_datetime("") is None
    assert parse_email_header_datetime("   ") is None
    assert parse_email_header_datetime("not a date") is None


def test_mark_feedback_replied_stores_when_and_meta():
    fb = SimpleNamespace(replied_at=None, channel_metadata="{}")
    when = datetime(2024, 7, 15, 16, 45, tzinfo=timezone.utc)
    assert mark_feedback_replied(
        None,
        fb,
        when=when,
        source="imap_sent",
        reply_meta={"sent_date": "Tue, 15 Jul 2024 16:45:00 +0000"},
    )
    assert fb.replied_at == when
    assert "imap_sent" in fb.channel_metadata
    assert "sent_date" in fb.channel_metadata


def test_mark_feedback_replied_skips_already_replied():
    fb = SimpleNamespace(
        replied_at=datetime(2024, 7, 1, tzinfo=timezone.utc),
        channel_metadata="{}",
    )
    assert not mark_feedback_replied(None, fb, when=datetime.now(tz=timezone.utc))


def test_apply_sent_emails_uses_sent_date_header(monkeypatch):
    mid = "<inbound-msg-1@example.com>"
    fb = SimpleNamespace(
        id=1,
        replied_at=None,
        deleted_at=None,
        channel_metadata='{"message_id": "<inbound-msg-1@example.com>"}',
    )

    query = MagicMock()
    query.filter.return_value = query
    query.order_by.return_value = query
    query.limit.return_value = query
    query.all.return_value = [fb]

    db = MagicMock()
    db.query.return_value = query

    sent_date = "Tue, 15 Jul 2024 16:45:00 +0000"
    marked = apply_sent_emails_to_feedback(
        db,
        [
            {
                "in_reply_to": mid,
                "in_reply_to_ids": [mid],
                "message_id": "<sent-msg-1@example.com>",
                "subject": "Re: hello",
                "date": sent_date,
            }
        ],
    )
    assert marked == 1
    assert fb.replied_at == datetime(2024, 7, 15, 16, 45, tzinfo=timezone.utc)
    assert sent_date in fb.channel_metadata
    db.commit.assert_called_once()


def test_apply_sent_emails_falls_back_when_date_invalid():
    mid = "<inbound-msg-2@example.com>"
    fb = SimpleNamespace(
        id=2,
        replied_at=None,
        deleted_at=None,
        channel_metadata='{"message_id": "<inbound-msg-2@example.com>"}',
    )

    query = MagicMock()
    query.filter.return_value = query
    query.order_by.return_value = query
    query.limit.return_value = query
    query.all.return_value = [fb]

    db = MagicMock()
    db.query.return_value = query

    before = datetime.now(tz=timezone.utc)
    marked = apply_sent_emails_to_feedback(
        db,
        [
            {
                "in_reply_to": mid,
                "in_reply_to_ids": [mid],
                "message_id": "<sent-msg-2@example.com>",
                "subject": "Re: hello",
                "date": "not-a-valid-date",
            }
        ],
    )
    after = datetime.now(tz=timezone.utc)
    assert marked == 1
    assert fb.replied_at is not None
    assert before - timedelta(seconds=2) <= fb.replied_at <= after + timedelta(seconds=2)
    assert "not-a-valid-date" in fb.channel_metadata


def test_apply_sent_emails_falls_back_when_date_missing():
    mid = "<inbound-msg-3@example.com>"
    fb = SimpleNamespace(
        id=3,
        replied_at=None,
        deleted_at=None,
        channel_metadata='{"message_id": "<inbound-msg-3@example.com>"}',
    )

    query = MagicMock()
    query.filter.return_value = query
    query.order_by.return_value = query
    query.limit.return_value = query
    query.all.return_value = [fb]

    db = MagicMock()
    db.query.return_value = query

    before = datetime.now(tz=timezone.utc)
    marked = apply_sent_emails_to_feedback(
        db,
        [
            {
                "in_reply_to": mid,
                "in_reply_to_ids": [mid],
                "message_id": "<sent-msg-3@example.com>",
                "subject": "Re: hello",
            }
        ],
    )
    after = datetime.now(tz=timezone.utc)
    assert marked == 1
    assert before - timedelta(seconds=2) <= fb.replied_at <= after + timedelta(seconds=2)
