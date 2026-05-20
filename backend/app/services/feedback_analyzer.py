"""AI-powered feedback analysis for the overview dashboard time window."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import desc, func

from ..config import get_config
from ..models import Feedback, User
from ..security import decrypt_text
from ..services.analytics_time_window import parse_overview_time_window
from ..services.metadata_normalization import normalize_channel_metadata
from ..services.prioritization import normalize_source_group

logger = logging.getLogger(__name__)

MAX_SAMPLES = 20
MAX_MSG_CHARS = 320
EXCLUDED_SOURCES = ["api", "web"]


def _apply_time_filter(q, filter_from: Optional[datetime], filter_to: Optional[datetime]):
    if filter_from is not None:
        q = q.filter(Feedback.created_at >= filter_from)
    if filter_to is not None:
        q = q.filter(Feedback.created_at < filter_to)
    return q


def _truncate(text: str, limit: int = MAX_MSG_CHARS) -> str:
    s = (text or "").strip().replace("\r\n", "\n")
    if len(s) <= limit:
        return s
    return s[: limit - 1].rstrip() + "…"


def gather_analyzer_context(
    db,
    *,
    user: User,
    perms: set[str],
    time_window: str,
    scope_feedback_query,
) -> Dict[str, Any]:
    now = datetime.now(tz=timezone.utc)
    tw, filter_from, filter_to, label, range_days = parse_overview_time_window(time_window, now=now)

    if tw == "all":
        start_range = now - timedelta(days=range_days)
    else:
        start_range = filter_from or (now - timedelta(days=range_days))

    base = (
        db.query(Feedback)
        .filter(Feedback.deleted_at.is_(None))
        .filter(~func.lower(Feedback.source).in_(EXCLUDED_SOURCES))
    )
    base = scope_feedback_query(db, base, user=user, perms=perms)
    scoped = _apply_time_filter(base, filter_from, filter_to)

    total = scoped.count() or 0

    sentiment_rows = (
        scoped.with_entities(Feedback.sentiment_label, func.count(Feedback.id))
        .group_by(Feedback.sentiment_label)
        .all()
    )
    sentiment = {str(lbl or "unknown"): int(cnt or 0) for lbl, cnt in sentiment_rows}

    category_rows = (
        scoped.filter(Feedback.category.isnot(None))
        .with_entities(Feedback.category, func.count(Feedback.id))
        .group_by(Feedback.category)
        .order_by(desc(func.count(Feedback.id)))
        .limit(8)
        .all()
    )
    top_categories = [{"category": cat or "uncategorized", "count": int(cnt or 0)} for cat, cnt in category_rows]

    source_rows = (
        scoped.with_entities(Feedback.source, func.count(Feedback.id))
        .group_by(Feedback.source)
        .order_by(desc(func.count(Feedback.id)))
        .limit(8)
        .all()
    )
    top_sources = [
        {"source": normalize_source_group(src) or (src or "unknown"), "count": int(cnt or 0)}
        for src, cnt in source_rows
    ]

    high_priority = (
        scoped.filter(Feedback.priority.isnot(None)).filter(Feedback.priority >= 100).count() or 0
    )

    theme_counts: Dict[str, int] = {}
    meta_rows = (
        scoped.with_entities(Feedback.sentiment_label, Feedback.channel_metadata)
        .order_by(desc(Feedback.created_at))
        .limit(5000)
        .all()
    )
    for _label, channel_meta in meta_rows:
        meta = normalize_channel_metadata(None, channel_meta) or {}
        tags = meta.get("insurance_tags")
        if not isinstance(tags, list) or not tags:
            key = "unclassified"
        else:
            valid = [str(t or "").strip().lower() for t in tags if str(t or "").strip()]
            key = valid[0] if valid else "unclassified"
        theme_counts[key] = theme_counts.get(key, 0) + 1
    top_themes = sorted(
        [{"theme": k.replace("_", " "), "count": v} for k, v in theme_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:8]

    sample_rows = (
        scoped.order_by(desc(Feedback.priority), desc(Feedback.created_at)).limit(MAX_SAMPLES).all()
    )
    samples: List[Dict[str, Any]] = []
    for row in sample_rows:
        try:
            msg = decrypt_text(row.message_encrypted)
        except Exception:
            msg = ""
        meta = normalize_channel_metadata(row.source, row.channel_metadata) or {}
        tags = meta.get("insurance_tags") if isinstance(meta.get("insurance_tags"), list) else []
        samples.append(
            {
                "id": row.id,
                "source": normalize_source_group(row.source) or row.source,
                "sentiment": row.sentiment_label,
                "category": row.category,
                "priority": row.priority,
                "themes": [str(t).replace("_", " ") for t in tags[:3]] if tags else [],
                "excerpt": _truncate(msg),
            }
        )

    return {
        "time_window": tw,
        "time_window_label": label,
        "range_days": range_days,
        "metrics": {
            "total_feedback": total,
            "positive": sentiment.get("positive", 0),
            "negative": sentiment.get("negative", 0),
            "neutral": sentiment.get("neutral", 0),
            "high_priority": high_priority,
        },
        "sentiment": sentiment,
        "top_categories": top_categories,
        "top_sources": top_sources,
        "top_themes": top_themes,
        "sample_feedback": samples,
        "period_start": (filter_from or start_range).isoformat() if (filter_from or start_range) else None,
        "period_end": (filter_to or now).isoformat(),
    }


def _fallback_analysis(context: Dict[str, Any]) -> Dict[str, Any]:
    m = context.get("metrics") or {}
    total = int(m.get("total_feedback") or 0)
    pos = int(m.get("positive") or 0)
    neg = int(m.get("negative") or 0)
    neu = int(m.get("neutral") or 0)
    hp = int(m.get("high_priority") or 0)
    label = context.get("time_window_label") or "the selected period"

    if total == 0:
        return {
            "summary": f"No feedback was recorded for {label}. Try widening the time filter or check ingestion.",
            "key_themes": [],
            "sentiment_insights": "Insufficient data to assess sentiment.",
            "risks": [],
            "recommendations": [
                "Confirm channels are connected and polling is enabled.",
                "Review the inbox for items outside this date window.",
            ],
        }

    neg_pct = round((neg / total) * 100) if total else 0
    themes = [t.get("theme") for t in (context.get("top_themes") or [])[:5] if t.get("theme")]
    sources = [s.get("source") for s in (context.get("top_sources") or [])[:3] if s.get("source")]

    summary = (
        f"Across {total} feedback items for {label}, "
        f"{pos} positive, {neu} neutral, and {neg} negative ({neg_pct}% negative). "
    )
    if hp:
        summary += f"{hp} items are flagged high priority. "
    if themes:
        summary += f"Most discussed themes: {', '.join(themes)}."

    risks = []
    if neg_pct >= 40:
        risks.append("Negative sentiment exceeds 40% of volume—monitor for recurring complaints.")
    if hp >= max(3, total // 10):
        risks.append("Elevated high-priority queue—response SLAs may be at risk.")

    recs = [
        "Drill into negative items in the inbox and assign owners.",
        "Compare theme volume week-over-week to spot emerging issues.",
    ]
    if sources:
        recs.append(f"Focus on top channels: {', '.join(sources)}.")

    return {
        "summary": summary.strip(),
        "key_themes": themes,
        "sentiment_insights": (
            f"Negative share is {neg_pct}%. "
            + ("Sentiment skews concerning—prioritize recovery on top themes." if neg_pct >= 35 else "Sentiment mix is manageable; sustain positive momentum.")
        ),
        "risks": risks,
        "recommendations": recs,
    }


def _gemini_credentials() -> tuple[str, str]:
    """Read Gemini settings at call time so .env changes apply without stale class attrs."""
    cfg = get_config()
    api_key = (os.getenv("GEMINI_API_KEY") or getattr(cfg, "GEMINI_API_KEY", "") or "").strip()
    model = (os.getenv("GEMINI_MODEL") or getattr(cfg, "GEMINI_MODEL", "gemini-1.5-flash") or "gemini-1.5-flash").strip()
    return api_key, model


def _analyze_with_gemini(context: Dict[str, Any]) -> Dict[str, Any]:
    try:
        from .gemini_client import genai_generate_json, gemini_sdk_available, normalize_model_name
    except Exception as exc:
        logger.exception("Gemini client unavailable; using rule-based analyzer")
        parsed = _fallback_analysis(context)
        return {**parsed, "ai_generated": False, "model_name": "rule-based", "gemini_error": str(exc)[:200]}

    if not gemini_sdk_available():
        from .gemini_client import gemini_sdk_error

        err = (gemini_sdk_error() or "google-genai not installed")[:200]
        logger.warning("Gemini SDK missing (%s); using rule-based analyzer", err)
        parsed = _fallback_analysis(context)
        return {**parsed, "ai_generated": False, "model_name": "rule-based", "gemini_error": err}

    api_key, model = _gemini_credentials()

    if not api_key:
        logger.warning("GEMINI_API_KEY is empty; using rule-based analyzer")
        parsed = _fallback_analysis(context)
        return {**parsed, "ai_generated": False, "model_name": "rule-based", "gemini_error": "missing_api_key"}

    prompt = f"""
