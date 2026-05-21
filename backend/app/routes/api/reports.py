"""
Report export and scheduled report configuration.
"""

from __future__ import annotations

import csv
import io
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from flask import Response, jsonify, request, session
from sqlalchemy import desc, func

from ...database import SessionLocal
from ...models import Feedback, ReportSchedule
from ...security import decrypt_text
from ...services.metadata_normalization import safe_json_loads
from . import api_bp
from ._helpers import (
    _audit_log,
    _parse_dt,
    _require_any_permission,
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
    q = db.query(Feedback).filter(Feedback.deleted_at.is_(None))
    q = _scope_feedback_query(db, q, user=user, perms=perms)

    sentiment = str(params.get("sentiment") or "all").strip().lower()
    if sentiment and sentiment != "all":
        q = q.filter(func.lower(Feedback.sentiment_label) == sentiment)

    category = str(params.get("category") or "all").strip().lower()
    if category and category != "all":
        q = q.filter(func.lower(Feedback.category) == category)

    source = str(params.get("source") or "all").strip().lower()
    if source and source != "all":
        q = q.filter(func.lower(Feedback.source) == source)

    priority = str(params.get("priority") or "all").strip().lower()
    if priority == "high":
        q = q.filter(Feedback.priority >= 80)

    date_from = _parse_dt(params.get("date_from"))
    date_to = _parse_dt(params.get("date_to"))
    if date_from:
        q = q.filter(Feedback.created_at >= date_from)
    if date_to:
        end = date_to.replace(hour=23, minute=59, second=59, microsecond=999999)
        q = q.filter(Feedback.created_at <= end)

    limit = min(max(int(params.get("limit") or 2000), 1), 5000)
    return q.order_by(desc(Feedback.created_at), desc(Feedback.id)).limit(limit)


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


@api_bp.route("/reports/schedules/<int:schedule_id>", methods=["DELETE"])
def report_schedule_delete(schedule_id: int):
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
        db.delete(row)
        db.commit()
        return jsonify({"ok": True})
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
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
                message = decrypt_text(fb.message_encrypted) or ""
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
