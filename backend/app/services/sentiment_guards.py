"""Threat, sarcasm/polarity-clash, emoji polarity, and optional LLM sentiment re-score."""

from __future__ import annotations

import logging
import os
import re
from typing import Any, Dict, List, Literal, Optional, Tuple

logger = logging.getLogger(__name__)

Label = Literal["positive", "neutral", "negative"]

# ---------------------------------------------------------------------------
# Threat / hostility
# ---------------------------------------------------------------------------

_THREAT_PATTERNS: List[re.Pattern[str]] = [
    re.compile(r"\btrack(?:\s+you)?\s+down\b", re.I),
    re.compile(r"\bfind\s+you\s+(?:and|at|where)\b", re.I),
    re.compile(r"\bsell\s+(?:your|the)\s+(?:house|kids?|children|family)\b", re.I),
    re.compile(r"\b(?:kill|murder|hurt|harm|beat|assault)\s+(?:you|your|them|him|her)\b", re.I),
    re.compile(r"\b(?:i(?:'| wi)?ll|gonna|going\s+to)\s+(?:kill|hurt|sue|destroy|ruin)\b", re.I),
    re.compile(r"\bsue\s+(?:you|your\s+company|the\s+company)\b", re.I),
    re.compile(r"\b(?:lawsuit|legal\s+action|take\s+you\s+to\s+court)\b", re.I),
    re.compile(r"\b(?:blackmail|extort(?:ion)?|ransom)\b", re.I),
    re.compile(r"\b(?:stalk(?:ing|er)?|harass(?:ment|ing)?)\b", re.I),
    re.compile(r"\b(?:bomb\s+threat|blow\s+(?:you|it)\s+up|violence|violent\s+threat)\b", re.I),
    re.compile(r"\b(?:death\s+threat|threaten(?:ing)?\s+(?:you|to))\b", re.I),
    re.compile(r"\b(?:burn\s+(?:your|the)\s+(?:house|office)|come\s+after\s+you)\b", re.I),
    re.compile(r"\b(?:report\s+you\s+to\s+(?:the\s+)?police|file\s+a\s+police\s+report)\b", re.I),
]

_PRAISE_WORDS = re.compile(
    r"\b(great|amazing|awesome|wonderful|excellent|fantastic|love|thanks|thank\s+you|"
    r"appreciate|perfect|best|brilliant|outstanding|delighted|happy|pleased)\b",
    re.I,
)

# ---------------------------------------------------------------------------
# Emoji polarity
# ---------------------------------------------------------------------------

_EMOJI_NEG = {
    "😈", "💀", "🤬", "😤", "😡", "😠", "👿", "☠️", "🔪", "💣", "👎", "🤮", "🤢", "💔", "🤡", "😒", "😑",
}
_EMOJI_POS = {
    "😍", "🎉", "👍", "❤️", "❤", "😊", "😁", "🙂", "😄", "🙌", "✨", "💯", "🥰", "💕", "👏", "🥳", "😎",
}

_EMOJI_WEIGHT = 0.14
_EMOJI_CLIP = 0.45

# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


def threat_hits(text: str) -> List[str]:
    t = text or ""
    hits: List[str] = []
    for rx in _THREAT_PATTERNS:
        m = rx.search(t)
        if m:
            hits.append(m.group(0))
    return hits


def emoji_polarity_delta(text: str) -> Tuple[float, Dict[str, int]]:
    """Return score delta in roughly [-0.45, 0.45] plus counts."""
    t = text or ""
    neg_n = sum(t.count(e) for e in _EMOJI_NEG)
    pos_n = sum(t.count(e) for e in _EMOJI_POS)
    raw = (pos_n - neg_n) * _EMOJI_WEIGHT
    if raw > _EMOJI_CLIP:
        raw = _EMOJI_CLIP
    if raw < -_EMOJI_CLIP:
        raw = -_EMOJI_CLIP
    return float(raw), {"positive": pos_n, "negative": neg_n}


def detect_sarcasm_clash(text: str, *, threat: bool, emoji_neg: int) -> bool:
    """
    True when strong praise co-occurs with threat/hostility or negative emoji —
    classic sarcastic praise pattern VADER misreads as positive.
    """
    t = text or ""
    if not _PRAISE_WORDS.search(t):
        return False
    if threat or emoji_neg > 0:
        return True
    # Praise + ruin/deny/worst without needing full threat lexicon
    if re.search(r"\b(ruin(?:ed|ing)?|destroy(?:ed|ing)?|denied|worst|terrible|awful|joke|nothing)\b", t, re.I):
        return True
    return False


