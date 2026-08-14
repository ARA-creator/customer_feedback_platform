"""Deep Insights analytics: SLA, workforce, drivers, segments, quality, leadership."""

from __future__ import annotations

import math
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple

from sqlalchemy import and_, desc, exists, func, or_
from sqlalchemy.orm import Session

from ..models import Feedback, FeedbackPolicyMatch, ReleaseEvent
from ..security import decrypt_text
from ..services.analytics_time_window import parse_overview_time_window
from ..services.analyst_export import (
    _CLOSED_STATUSES,
    _assigned_to_label,
    _customer_segment,
    _hours_between,
    _insurance_tags,
    _load_assignees,
    _load_first_response_at,
    _load_workflows,
    _plain_text_for_export,
    _theme_label,
)
from ..services.metadata_normalization import safe_json_loads

_MAX_ROWS = 8000
_CHRONIC_MIN = 3
_QUOTE_CAP = 25
_TOP_N = 12
_KEYWORD_STOP = {
    "the",
    "and",
    "for",
    "that",
    "with",
    "this",
    "from",
    "have",
    "been",
    "were",
    "will",
    "your",
    "you",
    "are",
    "was",
    "not",
    "but",
    "they",
    "their",
    "our",
    "pls",
    "please",
    "email",
    "claim",
    "policy",
}


def _percentile(sorted_vals: Sequence[float], p: float) -> Optional[float]:
    if not sorted_vals:
        return None
    if len(sorted_vals) == 1:
        return round(float(sorted_vals[0]), 2)
    rank = (len(sorted_vals) - 1) * p
    lo = int(math.floor(rank))
    hi = int(math.ceil(rank))
    if lo == hi:
        return round(float(sorted_vals[lo]), 2)
    w = rank - lo
    return round(float(sorted_vals[lo]) * (1 - w) + float(sorted_vals[hi]) * w, 2)


def _hist_bins(values: Sequence[float], edges: Sequence[float]) -> List[Dict[str, Any]]:
    counts = [0] * (len(edges) + 1)
    for v in values:
        placed = False
        for i, edge in enumerate(edges):
            if v < edge:
                counts[i] += 1
                placed = True
                break
        if not placed:
            counts[-1] += 1
    labels = []
    prev = 0.0
    for edge in edges:
        labels.append(f"{prev:g}–{edge:g}h")
        prev = float(edge)
    labels.append(f"{prev:g}h+")
    return [{"bucket": labels[i], "count": counts[i]} for i in range(len(counts))]


def _week_key(dt: datetime) -> str:
    iso = dt.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def _quarter_key(dt: datetime) -> str:
    q = (dt.month - 1) // 3 + 1
    return f"{dt.year}-Q{q}"


def _month_key(dt: datetime) -> str:
    return f"{dt.year}-{dt.month:02d}"


def _ensure_aware(dt: Optional[datetime]) -> Optional[datetime]:
    if not dt:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _status_norm(raw: Optional[str]) -> str:
    s = str(raw or "open").strip().lower()
    return s or "open"


def _is_closed(status: str) -> bool:
    return status in _CLOSED_STATUSES


def _prior_window(
    filter_from: Optional[datetime],
    filter_to: Optional[datetime],
    now: datetime,
) -> Tuple[Optional[datetime], Optional[datetime]]:
    """Equal-length window immediately before the current filter."""
    end = filter_to or now
    if filter_from is None:
        # All-time: compare last 30d vs prior 30d
        cur_start = now - timedelta(days=30)
        return cur_start - timedelta(days=30), cur_start
    span = end - filter_from
    if span.total_seconds() <= 0:
        span = timedelta(days=7)
    return filter_from - span, filter_from


def _apply_product_filter(q, product_prefix: Optional[str], product_group: Optional[str]):
    pp = (product_prefix or "").strip()
    if not pp:
        return q
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
            conds.append(
                or_(FeedbackPolicyMatch.product_group.is_(None), FeedbackPolicyMatch.product_group == "")
            )
    return q.filter(exists().where(and_(*conds)))


