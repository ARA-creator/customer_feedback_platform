"""Analyst-friendly CSV export: one row per feedback, tidy columns."""

from __future__ import annotations

import csv
import io
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..models import Feedback, FeedbackReplyDraft, FeedbackWorkflow, User
from ..security import decrypt_text
from ..services.analytics_time_window import parse_overview_time_window
from ..services.metadata_normalization import safe_json_loads

FEEDBACK_RECORD_COLUMNS = [
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
]

_CLOSED_STATUSES = {"closed", "resolved"}


def _csv_cell(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _write_csv(headers: List[str], rows: Iterable[List[Any]]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(headers)
    for row in rows:
        writer.writerow([_csv_cell(v) for v in row])
    return buf.getvalue()


def _iso_date(dt: Optional[datetime]) -> str:
    if not dt:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).date().isoformat()


def _hours_between(start: Optional[datetime], end: Optional[datetime]) -> Optional[float]:
    if not start or not end:
        return None
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return round((end - start).total_seconds() / 3600.0, 2)


def _theme_label(tags: List[str]) -> str:
    if not tags:
        return ""
    labels = []
    for tag in tags:
        key = str(tag or "").strip().lower()
        if not key:
            continue
        if key == "speed_delays":
            labels.append("delivery delays")
        else:
            labels.append(key.replace("_", " "))
    return " | ".join(labels)


def _customer_segment(meta: Dict[str, Any]) -> str:
    for key in ("customer_tier", "segment", "customer_segment"):
        val = meta.get(key)
        if val:
            return str(val).strip()
    return ""


def _insurance_tags(meta: Dict[str, Any], tags_raw: Optional[str]) -> List[str]:
    from_meta = meta.get("insurance_tags")
    if isinstance(from_meta, list) and from_meta:
        return [str(t).strip().lower() for t in from_meta if str(t).strip()]
    if tags_raw:
        try:
            parsed = json.loads(tags_raw)
            if isinstance(parsed, list):
                return [str(t).strip().lower() for t in parsed if str(t).strip()]
        except Exception:
            pass
    return []


def build_feedback_export_query(db: Session, user, perms: set[str], params: Dict[str, Any]):
    from ..routes.api._helpers import _scope_feedback_query

    q = db.query(Feedback).filter(Feedback.deleted_at.is_(None))
    q = _scope_feedback_query(db, q, user=user, perms=perms)

    sentiment = str(params.get("sentiment") or "all").strip().lower()
    if sentiment and sentiment != "all":
        q = q.filter(Feedback.sentiment_label.ilike(sentiment))

    category = str(params.get("category") or "all").strip().lower()
    if category and category != "all":
        q = q.filter(Feedback.category.ilike(category))

    source = str(params.get("source") or "all").strip().lower()
    if source and source != "all":
        q = q.filter(Feedback.source.ilike(source))

    priority = str(params.get("priority") or "all").strip().lower()
    if priority == "high":
        q = q.filter(Feedback.priority >= 80)

    time_window = str(params.get("time_window") or "all").strip().lower()
    _tw, filter_from, filter_to, _label, _range_days = parse_overview_time_window(
        time_window, now=datetime.now(tz=timezone.utc)
    )
    if time_window != "all":
        if filter_from is not None:
            q = q.filter(Feedback.created_at >= filter_from)
        if filter_to is not None:
            q = q.filter(Feedback.created_at < filter_to)

    date_from = params.get("date_from")
    date_to = params.get("date_to")
    if date_from:
        from ..routes.api._helpers import _parse_dt

        parsed_from = _parse_dt(str(date_from))
        if parsed_from:
            q = q.filter(Feedback.created_at >= parsed_from)
    if date_to:
        from ..routes.api._helpers import _parse_dt

        parsed_to = _parse_dt(str(date_to))
        if parsed_to:
            end = parsed_to.replace(hour=23, minute=59, second=59, microsecond=999999)
            q = q.filter(Feedback.created_at <= end)

    limit = min(max(int(params.get("limit") or 5000), 1), 10000)
    return q.order_by(desc(Feedback.created_at), desc(Feedback.id)).limit(limit)


def _load_workflows(db: Session, feedback_ids: List[int]) -> Dict[int, FeedbackWorkflow]:
    if not feedback_ids:
        return {}
    rows = db.query(FeedbackWorkflow).filter(FeedbackWorkflow.feedback_id.in_(feedback_ids)).all()
    return {int(r.feedback_id): r for r in rows}


def _load_assignees(db: Session, user_ids: List[int]) -> Dict[int, User]:
    if not user_ids:
        return {}
    rows = db.query(User).filter(User.id.in_(user_ids)).all()
    return {int(r.id): r for r in rows}


def _load_first_response_at(db: Session, feedback_ids: List[int]) -> Dict[int, datetime]:
    if not feedback_ids:
        return {}
    rows = (
        db.query(FeedbackReplyDraft)
        .filter(
            FeedbackReplyDraft.feedback_id.in_(feedback_ids),
            FeedbackReplyDraft.sent_at.isnot(None),
        )
        .order_by(FeedbackReplyDraft.sent_at.asc())
        .all()
    )
    first_sent: Dict[int, datetime] = {}
    for row in rows:
        fid = int(row.feedback_id)
        if fid not in first_sent and row.sent_at:
            first_sent[fid] = row.sent_at
    return first_sent


def _assigned_to_label(user: Optional[User]) -> str:
    if not user:
        return ""
    name = str(user.full_name or "").strip()
    email = str(user.email or "").strip()
    if name and email:
        return f"{name} <{email}>"
    return name or email


def build_analyst_export_csv(db: Session, user, perms: set[str], params: Dict[str, Any]) -> Tuple[str, str]:
    """Return (csv_text, filename) for a single tidy feedback export."""
    rows, _summaries = _collect_feedback_export_rows(db, user, perms, params)
    csv_text = _write_csv(FEEDBACK_RECORD_COLUMNS, rows)
    stamp = datetime.now(tz=timezone.utc).strftime("%Y%m%d_%H%M%S")
    return csv_text, f"feedback_export_{stamp}.csv"


def build_analyst_export_bundle(db: Session, user, perms: set[str], params: Dict[str, Any]) -> Dict[str, str]:
    """Backward-compatible helper used in tests; returns only the primary CSV."""
    rows, summaries = _collect_feedback_export_rows(db, user, perms, params)
    files = {"feedback_records.csv": _write_csv(FEEDBACK_RECORD_COLUMNS, rows)}
    files.update(summaries)
    return files


def _collect_feedback_export_rows(
    db: Session, user, perms: set[str], params: Dict[str, Any]
) -> Tuple[List[List[Any]], Dict[str, str]]:
    rows = build_feedback_export_query(db, user, perms, params).all()
    feedback_ids = [int(r.id) for r in rows if r.id is not None]
    workflows = _load_workflows(db, feedback_ids)
    assignee_ids = [
        int(w.assigned_user_id) for w in workflows.values() if w.assigned_user_id is not None
    ]
    assignees = _load_assignees(db, assignee_ids)
    first_response_at = _load_first_response_at(db, feedback_ids)

    record_rows: List[List[Any]] = []
    sentiment_counts: Counter[str] = Counter()
    category_counts: Counter[str] = Counter()
    daily: Dict[str, Dict[str, int]] = defaultdict(lambda: {"total": 0, "positive": 0, "negative": 0, "neutral": 0})

    high_priority = 0
    positive = 0
    negative = 0
    neutral = 0

    for fb in rows:
        meta = safe_json_loads(fb.channel_metadata) if fb.channel_metadata else {}
        if not isinstance(meta, dict):
            meta = {}
        try:
            message = decrypt_text(fb.message_encrypted) or ""
        except Exception:
            message = ""

        sentiment = str(fb.sentiment_label or "").strip().lower() or "unknown"
        sentiment_counts[sentiment] += 1
        if sentiment == "positive":
            positive += 1
        elif sentiment == "negative":
            negative += 1
        elif sentiment == "neutral":
            neutral += 1

        cat = str(fb.category or "uncategorized").strip().lower()
        category_counts[cat] += 1

        if fb.priority is not None and int(fb.priority) >= 80:
            high_priority += 1

        date_key = _iso_date(fb.created_at)
        if date_key:
            bucket = daily[date_key]
            bucket["total"] += 1
            if sentiment in ("positive", "negative", "neutral"):
                bucket[sentiment] += 1

        wf = workflows.get(int(fb.id))
        assignee = assignees.get(int(wf.assigned_user_id)) if wf and wf.assigned_user_id else None
        status = str(wf.status or "open").strip().lower() if wf else "open"

        response_at = first_response_at.get(int(fb.id))
        response_hours = _hours_between(fb.created_at, response_at) if response_at else None

        resolution_hours = None
        if wf and status in _CLOSED_STATUSES:
            resolution_hours = _hours_between(fb.created_at, wf.updated_at)

        escalation_flag = False
        if wf:
            escalation_flag = bool(wf.escalated_at) or int(wf.escalation_level or 0) > 0

        tags = _insurance_tags(meta, fb.tags)

        record_rows.append(
            [
                fb.id,
                date_key,
                str(fb.source or "").strip().lower(),
                _customer_segment(meta),
                sentiment,
                fb.priority if fb.priority is not None else "",
                _theme_label(tags),
                cat,
                message,
                _assigned_to_label(assignee),
                status,
                response_hours if response_hours is not None else "",
                resolution_hours if resolution_hours is not None else "",
                escalation_flag,
            ]
        )

    total = len(rows)
    export_date = datetime.now(tz=timezone.utc).date().isoformat()

    summary_metrics = _write_csv(
        [
            "total_feedback",
            "positive_count",
            "negative_count",
            "neutral_count",
            "high_priority_count",
            "export_date",
        ],
        [[total, positive, negative, neutral, high_priority, export_date]],
    )

    sentiment_total = sum(sentiment_counts.values()) or 1
    sentiment_summary = _write_csv(
        ["sentiment", "count", "percentage"],
        [
            [sent, count, round((count / sentiment_total) * 100, 1)]
            for sent, count in sorted(sentiment_counts.items(), key=lambda x: (-x[1], x[0]))
        ],
    )

    category_total = sum(category_counts.values()) or 1
    category_summary = _write_csv(
        ["category", "count", "percentage"],
        [
            [cat, count, round((count / category_total) * 100, 1)]
            for cat, count in sorted(category_counts.items(), key=lambda x: (-x[1], x[0]))
        ],
    )

    daily_trends = _write_csv(
        ["date", "total", "positive", "negative", "neutral"],
        [
            [
                date,
                daily[date]["total"],
                daily[date]["positive"],
                daily[date]["negative"],
                daily[date]["neutral"],
            ]
            for date in sorted(daily.keys())
        ],
    )

    feedback_records = _write_csv(FEEDBACK_RECORD_COLUMNS, record_rows)

    summaries = {
        "summary_metrics.csv": summary_metrics,
        "sentiment_summary.csv": sentiment_summary,
        "category_summary.csv": category_summary,
        "daily_trends.csv": daily_trends,
    }
    return record_rows, summaries


def build_analyst_export_zip(db: Session, user, perms: set[str], params: Dict[str, Any]) -> Tuple[bytes, str]:
    """Deprecated: use build_analyst_export_csv."""
    csv_text, filename = build_analyst_export_csv(db, user, perms, params)
    return csv_text.encode("utf-8"), filename
