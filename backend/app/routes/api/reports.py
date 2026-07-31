"""
Report export and scheduled report configuration.
"""

from __future__ import annotations

import csv
import io
import json
import logging
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from flask import Response, jsonify, request, session
from sqlalchemy import desc, func

from ...database import SessionLocal
from ...models import Feedback, ReportSchedule
from ...security import decrypt_text
from ...services.analyst_export import (
    _insurance_tags,
    _plain_text_for_export,
    _theme_label,
    apply_feedback_report_filters,
    build_analyst_export,
    build_analyst_export_csv,
    build_feedback_export_query,
)
from ...services.metadata_normalization import safe_json_loads
from . import api_bp
from ._helpers import (
    _audit_log,
    _normalize_source_group,
    _parse_dt,
    _require_any_permission,
    _require_user,
    _scope_feedback_query,
    _user_permission_keys,
)

logger = logging.getLogger(__name__)


def _can_view_reports(perms: set[str]) -> bool:
    return bool(
        {"reports.view_team", "reports.view_org", "reports.export"} & perms
        or "admin.manage_users" in perms
    )


def _can_export_reports(perms: set[str]) -> bool:
    return "reports.export" in perms or "admin.manage_users" in perms


def _serialize_schedule(row: ReportSchedule) -> Dict[str, Any]:
    recipients = safe_json_loads(row.recipients) if row.recipients else []
    if not isinstance(recipients, list):
        recipients = []
    filters = safe_json_loads(row.filters) if row.filters else {}
    if not isinstance(filters, dict):
        filters = {}
    return {
        "id": row.id,
        "name": row.name,
        "cadence": row.cadence,
        "time_of_day": row.time_of_day,
        "timezone": row.timezone,
        "recipients": recipients,
        "filters": filters,
        "format": row.format,
        "enabled": bool(row.enabled),
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _build_feedback_export_query(db, user, perms: set[str], params: Dict[str, Any]):
    return build_feedback_export_query(db, user, perms, params, apply_limit=True)


def _scoped_feedback_base(db, user, perms: set[str]):
    q = db.query(Feedback).filter(Feedback.deleted_at.is_(None))
    return _scope_feedback_query(db, q, user=user, perms=perms)


def _count_with_params(db, user, perms: set[str], params: Dict[str, Any]) -> int:
    q = _scoped_feedback_base(db, user, perms)
    q = apply_feedback_report_filters(q, params)
    return int(q.with_entities(func.count(Feedback.id)).scalar() or 0)


@api_bp.route("/reports/schedules", methods=["GET", "POST"])
def report_schedules():
    db = SessionLocal()
    try:
        user, perms = _require_any_permission(
            db,
            ["reports.view_team", "reports.view_org", "reports.export", "admin.manage_users"],
        )
        if not _can_view_reports(perms):
            return jsonify({"error": "Missing reports permission"}), 403

        if request.method == "GET":
            rows = (
                db.query(ReportSchedule)
                .filter(ReportSchedule.user_id == user.id)
                .order_by(desc(ReportSchedule.created_at), desc(ReportSchedule.id))
                .all()
            )
            return jsonify({"schedules": [_serialize_schedule(r) for r in rows]})

        if not _can_export_reports(perms):
            return jsonify({"error": "Missing permission: reports.export"}), 403

        payload = request.get_json(silent=True) or {}
        name = str(payload.get("name") or "").strip()
        if len(name) < 3:
            return jsonify({"error": "Name must be at least 3 characters"}), 400

        cadence = str(payload.get("cadence") or "weekly").strip().lower()
        if cadence not in ("daily", "weekly", "monthly"):
            return jsonify({"error": "cadence must be daily, weekly, or monthly"}), 400

        recipients = payload.get("recipients") or []
        if isinstance(recipients, str):
            recipients = [x.strip() for x in recipients.split(",") if x.strip()]
        if not isinstance(recipients, list) or not recipients:
            return jsonify({"error": "At least one recipient email is required"}), 400

        fmt = str(payload.get("format") or "csv").strip().lower()
        if fmt not in ("csv", "pdf"):
            fmt = "csv"

        row = ReportSchedule(
            user_id=user.id,
            name=name,
            cadence=cadence,
            time_of_day=str(payload.get("time_of_day") or "08:00")[:8],
            timezone=str(payload.get("timezone") or "UTC")[:40],
            recipients=json.dumps(recipients),
            filters=json.dumps(payload.get("filters") if isinstance(payload.get("filters"), dict) else {}),
            format=fmt,
            enabled=bool(payload.get("enabled", True)),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return jsonify({"schedule": _serialize_schedule(row)}), 201
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/reports/schedules/<int:schedule_id>", methods=["PATCH", "DELETE"])
def report_schedule_mutate(schedule_id: int):
    db = SessionLocal()
    try:
        user, perms = _require_any_permission(
            db,
            ["reports.export", "admin.manage_users"],
        )
        if not _can_export_reports(perms):
            return jsonify({"error": "Missing permission: reports.export"}), 403

        row = (
            db.query(ReportSchedule)
            .filter(ReportSchedule.id == schedule_id, ReportSchedule.user_id == user.id)
            .first()
        )
        if not row:
            return jsonify({"error": "Schedule not found"}), 404

        if request.method == "DELETE":
            db.delete(row)
            db.commit()
            return jsonify({"ok": True})

        payload = request.get_json(silent=True) or {}
        if "enabled" in payload:
            row.enabled = bool(payload.get("enabled"))
        if "name" in payload:
            name = str(payload.get("name") or "").strip()
            if len(name) >= 3:
                row.name = name
        if "cadence" in payload:
            cadence = str(payload.get("cadence") or "").strip().lower()
            if cadence in ("daily", "weekly", "monthly"):
                row.cadence = cadence
        if "time_of_day" in payload:
            row.time_of_day = str(payload.get("time_of_day") or "08:00")[:8]
        if "timezone" in payload:
            row.timezone = str(payload.get("timezone") or "UTC")[:40]
        if "format" in payload:
            fmt = str(payload.get("format") or "csv").strip().lower()
            if fmt in ("csv", "pdf", "xlsx"):
                row.format = fmt if fmt != "xlsx" else "csv"
        if "recipients" in payload:
            recipients = payload.get("recipients") or []
            if isinstance(recipients, str):
                recipients = [x.strip() for x in recipients.split(",") if x.strip()]
            if isinstance(recipients, list) and recipients:
                row.recipients = json.dumps(recipients)
        if "filters" in payload and isinstance(payload.get("filters"), dict):
            row.filters = json.dumps(payload.get("filters"))

        db.commit()
        db.refresh(row)
        return jsonify({"schedule": _serialize_schedule(row)})
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/reports/preview", methods=["GET"])
def report_preview():
    """
    Live briefing preview for the Reports builder.
    Uses the same filters as analyst export.
    """
    db = SessionLocal()
    try:
        user, perms = _require_any_permission(
            db,
            ["reports.view_team", "reports.view_org", "reports.export", "admin.manage_users"],
        )
        if not _can_view_reports(perms):
            return jsonify({"error": "Missing reports permission"}), 403

        params = dict(request.args)
        # Preview ignores row limit; aggregations are over the filtered set.
        params.pop("limit", None)

        base = apply_feedback_report_filters(_scoped_feedback_base(db, user, perms), params)

        total = int(base.with_entities(func.count(Feedback.id)).scalar() or 0)

        sentiment_rows = (
            apply_feedback_report_filters(_scoped_feedback_base(db, user, perms), params)
            .with_entities(func.lower(Feedback.sentiment_label), func.count(Feedback.id))
            .group_by(func.lower(Feedback.sentiment_label))
            .all()
        )
        sentiment = {"positive": 0, "neutral": 0, "negative": 0}
        for label, count in sentiment_rows:
            key = (label or "neutral").lower()
            if key not in sentiment:
                key = "neutral"
            sentiment[key] += int(count or 0)

        def _pct(n: int) -> int:
            return int(round((n / total) * 100)) if total > 0 else 0

        # Daily trend across the filtered window (fallback last 28 days if unbounded).
        day_col = func.date(Feedback.created_at)
        trend_q = apply_feedback_report_filters(_scoped_feedback_base(db, user, perms), params)
        date_from = _parse_dt(params.get("date_from"))
        date_to = _parse_dt(params.get("date_to"))
        now = datetime.now(tz=timezone.utc)
        if not date_from and str(params.get("time_window") or "all").lower() == "all":
            trend_q = trend_q.filter(Feedback.created_at >= now - timedelta(days=27))
            chart_start = (now - timedelta(days=27)).date()
            chart_end = now.date()
        else:
            chart_end = date_to.date() if date_to else now.date()
            chart_start = date_from.date() if date_from else chart_end - timedelta(days=27)

        trend_rows = (
            trend_q.with_entities(
                day_col.label("day"),
                func.lower(Feedback.sentiment_label),
                func.count(Feedback.id),
            )
            .group_by(day_col, func.lower(Feedback.sentiment_label))
            .order_by(day_col)
            .all()
        )
        trends_map: Dict[str, Dict[str, int]] = {}
        for day, label, count in trend_rows:
            if day is None:
                continue
            day_str = day.isoformat() if hasattr(day, "isoformat") else str(day)
            bucket = trends_map.setdefault(
                day_str,
                {"date": day_str, "positive": 0, "negative": 0, "neutral": 0, "total": 0},
            )
            sk = (label or "neutral").lower()
            if sk not in ("positive", "negative", "neutral"):
                sk = "neutral"
            bucket[sk] += int(count or 0)
            bucket["total"] += int(count or 0)

        trends: List[Dict[str, Any]] = []
        d = chart_start
        while d <= chart_end:
            key = d.isoformat()
            trends.append(
                trends_map.get(key)
                or {"date": key, "positive": 0, "negative": 0, "neutral": 0, "total": 0}
            )
            d += timedelta(days=1)

        # Top themes from insurance tags / category fallback.
        theme_counter: Counter = Counter()
        sample = (
            apply_feedback_report_filters(_scoped_feedback_base(db, user, perms), params)
            .with_entities(Feedback.channel_metadata, Feedback.tags, Feedback.category)
            .order_by(desc(Feedback.created_at), desc(Feedback.id))
            .limit(4000)
            .all()
        )
        for meta_raw, tags_raw, category in sample:
            meta = safe_json_loads(meta_raw) if meta_raw else {}
            if not isinstance(meta, dict):
                meta = {}
            tags = _insurance_tags(meta, tags_raw)
            if tags:
                theme_counter[_theme_label([tags[0]]) or tags[0]] += 1
            elif category:
                theme_counter[str(category).replace("_", " ").strip()] += 1

        themes = []
        for label, count in theme_counter.most_common(5):
            themes.append(
                {
                    "label": label,
                    "count": int(count),
                    "pct": _pct(int(count)),
                }
            )

        # Filter option lists (scoped, recent-ish).
        source_rows = (
            _scoped_feedback_base(db, user, perms)
            .with_entities(Feedback.source, func.count(Feedback.id))
            .group_by(Feedback.source)
            .order_by(desc(func.count(Feedback.id)))
            .limit(30)
            .all()
        )
        channels = []
        for src, count in source_rows:
            if not src:
                continue
            key = str(src).strip().lower()
            if key in ("api", "web"):
                continue
            channels.append(
                {
                    "value": str(src),
                    "label": _normalize_source_group(src) or str(src),
                    "count": int(count or 0),
                }
            )

        # Quick pack counts (independent of current builder filters except scope).
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = now - timedelta(days=now.weekday())  # Monday
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        today_iso = today_start.date().isoformat()
        week_params = {
            "date_from": week_start.date().isoformat(),
            "date_to": now.date().isoformat(),
        }
        today_params = {
            "date_from": today_iso,
            "date_to": today_iso,
        }
        month_params = {
            "date_from": month_start.date().isoformat(),
            "date_to": now.date().isoformat(),
        }
        all_params: Dict[str, Any] = {}

        quick = {
            "today": {"total": _count_with_params(db, user, perms, today_params)},
            "week": {"total": _count_with_params(db, user, perms, week_params)},
            "month": {"total": _count_with_params(db, user, perms, month_params)},
            "all": {"total": _count_with_params(db, user, perms, all_params)},
        }

        return jsonify(
            {
                "total": total,
                "sentiment": {
                    **sentiment,
                    "positive_pct": _pct(sentiment["positive"]),
                    "neutral_pct": _pct(sentiment["neutral"]),
                    "negative_pct": _pct(sentiment["negative"]),
                },
                "trends": trends,
                "themes": themes,
                "channels": channels,
                "quick": quick,
                "filters": {
                    "date_from": params.get("date_from"),
                    "date_to": params.get("date_to"),
                    "sentiment": params.get("sentiment") or "all",
                    "source": params.get("source") or "all",
                    "priority": params.get("priority") or "all",
                    "product_prefix": params.get("product_prefix") or "",
                    "product_group": params.get("product_group"),
                },
            }
        )
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    except Exception:
        logger.exception("Report preview failed")
        return jsonify({"error": "Failed to build report preview"}), 500
    finally:
        db.close()


@api_bp.route("/reports/custom.csv", methods=["GET"])
def report_custom_csv():
    db = SessionLocal()
    try:
        user, perms = _require_any_permission(
            db,
            ["reports.export", "reports.view_org", "admin.manage_users"],
        )
        if not _can_export_reports(perms):
            return jsonify({"error": "Missing permission: reports.export"}), 403

        params = dict(request.args)
        rows = _build_feedback_export_query(db, user, perms, params).all()

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            [
                "id",
                "source",
                "category",
                "sentiment_label",
                "sentiment_score",
                "priority",
                "rating",
                "customer_id",
                "created_at",
                "message",
                "tags",
            ]
        )
        for fb in rows:
            try:
                message = _plain_text_for_export(decrypt_text(fb.message_encrypted) or "")
            except Exception:
                message = ""
            writer.writerow(
                [
                    fb.id,
                    fb.source,
                    fb.category or "",
                    fb.sentiment_label or "",
                    fb.sentiment_score if fb.sentiment_score is not None else "",
                    fb.priority if fb.priority is not None else "",
                    fb.rating if fb.rating is not None else "",
                    fb.customer_id or "",
                    fb.created_at.isoformat() if fb.created_at else "",
                    message,
                    fb.tags or "",
                ]
            )

        filename = f"custom_report_{datetime.now(tz=timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
        _audit_log(
            db,
            actor_user_id=session.get("user_id"),
            action="reports.custom_export",
            target_type="report",
            target_id=None,
            meta={"row_count": len(rows), "filters": params},
        )
        return Response(
            buf.getvalue(),
            mimetype="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/reports/analyst-export", methods=["GET"])
@api_bp.route("/reports/analyst-export.csv", methods=["GET"])
@api_bp.route("/reports/analyst-export.xlsx", methods=["GET"])
@api_bp.route("/reports/analyst-export.pdf", methods=["GET"])
def report_analyst_export():
    """
    Analyst-friendly export: one row per feedback.

    Formats: csv (default), xlsx, pdf — via ?format= or URL extension.
    """
    db = SessionLocal()
    try:
        user = _require_user(db)
        perms = _user_permission_keys(db, user.id)
        params = dict(request.args)

        path = (request.path or "").lower()
        fmt = str(params.pop("format", None) or params.pop("fmt", None) or "").strip().lower()
        if not fmt:
            if path.endswith(".xlsx"):
                fmt = "xlsx"
            elif path.endswith(".pdf"):
                fmt = "pdf"
            else:
                fmt = "csv"

        payload, filename, mimetype = build_analyst_export(db, user, perms, params, fmt=fmt)
        _audit_log(
            db,
            actor_user_id=session.get("user_id"),
            action="reports.analyst_export",
            target_type="report",
            target_id=None,
            meta={"filters": params, "filename": filename, "format": fmt},
        )
        return Response(
            payload,
            mimetype=mimetype,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    except Exception:
        logger.exception("Analyst export failed")
        return jsonify({"error": "Failed to build analyst export"}), 500
    finally:
        db.close()
