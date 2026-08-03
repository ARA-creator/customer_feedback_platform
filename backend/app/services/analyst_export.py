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
    "feedback_text",
    "assigned_to",
    "status",
    "response_time_hours",
    "resolution_time_hours",
    "escalation_flag",
]

_CLOSED_STATUSES = {"closed", "resolved"}


def _plain_text_for_export(text: str, *, max_len: int = 8000) -> str:
    """Turn HTML email bodies into readable plain text for CSV cells."""
    from ..services.html_text import normalize_message_text

    plain = normalize_message_text(text or "")
    if max_len and len(plain) > max_len:
        return plain[:max_len].rstrip() + "…"
    return plain


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


def apply_feedback_report_filters(q, params: Dict[str, Any]):
    """Apply shared report/export filters (no ordering/limit)."""
    from sqlalchemy import and_, exists, or_

    from ..models import FeedbackPolicyMatch
    from ..routes.api._helpers import _parse_dt

    sentiment = str(params.get("sentiment") or "all").strip().lower()
    if sentiment and sentiment != "all":
        q = q.filter(Feedback.sentiment_label.ilike(sentiment))

    # Theme = insurance tags (legacy `category` query param accepted as an alias).
    theme = str(params.get("theme") or params.get("category") or "all").strip().lower()
    if theme and theme != "all":
        # Match tag keys in channel_metadata JSON (e.g. "claims") or humanized labels.
        needle = theme.replace(" ", "_")
        q = q.filter(Feedback.channel_metadata.ilike(f"%{needle}%"))

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
        parsed_from = _parse_dt(str(date_from))
        if parsed_from:
            q = q.filter(Feedback.created_at >= parsed_from)
    if date_to:
        parsed_to = _parse_dt(str(date_to))
        if parsed_to:
            end = parsed_to.replace(hour=23, minute=59, second=59, microsecond=999999)
            q = q.filter(Feedback.created_at <= end)

    # Product filter via primary policy match (same semantics as /analytics).
    pf_prefix = str(params.get("product_prefix") or "").strip()
    if pf_prefix:
        conds = [
            FeedbackPolicyMatch.feedback_id == Feedback.id,
            FeedbackPolicyMatch.is_primary.is_(True),
            FeedbackPolicyMatch.product_prefix == pf_prefix,
        ]
        if "product_group" in params:
            pgs = str(params.get("product_group") or "").strip()
            if pgs:
                conds.append(FeedbackPolicyMatch.product_group == pgs)
            else:
                conds.append(
                    or_(FeedbackPolicyMatch.product_group.is_(None), FeedbackPolicyMatch.product_group == "")
                )
        q = q.filter(exists().where(and_(*conds)))

    return q


def build_feedback_export_query(
    db: Session, user, perms: set[str], params: Dict[str, Any], *, apply_limit: bool = True
):
    from ..routes.api._helpers import _scope_feedback_query

    q = db.query(Feedback).filter(Feedback.deleted_at.is_(None))
    q = _scope_feedback_query(db, q, user=user, perms=perms)
    q = apply_feedback_report_filters(q, params)
    q = q.order_by(desc(Feedback.created_at), desc(Feedback.id))
    if not apply_limit:
        return q
    limit = min(max(int(params.get("limit") or 5000), 1), 10000)
    return q.limit(limit)


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


