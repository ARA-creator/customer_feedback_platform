"""Per-user inbox read/pin state for feedback items."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Set, Tuple

from ..models import UserFeedbackInboxState


def _norm_feedback_id(value) -> Optional[int]:
    try:
        fid = int(value)
    except (TypeError, ValueError):
        return None
    return fid if fid > 0 else None


def get_user_inbox_state_maps(db, user_id: int) -> Tuple[Set[int], Set[int]]:
    """Return (read_feedback_ids, pinned_feedback_ids) for a user."""
    read_ids: Set[int] = set()
    pinned_ids: Set[int] = set()
    rows = (
        db.query(
            UserFeedbackInboxState.feedback_id,
            UserFeedbackInboxState.read_at,
            UserFeedbackInboxState.pinned_at,
        )
        .filter(UserFeedbackInboxState.user_id == int(user_id))
        .all()
    )
    for fid, read_at, pinned_at in rows:
        if fid is None:
            continue
        fid_int = int(fid)
        if read_at is not None:
            read_ids.add(fid_int)
        if pinned_at is not None:
            pinned_ids.add(fid_int)
    return read_ids, pinned_ids


def get_inbox_state_for_feedback_ids(
    db, user_id: int, feedback_ids: Iterable[int]
) -> Dict[str, List[int]]:
    """Subset of read/pinned ids intersecting requested feedback ids."""
    wanted = {_norm_feedback_id(i) for i in feedback_ids}
    wanted.discard(None)
    if not wanted:
        return {"read_feedback_ids": [], "pinned_feedback_ids": []}

    read_ids: List[int] = []
    pinned_ids: List[int] = []
    rows = (
        db.query(
            UserFeedbackInboxState.feedback_id,
            UserFeedbackInboxState.read_at,
            UserFeedbackInboxState.pinned_at,
        )
        .filter(UserFeedbackInboxState.user_id == int(user_id))
        .filter(UserFeedbackInboxState.feedback_id.in_(sorted(wanted)))
        .all()
    )
    for fid, read_at, pinned_at in rows:
        if read_at is not None:
            read_ids.append(int(fid))
        if pinned_at is not None:
            pinned_ids.append(int(fid))
    return {"read_feedback_ids": read_ids, "pinned_feedback_ids": pinned_ids}


def _get_or_create_row(db, user_id: int, feedback_id: int) -> UserFeedbackInboxState:
    row = (
        db.query(UserFeedbackInboxState)
        .filter(
            UserFeedbackInboxState.user_id == int(user_id),
            UserFeedbackInboxState.feedback_id == int(feedback_id),
        )
        .first()
    )
    if row:
        return row
    row = UserFeedbackInboxState(
        user_id=int(user_id),
        feedback_id=int(feedback_id),
        read_at=None,
        pinned_at=None,
    )
    db.add(row)
    db.flush()
    return row


def apply_inbox_state_patch(
    db,
    user_id: int,
    *,
    mark_read: Optional[Iterable[int]] = None,
    mark_unread: Optional[Iterable[int]] = None,
    pin_updates: Optional[Iterable[Tuple[int, bool]]] = None,
) -> Dict[str, int]:
    """
    Apply read/unread/pin updates. Returns counts of rows touched per action.
    """
    now = datetime.now(tz=timezone.utc)
    counts = {"marked_read": 0, "marked_unread": 0, "pinned": 0, "unpinned": 0}

    for raw in mark_read or []:
        fid = _norm_feedback_id(raw)
        if fid is None:
            continue
        row = _get_or_create_row(db, user_id, fid)
        if row.read_at is None:
            row.read_at = now
            counts["marked_read"] += 1
        row.updated_at = now

    for raw in mark_unread or []:
        fid = _norm_feedback_id(raw)
        if fid is None:
            continue
        row = _get_or_create_row(db, user_id, fid)
        if row.read_at is not None:
            row.read_at = None
            counts["marked_unread"] += 1
        row.updated_at = now

    for entry in pin_updates or []:
        if not isinstance(entry, (list, tuple)) or len(entry) < 2:
            continue
        fid = _norm_feedback_id(entry[0])
        pinned = bool(entry[1])
        if fid is None:
            continue
        row = _get_or_create_row(db, user_id, fid)
        if pinned:
            if row.pinned_at is None:
                row.pinned_at = now
                counts["pinned"] += 1
        else:
            if row.pinned_at is not None:
                row.pinned_at = None
                counts["unpinned"] += 1
        row.updated_at = now

    db.commit()
    read_ids, pinned_ids = get_user_inbox_state_maps(db, user_id)
    return {
        **counts,
        "read_feedback_ids": sorted(read_ids),
        "pinned_feedback_ids": sorted(pinned_ids),
    }