def _breakdown_stats(
    items: List[Dict[str, Any]], key: str, *, top_n: int = _TOP_N
) -> List[Dict[str, Any]]:
    groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for it in items:
        groups[str(it.get(key) or "unassigned")].append(it)
    out = []
    for name, rows in groups.items():
        resp = sorted(r["response_hours"] for r in rows if r.get("response_hours") is not None)
        reso = sorted(r["resolution_hours"] for r in rows if r.get("resolution_hours") is not None)
        breached = sum(1 for r in rows if r.get("breached"))
        escalated = sum(1 for r in rows if r.get("escalated"))
        open_n = sum(1 for r in rows if not r.get("closed"))
        closed_n = sum(1 for r in rows if r.get("closed"))
        out.append(
            {
                "key": name,
                "count": len(rows),
                "open": open_n,
                "closed": closed_n,
                "breach_count": breached,
                "breach_rate": round(breached / max(1, len(rows)), 4),
                "escalation_count": escalated,
                "escalation_rate": round(escalated / max(1, len(rows)), 4),
                "response_p50": _percentile(resp, 0.5),
                "response_p90": _percentile(resp, 0.9),
                "resolution_p50": _percentile(reso, 0.5),
                "resolution_p90": _percentile(reso, 0.9),
                "avg_response_hours": round(sum(resp) / len(resp), 2) if resp else None,
                "avg_resolution_hours": round(sum(reso) / len(reso), 2) if reso else None,
            }
        )
    out.sort(key=lambda x: x["count"], reverse=True)
    return out[:top_n]


def build_insights_deep(
    db: Session,
    *,
    user,
    perms: set,
    time_window: str = "all",
    sentiment: str = "all",
    product_prefix: str = "",
    product_group: Optional[str] = None,
    compare: bool = True,
    scope_feedback_query,
) -> Dict[str, Any]:
    """
    Build the deep Insights payload for the selected window.

    ``product_group``: None = ignore; "" = NULL/empty group; non-empty = exact match.
    """
    now = datetime.now(tz=timezone.utc)
    tw, filter_from, filter_to, label, range_days = parse_overview_time_window(time_window, now=now)

    def _base_q(start: Optional[datetime], end: Optional[datetime]):
        q = db.query(Feedback).filter(Feedback.deleted_at.is_(None))
        q = q.filter(~func.lower(Feedback.source).in_(["api", "web"]))
        q = scope_feedback_query(db, q, user=user, perms=perms)
        if start is not None:
            q = q.filter(Feedback.created_at >= start)
        if end is not None:
            q = q.filter(Feedback.created_at < end)
        sent = (sentiment or "all").strip().lower()
        if sent in ("positive", "negative", "neutral"):
            q = q.filter(func.lower(Feedback.sentiment_label) == sent)
        q = _apply_product_filter(q, product_prefix, product_group)
        return q.order_by(desc(Feedback.created_at), desc(Feedback.id)).limit(_MAX_ROWS)

    rows = _base_q(filter_from, filter_to).all()
    items = _enrich_rows(db, rows, now=now)

    payload = _aggregate_modules(db, items, now=now, range_days=range_days, filter_from=filter_from)

    if compare:
        prior_from, prior_to = _prior_window(filter_from, filter_to, now)
        # For all-time, also restrict current side of benchmark to last 30d for fair PoP
        if filter_from is None:
            cur_items = [it for it in items if it["created_at"] and it["created_at"] >= (now - timedelta(days=30))]
        else:
            cur_items = items
        prior_rows = _base_q(prior_from, prior_to).all()
        prior_items = _enrich_rows(db, prior_rows, now=now)
        payload["benchmark"] = _build_benchmark(cur_items, prior_items)
        payload["benchmark"]["current_label"] = "Current window" if filter_from else "Last 30 days"
        payload["benchmark"]["prior_label"] = "Prior equal window"
    else:
        payload["benchmark"] = None

    payload["meta"] = {
        "time_window": tw,
        "time_window_label": label,
        "range_days_hint": range_days,
        "sentiment": (sentiment or "all").strip().lower() or "all",
        "product_prefix": (product_prefix or "").strip(),
        "row_count": len(items),
        "row_cap": _MAX_ROWS,
        "generated_at": now.isoformat(),
    }
    return payload


