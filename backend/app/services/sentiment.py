import logging
import os
import re
from pathlib import Path
from typing import List, Literal, Optional, TypedDict

import nltk
from nltk.sentiment import SentimentIntensityAnalyzer

logger = logging.getLogger(__name__)


class SentimentResult(TypedDict):
    label: Literal["positive", "neutral", "negative"]
    score: float


def _nltk_data_dir() -> str:
    """
    Directory to store NLTK resources.

    On serverless (Vercel), only /tmp is writable, so we default there.
    """
    return os.getenv("NLTK_DATA", "/tmp/nltk_data")


def _ensure_vader_lexicon() -> None:
    """Ensure the VADER lexicon is available; never crash app startup."""
    try:
        nltk.data.find("sentiment/vader_lexicon.zip")
        return
    except LookupError:
        pass
    except Exception:
        logger.exception("NLTK: unexpected error while checking VADER lexicon")
        return

    try:
        data_dir = _nltk_data_dir()
        Path(data_dir).mkdir(parents=True, exist_ok=True)
        if data_dir not in nltk.data.path:
            nltk.data.path.append(data_dir)
        logger.info("NLTK: downloading VADER lexicon to %s", data_dir)
        nltk.download("vader_lexicon", download_dir=data_dir, quiet=True)
    except Exception:
        # If this fails on serverless, we don't want the whole API to 500.
        logger.exception("NLTK: failed to download VADER lexicon")


_ensure_vader_lexicon()
try:
    _vader = SentimentIntensityAnalyzer()
except Exception:
    logger.exception("NLTK: failed to initialize VADER analyzer (lexicon missing?)")
    _vader = None

# Domain tuning: VADER's default lexicon can underweight complaint language
# common in benefit/payment escalation emails.
if _vader is not None:
    _vader.lexicon.update(
        {
            "annoyed": -2.4,
            "annoying": -2.2,
            "frustrated": -2.8,
            "frustrating": -2.8,
            "frustration": -2.4,
            "unpaid": -2.6,
            "nonpayment": -2.6,
            "delayed": -1.8,
            "delay": -1.4,
            "overdue": -2.2,
            # Insurance / claims context (lean toward capturing customer distress)
            "denied": -2.8,
            "denial": -2.4,
            "rejected": -2.2,
            "dispute": -2.0,
            "lapse": -2.0,
            "lapsed": -2.0,
            "underinsured": -1.8,
            "underpaid": -2.2,
            "exclusion": -1.8,
            "excluded": -1.8,
            "rescission": -2.2,
            "nonrenewal": -1.8,
            "cancellation": -1.4,
            "complaint": -1.8,
            "escalation": -1.6,
            "breach": -2.0,
            "badfaith": -2.6,
            "bad-faith": -2.6,
            # Insurance domain: "benefits" = covered services (not generic positive affect)
            "benefit": 0.0,
            "benefits": 0.0,
        }
    )

# When any of these insurance topic tags apply, allow a small compound nudge for ambiguous VADER scores.
_INSURANCE_TOPIC_TAGS_FOR_SENTIMENT_GATE = frozenset(
    {
        "benefits",
        "claims",
        "billing",
        "premiums",
        "policy",
        "underwriting",
        "support",
        "trust_fairness",
        "speed_delays",
        "digital",
    }
)

# Extra nudge when "benefits" topic + clear complaint language in the same text.
_BENEFITS_COMPLAINT_HINT = re.compile(
    r"\b(terrible|awful|horrible|unacceptable|worst|pathetic|rubbish|disgusting|"
    r"scam|fraud|useless|disappoint|frustrat|angry|furious|unhappy|not\s+happy|"
    r"not\s+satisfied|poor|bad|ridiculous|shocking|unfair)\b",
    re.I,
)

_HEADER_LINE = re.compile(
    r"^(?:from|to|cc|bcc|subject|date|sent|reply-to|message-id|"
    r"mime-version|content-type|importance|x-mailer|x-msmail-priority):\s",
    re.I,
)

_SALUTATION = re.compile(
    r"(?is)^\s*"
    r"(?:"
    r"dear\s+[\w\s.,'’-]+\s*,|"
    r"hello\s+[\w\s.,'’-]+\s*,|"
    r"hi\s+[\w\s.,'’-]+\s*,|"
    r"hey\s+[\w\s.,'’-]+\s*,|"
    r"greetings\s*,|"
    r"good\s+(?:morning|afternoon|evening)[^,\n]*,?"
    r")\s*"
)

_FORWARDED_BANNER = re.compile(
    r"(?is)^\s*-{3,}\s*forwarded message\s*-{3,}\s*$",
    re.M,
)


def _is_email_source(source: Optional[str]) -> bool:
    s = (source or "").lower()
    return "mail" in s or s == "email" or s.endswith("_mail")


def _looks_like_pasted_email(text: str) -> bool:
    t = text[:4000]
    return bool(_HEADER_LINE.search(t)) or bool(re.search(r"(?im)^subject:\s", t))


def _strip_email_headers_and_focus_body(text: str) -> str:
    """
    Remove common RFC822-style headers and focus on the message body.
    Salutations are stripped separately so sentiment reflects the substance of the email.
    """
    raw = text.replace("\r\n", "\n").strip()
    if not raw:
        return raw

    # Drop "----- Forwarded message -----" blocks (keep after last banner if multiple)
    raw = _FORWARDED_BANNER.sub("", raw).strip()

    # If we see typical headers, take content after the header block (blank line).
    if _HEADER_LINE.search(raw) or re.search(r"(?im)^subject:\s", raw):
        parts = re.split(r"\n\s*\n", raw, maxsplit=1)
        if len(parts) == 2 and len(parts[0]) < 12000:
            raw = parts[1].strip()

    # First non-empty line might still be "Subject: ..." if split failed
    lines = raw.split("\n")
    while lines and _HEADER_LINE.match(lines[0].strip()):
        lines.pop(0)
    raw = "\n".join(lines).strip()

    # Remove a leading subject-only line sometimes left in forwards
    raw = re.sub(r"(?is)^\s*subject:\s*.+\n+", "", raw, count=1).strip()

    return raw


