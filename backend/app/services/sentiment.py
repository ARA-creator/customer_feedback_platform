import logging
import os
import re
import threading
from pathlib import Path
from typing import Any, List, Literal, NotRequired, Optional, TypedDict

try:
    import nltk  # type: ignore
except Exception:  # pragma: no cover
    nltk = None

logger = logging.getLogger(__name__)

_vader_lock = threading.Lock()
# Placeholder so import never builds VADER (expensive NLTK + disk on serverless cold start).
_vader_obj: list[Any] = []

# Insurance-domain phrase tuning.
# Goal: correct common false neutrals/positives around claims, payouts, delays, and lapses.
_PHRASE_WEIGHTS: list[tuple[re.Pattern[str], float]] = [
    # Strong positives
    (re.compile(r"\b(processed quickly|paid promptly|payout (?:was )?received on time|fast payout|claim settled)\b", re.I), 0.55),
    (re.compile(r"\b(approved quickly|authorization was approved|seamless|resolved my issue so quickly)\b", re.I), 0.45),
    (re.compile(r"\b(responded immediately|quick response|resolved my concern|resolved everything)\b", re.I), 0.40),
    (re.compile(r"\b(kept me updated|kept us updated|kept me informed|kept us informed)\b", re.I), 0.40),
    (re.compile(r"\b(renewal reminder|avoid policy lapse|avoided policy lapse)\b", re.I), 0.90),
    (re.compile(r"\b(reimbursement was faster than expected|faster than expected|reimburs(?:e|ement))\b", re.I), 0.55),
    (re.compile(r"\b(handled my complaint professionally|handled my complaint|complaint professionally)\b", re.I), 0.55),
    (re.compile(r"\b(premium payment|paid my premium|pay(?:ing)? premium)\b", re.I), 0.25),
    (re.compile(r"\b(smooth|straightforward|easy without|easy and straightforward)\b", re.I), 0.45),
    (re.compile(r"\b(without (?:any )?issues?|no issues?)\b", re.I), 0.35),
    (re.compile(r"\b(helpful|professional|explained everything clearly|easy to use|convenient)\b", re.I), 0.25),
    (re.compile(r"\b(thank you|appreciate)\b", re.I), 0.20),

    # Strong negatives
    (re.compile(r"\b(claim (?:was )?(?:declined|denied|rejected)|declined without|denied without)\b", re.I), -0.65),
    (re.compile(r"\b(delayed payout|delay in settlement|settlement has caused|waiting weeks|over a month)\b", re.I), -0.55),
    # Slowness / backlog (VADER often misreads "claims" + "processing" as mild positive alone)
    (re.compile(r"\b(?:was|were|is|been)\s+(?:(?:so|too|very|quite|pretty)\s+)?slow\b", re.I), -0.58),
    (re.compile(r"\b(?:so|too|very|quite|pretty)\s+slow\b", re.I), -0.55),
    (re.compile(r"\bclaims?\b.*\bprocessing\b.*\bslow\b", re.I | re.DOTALL), -0.58),
    (re.compile(r"\btook\s+(?:too\s+)?(?:long|forever|ages)\b", re.I), -0.48),
    (re.compile(r"\b(no response|nobody is responding|stopped responding|still have no resolution)\b", re.I), -0.60),
    (re.compile(r"\b(cancelled without|policy (?:lapsed|cancelled)|misleading terms)\b", re.I), -0.55),
    (re.compile(r"\b(refund (?:has )?still not been processed|premium increase is too high)\b", re.I), -0.50),
    (re.compile(r"\b(rude|unprofessional|worst|regret taking|disappointed|frustrating and slow)\b", re.I), -0.45),
    (re.compile(r"\b(report to regulator|report(?:ing)? to (?:nic|regulator))\b", re.I), -0.60),

    # Neutral / workflow language: keep close to neutral unless other signals exist
    (re.compile(r"\b(under review|pending confirmation|still ongoing|forwarded to|get back to me|currently under review)\b", re.I), 0.0),
    (re.compile(r"\b(expire next month|policy is active until|premium has been updated)\b", re.I), 0.0),
]

