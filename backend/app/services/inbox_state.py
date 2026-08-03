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


def apply_inbox_tab_filter(query, db, user_id: int, inbox_tab: Optional[str]):
    """Filter feedback query by per-user read state or replied (all | read | unread | replied)."""
    from sqlalchemy import and_, exists

    from ..models import Feedback, UserFeedbackInboxState

    tab = (inbox_tab or "all").strip().lower()
    if tab == "replied":
        return query.filter(Feedback.replied_at.isnot(None))
    # "all" = unreplied inbox (matches All feedback tab counts).
    if tab not in ("read", "unread"):
        return query.filter(Feedback.replied_at.is_(None))

    # Read/Unread operate on unreplied items (replied live on the Replied tab).
    query = query.filter(Feedback.replied_at.is_(None))

    read_exists = exists().where(
        and_(
            UserFeedbackInboxState.feedback_id == Feedback.id,
            UserFeedbackInboxState.user_id == int(user_id),
            UserFeedbackInboxState.read_at.isnot(None),
        )
    )
    if tab == "read":
        return query.filter(read_exists)
    return query.filter(~read_exists)


def count_inbox_tabs(db, user_id: int, base_query) -> Dict[str, int]:
    """Count all/read/unread/replied for the current scoped feedback query (one scan)."""
    from sqlalchemy import and_, case, exists, func

    from ..models import Feedback, UserFeedbackInboxState

    read_exists = exists().where(
        and_(
            UserFeedbackInboxState.feedback_id == Feedback.id,
            UserFeedbackInboxState.user_id == int(user_id),
            UserFeedbackInboxState.read_at.isnot(None),
        )
    )
    row = (
        base_query.with_entities(
            func.count(Feedback.id).label("total"),
            func.sum(case((Feedback.replied_at.isnot(None), 1), else_=0)).label("replied"),
            func.sum(
                case(
                    (
                        and_(Feedback.replied_at.is_(None), read_exists),
                        1,
                    ),
                    else_=0,
                )
            ).label("read"),
            func.sum(
                case(
                    (
                        and_(Feedback.replied_at.is_(None), ~read_exists),
                        1,
                    ),
                    else_=0,
                )
            ).label("unread"),
        ).one()
    )
    total = int(getattr(row, "total", 0) or 0)
    replied_count = int(getattr(row, "replied", 0) or 0)
    read_count = int(getattr(row, "read", 0) or 0)
    unread_count = int(getattr(row, "unread", 0) or 0)
    unreplied_total = read_count + unread_count
    return {
        "all": unreplied_total,
        "read": read_count,
        "unread": unread_count,
        "replied": replied_count,
        "total": total,
    }


def get_inbox_open_activity(db, *, limit: int = 50) -> Dict[str, object]:
    """
    Org-wide summary of who has opened (read) inbox feedback and how many.

    Opening a feedback detail marks it read for that user; those rows power this report.
    """
    from sqlalchemy import desc, func

    from ..models import User, UserFeedbackInboxState

    lim = max(1, min(int(limit or 50), 200))
    total_opens = int(
        db.query(func.count(UserFeedbackInboxState.id))
        .filter(UserFeedbackInboxState.read_at.isnot(None))
        .scalar()
        or 0
    )
    users_opened_count = int(
        db.query(func.count(func.distinct(UserFeedbackInboxState.user_id)))
        .filter(UserFeedbackInboxState.read_at.isnot(None))
        .scalar()
        or 0
    )
    rows = (
        db.query(
            UserFeedbackInboxState.user_id,
            func.count(UserFeedbackInboxState.feedback_id).label("opened_count"),
            func.max(UserFeedbackInboxState.read_at).label("last_opened_at"),
        )
        .filter(UserFeedbackInboxState.read_at.isnot(None))
        .group_by(UserFeedbackInboxState.user_id)
        .order_by(desc("opened_count"), desc("last_opened_at"))
        .limit(lim)
        .all()
    )
    user_ids = [int(r.user_id) for r in rows if r.user_id is not None]
    users_by_id = {}
    if user_ids:
        for u in db.query(User).filter(User.id.in_(user_ids)).all():
            users_by_id[int(u.id)] = u

    users_out = []
    for r in rows:
        uid = int(r.user_id)
        u = users_by_id.get(uid)
        users_out.append(
            {
                "user_id": uid,
                "email": getattr(u, "email", None) if u else None,
                "full_name": getattr(u, "full_name", None) if u else None,
                "opened_count": int(r.opened_count or 0),
                "last_opened_at": r.last_opened_at.isoformat() if r.last_opened_at else None,
            }
        )

    return {
        "users_opened_count": users_opened_count,
        "total_opens": total_opens,
        "users": users_out,
    }


def get_feedback_open_readers(db, feedback_id: int) -> Dict[str, object]:
    """Who has opened (read) a specific feedback item."""
    from ..models import User, UserFeedbackInboxState

    fid = int(feedback_id)
    rows = (
        db.query(UserFeedbackInboxState)
        .filter(
            UserFeedbackInboxState.feedback_id == fid,
            UserFeedbackInboxState.read_at.isnot(None),
        )
        .order_by(UserFeedbackInboxState.read_at.desc())
        .all()
    )
    user_ids = [int(r.user_id) for r in rows]
    users_by_id = {}
    if user_ids:
        for u in db.query(User).filter(User.id.in_(user_ids)).all():
            users_by_id[int(u.id)] = u

    readers = []
    for r in rows:
        u = users_by_id.get(int(r.user_id))
        readers.append(
            {
                "user_id": int(r.user_id),
                "email": getattr(u, "email", None) if u else None,
                "full_name": getattr(u, "full_name", None) if u else None,
                "opened_at": r.read_at.isoformat() if r.read_at else None,
            }
        )
    return {"feedback_id": fid, "opened_count": len(readers), "readers": readers}