You are a customer experience analyst for an insurance / financial services feedback platform (Enterprise Life).

Analyze the aggregated feedback dataset below for the stated time window.
Write for operations and CX leaders: concise, actionable, grounded only in the data provided.
Do not invent statistics or quotes not supported by the payload.

Return JSON only with keys:
- summary (2-4 sentences)
- key_themes (array of up to 6 short strings)
- sentiment_insights (1-3 sentences on positive/negative/neutral mix)
- risks (array of up to 4 bullet strings; empty if none)
- recommendations (array of up to 5 actionable bullet strings)

Dataset:
{json.dumps(context, ensure_ascii=False)}
""".strip()

    try:
        parsed = genai_generate_json(api_key=api_key, model=model, prompt=prompt, temperature=0.35)
        out = {
            "summary": (parsed.get("summary") or "").strip(),
            "key_themes": [str(x).strip() for x in (parsed.get("key_themes") or []) if str(x).strip()][:6],
            "sentiment_insights": (parsed.get("sentiment_insights") or "").strip(),
            "risks": [str(x).strip() for x in (parsed.get("risks") or []) if str(x).strip()][:4],
            "recommendations": [str(x).strip() for x in (parsed.get("recommendations") or []) if str(x).strip()][:5],
        }
        if not out["summary"]:
            raise ValueError("Empty analyzer summary")
        return {**out, "ai_generated": True, "model_name": normalize_model_name(model)}
    except Exception as exc:
        logger.exception("Gemini feedback analysis failed")
        parsed = _fallback_analysis(context)
        err = str(exc)
        if len(err) > 240:
            err = err[:240] + "…"
        return {**parsed, "ai_generated": False, "model_name": "rule-based", "gemini_error": err}


def run_feedback_analyzer(
    db,
    *,
    user: User,
    perms: set[str],
    time_window: str,
    scope_feedback_query,
) -> Dict[str, Any]:
    context = gather_analyzer_context(
        db,
        user=user,
        perms=perms,
        time_window=time_window,
        scope_feedback_query=scope_feedback_query,
    )
    analysis = _analyze_with_gemini(context)
    ai_generated = bool(analysis.pop("ai_generated", False))
    model_name = analysis.pop("model_name", "unknown")
    gemini_error = analysis.pop("gemini_error", None)

    out: Dict[str, Any] = {
        "time_window": context["time_window"],
        "time_window_label": context["time_window_label"],
        "feedback_count": context["metrics"]["total_feedback"],
        "metrics": context["metrics"],
        "ai_generated": ai_generated,
        "model_name": model_name,
        "analysis": analysis,
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
    }
    if gemini_error and not ai_generated:
        out["gemini_error"] = gemini_error
    return out
