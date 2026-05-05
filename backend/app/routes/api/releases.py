"""
Release events/impact routes for the /api blueprint.

Moved from legacy `backend/app/routes/api.py`.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from flask import jsonify, request
from sqlalchemy import desc, func

from ...database import SessionLocal
from ...models import Feedback, FeedbackPolicyMatch, ReleaseEvent
from ...services.metadata_normalization import normalize_channel_metadata
from . import api_bp
from ._helpers import _parse_dt, _require_permission, _safe_json_dumps

logger = logging.getLogger(__name__)


def _metadata_text_match(column, key: str, value: Optional[str]):
    needle = str(value or "").strip().lower()
    if not needle or needle == "all":
        return None
    return func.lower(column).like(f'%"{key}":%{needle}%')


@api_bp.route("/admin/release-events", methods=["GET", "POST"])
def admin_release_events():
    """
    Admin CRUD for release events used by the release impact tracker.
    """
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_integrations")
        if request.method == "GET":
            rows = db.query(ReleaseEvent).order_by(desc(ReleaseEvent.released_at), desc(ReleaseEvent.id)).limit(200).all()
            return jsonify(
                {
                    "items": [
                        {
                            "id": r.id,
                            "title": r.title,
                            "released_at": r.released_at.isoformat() if r.released_at else None,
                            "product_prefixes": json.loads(r.product_prefixes) if r.product_prefixes else [],
                            "notes": r.notes,
                            "links": r.links,
                        }
                        for r in (rows or [])
                    ]
                }
            )

        payload = request.get_json(silent=True) or {}
        title = str(payload.get("title") or "").strip()
        if not title:
            return jsonify({"error": "title is required"}), 400
        released_at = _parse_dt(payload.get("released_at"))
        if not released_at:
            return jsonify({"error": "released_at is required (ISO datetime)"}), 400
        prefixes_in = payload.get("product_prefixes")
        prefixes: List[str] = []
        if isinstance(prefixes_in, list):
            prefixes = [str(x or "").strip().upper() for x in prefixes_in if str(x or "").strip()]
        notes = str(payload.get("notes") or "").strip() or None
        links = str(payload.get("links") or "").strip() or None

        row = ReleaseEvent(
            title=title,
            released_at=released_at,
            product_prefixes=_safe_json_dumps(prefixes),
            notes=notes,
            links=links,
            updated_at=datetime.now(tz=timezone.utc),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return (
            jsonify(
                {
                    "item": {
                        "id": row.id,
                        "title": row.title,
                        "released_at": row.released_at.isoformat() if row.released_at else None,
                        "product_prefixes": prefixes,
                        "notes": row.notes,
                        "links": row.links,
                    }
                }
            ),
            201,
        )
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    except Exception:
        db.rollback()
        logger.exception("Failed to manage release events")
        return jsonify({"error": "Internal server error"}), 500
    finally:
        db.close()


@api_bp.route("/admin/release-events/<int:release_id>", methods=["POST", "DELETE"])
def admin_release_event_update(release_id: int):
    """
    Update or delete a release event.
    """
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_integrations")
        row = db.query(ReleaseEvent).filter(ReleaseEvent.id == release_id).first()
        if not row:
            return jsonify({"error": "not found"}), 404

        if request.method == "DELETE":
            db.delete(row)
            db.commit()
            return jsonify({"ok": True})

        payload = request.get_json(silent=True) or {}
        if "title" in payload:
            t = str(payload.get("title") or "").strip()
            if not t:
                return jsonify({"error": "title cannot be empty"}), 400
            row.title = t
        if "released_at" in payload:
            ra = _parse_dt(payload.get("released_at"))
            if not ra:
                return jsonify({"error": "released_at must be ISO datetime"}), 400
            row.released_at = ra
        if "product_prefixes" in payload:
            prefixes_in = payload.get("product_prefixes")
            prefixes: List[str] = []
            if isinstance(prefixes_in, list):
                prefixes = [str(x or "").strip().upper() for x in prefixes_in if str(x or "").strip()]
            row.product_prefixes = _safe_json_dumps(prefixes)
        if "notes" in payload:
            row.notes = str(payload.get("notes") or "").strip() or None
        if "links" in payload:
            row.links = str(payload.get("links") or "").strip() or None
        row.updated_at = datetime.now(tz=timezone.utc)
        db.commit()
        db.refresh(row)
        return jsonify(
            {
                "item": {
                    "id": row.id,
                    "title": row.title,
                    "released_at": row.released_at.isoformat() if row.released_at else None,
                    "product_prefixes": json.loads(row.product_prefixes) if row.product_prefixes else [],
                    "notes": row.notes,
                    "links": row.links,
                }
            }
        )
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    except Exception:
        db.rollback()
        logger.exception("Failed to update release event")
        return jsonify({"error": "Internal server error"}), 500
    finally:
        db.close()


@api_bp.route("/analytics/release-impact", methods=["GET"])
def release_impact():
    """
    Release impact: compare before/after windows for a release event and (optionally) a product prefix.
    """
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_integrations")

        release_id = request.args.get("release_id", type=int)
        if not release_id:
            return jsonify({"error": "release_id is required"}), 400
        window_days = request.args.get("window_days", type=int) or 7
        window_days = max(1, min(window_days, 30))

        product_prefix = (request.args.get("product_prefix") or "").strip().upper() or None
        source = (request.args.get("source") or "").strip().lower() or None
        location = (request.args.get("location") or "").strip() or None

        rel = db.query(ReleaseEvent).filter(ReleaseEvent.id == release_id).first()
        if not rel:
            return jsonify({"error": "release not found"}), 404

        prefixes_from_release: List[str] = []
        try:
            prefixes_from_release = json.loads(rel.product_prefixes) if rel.product_prefixes else []
        except Exception:
            prefixes_from_release = []

        if product_prefix:
            prefixes = [product_prefix]
        elif prefixes_from_release:
            prefixes = [str(x or "").strip().upper() for x in prefixes_from_release if str(x or "").strip()]
        else:
            prefixes = []

        released_at = rel.released_at
        if released_at.tzinfo is None:
            released_at = released_at.replace(tzinfo=timezone.utc)
        else:
            released_at = released_at.astimezone(timezone.utc)

        before_start = released_at - timedelta(days=window_days)
        before_end = released_at
        after_start = released_at
        after_end = released_at + timedelta(days=window_days)

        q = (
            db.query(Feedback)
            .join(FeedbackPolicyMatch, FeedbackPolicyMatch.feedback_id == Feedback.id)
            .filter(Feedback.deleted_at.is_(None))
            .filter(Feedback.created_at >= before_start)
            .filter(Feedback.created_at < after_end)
            .filter(FeedbackPolicyMatch.is_primary.is_(True))
        )
        if prefixes:
            q = q.filter(FeedbackPolicyMatch.product_prefix.in_(prefixes))
        if source and source != "all":
            q = q.filter(func.lower(Feedback.source).like(f"%{source.lower()}%"))
        if location:
            clause = _metadata_text_match(Feedback.channel_metadata, "location", location)
            if clause is not None:
                q = q.filter(clause)

        rows = q.order_by(Feedback.created_at).all()

        def bucket_for(ts: Optional[datetime]) -> Optional[str]:
            if not ts:
                return None
            t = ts.astimezone(timezone.utc) if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
            if before_start <= t < before_end:
                return "before"
            if after_start <= t < after_end:
                return "after"
            return None

        summary = {
            "before": {"total": 0, "negative": 0, "neutral": 0, "positive": 0},
            "after": {"total": 0, "negative": 0, "neutral": 0, "positive": 0},
        }
        topics: Dict[str, Dict[str, int]] = {"before": {}, "after": {}}

        for fb in rows:
            b = bucket_for(fb.created_at)
            if not b:
                continue
            label = (fb.sentiment_label or "neutral").lower()
            if label not in {"negative", "neutral", "positive"}:
                label = "neutral"
            summary[b]["total"] += 1
            summary[b][label] += 1

            meta = normalize_channel_metadata(getattr(fb, "source", None), fb.channel_metadata) or {}
            ins = meta.get("insurance_tags")
            topic = None
            if isinstance(ins, list) and ins:
                topic = str(ins[0] or "").strip().lower() or None
            if not topic:
                topic = (fb.category or "").strip().lower() or None
            if topic:
                topics[b][topic] = int(topics[b].get(topic, 0)) + 1

        def pct(n: int, d: int) -> float:
            if d <= 0:
                return 0.0
            return round(100.0 * n / d, 2)

        def rate_block(block: Dict[str, int]) -> Dict[str, Any]:
            tot = int(block.get("total", 0))
            neg = int(block.get("negative", 0))
            return {**block, "negative_share": pct(neg, tot)}

        before_rates = rate_block(summary["before"])
        after_rates = rate_block(summary["after"])

        all_topics = set(list(topics["before"].keys()) + list(topics["after"].keys()))
        topic_rows = []
        for t in all_topics:
            b = int(topics["before"].get(t, 0))
            a = int(topics["after"].get(t, 0))
            bs = pct(b, summary["before"]["total"])
            as_ = pct(a, summary["after"]["total"])
            topic_rows.append(
                {
                    "topic": t,
                    "before_count": b,
                    "after_count": a,
                    "before_share": bs,
                    "after_share": as_,
                    "delta_share": round(as_ - bs, 2),
                }
            )
        topic_rows.sort(key=lambda r: abs(r.get("delta_share") or 0.0), reverse=True)

        return jsonify(
            {
                "release": {
                    "id": rel.id,
                    "title": rel.title,
                    "released_at": released_at.isoformat(),
                    "product_prefixes": prefixes,
                },
                "window_days": window_days,
                "windows": {
                    "before": {"start": before_start.isoformat(), "end": before_end.isoformat()},
                    "after": {"start": after_start.isoformat(), "end": after_end.isoformat()},
                },
                "sentiment": {"before": before_rates, "after": after_rates},
                "topics": {"top_deltas": topic_rows[:15]},
                "notes": {"interpretation": "Before/after comparisons show association, not proof of causation."},
            }
        )
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    except Exception:
        db.rollback()
        logger.exception("Release impact failed")
        return jsonify({"error": "Internal server error"}), 500
    finally:
        db.close()