def _enrich_rows(db: Session, rows: List[Feedback], *, now: datetime) -> List[Dict[str, Any]]:
    feedback_ids = [int(r.id) for r in rows if r.id is not None]
    workflows = _load_workflows(db, feedback_ids)
    assignee_ids = [
        int(w.assigned_user_id) for w in workflows.values() if w.assigned_user_id is not None
    ]
    assignees = _load_assignees(db, assignee_ids)
    first_response_at = _load_first_response_at(db, feedback_ids)

    # Primary policy map
    policy_by_fb: Dict[int, FeedbackPolicyMatch] = {}
    if feedback_ids:
        for pm in (
            db.query(FeedbackPolicyMatch)
            .filter(
                FeedbackPolicyMatch.feedback_id.in_(feedback_ids),
                FeedbackPolicyMatch.is_primary.is_(True),
            )
            .all()
        ):
            policy_by_fb[int(pm.feedback_id)] = pm

    enriched: List[Dict[str, Any]] = []
    for fb in rows:
        fid = int(fb.id)
        meta = safe_json_loads(fb.channel_metadata) if fb.channel_metadata else {}
        if not isinstance(meta, dict):
            meta = {}
        tags = _insurance_tags(meta, fb.tags)
        theme = _theme_label(tags) or "untagged"
        primary_theme = theme.split(" | ")[0].strip() if theme else "untagged"
        sentiment = str(fb.sentiment_label or "neutral").strip().lower() or "neutral"
        if sentiment not in ("positive", "negative", "neutral"):
            sentiment = "neutral"
        created = _ensure_aware(fb.created_at)
        wf = workflows.get(fid)
        status = _status_norm(wf.status if wf else "open")
        closed = _is_closed(status)
        assignee = assignees.get(int(wf.assigned_user_id)) if wf and wf.assigned_user_id else None
        assignee_label = _assigned_to_label(assignee) or "Unassigned"
        team = str((wf.assigned_team if wf else None) or "").strip() or "Unassigned"

        response_at = first_response_at.get(fid)
        response_hours = _hours_between(created, response_at) if response_at else None
        resolution_hours = None
        if wf and closed:
            resolution_hours = _hours_between(created, _ensure_aware(wf.updated_at))

        sla_due = _ensure_aware(wf.sla_due_at) if wf else None
        breached = False
        if sla_due:
            if closed and wf and _ensure_aware(wf.updated_at) and _ensure_aware(wf.updated_at) > sla_due:
                breached = True
            elif not closed and now > sla_due:
                breached = True

        escalated = bool(wf and (wf.escalated_at or int(wf.escalation_level or 0) > 0))
        age_hours = _hours_between(created, now) if created and not closed else None

        signals = meta.get("sentiment_signals") if isinstance(meta.get("sentiment_signals"), dict) else {}
        review = meta.get("sentiment_review") if isinstance(meta.get("sentiment_review"), dict) else {}
        override = meta.get("sentiment_override") if isinstance(meta.get("sentiment_override"), dict) else None

        pm = policy_by_fb.get(fid)
        product = ""
        if pm:
            product = f"{pm.product_prefix}|{pm.product_group or ''}".strip("|")

        enriched.append(
            {
                "id": fid,
                "created_at": created,
                "channel": str(fb.source or "").strip().lower() or "unknown",
                "sentiment": sentiment,
                "sentiment_score": float(fb.sentiment_score) if fb.sentiment_score is not None else None,
                "rating": int(fb.rating) if isinstance(fb.rating, int) else None,
                "priority": int(fb.priority) if fb.priority is not None else None,
                "theme": primary_theme,
                "themes": [t.strip() for t in theme.split(" | ") if t.strip()] or ["untagged"],
                "segment": _customer_segment(meta) or "Unknown",
                "customer_id": str(fb.customer_id or "").strip() or None,
                "customer_key": str(meta.get("customer_key") or meta.get("sender_email") or fb.customer_id or "").strip()
                or None,
                "policy_hash": pm.policy_hash if pm else None,
                "policy_masked": pm.policy_masked if pm else None,
                "product": product or "unmapped",
                "product_prefix": (pm.product_prefix if pm else "") or "",
                "assignee": assignee_label,
                "assignee_user_id": int(wf.assigned_user_id) if wf and wf.assigned_user_id else None,
                "team": team,
                "status": status,
                "closed": closed,
                "response_hours": response_hours,
                "resolution_hours": resolution_hours,
                "response_at": _ensure_aware(response_at),
                "sla_due_at": sla_due,
                "breached": breached,
                "escalated": escalated,
                "age_hours": age_hours,
                "signals": signals,
                "review": review,
                "override": override,
                "threat": bool(signals.get("threat")),
                "sarcasm_clash": bool(signals.get("sarcasm_clash")),
                "has_override": bool(override),
                "review_pending": str(review.get("status") or "").lower() == "pending",
            }
        )
    return enriched