_NEUTRAL_WORKFLOW_PHRASES: list[re.Pattern[str]] = [
    re.compile(r"\b(under review|currently under review)\b", re.I),
    re.compile(r"\b(pending confirmation|still ongoing|underwriting process)\b", re.I),
    re.compile(r"\b(get back to me|forwarded to|escalated for further review)\b", re.I),
    re.compile(r"\b(request(?:ed)? additional (?:medical )?documents|additional verification)\b", re.I),
    re.compile(r"\b(submitted successfully|everything has been submitted)\b", re.I),
    re.compile(r"\b(change of beneficiary|change (?:the )?beneficiary)\b", re.I),
    re.compile(r"\b(policy is active until|active until)\b", re.I),
]

_FORCE_NEUTRAL_PHRASES: list[re.Pattern[str]] = [
    re.compile(r"\b(escalated for further review)\b", re.I),
]

# Negation cues that should flip/strengthen negative meaning in otherwise mild phrases.
_NEGATION_CUES = re.compile(r"\b(no|not|never|nothing|none|without)\b", re.I)
_NEGATION_POSITIVE_EXCEPTIONS = re.compile(r"\b(without (?:any )?issues?|no issues?)\b", re.I)

# Polite ops / follow-up language: offset VADER treating "overdue" in a subject line as fury.
_PROCEDURAL_POLITE = re.compile(
    r"\b(?:please|kindly)\s+(?:process|complete|arrange|expedite|credit|pay|transfer|send)\b",
    re.I,
)
_SERVICE_COMPLAINT_SHADE = re.compile(
    r"\b(frustrat|angry|furious|unacceptable|outraged?|disgusted?|terrible\s+service|awful\s+service|"
    r"worst\s+(?:service|experience)|pathetic|useless\s+service|"
    r"complain(?:t|ing)?\s+about\s+(?:your|the)\s+service)\b",
    re.I,
)


def _procedural_request_compensation(text: str) -> float:
    """Positive nudge for neutral service requests; not counted toward domain anchor (phrase score)."""
    t = (text or "").strip()
    if not t or not _PROCEDURAL_POLITE.search(t):
        return 0.0
    if _SERVICE_COMPLAINT_SHADE.search(t):
        return 0.0
    return 0.48


def _insurance_phrase_rule_score(text: str) -> float:
    """
    Sum of insurance-domain phrase weights and negation tweak, in about [-1, 1].

    Used as ``domain_score`` and for label anchoring. Procedural request compensation
    (``_procedural_request_compensation``) is applied separately so ops-style emails are
    not mislabeled using the same "strong positive" anchor as real praise.
    """
    t = (text or "").strip()
    if not t:
        return 0.0
    score = 0.0
    matched_any = False
    for rx, w in _PHRASE_WEIGHTS:
        if rx.search(t):
            matched_any = True
            score += float(w)

    # If we only matched neutral workflow phrases, stay neutral.
    if matched_any and abs(score) < 1e-9:
        return 0.0

    # Negation cues: “not happy”, “no response”, “never received” should be more negative.
    if _NEGATION_CUES.search(t) and not _NEGATION_POSITIVE_EXCEPTIONS.search(t) and score <= 0.2:
        score -= 0.20

    # Clip to [-1, 1]
    if score < -1.0:
        return -1.0
    if score > 1.0:
        return 1.0
    return float(score)


# Domain phrase weights stack into ``domain_score`` (phrase-only); past these thresholds
# the discrete label follows domain points first; VADER+domain ``score`` fills ambiguous cases.
_STRONG_DOMAIN_NEG = -0.30
_STRONG_DOMAIN_POS = 0.36
# Require clear overall praise before overriding a strong negative phrase signal.
_CONTRAST_OVERRIDE_POS = 0.42
_CONTRAST_OVERRIDE_NEG = -0.28


class SentimentResult(TypedDict):
    label: Literal["positive", "neutral", "negative"]
    score: float
    domain_score: NotRequired[float]


def _nltk_data_dir() -> str:
    """
    Directory to store NLTK resources.

    On serverless (Vercel), only /tmp is writable, so we default there.
    """
    return os.getenv("NLTK_DATA", "/tmp/nltk_data")