def build_analyst_export(
    db: Session, user, perms: set[str], params: Dict[str, Any], *, fmt: str = "csv"
) -> Tuple[bytes, str, str]:
    """
    Build an analyst export in csv, xlsx, or pdf.

    Returns (payload_bytes, filename, mimetype).
    """
    fmt_norm = str(fmt or "csv").strip().lower()
    if fmt_norm in ("excel", "xls", "xlsx"):
        fmt_norm = "xlsx"
    elif fmt_norm not in ("csv", "pdf"):
        fmt_norm = "csv"

    rows, _summaries = _collect_feedback_export_rows(db, user, perms, params)
    stamp = datetime.now(tz=timezone.utc).strftime("%Y%m%d_%H%M%S")

    if fmt_norm == "csv":
        text = _write_csv(FEEDBACK_RECORD_COLUMNS, rows)
        return text.encode("utf-8"), f"feedback_export_{stamp}.csv", "text/csv; charset=utf-8"

    if fmt_norm == "xlsx":
        payload = _rows_to_xlsx_bytes(FEEDBACK_RECORD_COLUMNS, rows)
        return (
            payload,
            f"feedback_export_{stamp}.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

    payload = _rows_to_pdf_bytes(
        title="Customer Pulse — Feedback Export",
        headers=FEEDBACK_RECORD_COLUMNS,
        rows=rows,
    )
    return payload, f"feedback_export_{stamp}.pdf", "application/pdf"


def _xml_escape(value: Any) -> str:
    s = "" if value is None else str(value)
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _rows_to_xlsx_bytes(headers: List[str], rows: Iterable[List[Any]]) -> bytes:
    """Build a minimal XLSX workbook with the stdlib (no openpyxl)."""
    import zipfile

    def col_name(idx: int) -> str:
        # 1-based Excel column letters
        n = idx
        out = ""
        while n:
            n, rem = divmod(n - 1, 26)
            out = chr(65 + rem) + out
        return out

    sheet_rows = []
    all_rows = [list(headers)] + [list(r) for r in rows]
    for r_i, row in enumerate(all_rows, start=1):
        cells = []
        for c_i, val in enumerate(row, start=1):
            text = _xml_escape(_csv_cell(val))
            ref = f"{col_name(c_i)}{r_i}"
            cells.append(
                f'<c r="{ref}" t="inlineStr"><is><t xml:space="preserve">{text}</t></is></c>'
            )
        sheet_rows.append(f'<row r="{r_i}">{"".join(cells)}</row>')

    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(sheet_rows)}</sheetData></worksheet>'
    )
    workbook_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="Feedback" sheetId="1" r:id="rId1"/></sheets></workbook>'
    )
    rels_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/></Relationships>'
    )
    wb_rels_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
        'Target="worksheets/sheet1.xml"/></Relationships>'
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        "</Types>"
    )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels_xml)
        zf.writestr("xl/workbook.xml", workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", wb_rels_xml)
        zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)
    return buf.getvalue()


def _pdf_escape(text: str) -> str:
    return (
        str(text or "")
        .replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
        .replace("\r", " ")
        .replace("\n", " ")
    )


