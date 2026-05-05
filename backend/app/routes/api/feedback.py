"""
Feedback routes for the /api blueprint.

Moved incrementally from legacy `backend/app/routes/api.py`.
"""

from __future__ import annotations

import json
import logging
from queue import Empty, Queue

from datetime import datetime, timedelta, timezone

from flask import Response, jsonify, request, stream_with_context
from sqlalchemy import Integer, and_, cast, desc, func, or_
from sqlalchemy.exc import SQLAlchemyError

from ...database import SessionLocal
from ...models import (
    Feedback,
    FeedbackPolicyMatch,
    FeedbackSearchDocument,
    Notification,
    NotificationPreference,
    User,
)
from ...security import decrypt_text, encrypt_text, hash_email
from ...sentiment_analyzer import analyze_sentiment
from ...services.insurance_tags import categorize_insurance_tags
from ...services.metadata_normalization import normalize_channel_metadata, safe_json_loads
from ...services.policy_detection import detect_policies
from . import api_bp
from ._helpers import (
    event_queue,
    _notif_streams,
    _apply_insurance_tag_metadata_filters,
    _current_user,
    _impact_score_for,
    _metadata_text_match,
    _normalize_source_group,
    _normalize_metadata,
    _parse_dt,
    _scope_feedback_query,
    _serialize_feedback,
    _safe_json_dumps,
    _ensure_workflow,
    _upsert_customer_entities,
    _upsert_search_document,
    _user_permission_keys,
    _notif_publish,
)

logger = logging.getLogger(__name__)


def _exclude_removed_sources(q):
    # Hide legacy channels that were removed from product surfaces.
    return q.filter(~func.lower(Feedback.source).in_(["api", "web"]))