def apply_threat_and_clash(
    *,
    compound: float,
    label: Label,
    text: str,
) -> Dict[str, Any]:
    """
    Apply threat / sarcasm / emoji adjustments.

    Returns updated compound, label, and signal flags.
    """
    hits = threat_hits(text)
    threat = bool(hits)
    emoji_delta, emoji_counts = emoji_polarity_delta(text)
    clash = detect_sarcasm_clash(text, threat=threat, emoji_neg=int(emoji_counts.get("negative") or 0))

    score = float(compound) + float(emoji_delta)
    out_label: Label = label
    forced = False

    if threat:
        # Hostility always wins over praise / thanks.
        score = min(score, -0.55)
        out_label = "negative"
        forced = True
    elif clash:
        # Praise + negative cue: do not trust a positive VADER label.
        if score > 0.15:
            score = min(score, -0.15)
        if out_label == "positive":
            out_label = "negative" if score <= -0.2 or emoji_counts.get("negative", 0) > 0 else "neutral"
            forced = True
        elif out_label == "neutral" and score <= -0.2:
            out_label = "negative"
            forced = True

    score = max(-1.0, min(1.0, score))
    return {
        "compound": score,
        "label": out_label,
        "threat": threat,
        "threat_hits": hits[:5],
        "sarcasm_clash": clash,
        "emoji_delta": emoji_delta,
        "emoji_counts": emoji_counts,
        "forced": forced,
    }


def is_ambiguous_score(compound: float) -> bool:
    """Near the positive/neutral/negative boundaries — candidate for LLM re-score."""
    return abs(float(compound)) < 0.22


def llm_rescore_sentiment(
    text: str,
    *,
    heuristic_label: Label,
    heuristic_score: float,
    signals: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """
    Second-pass Gemini label for ambiguous or clash cases only.

    Returns None when Gemini is unavailable or the call fails (caller keeps heuristics).
    """
    api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if not api_key:
        try:
            from ..core.config import get_config

            api_key = (getattr(get_config(), "GEMINI_API_KEY", "") or "").strip()
        except Exception:
            api_key = ""
    if not api_key:
        return None

    try:
        from .gemini_client import genai_generate_json, gemini_sdk_available, normalize_model_name
    except Exception:
        return None

    if not gemini_sdk_available():
        return None

    model = (os.getenv("GEMINI_MODEL") or "gemini-1.5-flash").strip()
    try:
        from ..core.config import get_config

        model = (getattr(get_config(), "GEMINI_MODEL", None) or model).strip()
    except Exception:
        pass
    model = normalize_model_name(model)

    snippet = (text or "").strip()
    if len(snippet) > 3500:
        snippet = snippet[:3500]

    sig = signals or {}
    prompt = (
        "You classify customer feedback sentiment for an insurance CX platform.\n"
        "Return JSON only with keys: label (one of positive, neutral, negative), "
        "score (float from -1 to 1), reason (short string).\n"
        "Treat sarcasm, dark humor, threats, hostility, and devil/skull emojis as negative "
        "even if the message starts with words like Great/Thanks/Amazing.\n"
        f"Heuristic label={heuristic_label}, heuristic_score={heuristic_score:.3f}, "
        f"signals={{{', '.join(f'{k}={v}' for k, v in sig.items() if k in ('threat','sarcasm_clash','emoji_delta'))}}}.\n"
        f"Message:\n\"\"\"\n{snippet}\n\"\"\"\n"
    )
    try:
        parsed = genai_generate_json(api_key=api_key, model=model, prompt=prompt, temperature=0.1)
    except Exception:
        logger.exception("LLM sentiment re-score failed")
        return None

    raw = str(parsed.get("label") or "").strip().lower()
    if raw not in {"positive", "neutral", "negative"}:
        return None
    try:
        score = float(parsed.get("score"))
    except Exception:
        score = {"negative": -0.6, "neutral": 0.0, "positive": 0.6}[raw]
    score = max(-1.0, min(1.0, score))
    return {
        "label": raw,  # type: ignore[return-value]
        "score": score,
        "reason": str(parsed.get("reason") or "")[:240],
        "provider": "gemini",
    }