def _ensure_vader_lexicon() -> None:
    """Ensure the VADER lexicon is available; never crash app startup."""
    if nltk is None:
        return
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


_VADER_LEXICON_UPDATES = {
    "annoyed": -2.4,
    "annoying": -2.2,
    "frustrated": -2.8,
    "frutsrating": -2.8,
    "frustration": -2.4,
    "unpaid": -2.6,
    "nonpayment": -2.6,
    "delayed": -1.8,
    "delay": -1.4,
    "overdue": -1.5,
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
    "benefit": 0.0,
    "benefits": 0.0,
}


def _get_vader():
    """Lazy singleton — first call initializes VADER."""
    if _vader_obj:
        return _vader_obj[0]
    with _vader_lock:
        if _vader_obj:
            return _vader_obj[0]
        _ensure_vader_lexicon()
        try:
            if nltk is None:
                raise RuntimeError("NLTK is not installed")
            from nltk.sentiment import SentimentIntensityAnalyzer

            vader = SentimentIntensityAnalyzer()
            vader.lexicon.update(_VADER_LEXICON_UPDATES)
            _vader_obj.append(vader)
            return vader
        except Exception:
            logger.exception("NLTK: failed to initialize VADER analyzer (lexicon missing?)")
            _vader_obj.append(None)
            return None

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


def _derive_sentiment_label(combined: float, domain_score: float) -> Literal["positive", "neutral", "negative"]:
    """
    Map numeric sentiment to a discrete label.

    ``domain_score`` is the sum of insurance phrase weights (plus negation tweak), about
    [-1, 1]. Strong domain totals pick negative/positive so phrase "points" match the
    label; otherwise the combined score uses the usual VADER bands.
    """
    if domain_score <= _STRONG_DOMAIN_NEG and combined < _CONTRAST_OVERRIDE_POS:
        return "negative"
    if domain_score >= _STRONG_DOMAIN_POS and combined > _CONTRAST_OVERRIDE_NEG:
        return "positive"
    return _compound_to_label(combined)


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
            - label: "positive" | "neutral" | "negative" (from domain points when strong,
              else from combined score bands)
            - score: VADER compound plus domain adjustment, clipped to [-1, 1]
            - domain_score: optional; phrase-rule total only (excludes procedural nudge)
    """
    prepared = _prepare_text_for_analysis(text, source)
    if not prepared:
        return {"label": "neutral", "score": 0.0}

    phrase_domain = _insurance_phrase_rule_score(prepared)
    procedural = _procedural_request_compensation(prepared)
    rule_delta = phrase_domain + procedural

    vader = _get_vader()
    if vader is None:
        # Fallback: still apply domain phrase tuning even when NLTK/VADER isn't available.
        compound = float(rule_delta)
        label = _derive_sentiment_label(compound, phrase_domain)
        return {"label": label, "score": compound, "domain_score": phrase_domain}

    scores = vader.polarity_scores(prepared)
    compound = float(scores.get("compound", 0.0))

    parts = [p.strip() for p in re.split(r"[.!?\n]+", prepared) if p and p.strip()]
    if parts:
        worst = min(float(vader.polarity_scores(p).get("compound", 0.0)) for p in parts)
        if worst <= -0.20:
            compound = min(compound, worst)

    compound = _adjust_compound_for_insurance_context(compound, insurance_tags, source, prepared)

    # If the text is primarily a workflow/status update, keep neutral unless there are
    # strong positive/negative signals from rules (phrase-only; procedural is not domain signal).
    if any(rx.search(prepared) for rx in _FORCE_NEUTRAL_PHRASES) and abs(phrase_domain) < 0.15:
        compound = 0.0
    if any(rx.search(prepared) for rx in _NEUTRAL_WORKFLOW_PHRASES):
        if abs(compound) < 0.35 and abs(phrase_domain) < 0.15:
            compound = 0.0

    # Combine VADER with phrase rules plus procedural compensation.
    compound = max(-1.0, min(1.0, float(compound) + float(rule_delta)))
    label = _derive_sentiment_label(compound, phrase_domain)
    return {"label": label, "score": compound, "domain_score": phrase_domain}
