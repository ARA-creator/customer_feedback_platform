from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional


def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def normalize_source_group(value: Optional[str]) -> Optional[str]:
    s = (value or "").strip().lower()
    if not s:
        return None
    # WhatsApp before broad "mail" heuristics so mixed strings stay WhatsApp.
    if "whatsapp" in s:
        return "whatsapp"
    # Avoid classifying "voicemail" as email: substring "mail" appears inside it.
    if s == "email" or s in ("e-mail", "imap") or s.startswith("email"):
        return "email"
    if "mail" in s and "voice" not in s:
        return "email"
    if s == "web" or s.startswith("web_") or s.startswith("web-") or "web_form" in s or "webform" in s:
        return "web"
    if s == "x" or "x_" in s or "x-" in s or "x " in s:
        return "x"
    if "twitter" in s:
        return "twitter"
    if "tiktok" in s:
        return "tiktok"
    if "instagram" in s:
        return "instagram"
    if "facebook" in s:
        return "facebook"
    return s


def score_feedback(*, feedback, meta: Dict[str, Any], purchase_summary: Optional[Dict[str, Any]] = None, ticket_summary: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    factors: Dict[str, int] = {}

    sentiment = (getattr(feedback, "sentiment_label", "") or "").lower()
    if sentiment == "negative":
        factors["sentiment"] = 35
    elif sentiment == "neutral":
        factors["sentiment"] = 10
    else:
        factors["sentiment"] = 5

    rating = getattr(feedback, "rating", None)
    if rating is not None:
        if rating <= 2:
            factors["rating"] = 18
        elif rating >= 4:
            factors["rating"] = 4
        else:
            factors["rating"] = 8

    source = (normalize_source_group(getattr(feedback, "source", None)) or getattr(feedback, "source", "") or "").lower()
    source_weights = {"x": 16, "twitter": 14, "tiktok": 15, "facebook": 12, "instagram": 12, "web": 10, "whatsapp": 8, "email": 6}
    factors["channel_reach"] = source_weights.get(source, 6)

    engagement = meta.get("engagement") if isinstance(meta.get("engagement"), dict) else {}
    engagement_total = 0
    for key in ["likes", "comments", "shares", "reposts", "views"]:
        try:
            engagement_total += int(engagement.get(key) or 0)
        except Exception:
            pass
    factors["engagement"] = min(35, engagement_total // 10)

    if meta.get("matched_keyword") or meta.get("query"):
        factors["brand_signal"] = 6
    if meta.get("campaign"):
        factors["campaign"] = 4

    created_at = _ensure_utc(getattr(feedback, "created_at", None))
    if created_at:
        age_hours = max(0.0, (datetime.now(tz=timezone.utc) - created_at).total_seconds() / 3600.0)
        if age_hours <= 6:
            factors["recency"] = 16
        elif age_hours <= 24:
            factors["recency"] = 10
        elif age_hours <= 72:
            factors["recency"] = 5
        else:
            factors["recency"] = 1

    base_priority = int(getattr(feedback, "priority", 0) or 0)
    factors["existing_priority"] = min(25, base_priority // 4)

    purchase_summary = purchase_summary or {}
    total_spend = float(purchase_summary.get("total_spend") or 0.0)
    customer_tier = str(meta.get("customer_tier") or purchase_summary.get("customer_tier") or "").lower()
    customer_value = 0
    if total_spend >= 10000:
        customer_value += 22
    elif total_spend >= 2500:
        customer_value += 15
    elif total_spend > 0:
        customer_value += 8
    if customer_tier in {"platinum", "gold", "vip", "enterprise"}:
        customer_value += 10
    elif customer_tier in {"silver", "premium"}:
        customer_value += 5
    factors["customer_value"] = customer_value

    ticket_summary = ticket_summary or {}
    open_tickets = int(ticket_summary.get("open_count") or 0)
    complaint_count = int(ticket_summary.get("complaint_count") or 0)
    churn_risk = min(24, open_tickets * 4 + complaint_count * 3)
    factors["churn_risk"] = churn_risk

    total_score = max(0, min(100, sum(factors.values())))
    summary_parts = []
    if factors.get("sentiment", 0) >= 30:
        summary_parts.append("negative sentiment")
    if factors.get("engagement", 0) >= 10:
        summary_parts.append("strong engagement")
    if factors.get("customer_value", 0) >= 15:
        summary_parts.append("high-value customer")
    if factors.get("churn_risk", 0) >= 8:
        summary_parts.append("repeat support risk")
    if factors.get("recency", 0) >= 10:
        summary_parts.append("recent issue")
    if not summary_parts:
        summary_parts.append("baseline operational priority")

    return {
        "impact_score": total_score,
        "impact_factors": factors,
        "priority_reason_summary": ", ".join(summary_parts[:3]),
    }