def _aggregate_modules(
    db: Session,
    items: List[Dict[str, Any]],
    *,
    now: datetime,
    range_days: int,
    filter_from: Optional[datetime],
) -> Dict[str, Any]:
    resp_vals = sorted(it["response_hours"] for it in items if it.get("response_hours") is not None)
    reso_vals = sorted(it["resolution_hours"] for it in items if it.get("resolution_hours") is not None)
    breached_n = sum(1 for it in items if it.get("breached"))
    escalated_n = sum(1 for it in items if it.get("escalated"))
    open_items = [it for it in items if not it.get("closed")]

    age_buckets = {"0-4h": 0, "4-24h": 0, "1-3d": 0, "3-7d": 0, "7d+": 0}
    for it in open_items:
        age = it.get("age_hours")
        if age is None:
            continue
        if age < 4:
            age_buckets["0-4h"] += 1
        elif age < 24:
            age_buckets["4-24h"] += 1
        elif age < 72:
            age_buckets["1-3d"] += 1
        elif age < 168:
            age_buckets["3-7d"] += 1
        else:
            age_buckets["7d+"] += 1

    edges = [1, 4, 8, 24, 48, 72]
    ops_sla = {
        "response": {
            "count": len(resp_vals),
            "p50": _percentile(resp_vals, 0.5),
            "p90": _percentile(resp_vals, 0.9),
            "avg": round(sum(resp_vals) / len(resp_vals), 2) if resp_vals else None,
            "histogram": _hist_bins(resp_vals, edges),
        },
        "resolution": {
            "count": len(reso_vals),
            "p50": _percentile(reso_vals, 0.5),
            "p90": _percentile(reso_vals, 0.9),
            "avg": round(sum(reso_vals) / len(reso_vals), 2) if reso_vals else None,
            "histogram": _hist_bins(reso_vals, edges),
        },
        "breach_rate": round(breached_n / max(1, len(items)), 4),
        "breach_count": breached_n,
        "backlog_aging": [{"bucket": k, "count": v} for k, v in age_buckets.items()],
        "open_count": len(open_items),
        "by_channel": _breakdown_stats(items, "channel"),
        "by_theme": _breakdown_stats(items, "theme"),
        "by_assignee": _breakdown_stats(items, "assignee"),
    }

    # Escalations over time + by theme/channel
    esc_by_day: Dict[str, Dict[str, int]] = defaultdict(lambda: {"total": 0, "escalated": 0})
    for it in items:
        if not it.get("created_at"):
            continue
        day = it["created_at"].date().isoformat()
        esc_by_day[day]["total"] += 1
        if it.get("escalated"):
            esc_by_day[day]["escalated"] += 1
    escalations = {
        "rate": round(escalated_n / max(1, len(items)), 4),
        "count": escalated_n,
        "over_time": [
            {
                "date": d,
                "total": v["total"],
                "escalated": v["escalated"],
                "rate": round(v["escalated"] / max(1, v["total"]), 4),
            }
            for d, v in sorted(esc_by_day.items())
        ],
        "by_theme": _breakdown_stats(items, "theme"),
        "by_channel": _breakdown_stats(items, "channel"),
    }

    # Workforce
    workforce_rows = _breakdown_stats(items, "assignee", top_n=25)
    team_rows = _breakdown_stats(items, "team", top_n=15)
    open_total = max(1, len(open_items))
    for row in workforce_rows:
        open_share = sum(
            1 for it in open_items if (it.get("assignee") or "Unassigned") == row["key"]
        )
        row["open_share"] = round(open_share / open_total, 4)
        row["workload_balance"] = row["open_share"]

    after_hours = [[0 for _ in range(24)] for _ in range(7)]
    for it in items:
        ra = it.get("response_at")
        if not ra:
            continue
        dow = ra.weekday()
        hour = ra.hour
        from .working_hours import is_working_slot

        if not is_working_slot(dow, hour):
            continue
        after_hours[dow][hour] += 1
    workforce = {
        "assignees": workforce_rows,
        "teams": team_rows,
        "response_heatmap": [
            {"dow": d, "hour": h, "count": after_hours[d][h]}
            for d in range(7)
            for h in range(24)
            if after_hours[d][h] > 0
        ],
    }

    # Releases list (impact computed lightly)
    releases = []
    try:
        for rel in db.query(ReleaseEvent).order_by(desc(ReleaseEvent.released_at)).limit(20).all():
            releases.append(
                {
                    "id": rel.id,
                    "title": rel.title,
                    "released_at": _ensure_aware(rel.released_at).isoformat() if rel.released_at else None,
                }
            )
    except Exception:
        releases = []

    impact = {
        "releases": releases,
        "note": "Pick a release in the UI; impact uses before/after windows around released_at.",
    }
    # Auto-compute impact for most recent release if present
    if releases:
        impact["latest"] = _release_impact_from_items(items, releases[0], window_days=7)

    # Repeats
    by_customer: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    by_policy: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for it in items:
        ck = it.get("customer_key") or it.get("customer_id")
        if ck:
            by_customer[str(ck)].append(it)
        if it.get("policy_hash"):
            by_policy[str(it["policy_hash"])].append(it)

    def _repeat_rows(groups: Dict[str, List[Dict[str, Any]]], *, kind: str) -> List[Dict[str, Any]]:
        rows_out = []
        for key, rows_g in groups.items():
            if len(rows_g) < 2:
                continue
            neg = sum(1 for r in rows_g if r.get("sentiment") == "negative")
            sample = rows_g[0]
            rows_out.append(
                {
                    "key": key,
                    "kind": kind,
                    "count": len(rows_g),
                    "chronic": len(rows_g) >= _CHRONIC_MIN,
                    "negative": neg,
                    "negative_share": round(neg / max(1, len(rows_g)), 4),
                    "label": sample.get("policy_masked") if kind == "policy" else key,
                    "feedback_ids": [r["id"] for r in rows_g[:8]],
                }
            )
        rows_out.sort(key=lambda x: x["count"], reverse=True)
        return rows_out[:20]

    repeats = {
        "customers": _repeat_rows(by_customer, kind="customer"),
        "policies": _repeat_rows(by_policy, kind="policy"),
        "chronic_threshold": _CHRONIC_MIN,
    }

    # Product × theme × sentiment
    product_lob_map: Dict[str, Dict[str, Dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: {"positive": 0, "neutral": 0, "negative": 0, "total": 0})
    )
    for it in items:
        cell = product_lob_map[it["product"]][it["theme"]]
        cell[it["sentiment"]] += 1
        cell["total"] += 1
    product_lob = []
    for prod, themes in product_lob_map.items():
        for theme, counts in themes.items():
            product_lob.append({"product": prod, "theme": theme, **counts})
    product_lob.sort(key=lambda x: x["total"], reverse=True)

    # Channel mix by quarter (or month if short)
    use_month = range_days <= 45 or (filter_from and (now - filter_from).days <= 45)
    mix_bucket: Dict[str, Counter] = defaultdict(Counter)
    for it in items:
        if not it.get("created_at"):
            continue
        bucket = _month_key(it["created_at"]) if use_month else _quarter_key(it["created_at"])
        mix_bucket[bucket][it["channel"]] += 1
    channel_mix = []
    for period in sorted(mix_bucket.keys()):
        total = sum(mix_bucket[period].values()) or 1
        row = {"period": period, "total": total}
        for ch, n in mix_bucket[period].most_common(8):
            row[ch] = n
            row[f"{ch}_share"] = round(n / total, 4)
        channel_mix.append(row)
    channel_keys = sorted({ch for c in mix_bucket.values() for ch, _ in c.most_common(8)})

    # Drivers: theme contribution to negatives
    theme_total = Counter(it["theme"] for it in items)
    theme_neg = Counter(it["theme"] for it in items if it["sentiment"] == "negative")
    total_n = max(1, len(items))
    total_neg = max(1, sum(theme_neg.values()))
    drivers = []
    for theme, neg_n in theme_neg.most_common(_TOP_N):
        share_all = theme_total[theme] / total_n
        share_neg = neg_n / total_neg
        lift = share_neg / share_all if share_all > 0 else 0
        drivers.append(
            {
                "theme": theme,
                "negative_count": neg_n,
                "total_count": theme_total[theme],
                "neg_share_of_negatives": round(share_neg, 4),
                "volume_share": round(share_all, 4),
                "lift": round(lift, 3),
            }
        )

    # Segments
    seg_stats = _breakdown_stats(items, "segment")
    segments_detail = []
    by_seg: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for it in items:
        by_seg[it["segment"]].append(it)
    for seg, rows_g in by_seg.items():
        themes = Counter(r["theme"] for r in rows_g).most_common(5)
        sent = Counter(r["sentiment"] for r in rows_g)
        segments_detail.append(
            {
                "segment": seg,
                "count": len(rows_g),
                "positive": sent.get("positive", 0),
                "neutral": sent.get("neutral", 0),
                "negative": sent.get("negative", 0),
                "top_themes": [{"theme": t, "count": c} for t, c in themes],
            }
        )
    segments_detail.sort(key=lambda x: x["count"], reverse=True)

    # Cross-tabs cube (bounded)
    cross_tabs = {
        "channel_theme": _cube(items, "channel", "theme"),
        "channel_status": _cube(items, "channel", "status"),
        "theme_week": _cube_week(items, "theme"),
        "assignee_status": _cube(items, "assignee", "status", top_a=10),
    }

    # Quality
    scores = [it["sentiment_score"] for it in items if it.get("sentiment_score") is not None]
    hist = [0] * 10
    for s in scores:
        # map [-1,1] → bin 0..9
        idx = min(9, max(0, int((float(s) + 1.0) / 2.0 * 10)))
        hist[idx] += 1
    score_histogram = [
        {"bin": f"{(-1 + i * 0.2):.1f}–{(-1 + (i + 1) * 0.2):.1f}", "count": hist[i]} for i in range(10)
    ]
    override_n = sum(1 for it in items if it.get("has_override"))
    review_n = sum(1 for it in items if it.get("review_pending"))
    threat_n = sum(1 for it in items if it.get("threat"))
    clash_n = sum(1 for it in items if it.get("sarcasm_clash"))
    quality = {
        "score_histogram": score_histogram,
        "override_rate": round(override_n / max(1, len(items)), 4),
        "override_count": override_n,
        "review_pending_rate": round(review_n / max(1, len(items)), 4),
        "review_pending_count": review_n,
        "threat_count": threat_n,
        "sarcasm_clash_count": clash_n,
        "override_samples": [
            {
                "id": it["id"],
                "sentiment": it["sentiment"],
                "previous": (it.get("override") or {}).get("previous_label"),
                "note": (it.get("override") or {}).get("note"),
            }
            for it in items
            if it.get("has_override")
        ][:15],
        "threat_samples": [{"id": it["id"], "theme": it["theme"], "channel": it["channel"]} for it in items if it.get("threat")][
            :15
        ],
    }

    # Verbatim: decrypt a sample for quotes + keywords (cap decrypts)
    verbatim = _build_verbatim(db, items)

    # CSAT from rating
    ratings = [it["rating"] for it in items if it.get("rating") is not None]
    rating_dist = Counter(ratings)
    csat_by_day: Dict[str, List[int]] = defaultdict(list)
    for it in items:
        if it.get("rating") is None or not it.get("created_at"):
            continue
        csat_by_day[it["created_at"].date().isoformat()].append(int(it["rating"]))
    csat = {
        "count": len(ratings),
        "avg": round(sum(ratings) / len(ratings), 2) if ratings else None,
        "distribution": [{"rating": k, "count": rating_dist[k]} for k in sorted(rating_dist.keys())],
        "trend": [
            {"date": d, "avg": round(sum(vs) / len(vs), 2), "count": len(vs)}
            for d, vs in sorted(csat_by_day.items())
        ],
        "by_channel": _rating_breakdown(items, "channel"),
        "by_theme": _rating_breakdown(items, "theme"),
    }

    # Capacity: volume by dow×hour × handle time (working hours only)
    from .working_hours import is_working_slot

    handle = ops_sla["response"]["avg"] or ops_sla["response"]["p50"] or 4.0
    vol_grid = [[0 for _ in range(24)] for _ in range(7)]
    for it in items:
        if not it.get("created_at"):
            continue
        created = it["created_at"]
        dow, hour = created.weekday(), created.hour
        if not is_working_slot(dow, hour):
            continue
        vol_grid[dow][hour] += 1
    peak_hour_vol = max(
        (vol_grid[d][h] for d in range(7) for h in range(24) if is_working_slot(d, h)),
        default=0,
    )
    # staffing hint: peak hourly arrivals * handle_hours (very rough FTE proxy / day)
    capacity = {
        "assumed_handle_hours": round(float(handle), 2),
        "peak_hourly_volume": peak_hour_vol,
        "staffing_hint_fte": round((peak_hour_vol * float(handle)) / 8.0, 2) if handle else None,
        "volume_heatmap": [
            {"dow": d, "hour": h, "count": vol_grid[d][h]}
            for d in range(7)
            for h in range(24)
            if vol_grid[d][h] > 0
        ],
        "note": "Staffing hint = peak hourly volume × avg handle hours / 8. Directional only.",
    }

    return {
        "ops_sla": ops_sla,
        "escalations": escalations,
        "workforce": workforce,
        "impact": impact,
        "repeats": repeats,
        "product_lob": product_lob[:200],
        "channel_mix": {"periods": channel_mix, "channels": channel_keys, "granularity": "month" if use_month else "quarter"},
        "drivers": drivers,
        "segments": {"summary": seg_stats, "detail": segments_detail[:15]},
        "cross_tabs": cross_tabs,
        "quality": quality,
        "verbatim": verbatim,
        "csat": csat,
        "capacity": capacity,
    }


