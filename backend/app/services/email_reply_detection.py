"""Detect officer replies in the mailbox Sent folder and mark feedback as replied."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Set

from ..integrations.email_integration import normalize_message_id
from ..models import Feedback

logger = logging.getLogger(__name__)


def _parse_meta(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _feedback_message_id(feedback: Feedback) -> Optional[str]:
    meta = _parse_meta(feedback.channel_metadata)
    return normalize_message_id(meta.get("message_id") or meta.get("thread_id"))


def _referenced_ids_from_sent(sent: Dict[str, Any]) -> Set[str]:
    ids: Set[str] = set()
    for mid in sent.get("in_reply_to_ids") or []:
        n = normalize_message_id(mid)
        if n:
            ids.add(n)
    n = normalize_message_id(sent.get("in_reply_to"))
    if n:
        ids.add(n)
    for mid in sent.get("references") or []:
        n = normalize_message_id(mid)
        if n:
            ids.add(n)
    return ids


def mark_feedback_replied(
    db,
    feedback: Feedback,
    *,
    when: Optional[datetime] = None,
    source: str = "manual",
    reply_meta: Optional[Dict[str, Any]] = None,
) -> bool:
    """Set replied_at on a feedback row if not already set. Returns True if newly marked."""
    if feedback is None or feedback.replied_at is not None:
        return False
    now = when or datetime.now(tz=timezone.utc)
    feedback.replied_at = now
    meta = _parse_meta(feedback.channel_metadata)
    meta["officer_reply"] = {
        "detected_at": now.isoformat(),
        "source": source,
        **(reply_meta or {}),
    }
    try:
        feedback.channel_metadata = json.dumps(meta)
    except Exception:
        pass
    return True


def apply_sent_emails_to_feedback(db, sent_emails: Iterable[Dict[str, Any]]) -> int:
    """
    Match outbound Sent messages to inbound email feedback via In-Reply-To / References.

    When an officer replies in Gmail/Outlook to a customer message that was ingested
    as feedback, the Sent copy's In-Reply-To points at the original Message-ID stored
    on the feedback row.
    """
    sent_list = [s for s in (sent_emails or []) if isinstance(s, dict)]
    if not sent_list:
        return 0

    wanted: Set[str] = set()
    sent_by_ref: Dict[str, Dict[str, Any]] = {}
    for sent in sent_list:
        for mid in _referenced_ids_from_sent(sent):
            wanted.add(mid)
            # Prefer the first match; later duplicates are fine
            sent_by_ref.setdefault(mid, sent)

    if not wanted:
        return 0

    # Load unreplied email-like feedback; match in Python (portable across SQLite/Postgres).
    candidates: List[Feedback] = (
        db.query(Feedback)
        .filter(
            Feedback.deleted_at.is_(None),
            Feedback.replied_at.is_(None),
            Feedback.channel_metadata.isnot(None),
        )
        .order_by(Feedback.id.desc())
        .limit(5000)
        .all()
    )

    by_mid: Dict[str, Feedback] = {}
    for fb in candidates:
        mid = _feedback_message_id(fb)
        if mid and mid in wanted:
            by_mid[mid] = fb

    if not by_mid:
        return 0

    now = datetime.now(tz=timezone.utc)
    marked = 0
    for mid, fb in by_mid.items():
        sent = sent_by_ref.get(mid) or {}
        if mark_feedback_replied(
            db,
            fb,
            when=now,
            source="imap_sent",
            reply_meta={
                "matched_message_id": mid,
                "sent_message_id": sent.get("message_id"),
                "sent_subject": sent.get("subject"),
                "sent_date": sent.get("date"),
            },
        ):
            marked += 1

    if marked:
        db.commit()
        logger.info("Marked %s feedback item(s) as replied from Sent folder", marked)
    return marked