def _rows_to_pdf_bytes(*, title: str, headers: List[str], rows: List[List[Any]]) -> bytes:
    """
    Minimal multi-page PDF (Helvetica). Long cells are truncated so the file stays usable.
    """
    page_w, page_h = 842, 595  # landscape A4 points
    margin = 36
    line_h = 12
    font_size = 8
    max_rows_per_page = int((page_h - margin * 2 - 40) / line_h)

    # Column widths proportional to header length, capped for landscape.
    usable = page_w - margin * 2
    weights = [max(4, len(h)) for h in headers]
    weight_sum = sum(weights) or 1
    col_widths = [max(28, int(usable * (w / weight_sum))) for w in weights]
    # Normalize if overflow
    total_w = sum(col_widths)
    if total_w > usable:
        scale = usable / total_w
        col_widths = [max(24, int(w * scale)) for w in col_widths]

    def fit(text: Any, width_pt: int) -> str:
        s = _csv_cell(text).replace("\n", " ").strip()
        max_chars = max(4, int(width_pt / 4.2))
        if len(s) <= max_chars:
            return s
        return s[: max_chars - 1] + "…"

    pages: List[List[List[str]]] = []
    header_line = [fit(h, col_widths[i]) for i, h in enumerate(headers)]
    current: List[List[str]] = [header_line]
    for row in rows:
        line = [fit(row[i] if i < len(row) else "", col_widths[i]) for i in range(len(headers))]
        if len(current) >= max_rows_per_page:
            pages.append(current)
            current = [header_line, line]
        else:
            current.append(line)
    if current:
        pages.append(current)

    out = io.BytesIO()
    objects: List[bytes] = []

    def add_obj(data: bytes) -> int:
        objects.append(data)
        return len(objects)

    # Font object
    font_id = add_obj(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    page_ids: List[int] = []
    content_ids: List[int] = []
    for page_idx, page_rows in enumerate(pages):
        y = page_h - margin - 18
        parts = [
            "BT",
            f"/F1 {font_size + 2} Tf",
            f"1 0 0 1 {margin} {y} Tm",
            f"({_pdf_escape(title)} — page {page_idx + 1}/{len(pages)}) Tj",
            "ET",
        ]
        y -= 22
        for r_i, row in enumerate(page_rows):
            x = margin
            parts.append("BT")
            parts.append(f"/F1 {font_size} Tf")
            for c_i, cell in enumerate(row):
                parts.append(f"1 0 0 1 {x} {y} Tm")
                # Bold-ish header by drawing twice slightly offset
                if r_i == 0:
                    parts.append(f"({_pdf_escape(cell)}) Tj")
                else:
                    parts.append(f"({_pdf_escape(cell)}) Tj")
                x += col_widths[c_i]
            parts.append("ET")
            y -= line_h

        stream = "\n".join(parts).encode("latin-1", errors="replace")
        content_id = add_obj(
            b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream"
        )
        content_ids.append(content_id)
        page_id = add_obj(
            (
                f"<< /Type /Page /Parent 0 0 R /MediaBox [0 0 {page_w} {page_h}] "
                f"/Resources << /Font << /F1 {font_id} 0 R >> >> "
                f"/Contents {content_id} 0 R >>"
            ).encode("ascii")
        )
        page_ids.append(page_id)

    kids = " ".join(f"{pid} 0 R" for pid in page_ids)
    pages_id = add_obj(f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode("ascii"))
    # Patch parent refs in page objects
    for i, pid in enumerate(page_ids):
        objects[pid - 1] = (
            f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 {page_w} {page_h}] "
            f"/Resources << /Font << /F1 {font_id} 0 R >> >> "
            f"/Contents {content_ids[i]} 0 R >>"
        ).encode("ascii")

    catalog_id = add_obj(f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode("ascii"))

    out.write(b"%PDF-1.4\n")
    offsets = [0]
    for i, obj in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(f"{i} 0 obj\n".encode("ascii"))
        out.write(obj)
        out.write(b"\nendobj\n")
    xref_pos = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    out.write(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.write(f"{off:010d} 00000 n \n".encode("ascii"))
    out.write(
        f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF\n".encode("ascii")
    )
    return out.getvalue()


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
    theme_counts: Counter[str] = Counter()
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
            message = _plain_text_for_export(decrypt_text(fb.message_encrypted) or "")
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

        tags = _insurance_tags(meta, fb.tags)
        theme_label = _theme_label(tags)
        if theme_label:
            for part in theme_label.split(" | "):
                key = part.strip()
                if key:
                    theme_counts[key] += 1
        else:
            theme_counts["untagged"] += 1

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

        record_rows.append(
            [
                fb.id,
                date_key,
                str(fb.source or "").strip().lower(),
                _customer_segment(meta),
                sentiment,
                fb.priority if fb.priority is not None else "",
                theme_label,
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

    theme_total = sum(theme_counts.values()) or 1
    theme_summary = _write_csv(
        ["theme", "count", "percentage"],
        [
            [theme, count, round((count / theme_total) * 100, 1)]
            for theme, count in sorted(theme_counts.items(), key=lambda x: (-x[1], x[0]))
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
        "theme_summary.csv": theme_summary,
        "daily_trends.csv": daily_trends,
    }
    return record_rows, summaries


def build_analyst_export_zip(db: Session, user, perms: set[str], params: Dict[str, Any]) -> Tuple[bytes, str]:
    """Deprecated: use build_analyst_export_csv."""
    csv_text, filename = build_analyst_export_csv(db, user, perms, params)
    return csv_text.encode("utf-8"), filename