def _cube(
    items: List[Dict[str, Any]], a: str, b: str, *, top_a: int = 8, top_b: int = 8
) -> List[Dict[str, Any]]:
    top_as = [k for k, _ in Counter(it.get(a) or "unknown" for it in items).most_common(top_a)]
    top_bs = [k for k, _ in Counter(it.get(b) or "unknown" for it in items).most_common(top_b)]
    counts: Dict[Tuple[str, str], int] = defaultdict(int)
    for it in items:
        av = it.get(a) or "unknown"
        bv = it.get(b) or "unknown"
        if av not in top_as or bv not in top_bs:
            continue
        counts[(av, bv)] += 1
    return [{"a": av, "b": bv, "count": n} for (av, bv), n in counts.items()]


def _cube_week(items: List[Dict[str, Any]], dim: str, *, top_n: int = 8) -> List[Dict[str, Any]]:
    top = [k for k, _ in Counter(it.get(dim) or "unknown" for it in items).most_common(top_n)]
    counts: Dict[Tuple[str, str], int] = defaultdict(int)
    for it in items:
        if not it.get("created_at"):
            continue
        av = it.get(dim) or "unknown"
        if av not in top:
            continue
        wk = _week_key(it["created_at"])
        counts[(av, wk)] += 1
    return [{"a": av, "b": wk, "count": n} for (av, wk), n in counts.items()]


