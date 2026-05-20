"""
Analytics routes for the /api blueprint.

Moved from legacy `backend/app/routes/api.py`.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from flask import jsonify, request
from sqlalchemy import Float, and_, cast, case, desc, exists, func, or_

from ...database import SessionLocal
from ...models import Feedback, FeedbackPolicyMatch
from ...services.analytics_time_window import parse_overview_time_window
from ...services.metadata_normalization import normalize_channel_metadata
from . import api_bp
from ._helpers import _normalize_source_group, _require_user, _scope_feedback_query, _user_permission_keys

logger = logging.getLogger(__name__)


def _exclude_removed_sources(q):
    return q.filter(~func.lower(Feedback.source).in_(["api", "web"]))


def _safe_int(value: Any, default: int) -> int:
    try:
        if value is None:
            return int(default)
        return int(value)
    except Exception:
        return int(default)


def _apply_primary_product_exists(query, product_prefix: Optional[str], product_group: Optional[str]):
    """
    Restrict Feedback queries to rows whose primary policy/product match matches.
    - No prefix: no-op.
    - Prefix only (product_group is None): any primary row with that prefix.
    - Prefix + group param (including empty string): exact group; empty string matches NULL/'' group only.
    """
    pp = (product_prefix or "").strip()
    if not pp:
        return query
    conds = [
        FeedbackPolicyMatch.feedback_id == Feedback.id,
        FeedbackPolicyMatch.is_primary.is_(True),
        FeedbackPolicyMatch.product_prefix == pp,
    ]
    if product_group is not None:
        pgs = (product_group or "").strip()
        if pgs:
            conds.append(FeedbackPolicyMatch.product_group == pgs)
        else:
            conds.append(or_(FeedbackPolicyMatch.product_group.is_(None), FeedbackPolicyMatch.product_group == ""))
    return query.filter(exists().where(and_(*conds)))


@api_bp.route("/analytics", methods=["GET"])
def get_analytics():
    """
    Get analytics data for dashboard: sentiment breakdown, category breakdown, trends.
    (Copied from legacy module to preserve behavior.)
    """
    db = SessionLocal()
    try:
        now = datetime.now(tz=timezone.utc)

        time_window = (request.args.get("time_window") or "all").strip().lower()
        if time_window not in ("all", "today", "week", "last_week", "month"):
            time_window = "all"

        filter_from = None
        filter_to = None
        if time_window == "today":
            filter_from = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        elif time_window == "week":
            filter_from = now - timedelta(days=7)
        elif time_window == "last_week":
            weekday = now.weekday()
            start_this_week = datetime(now.year, now.month, now.day, tzinfo=timezone.utc) - timedelta(days=weekday)
            filter_from = start_this_week - timedelta(days=7)
            filter_to = start_this_week
        elif time_window == "month":
            filter_from = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

        req_range = request.args.get("range_days", type=int) or 30
        if time_window == "all":
            range_days = req_range if req_range in (7, 30, 90) else 30
            start_range = now - timedelta(days=range_days)
        else:
            if time_window == "today":
                range_days = 1
            elif time_window in ("week", "last_week"):
                range_days = 7
            else:
                range_days = min((now.date() - filter_from.date()).days + 1, 62)
            start_range = filter_from

        pf_prefix = (request.args.get("product_prefix") or "").strip()
        pf_group_raw = request.args.get("product_group")
        pf_group = pf_group_raw if pf_group_raw is not None else None

        def _pf(q):
            return _apply_primary_product_exists(q, pf_prefix, pf_group)

        def _apply_created_filter(q):
            if filter_from is not None:
                q = q.filter(Feedback.created_at >= filter_from)
            if filter_to is not None:
                q = q.filter(Feedback.created_at < filter_to)
            return q

        sentiment_counts = (
            _pf(
                _apply_created_filter(
                    db.query(Feedback.sentiment_label, func.count(Feedback.id)).filter(Feedback.deleted_at.is_(None))
                )
            )
            .filter(~func.lower(Feedback.source).in_(["api", "web"]))
            .group_by(Feedback.sentiment_label)
            .all()
        )

        category_counts = (
            _pf(
                _apply_created_filter(
                    db.query(Feedback.category, func.count(Feedback.id))
                    .filter(Feedback.deleted_at.is_(None))
                    .filter(~func.lower(Feedback.source).in_(["api", "web"]))
                    .filter(Feedback.category.isnot(None))
                )
            )
            .group_by(Feedback.category)
            .order_by(desc(func.count(Feedback.id)))
            .limit(10)
            .all()
        )

        day_col = func.date(Feedback.created_at)
        daily_rows = (
            _pf(
                db.query(
                    day_col.label("day"),
                    Feedback.sentiment_label,
                    func.count(Feedback.id),
                )
                .filter(Feedback.deleted_at.is_(None))
                .filter(~func.lower(Feedback.source).in_(["api", "web"]))
                .filter(Feedback.created_at >= start_range)
            )
            .group_by(day_col, Feedback.sentiment_label)
            .order_by(day_col)
            .all()
        )

        trends_map: Dict[str, Dict[str, int]] = {}
        for day, label, count in daily_rows:
            if day is None:
                continue
            day_str = day.isoformat() if hasattr(day, "isoformat") else str(day)
            bucket = trends_map.setdefault(
                day_str,
                {"date": day_str, "positive": 0, "negative": 0, "neutral": 0, "total": 0},
            )
            sentiment_key = (label or "neutral").lower()
            if sentiment_key not in ("positive", "negative", "neutral"):
                sentiment_key = "neutral"
            bucket[sentiment_key] += count
            bucket["total"] += count

        end_day = now.date()
        trends_filled: list[Dict[str, Any]] = []
        for i in range(range_days - 1, -1, -1):
            d = end_day - timedelta(days=i)
            key = d.isoformat()
            if key in trends_map:
                trends_filled.append(trends_map[key])
            else:
                trends_filled.append({"date": key, "positive": 0, "negative": 0, "neutral": 0, "total": 0})
        trends = trends_filled

        def _avg_age_hours(query):
            rows = query.all()
            if not rows:
                return None
            total_hours = 0.0
            for (created_at,) in rows:
                if not created_at:
                    continue
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                else:
                    created_at = created_at.astimezone(timezone.utc)
                delta = now - created_at
                total_hours += delta.total_seconds() / 3600.0
            count = len(rows)
            return round(total_hours / count, 2) if count > 0 else None

        base_age_query = _pf(_apply_created_filter(db.query(Feedback.created_at).filter(Feedback.deleted_at.is_(None))))
        base_age_query = base_age_query.filter(~func.lower(Feedback.source).in_(["api", "web"]))
        avg_age_all = _avg_age_hours(base_age_query)
        high_priority_age_query = base_age_query.filter(Feedback.priority.isnot(None)).filter(Feedback.priority >= 100)
        avg_age_high_priority = _avg_age_hours(high_priority_age_query)
        response_metrics = {"avg_age_hours_all": avg_age_all, "avg_age_hours_high_priority": avg_age_high_priority}

        recent_times = (
            _pf(
                db.query(Feedback.created_at, Feedback.sentiment_label)
                .filter(Feedback.deleted_at.is_(None))
                .filter(~func.lower(Feedback.source).in_(["api", "web"]))
                .filter(Feedback.created_at >= start_range)
            )
            .all()
        )

        heatmap: Dict[tuple, Dict[str, int]] = {}
        for created_at, label in recent_times:
            if not created_at:
                continue
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            created_at = created_at.astimezone(timezone.utc)
            day_of_week = created_at.weekday()
            hour = created_at.hour
            key = (day_of_week, hour)
            bucket = heatmap.setdefault(key, {"positive": 0, "negative": 0, "neutral": 0, "total": 0})
            sentiment_key = (label or "neutral").lower()
            if sentiment_key not in ("positive", "negative", "neutral"):
                sentiment_key = "neutral"
            bucket[sentiment_key] += 1
            bucket["total"] += 1

        peak_times = [
            {
                "day_of_week": dow,
                "hour": hr,
                "count": counts.get("total", 0),
                "positive": counts.get("positive", 0),
                "negative": counts.get("negative", 0),
                "neutral": counts.get("neutral", 0),
            }
            for (dow, hr), counts in heatmap.items()
        ]

        total_feedback = (
            _pf(
                _apply_created_filter(db.query(func.count(Feedback.id)).filter(Feedback.deleted_at.is_(None)))
            )
            .filter(~func.lower(Feedback.source).in_(["api", "web"]))
            .scalar()
            or 0
        )
        positive_count = sum(count for label, count in sentiment_counts if label == "positive")
        negative_count = sum(count for label, count in sentiment_counts if label == "negative")
        neutral_count = sum(count for label, count in sentiment_counts if label == "neutral")
        high_priority_count = (
            _pf(
                _apply_created_filter(
                    db.query(func.count(Feedback.id)).filter(Feedback.deleted_at.is_(None), Feedback.priority >= 100)
                )
            )
            .filter(~func.lower(Feedback.source).in_(["api", "web"]))
            .scalar()
            or 0
        )

        score_rows = (
            _pf(
                _apply_created_filter(
                    db.query(Feedback.sentiment_score)
                    .filter(Feedback.deleted_at.is_(None))
                    .filter(Feedback.sentiment_score.isnot(None))
                )
            )
            .filter(~func.lower(Feedback.source).in_(["api", "web"]))
            .all()
        )
        histogram_bins = {"very_negative": 0, "negative": 0, "neutral": 0, "positive": 0, "very_positive": 0}
        for (score,) in score_rows:
            if score is None:
                continue
            if score <= -0.6:
                histogram_bins["very_negative"] += 1
            elif score < -0.05:
                histogram_bins["negative"] += 1
            elif score <= 0.05:
                histogram_bins["neutral"] += 1
            elif score < 0.6:
                histogram_bins["positive"] += 1
            else:
                histogram_bins["very_positive"] += 1
        score_histogram = [{"bucket": name, "count": count} for name, count in histogram_bins.items()]

        category_trend_rows = (
            _pf(
                db.query(func.date(Feedback.created_at).label("day"), Feedback.category, func.count(Feedback.id))
                .filter(Feedback.deleted_at.is_(None))
                .filter(~func.lower(Feedback.source).in_(["api", "web"]))
                .filter(Feedback.created_at >= start_range)
                .filter(Feedback.category.isnot(None))
            )
            .group_by("day", Feedback.category)
            .order_by("day")
            .all()
        )
        category_trends = []
        for day, category, count in category_trend_rows:
            if day is None:
                continue
            category_trends.append({"date": str(day), "category": category or "uncategorized", "count": count})

        source_trend_rows = (
            _pf(
                db.query(func.date(Feedback.created_at).label("day"), Feedback.source, func.count(Feedback.id))
                .filter(Feedback.deleted_at.is_(None))
                .filter(~func.lower(Feedback.source).in_(["api", "web"]))
                .filter(Feedback.created_at >= start_range)
            )
            .group_by("day", Feedback.source)
            .order_by("day")
            .all()
        )
        source_by_day: Dict[str, Dict[str, int]] = {}
        source_totals: Dict[str, int] = {}
        for day, source, count in source_trend_rows:
            if day is None:
                continue
            day_key = str(day)
            raw = (source or "").strip().lower()
            if not raw:
                continue
            group = _normalize_source_group(raw) or raw
            c = int(count or 0)
            bucket = source_by_day.setdefault(day_key, {})
            bucket[group] = bucket.get(group, 0) + c
            source_totals[group] = source_totals.get(group, 0) + c

        top_sources = [k for (k, _) in sorted(source_totals.items(), key=lambda kv: kv[1], reverse=True)[:5]]
        source_trends_data: list[Dict[str, Any]] = []
        for row in trends:
            day_key = row.get("date")
            if not day_key:
                continue
            src_counts = source_by_day.get(day_key, {})
            out: Dict[str, Any] = {"date": day_key}
            other_total = 0
            for src, c in src_counts.items():
                if src in top_sources:
                    out[src] = int(c or 0)
                else:
                    other_total += int(c or 0)
            if other_total > 0:
                out["other"] = other_total
            for src in top_sources:
                out.setdefault(src, 0)
            out.setdefault("other", 0)
            source_trends_data.append(out)

        source_rows = (
            _pf(
                _apply_created_filter(
                    db.query(
                        Feedback.source,
                        func.count(Feedback.id).label("total"),
                        func.sum(case((Feedback.sentiment_label == "positive", 1), else_=0)).label("positive"),
                        func.sum(case((Feedback.sentiment_label == "negative", 1), else_=0)).label("negative"),
                        func.avg(Feedback.sentiment_score).label("avg_score"),
                        func.avg(cast(Feedback.rating, Float)).label("avg_rating"),
                    )
                    .filter(Feedback.deleted_at.is_(None))
                    .filter(~func.lower(Feedback.source).in_(["api", "web"]))
                )
            )
            .group_by(Feedback.source)
            .all()
        )
        source_performance = []
        for (source, total, positive, negative, avg_score, avg_rating) in source_rows:
            label = source or "unknown"
            total_val = total or 0
            pos = positive or 0
            neg = negative or 0
            source_performance.append(
                {
                    "source": label,
                    "total": total_val,
                    "positive": pos,
                    "negative": neg,
                    "neutral": max(total_val - pos - neg, 0),
                    "avg_score": float(avg_score) if avg_score is not None else None,
                    "avg_rating": float(avg_rating) if avg_rating is not None else None,
                }
            )

        rating_rows = (
            _pf(
                db.query(func.date(Feedback.created_at).label("day"), func.avg(cast(Feedback.rating, Float)), func.count(Feedback.id))
                .filter(Feedback.deleted_at.is_(None))
                .filter(~func.lower(Feedback.source).in_(["api", "web"]))
                .filter(Feedback.created_at >= start_range)
                .filter(Feedback.rating.isnot(None))
            )
            .group_by("day")
            .order_by("day")
            .all()
        )
        csat_trends = []
        for day, avg_rating, count in rating_rows:
            if day is None:
                continue
            csat_trends.append({"date": str(day), "avg_rating": float(avg_rating) if avg_rating is not None else None, "count": count})

        NO_INSURANCE_TAG = "no_insurance_tag"
        insurance_tags_breakdown: Dict[str, Dict[str, int]] = {}
        insurance_trends_map: Dict[str, Dict[str, int]] = {}
        insurance_tagged_feedback = 0
        insurance_tag_mention_total = 0
        tag_rows = (
            _pf(
                db.query(Feedback.created_at, Feedback.sentiment_label, Feedback.channel_metadata)
                .filter(Feedback.deleted_at.is_(None))
                .filter(~func.lower(Feedback.source).in_(["api", "web"]))
                .filter(Feedback.created_at >= start_range)
                .order_by(desc(Feedback.created_at))
                .limit(20000)
            )
            .all()
        )
        for created_at, label, channel_meta in tag_rows:
            if not created_at:
                continue
            meta = normalize_channel_metadata(None, channel_meta) or {}
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            else:
                created_at = created_at.astimezone(timezone.utc)
            day_key = created_at.date().isoformat()
            day_bucket = insurance_trends_map.setdefault(day_key, {"date": day_key})
            sent_key = (label or "neutral").lower()
            if sent_key not in ("positive", "negative", "neutral"):
                sent_key = "neutral"

            tags = meta.get("insurance_tags")
            if not isinstance(tags, list) or not tags:
                k = NO_INSURANCE_TAG
            else:
                valid = [str(t or "").strip().lower() for t in tags if str(t or "").strip()]
                if not valid:
                    k = NO_INSURANCE_TAG
                else:
                    insurance_tagged_feedback += 1
                    k = valid[0]

            insurance_tag_mention_total += 1
            b = insurance_tags_breakdown.setdefault(k, {"total": 0, "positive": 0, "negative": 0, "neutral": 0})
            b["total"] += 1
            b[sent_key] += 1
            day_bucket[k] = int(day_bucket.get(k, 0) or 0) + 1

        insurance_tags_trends: list[Dict[str, Any]] = []
        end_day = now.date()
        for i in range(range_days - 1, -1, -1):
            d = end_day - timedelta(days=i)
            key = d.isoformat()
            insurance_tags_trends.append(insurance_trends_map.get(key, {"date": key}))

        sentiment_dict = {label or "unknown": count for label, count in sentiment_counts}
        category_dict = {cat or "uncategorized": count for cat, count in category_counts}

        return jsonify(
            {
                "time_window": time_window,
                "sentiment": sentiment_dict,
                "categories": category_dict,
                "metrics": {
                    "total_feedback": total_feedback,
                    "positive_count": positive_count,
                    "negative_count": negative_count,
                    "neutral_count": neutral_count,
                    "high_priority_count": high_priority_count,
                },
                "trends": trends,
                "response_metrics": response_metrics,
                "peak_times": peak_times,
                "score_histogram": score_histogram,
                "category_trends": category_trends,
                "source_trends": {"sources": top_sources + ["other"], "data": source_trends_data},
                "source_performance": source_performance,
                "csat_trends": csat_trends,
                "insurance_tags_breakdown": insurance_tags_breakdown,
                "insurance_tags_trends": insurance_tags_trends,
                "insurance_tags_meta": {"tagged_feedback": insurance_tagged_feedback, "tag_mention_total": insurance_tag_mention_total},
            }
        )
    except Exception:
        logger.exception("Error fetching analytics")
        return jsonify({"error": "Failed to fetch analytics"}), 500
    finally:
        db.close()


def _product_pulse_display_label(prefix: str, group: Optional[str]) -> str:
    p = (prefix or "").strip()
    g = (group or "").strip()
    if g and p:
        return f"{g} ({p})"
    return g or p or "Unknown"


def _apply_product_match_arg_filters(q, product_prefix: str, product_group_raw):
    """Narrow a Feedback + FeedbackPolicyMatch query to one primary product (optional)."""
    pp = (product_prefix or "").strip()
    if not pp:
        return q
    q = q.filter(FeedbackPolicyMatch.product_prefix == pp)
    if product_group_raw is not None:
        pgs = (product_group_raw or "").strip()
        if pgs:
            q = q.filter(FeedbackPolicyMatch.product_group == pgs)
        else:
            q = q.filter(or_(FeedbackPolicyMatch.product_group.is_(None), FeedbackPolicyMatch.product_group == ""))
    return q


@api_bp.route("/analytics/product-pulse-trend", methods=["GET"])
def product_pulse_trend():
    """
    Daily feedback counts per product (primary policy match), for top-N products by volume.
    Shape matches category_trends-style consumption: list of {date, product, count}.
    """
    db = SessionLocal()
    try:
        user = _require_user(db)
        perms = _user_permission_keys(db, user.id)

        range_days = _safe_int(request.args.get("range_days"), 30)
        if range_days <= 0 or range_days > 365:
            range_days = 30

        top_n = _safe_int(request.args.get("top_n"), 6)
        if top_n <= 0 or top_n > 12:
            top_n = 6

        source = str(request.args.get("source") or "").strip()
        location = str(request.args.get("location") or "").strip()

        now = datetime.now(tz=timezone.utc)
        start = now - timedelta(days=range_days)

        day_expr = func.date(Feedback.created_at)

        base = (
            db.query(
                day_expr.label("day"),
                FeedbackPolicyMatch.product_prefix.label("product_prefix"),
                FeedbackPolicyMatch.product_group.label("product_group"),
                func.count(Feedback.id).label("n"),
            )
            .join(Feedback, Feedback.id == FeedbackPolicyMatch.feedback_id)
            .filter(Feedback.deleted_at.is_(None))
            .filter(~func.lower(Feedback.source).in_(["api", "web"]))
            .filter(Feedback.created_at >= start)
            .filter(Feedback.created_at <= now)
            .filter(FeedbackPolicyMatch.is_primary.is_(True))
        )

        q = _scope_feedback_query(db, base, user=user, perms=perms)

        if source:
            s = source.lower()
            q = q.filter(func.lower(Feedback.source) == s)

        if location:
            loc = location.lower()
            q = q.filter(func.lower(Feedback.channel_metadata).like(f"%{loc}%"))

        pf = (request.args.get("product_prefix") or "").strip()
        pgr = request.args.get("product_group")
        q = _apply_product_match_arg_filters(q, pf, pgr)

        q = q.group_by(day_expr, FeedbackPolicyMatch.product_prefix, FeedbackPolicyMatch.product_group)

        raw_rows = q.all()

        totals: Dict[str, int] = {}
        row_keys: Dict[tuple, str] = {}
        for r in raw_rows or []:
            pk = (getattr(r, "product_prefix", None) or "", getattr(r, "product_group", None) or "")
            key = f"{pk[0]}|{pk[1]}"
            label = _product_pulse_display_label(pk[0], pk[1] if pk[1] else None)
            n = int(getattr(r, "n", 0) or 0)
            totals[key] = totals.get(key, 0) + n
            row_keys[(pk[0], pk[1])] = label

        top_keys = [k for k, _ in sorted(totals.items(), key=lambda kv: kv[1], reverse=True)[:top_n]]
        top_set = set(top_keys)

        trends: list[Dict[str, Any]] = []
        for r in raw_rows or []:
            prefix = getattr(r, "product_prefix", None) or ""
            group = getattr(r, "product_group", None) or ""
            key = f"{prefix}|{group}"
            if key not in top_set:
                continue
            day = getattr(r, "day", None)
            if day is None:
                continue
            label = row_keys.get((prefix, group)) or _product_pulse_display_label(prefix, group if group else None)
            trends.append(
                {
                    "date": str(day),
                    "product": label,
                    "count": int(getattr(r, "n", 0) or 0),
                }
            )

        trends.sort(key=lambda x: (x.get("date") or "", x.get("product") or ""))

        return jsonify({"trends": trends, "range_days": range_days, "top_n": top_n}), 200
    except PermissionError as e:
        return jsonify({"error": str(e)}), 401
    except Exception:
        db.rollback()
        logger.exception("Failed to compute product pulse trend")
        return jsonify({"error": "Internal server error"}), 500
    finally:
        db.close()


@api_bp.route("/analytics/analyzer", methods=["GET"])
def feedback_analyzer():
    """
    AI summary of feedback for the overview dashboard time window.
    Query: time_window = all | today | week | last_week | month
    """
    db = SessionLocal()
    try:
        user = _require_user(db)
        perms = _user_permission_keys(db, user.id)
        time_window = (request.args.get("time_window") or "all").strip().lower()
        # Lazy import: google-genai is heavy; keep it off the app cold-start path.
        from ...services.feedback_analyzer import run_feedback_analyzer

        result = run_feedback_analyzer(
            db,
            user=user,
            perms=perms,
            time_window=time_window,
            scope_feedback_query=_scope_feedback_query,
        )
        return jsonify(result), 200
    except PermissionError as e:
        return jsonify({"error": str(e)}), 401
    except Exception:
        db.rollback()
        logger.exception("Failed to run feedback analyzer")
        return jsonify({"error": "Failed to analyze feedback"}), 500
    finally:
        db.close()


@api_bp.route("/analytics/product-pulse", methods=["GET"])
def product_pulse():
    """
    Product pulse: feedback volume by product (derived from primary policy matches).
    """
    db = SessionLocal()
    try:
        user = _require_user(db)
        perms = _user_permission_keys(db, user.id)

        time_window = (request.args.get("time_window") or "").strip().lower()
        range_days = _safe_int(request.args.get("range_days"), 30)
        if range_days <= 0 or range_days > 365:
            range_days = 30

        source = str(request.args.get("source") or "").strip()
        location = str(request.args.get("location") or "").strip()

        now = datetime.now(tz=timezone.utc)
        filter_from = None
        filter_to = None
        if time_window in ("all", "today", "week", "last_week", "month"):
            time_window, filter_from, filter_to, _label, range_days = parse_overview_time_window(
                time_window, now=now
            )
            start = filter_from or (now - timedelta(days=range_days))
        else:
            time_window = ""
            start = now - timedelta(days=range_days)

        q = (
            db.query(
                FeedbackPolicyMatch.product_prefix.label("product_prefix"),
                FeedbackPolicyMatch.product_group.label("product_group"),
                func.lower(func.coalesce(Feedback.sentiment_label, "unknown")).label("sentiment"),
                func.count(Feedback.id).label("n"),
            )
            .join(Feedback, Feedback.id == FeedbackPolicyMatch.feedback_id)
            .filter(Feedback.deleted_at.is_(None))
            .filter(~func.lower(Feedback.source).in_(["api", "web"]))
            .filter(Feedback.created_at >= start)
            .filter(FeedbackPolicyMatch.is_primary.is_(True))
        )
        if filter_to is not None:
            q = q.filter(Feedback.created_at < filter_to)
        else:
            q = q.filter(Feedback.created_at <= now)

        q = _scope_feedback_query(db, q, user=user, perms=perms)

        if source:
            s = source.lower()
            q = q.filter(func.lower(Feedback.source) == s)

        if location:
            loc = location.lower()
            q = q.filter(func.lower(Feedback.channel_metadata).like(f"%{loc}%"))

        pfx = (request.args.get("product_prefix") or "").strip()
        pgf = request.args.get("product_group")
        q = _apply_product_match_arg_filters(q, pfx, pgf)

        q = q.group_by(
            FeedbackPolicyMatch.product_prefix,
            FeedbackPolicyMatch.product_group,
            func.lower(func.coalesce(Feedback.sentiment_label, "unknown")),
        )

        rows = q.all()
        agg: Dict[str, Dict[str, Any]] = {}
        for r in rows or []:
            prefix = r.product_prefix or ""
            group = r.product_group or None
            key = f"{prefix}|{group or ''}"
            if key not in agg:
                agg[key] = {
                    "product_prefix": prefix,
                    "product_group": group,
                    "total": 0,
                    "positive": 0,
                    "neutral": 0,
                    "negative": 0,
                }
            n = int(getattr(r, "n", 0) or 0)
            agg[key]["total"] += n
            sent = str(getattr(r, "sentiment", "unknown") or "unknown").lower()
            if sent in ("positive", "neutral", "negative"):
                agg[key][sent] += n

        items = sorted(agg.values(), key=lambda x: int(x.get("total") or 0), reverse=True)
        payload: Dict[str, Any] = {"items": items, "range_days": range_days}
        if time_window:
            payload["time_window"] = time_window
        return jsonify(payload), 200
    except PermissionError as e:
        return jsonify({"error": str(e)}), 401
    except Exception:
        db.rollback()
        logger.exception("Failed to compute product pulse")
        return jsonify({"error": "Internal server error"}), 500
    finally:
        db.close()