def _strip_leading_salutation(text: str) -> str:
    t = text.strip()
    if not t:
        return t
    t = _SALUTATION.sub("", t, count=1).strip()
    return t


def _prepare_text_for_analysis(text: str, source: Optional[str]) -> str:
    t = (text or "").strip()
    if not t:
        return t
    if _is_email_source(source) or _looks_like_pasted_email(t):
        t = _strip_email_headers_and_focus_body(t)
    # Strip common openings for every channel (WhatsApp, web, social, etc.).
    t = _strip_leading_salutation(t)
    return t.strip()


def _normalized_insurance_tag_set(insurance_tags: Optional[List[str]]) -> set[str]:
    out: set[str] = set()
    for t in insurance_tags or []:
        k = str(t or "").strip().lower()
        if k:
            out.add(k)
    return out


def _insurance_tag_gate_applicable(insurance_tags: Optional[List[str]]) -> bool:
    return bool(_normalized_insurance_tag_set(insurance_tags) & _INSURANCE_TOPIC_TAGS_FOR_SENTIMENT_GATE)


def _insurance_channel_gate_applicable(source: Optional[str]) -> bool:
    """Typical customer-feedback ingest sources (not a perfect allowlist, but broad)."""
    s = (source or "").lower().strip()
    if not s:
        return False
    if s in {"x", "twitter"} or s.startswith("x_") or s.startswith("x-"):
        return True
    markers = (
        "mail",
        "email",
        "web",
        "whatsapp",
        "instagram",
        "facebook",
        "tiktok",
        "twitter",
        "google",
        "form",
        "api",
        "csv",
    )
    return any(m in s for m in markers)


def _adjust_compound_for_insurance_context(
    compound: float,
    insurance_tags: Optional[List[str]],
    source: Optional[str],
    prepared: str,
) -> float:
    """
    Nudge VADER compound when insurance-topic tags and/or typical feedback channels apply,
    so weakly-positive/neutral scores are less likely on clear complaint language.
    """
    tag_gate = _insurance_tag_gate_applicable(insurance_tags)
    ch_gate = _insurance_channel_gate_applicable(source)
    if not tag_gate and not ch_gate:
        return compound
    # Strong positives: leave unchanged
    if compound >= 0.55:
        return compound
    tags_l = _normalized_insurance_tag_set(insurance_tags)
    adj = compound
    if -0.55 < adj < 0.58:
        adj -= 0.18
    if "benefits" in tags_l and _BENEFITS_COMPLAINT_HINT.search(prepared):
        adj -= 0.15
    if adj < -1.0:
        return -1.0
    if adj > 1.0:
        return 1.0
    return adj


def _compound_to_label(compound: float) -> Literal["positive", "neutral", "negative"]:
    """
    Map VADER compound [-1, 1] to discrete labels using a 0–1 normalized scale:

    - norm in [0, 0.4]   → predominantly negative (compound <= -0.2)
    - norm in (0.4, 0.6) → mixed / neutral
    - norm in [0.6, 1]   → predominantly positive (compound >= 0.2)

    Boundaries: 0.4 → negative, 0.6 → positive (endpoints match the requested ranges).
    """
    norm = (compound + 1.0) / 2.0
    if norm <= 0.4:
        return "negative"
    if norm < 0.6:
        return "neutral"
    return "positive"


def analyze_sentiment(
    text: str,
    source: Optional[str] = None,
    insurance_tags: Optional[List[str]] = None,
) -> SentimentResult:
    """
    Analyze sentiment using VADER on the given text.

    Optional ``source`` (e.g. ``email``, ``web``) is used to detect email-like content so
    RFC-style headers can be skipped before analysis. Leading salutations (Dear / Hi / Hey /
    etc.) are removed for **all** sources so sentiment reflects the substantive message.

    Optional ``insurance_tags`` (from ``categorize_insurance_tags``) plus ``source`` enable a
    small compound adjustment for insurance feedback channels so domain words like
    "benefits" do not inflate sentiment alone.

    Returns:
        dict with:
            - label: "positive" | "neutral" | "negative" (bands on normalized compound)
            - score: adjusted VADER compound in [-1, 1] (after insurance-context nudge)
    """
    prepared = _prepare_text_for_analysis(text, source)
    if not prepared:
        return {"label": "neutral", "score": 0.0}

    if _vader is None:
        # Fail safe: if VADER can't initialize (missing lexicon on serverless),
        # do not crash ingestion/auth endpoints that import this module.
        return {"label": "neutral", "score": 0.0}

    scores = _vader.polarity_scores(prepared)
    compound = float(scores.get("compound", 0.0))

    parts = [p.strip() for p in re.split(r"[.!?\n]+", prepared) if p and p.strip()]
    if parts:
        worst = min(float(_vader.polarity_scores(p).get("compound", 0.0)) for p in parts)
        if worst <= -0.20:
            compound = min(compound, worst)

    compound = _adjust_compound_for_insurance_context(compound, insurance_tags, source, prepared)
    label = _compound_to_label(compound)
    return {"label": label, "score": compound}