def _rating_breakdown(items: List[Dict[str, Any]], key: str) -> List[Dict[str, Any]]:
    groups: Dict[str, List[int]] = defaultdict(list)
    for it in items:
        if it.get("rating") is None:
            continue
        groups[str(it.get(key) or "unknown")].append(int(it["rating"]))
    out = [
        {"key": k, "count": len(vs), "avg": round(sum(vs) / len(vs), 2)}
        for k, vs in groups.items()
    ]
    out.sort(key=lambda x: x["count"], reverse=True)
    return out[:_TOP_N]


def _release_impact_from_items(
    items: List[Dict[str, Any]], release: Dict[str, Any], *, window_days: int = 7
) -> Dict[str, Any]:
    released_raw = release.get("released_at")
    if not released_raw:
        return {"error": "no released_at"}
    try:
        released_at = datetime.fromisoformat(str(released_raw).replace("Z", "+00:00"))
    except Exception:
        return {"error": "bad released_at"}
    released_at = _ensure_aware(released_at)
    assert released_at is not None
    before_start = released_at - timedelta(days=window_days)
    after_end = released_at + timedelta(days=window_days)

    def block(start: datetime, end: datetime) -> Dict[str, int]:
        b = {"total": 0, "positive": 0, "neutral": 0, "negative": 0}
        for it in items:
            t = it.get("created_at")
            if not t or not (start <= t < end):
                continue
            b["total"] += 1
            b[it["sentiment"]] += 1
        return b

    before = block(before_start, released_at)
    after = block(released_at, after_end)
    return {
        "release_id": release.get("id"),
        "title": release.get("title"),
        "window_days": window_days,
        "before": {**before, "negative_share": round(before["negative"] / max(1, before["total"]), 4)},
        "after": {**after, "negative_share": round(after["negative"] / max(1, after["total"]), 4)},
    }