def _serialize_notification(row: Notification) -> dict:
    return {
        "id": row.id,
        "type": row.type,
        "title": row.title,
        "body": row.body,
        "href": row.href,
        "meta": safe_json_loads(row.meta) if row.meta else {},
        "read_at": row.read_at.isoformat() if row.read_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _is_admin_ui(user: User, perms: set[str]) -> bool:
    return (
        "admin.manage_users" in perms
        or "admin.manage_roles" in perms
        or "admin.manage_integrations" in perms
        or str(getattr(user, "role", "") or "").lower() == "super_admin"
    )


def _get_notification_prefs(db, user_id: int, *, is_admin: bool) -> dict:
    row = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
    base = safe_json_loads(row.prefs) if row and row.prefs else {}
    defaults = {
        "new_feedback": True,
        "assigned_to_me": True,
        "admin_user_events": bool(is_admin),
        "realtime": True,
        "anomaly_alerts": not bool(is_admin),
    }
    out = {**defaults}
    for k, v in (base or {}).items():
        if k in defaults:
            out[k] = bool(v)
    return out


def _prefs_allows(prefs: dict, key: str) -> bool:
    return bool((prefs or {}).get(key, False))


def _serialize_feedback_safe(feedback: Feedback) -> dict:
    meta = normalize_channel_metadata(getattr(feedback, "source", None), feedback.channel_metadata) or {}
    insurance_tags = meta.get("insurance_tags") if isinstance(meta.get("insurance_tags"), list) else []
    return {
        "id": feedback.id,
        "source": feedback.source,
        "customer_id": feedback.customer_id,
        "rating": feedback.rating,
        "category": feedback.category,
        "created_at": feedback.created_at.isoformat() if feedback.created_at else None,
        "sentiment_label": feedback.sentiment_label,
        "sentiment_score": feedback.sentiment_score,
        "priority": feedback.priority,
        "tags": feedback.tags,
        "consent_given": feedback.consent_given,
        "consent_text": feedback.consent_text,
        "channel_metadata": feedback.channel_metadata,
        "insurance_tags": insurance_tags,
        "is_soft_deleted": feedback.deleted_at is not None,
    }


def _require_authenticated_user(db):
    user = _current_user(db)
    if not user:
        raise PermissionError("Authentication required")
    return user

@api_bp.route("/events", methods=["GET"])
def sse_events():
    """
    Server-Sent Events (SSE) endpoint for live dashboard updates.
    """

    def event_stream():
        yield ": connected\n\n"
        while True:
            try:
                event = event_queue.get(timeout=30)
            except Empty:
                yield ": keep-alive\n\n"
                continue

            try:
                payload = json.dumps(event)
            except TypeError:
                logger.exception("Failed to JSON-encode SSE event")
                continue

            yield f"data: {payload}\n\n"

    return Response(stream_with_context(event_stream()), mimetype="text/event-stream")


@api_bp.route("/feedback/recent", methods=["GET"])
def get_recent_feedback():
    db = SessionLocal()
    try:
        limit = request.args.get("limit", type=int) or 50
        limit = min(limit, 1000)

        recent = (
            db.query(Feedback)
            .filter(Feedback.deleted_at.is_(None))
            .filter(~func.lower(Feedback.source).in_(["api", "web"]))
            .order_by(desc(Feedback.created_at))
            .limit(limit)
            .all()
        )
        feedback_list = [_serialize_feedback(f) for f in recent]
        return jsonify({"feedback": feedback_list, "count": len(feedback_list)})
    except Exception:
        logger.exception("Error fetching recent feedback")
        return jsonify({"error": "Failed to fetch recent feedback"}), 500
    finally:
        db.close()


@api_bp.route("/feedback/priority", methods=["GET"])
def get_priority_queue():
    db = SessionLocal()
    try:
        limit = request.args.get("limit", type=int) or 20
        limit = min(limit, 300)

        priority_queue = (
            db.query(Feedback)
            .filter(Feedback.deleted_at.is_(None))
            .filter(~func.lower(Feedback.source).in_(["api", "web"]))
            .filter(Feedback.priority.isnot(None))
            .order_by(desc(Feedback.priority), desc(Feedback.created_at))
            .limit(limit)
            .all()
        )

        priority_list = sorted(
            [_serialize_feedback(f) for f in priority_queue],
            key=lambda item: (
                int(item.get("impact_score") or 0),
                int(item.get("priority") or 0),
                item.get("created_at") or "",
            ),
            reverse=True,
        )

        return jsonify({"feedback": priority_list, "count": len(priority_list)})
    except Exception:
        logger.exception("Error fetching priority queue")
        return jsonify({"error": "Failed to fetch priority queue"}), 500
    finally:
        db.close()


@api_bp.route("/feedback/source-counts", methods=["GET"])
def feedback_source_counts():
    """
    Return database-wide counts by source for the Inbox tabs.
    Supports filters (same behavior as legacy):
      - sentiment, category, priority, date_from/date_to, range_days, dow/hour, location/campaign/language/customer_tier, insurance_tag(s)
      - q (search) uses FeedbackSearchDocument (encrypted messages)
    """
    sentiment = (request.args.get("sentiment") or "all").strip().lower()
    query_text = (request.args.get("q") or "").strip()
    category = (request.args.get("category") or "all").strip()
    priority = (request.args.get("priority") or "all").strip().lower()
    date_from = _parse_dt(request.args.get("date_from"))
    date_to = _parse_dt(request.args.get("date_to"))
    dow = request.args.get("dow", type=int)
    hour = request.args.get("hour", type=int)
    range_days = request.args.get("range_days", type=int)
    location = request.args.get("location")
    campaign = request.args.get("campaign")
    language = request.args.get("language")
    customer_tier = request.args.get("customer_tier")
    insurance_tag = request.args.get("insurance_tag")
    insurance_tags_any = request.args.get("insurance_tags_any")

    db = SessionLocal()
    try:
        user = _current_user(db)
        perms = _user_permission_keys(db, getattr(user, "id", None))
        q = db.query(Feedback.source, func.count(Feedback.id)).filter(Feedback.deleted_at.is_(None))
        q = _exclude_removed_sources(q)
        if user and perms:
            q = _scope_feedback_query(db, q, user=user, perms=perms)
        if query_text:
            like_query = f"%{query_text.lower()}%"
            search_hits = (
                db.query(FeedbackSearchDocument.feedback_id)
                .filter(
                    or_(
                        func.lower(FeedbackSearchDocument.message_search_text).like(like_query),
                        func.lower(FeedbackSearchDocument.metadata_search_text).like(like_query),
                        func.lower(FeedbackSearchDocument.customer_label).like(like_query),
                    )
                )
                .subquery()
            )
            q = q.filter(Feedback.id.in_(search_hits))

        if sentiment and sentiment != "all":
            q = q.filter(Feedback.sentiment_label == sentiment)
        if category and category.lower() != "all":
            q = q.filter(Feedback.category == category)
        if priority == "high":
            q = q.filter(Feedback.priority.isnot(None)).filter(Feedback.priority >= 80)
        if range_days in (7, 30, 90):
            now = datetime.now(tz=timezone.utc)
            q = q.filter(Feedback.created_at >= (now - timedelta(days=range_days)))
        if date_from:
            q = q.filter(Feedback.created_at >= date_from)
        if date_to:
            q = q.filter(Feedback.created_at <= date_to)
        if dow is not None and 0 <= dow <= 6:
            dialect = getattr(getattr(db, "bind", None), "dialect", None)
            dialect_name = getattr(dialect, "name", "") or ""
            target_dow = (dow + 1) % 7
            if "sqlite" in dialect_name:
                q = q.filter(cast(func.strftime("%w", Feedback.created_at), Integer) == target_dow)
            elif "postgres" in dialect_name:
                q = q.filter(cast(func.extract("dow", Feedback.created_at), Integer) == target_dow)
        if hour is not None and 0 <= hour <= 23:
            dialect = getattr(getattr(db, "bind", None), "dialect", None)
            dialect_name = getattr(dialect, "name", "") or ""
            if "sqlite" in dialect_name:
                q = q.filter(cast(func.strftime("%H", Feedback.created_at), Integer) == hour)
            elif "postgres" in dialect_name:
                q = q.filter(cast(func.extract("hour", Feedback.created_at), Integer) == hour)
        for clause in [
            _metadata_text_match(Feedback.channel_metadata, "location", location),
            _metadata_text_match(Feedback.channel_metadata, "campaign", campaign),
            _metadata_text_match(Feedback.channel_metadata, "language", language),
            _metadata_text_match(Feedback.channel_metadata, "customer_tier", customer_tier),
        ]:
            if clause is not None:
                q = q.filter(clause)
        q = _apply_insurance_tag_metadata_filters(q, Feedback.channel_metadata, insurance_tag, insurance_tags_any)

        rows = q.group_by(Feedback.source).all()

        raw = {}
        grouped = {}
        total = 0
        for src, count in rows:
            key = (src or "").strip().lower()
            if not key:
                continue
            c = int(count or 0)
            raw[key] = raw.get(key, 0) + c
            total += c
            g = _normalize_source_group(key)
            if g:
                grouped[g] = grouped.get(g, 0) + c

        return jsonify({"total": total, "raw": raw, "grouped": grouped})
    finally:
        db.close()


@api_bp.route("/notifications/unread-count", methods=["GET"])
def notifications_unread_count():
    db = SessionLocal()
    try:
        user = _require_authenticated_user(db)
        unread = (
            db.query(func.count(Notification.id))
            .filter(Notification.user_id == user.id)
            .filter(Notification.read_at.is_(None))
            .scalar()
            or 0
        )
        return jsonify({"unread": int(unread)})
    except PermissionError as e:
        return jsonify({"error": str(e)}), 401
    finally:
        db.close()


@api_bp.route("/notifications", methods=["GET"])
def notifications_list():
    db = SessionLocal()
    try:
        user = _require_authenticated_user(db)
        limit = request.args.get("limit", type=int) or 30
        limit = max(1, min(limit, 100))
        unread_only = str(request.args.get("unread_only") or "").strip().lower() in {"1", "true", "yes", "on"}
        cursor = request.args.get("cursor", type=int)

        q = db.query(Notification).filter(Notification.user_id == user.id)
        if unread_only:
            q = q.filter(Notification.read_at.is_(None))
        if cursor:
            q = q.filter(Notification.id < cursor)

        rows = q.order_by(desc(Notification.id)).limit(limit + 1).all()
        has_more = len(rows) > limit
        rows = rows[:limit]
        next_cursor = rows[-1].id if has_more and rows else None

        return jsonify(
            {
                "items": [_serialize_notification(r) for r in rows],
                "next_cursor": next_cursor,
                "has_more": bool(has_more),
            }
        )
    except PermissionError as e:
        return jsonify({"error": str(e)}), 401
    finally:
        db.close()


@api_bp.route("/notifications/mark-read", methods=["POST"])
def notifications_mark_read():
    db = SessionLocal()
    try:
        user = _require_authenticated_user(db)
        payload = request.get_json(silent=True) or {}
        mark_all = bool(payload.get("all"))
        ids = payload.get("ids") if isinstance(payload.get("ids"), list) else []

        q = db.query(Notification).filter(Notification.user_id == user.id)
        if mark_all:
            target = q.filter(Notification.read_at.is_(None)).all()
        else:
            ids_int = [int(x) for x in ids if str(x).isdigit()]
            if not ids_int:
                return jsonify({"ok": True, "updated": 0})
            target = q.filter(Notification.id.in_(ids_int)).all()

        now = datetime.now(tz=timezone.utc)
        updated = 0
        for row in target:
            if row.read_at is None:
                row.read_at = now
                updated += 1
        db.commit()

        unread = (
            db.query(func.count(Notification.id))
            .filter(Notification.user_id == user.id)
            .filter(Notification.read_at.is_(None))
            .scalar()
            or 0
        )
        _notif_publish(user.id, {"type": "notification.unread_count", "unread": int(unread)})
        return jsonify({"ok": True, "updated": int(updated), "unread": int(unread)})
    except PermissionError as e:
        return jsonify({"error": str(e)}), 401
    finally:
        db.close()


@api_bp.route("/notifications/mark-unread", methods=["POST"])
def notifications_mark_unread():
    db = SessionLocal()
    try:
        user = _require_authenticated_user(db)
        payload = request.get_json(silent=True) or {}
        ids = payload.get("ids") if isinstance(payload.get("ids"), list) else []
        ids_int = [int(x) for x in ids if str(x).isdigit()]
        if not ids_int:
            return jsonify({"ok": True, "updated": 0})

        rows = (
            db.query(Notification)
            .filter(Notification.user_id == user.id)
            .filter(Notification.id.in_(ids_int))
            .all()
        )
        updated = 0
        for row in rows:
            if row.read_at is not None:
                row.read_at = None
                updated += 1
        db.commit()

        unread = (
            db.query(func.count(Notification.id))
            .filter(Notification.user_id == user.id)
            .filter(Notification.read_at.is_(None))
            .scalar()
            or 0
        )
        _notif_publish(user.id, {"type": "notification.unread_count", "unread": int(unread)})
        return jsonify({"ok": True, "updated": int(updated), "unread": int(unread)})
    except PermissionError as e:
        return jsonify({"error": str(e)}), 401
    finally:
        db.close()


@api_bp.route("/notifications/preferences", methods=["GET", "POST"])
def notifications_preferences():
    db = SessionLocal()
    try:
        user = _require_authenticated_user(db)
        perms = _user_permission_keys(db, user.id)
        is_admin = _is_admin_ui(user, perms)

        if request.method == "GET":
            prefs = _get_notification_prefs(db, user.id, is_admin=is_admin)
            return jsonify({"prefs": prefs})

        payload = request.get_json(silent=True) or {}
        incoming = payload.get("prefs") if isinstance(payload.get("prefs"), dict) else {}
        current = _get_notification_prefs(db, user.id, is_admin=is_admin)
        allowed_keys = set(current.keys())
        next_prefs = dict(current)
        for k, v in incoming.items():
            if k in allowed_keys:
                next_prefs[k] = bool(v)

        row = db.query(NotificationPreference).filter(NotificationPreference.user_id == user.id).first()
        if not row:
            row = NotificationPreference(user_id=user.id, prefs=_safe_json_dumps(next_prefs))
            db.add(row)
        else:
            row.prefs = _safe_json_dumps(next_prefs)
            row.updated_at = datetime.now(tz=timezone.utc)
        db.commit()
        return jsonify({"ok": True, "prefs": next_prefs})
    except PermissionError as e:
        return jsonify({"error": str(e)}), 401
    finally:
        db.close()


@api_bp.route("/notifications/stream", methods=["GET"])
def notifications_stream():
    db = SessionLocal()
    try:
        user = _require_authenticated_user(db)
        user_id = int(user.id)
    except PermissionError as e:
        db.close()
        return jsonify({"error": str(e)}), 401
    finally:
        try:
            db.close()
        except Exception:
            pass

    q: "Queue[dict]" = Queue()
    _notif_streams.setdefault(user_id, []).append(q)

    def event_stream():
        try:
            yield ": connected\n\n"
            while True:
                try:
                    event = q.get(timeout=25)
                    yield f"data: {json.dumps(event)}\n\n"
                except Empty:
                    yield ": keep-alive\n\n"
        finally:
            streams = _notif_streams.get(user_id) or []
            if q in streams:
                streams.remove(q)
            if not streams and user_id in _notif_streams:
                _notif_streams.pop(user_id, None)

    return Response(stream_with_context(event_stream()), mimetype="text/event-stream")


@api_bp.route("/feedback/feed", methods=["GET"])
def feedback_feed():
    db = SessionLocal()
    try:
        user = _current_user(db)
        perms = _user_permission_keys(db, getattr(user, "id", None))
        limit = request.args.get("limit", type=int) or 50
        limit = max(1, min(limit, 200))
        query_text = (request.args.get("q") or "").strip()
        sentiment = (request.args.get("sentiment") or "all").strip().lower()
        category = (request.args.get("category") or "all").strip()
        source = (request.args.get("source") or "all").strip().lower()
        priority = (request.args.get("priority") or "all").strip().lower()
        sort = (request.args.get("sort") or "chronological").strip().lower()
        date_from = _parse_dt(request.args.get("date_from"))
        date_to = _parse_dt(request.args.get("date_to"))
        dow = request.args.get("dow", type=int)
        hour = request.args.get("hour", type=int)
        range_days = request.args.get("range_days", type=int)
        location = request.args.get("location")
        campaign = request.args.get("campaign")
        language = request.args.get("language")
        customer_tier = request.args.get("customer_tier")
        insurance_tag = request.args.get("insurance_tag")
        insurance_tags_any = request.args.get("insurance_tags_any")
        cursor_created_at = _parse_dt(request.args.get("cursor_created_at"))
        cursor_id = request.args.get("cursor_id", type=int)

        q = db.query(Feedback).filter(Feedback.deleted_at.is_(None))
        q = _exclude_removed_sources(q)
        if user and perms:
            q = _scope_feedback_query(db, q, user=user, perms=perms)
        if query_text:
            like_query = f"%{query_text.lower()}%"
            search_hits = (
                db.query(FeedbackSearchDocument.feedback_id)
                .filter(
                    or_(
                        func.lower(FeedbackSearchDocument.message_search_text).like(like_query),
                        func.lower(FeedbackSearchDocument.metadata_search_text).like(like_query),
                        func.lower(FeedbackSearchDocument.customer_label).like(like_query),
                    )
                )
                .subquery()
            )
            q = q.filter(Feedback.id.in_(search_hits))
        if sentiment != "all":
            q = q.filter(Feedback.sentiment_label == sentiment)
        if category and category.lower() != "all":
            q = q.filter(func.lower(Feedback.category) == category.lower())
        if source and source != "all":
            raw_source = source.lower()
            q = q.filter(func.lower(Feedback.source).like(f"%{raw_source}%"))
        if priority == "high":
            q = q.filter(Feedback.priority.isnot(None)).filter(Feedback.priority >= 80)
        if range_days in (7, 30, 90):
            now = datetime.now(tz=timezone.utc)
            q = q.filter(Feedback.created_at >= (now - timedelta(days=range_days)))
        if date_from:
            q = q.filter(Feedback.created_at >= date_from)
        if date_to:
            q = q.filter(Feedback.created_at <= date_to)
        if dow is not None and 0 <= dow <= 6:
            dialect = getattr(getattr(db, "bind", None), "dialect", None)
            dialect_name = getattr(dialect, "name", "") or ""
            target_dow = (dow + 1) % 7
            if "sqlite" in dialect_name:
                q = q.filter(cast(func.strftime("%w", Feedback.created_at), Integer) == target_dow)
            elif "postgres" in dialect_name:
                q = q.filter(cast(func.extract("dow", Feedback.created_at), Integer) == target_dow)
        if hour is not None and 0 <= hour <= 23:
            dialect = getattr(getattr(db, "bind", None), "dialect", None)
            dialect_name = getattr(dialect, "name", "") or ""
            if "sqlite" in dialect_name:
                q = q.filter(cast(func.strftime("%H", Feedback.created_at), Integer) == hour)
            elif "postgres" in dialect_name:
                q = q.filter(cast(func.extract("hour", Feedback.created_at), Integer) == hour)
        for clause in [
            _metadata_text_match(Feedback.channel_metadata, "location", location),
            _metadata_text_match(Feedback.channel_metadata, "campaign", campaign),
            _metadata_text_match(Feedback.channel_metadata, "language", language),
            _metadata_text_match(Feedback.channel_metadata, "customer_tier", customer_tier),
        ]:
            if clause is not None:
                q = q.filter(clause)
        q = _apply_insurance_tag_metadata_filters(q, Feedback.channel_metadata, insurance_tag, insurance_tags_any)

        if sort == "impact":
            rows = q.limit(min(limit * 4, 400)).all()
            rows = sorted(
                rows,
                key=lambda f: (
                    _impact_score_for(f, _normalize_metadata(f)),
                    f.created_at or datetime.min.replace(tzinfo=timezone.utc),
                    f.id or 0,
                ),
                reverse=True,
            )
            page = rows[:limit]
            next_cursor = None
            has_more = len(rows) > limit
        else:
            if cursor_created_at and cursor_id:
                q = q.filter(
                    or_(
                        Feedback.created_at < cursor_created_at,
                        and_(Feedback.created_at == cursor_created_at, Feedback.id < cursor_id),
                    )
                )
            page = q.order_by(desc(Feedback.created_at), desc(Feedback.id)).limit(limit + 1).all()
            has_more = len(page) > limit
            page = page[:limit]
            next_cursor = None
            if has_more and page:
                last = page[-1]
                next_cursor = {
                    "cursor_created_at": last.created_at.isoformat() if last.created_at else None,
                    "cursor_id": last.id,
                }

        # Legacy backfill: older feedback rows may not have `email_hash` populated even though
        # channel metadata includes sender email. Without `email_hash`, we can't generate a stable
        # `customer_key` (email_hash:...) for Customer 360, so "View customer" stays unavailable.
        try:
            touched = False
            for fb in page:
                if getattr(fb, "email_hash", None):
                    continue
                meta_fb = normalize_channel_metadata(getattr(fb, "source", None), fb.channel_metadata) or {}
                derived_email = str(meta_fb.get("sender_email") or meta_fb.get("from_email") or "").strip().lower()
                if not derived_email:
                    continue
                fb.email_hash = hash_email(derived_email)
                if not getattr(fb, "email_encrypted", None):
                    fb.email_encrypted = encrypt_text(derived_email)
                try:
                    msg_plain = decrypt_text(fb.message_encrypted) or ""
                except Exception:
                    msg_plain = ""
                _upsert_customer_entities(db, feedback=fb, message_plaintext=msg_plain)
                _upsert_search_document(db, feedback=fb, message_plaintext=msg_plain)
                touched = True
            if touched:
                db.commit()
        except Exception:
            db.rollback()
            logger.exception("Failed legacy customer identity backfill")

        items = [_serialize_feedback(f) for f in page]
        return jsonify({"items": items, "next_cursor": next_cursor, "has_more": has_more})
    except Exception:
        logger.exception("Error fetching unified feedback feed")
        return jsonify({"error": "Failed to fetch feedback feed"}), 500
    finally:
        db.close()


@api_bp.route("/feedback", methods=["POST"])
def create_feedback():
    """
    Removed: public API feedback submission.
    """
    return jsonify({"error": "API feedback submission has been removed."}), 410