def _build_verbatim(db: Session, items: List[Dict[str, Any]]) -> Dict[str, Any]:
    # Prefer negatives / threats for quote bank
    ranked = sorted(
        items,
        key=lambda it: (
            0 if it.get("threat") else 1,
            0 if it.get("sentiment") == "negative" else 1,
            -(it.get("priority") or 0),
        ),
    )[:40]
    quotes = []
    word_counts: Counter = Counter()
    for it in ranked:
        fb = db.query(Feedback).filter(Feedback.id == it["id"]).first()
        if not fb:
            continue
        try:
            text = _plain_text_for_export(decrypt_text(fb.message_encrypted) or "", max_len=400)
        except Exception:
            text = ""
        if not text:
            continue
        quotes.append(
            {
                "id": it["id"],
                "sentiment": it["sentiment"],
                "theme": it["theme"],
                "channel": it["channel"],
                "text": text,
                "threat": it.get("threat"),
            }
        )
        for tok in re.findall(r"[a-zA-Z]{4,}", text.lower()):
            if tok in _KEYWORD_STOP:
                continue
            word_counts[tok] += 1
        if len(quotes) >= _QUOTE_CAP:
            break
    return {
        "quotes": quotes,
        "keywords": [{"word": w, "count": c} for w, c in word_counts.most_common(25)],
    }


def _kpi_block(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    n = len(items)
    neg = sum(1 for it in items if it["sentiment"] == "negative")
    resp = sorted(it["response_hours"] for it in items if it.get("response_hours") is not None)
    breached = sum(1 for it in items if it.get("breached"))
    escalated = sum(1 for it in items if it.get("escalated"))
    return {
        "volume": n,
        "negative_share": round(neg / max(1, n), 4),
        "response_p50": _percentile(resp, 0.5),
        "breach_rate": round(breached / max(1, n), 4),
        "escalation_rate": round(escalated / max(1, n), 4),
    }


def _build_benchmark(current: List[Dict[str, Any]], prior: List[Dict[str, Any]]) -> Dict[str, Any]:
    cur = _kpi_block(current)
    prev = _kpi_block(prior)

    def delta(a, b):
        if a is None or b is None:
            return None
        return round(float(a) - float(b), 4)

    return {
        "current": cur,
        "prior": prev,
        "deltas": {
            "volume": delta(cur["volume"], prev["volume"]),
            "negative_share": delta(cur["negative_share"], prev["negative_share"]),
            "response_p50": delta(cur["response_p50"], prev["response_p50"]),
            "breach_rate": delta(cur["breach_rate"], prev["breach_rate"]),
            "escalation_rate": delta(cur["escalation_rate"], prev["escalation_rate"]),
        },
    }


def compute_release_impact_scoped(
    db: Session,
    *,
    user,
    perms: set,
    release_id: int,
    window_days: int = 7,
    scope_feedback_query,
) -> Dict[str, Any]:
    """Reports-scoped release impact for Insights UI."""
    rel = db.query(ReleaseEvent).filter(ReleaseEvent.id == int(release_id)).first()
    if not rel:
        return {"error": "release not found"}
    released_at = _ensure_aware(rel.released_at)
    assert released_at is not None
    window_days = max(1, min(int(window_days or 7), 30))
    before_start = released_at - timedelta(days=window_days)
    after_end = released_at + timedelta(days=window_days)

    q = db.query(Feedback).filter(Feedback.deleted_at.is_(None))
    q = q.filter(~func.lower(Feedback.source).in_(["api", "web"]))
    q = scope_feedback_query(db, q, user=user, perms=perms)
    q = q.filter(Feedback.created_at >= before_start, Feedback.created_at < after_end)
    rows = q.limit(_MAX_ROWS).all()
    items = _enrich_rows(db, rows, now=datetime.now(tz=timezone.utc))
    release = {
        "id": rel.id,
        "title": rel.title,
        "released_at": released_at.isoformat(),
    }
    return _release_impact_from_items(items, release, window_days=window_days)
