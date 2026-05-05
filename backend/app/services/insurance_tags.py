import re
from typing import List, Optional, Tuple


TAXONOMY: Tuple[str, ...] = (
    "claims",
    "benefits",
    "billing",
    "premiums",
    "policy",
    "underwriting",
    "support",
    "digital",
    "trust_fairness",
    "speed_delays",
    "other",
)


_HEADER_LINE = re.compile(
    r"^(?:from|to|cc|bcc|subject|date|sent|reply-to|message-id|"
    r"mime-version|content-type|importance|x-mailer|x-msmail-priority):\s",
    re.I,
)

_FORWARDED_BANNER = re.compile(
    r"(?is)^\s*-{3,}\s*forwarded message\s*-{3,}\s*$",
    re.M,
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


def _is_email_source(source: Optional[str]) -> bool:
    s = (source or "").lower()
    return "mail" in s or s == "email" or s.endswith("_mail")


def _looks_like_pasted_email(text: str) -> bool:
    t = text[:4000]
    return bool(_HEADER_LINE.search(t)) or bool(re.search(r"(?im)^subject:\s", t))


def _strip_email_headers_and_focus_body(text: str) -> str:
    raw = text.replace("\r\n", "\n").strip()
    if not raw:
        return raw

    raw = _FORWARDED_BANNER.sub("", raw).strip()

    if _HEADER_LINE.search(raw) or re.search(r"(?im)^subject:\s", raw):
        parts = re.split(r"\n\s*\n", raw, maxsplit=1)
        if len(parts) == 2 and len(parts[0]) < 12000:
            raw = parts[1].strip()

    lines = raw.split("\n")
    while lines and _HEADER_LINE.match(lines[0].strip()):
        lines.pop(0)
    raw = "\n".join(lines).strip()

    raw = re.sub(r"(?is)^\s*subject:\s*.+\n+", "", raw, count=1).strip()
    return raw


def _strip_leading_salutation(text: str) -> str:
    t = text.strip()
    if not t:
        return t
    return _SALUTATION.sub("", t, count=1).strip()


def _prepare_text(text: str, source: Optional[str]) -> str:
    t = (text or "").strip()
    if not t:
        return t
    if _is_email_source(source) or _looks_like_pasted_email(t):
        t = _strip_email_headers_and_focus_body(t)
    t = _strip_leading_salutation(t)
    return t.strip()


def _score_matches(text_l: str, needles: List[str]) -> int:
    score = 0
    for n in needles:
        if not n:
            continue
        if n in text_l:
            score += 1
    return score


_RULES: List[Tuple[str, List[str]]] = [
    (
        "claims",
        [
            "claim",
            "claims",
            "payout",
            "settlement",
            "adjuster",
            "assessment",
            "loss",
            "accident",
            "hospital",
            "medical",
            "indemnity",
            "reimbursement",
            "reimburse",
        ],
    ),
    (
        "benefits",
        [
            "benefit",
            "benefits",
            "entitlement",
            "cover includes",
            "covered benefits",
            "benefit schedule",
            "schedule of benefits",
            "limit",
            "limits",
            "cap",
            "capped",
            "maximum",
            "outpatient",
            "inpatient",
            "dental",
            "optical",
            "maternity",
            "medicine",
            "drugs",
            "prescription",
        ],
    ),
    (
        "billing",
        [
            "charge",
            "charged",
            "billing",
            "bill",
            "payment",
            "paying",
            "paid",
            "unpaid",
            "nonpayment",
            "refund",
            "reversal",
            "deduction",
            "direct debit",
            "standing order",
            "receipt",
            "invoice",
            "statement",
            "arrears",
        ],
    ),
    (
        "premiums",
        [
            "premium",
            "premiums",
            "rate",
            "pricing",
            "price",
            "priced",
            "quotation",
            "quote",
            "increase",
            "increased",
            "increment",
            "too expensive",
            "expensive",
            "affordable",
            "discount",
            "loading",
            "excess",
            "deductible",
        ],
    ),
    (
        "policy",
        [
            "policy",
            "coverage",
            "cover",
            "exclusion",
            "excluded",
            "waiting period",
            "renewal",
            "renew",
            "nonrenewal",
            "non-renewal",
            "cancel",
            "cancellation",
            "lapse",
            "lapsed",
            "endorsement",
            "beneficiary",
            "dependant",
            "dependent",
            "terms",
            "conditions",
        ],
    ),
    (
        "underwriting",
        [
            "underwriting",
            "underwrite",
            "underwriter",
            "risk assessment",
            "risk",
            "medical exam",
            "medical examination",
            "medical test",
            "health check",
            "questionnaire",
            "proposal form",
            "application",
            "approval",
            "approve",
            "approved",
            "declined",
            "rejected",
            "acceptance",
            "accepted",
            "pre-existing",
            "pre existing",
            "waiting period",
        ],
    ),
    (
        "support",
        [
            "customer service",
            "support",
            "agent",
            "representative",
            "call center",
            "callcentre",
            "hotline",
            "respond",
            "response",
            "no reply",
            "ignored",
            "rude",
            "unhelpful",
            "escalate",
            "escalation",
            "complaint",
            "complain",
        ],
    ),
    (
        "digital",
        [
            "app",
            "portal",
            "website",
            "login",
            "log in",
            "sign in",
            "password",
            "otp",
            "verification code",
            "upload",
            "form",
            "error",
            "bug",
            "crash",
            "down",
            "cannot access",
            "can't access",
        ],
    ),
    (
        "trust_fairness",
        [
            "unfair",
            "cheated",
            "scam",
            "fraud",
            "bad faith",
            "badfaith",
            "dishonest",
            "lied",
            "misleading",
            "false",
            "regulator",
            "complaint to",
            "legal",
            "lawyer",
            "court",
        ],
    ),
    (
        "speed_delays",
        [
            "delay",
            "delayed",
            "slow",
            "waiting",
            "waited",
            "weeks",
            "months",
            "no update",
            "no updates",
            "follow up",
            "follow-up",
            "pending",
            "still not",
            "asap",
            "urgent",
            "immediately",
        ],
    ),
]


def categorize_insurance_tags(text: str, source: Optional[str] = None) -> List[str]:
    """
    Deterministic (rules-only) insurance categorization.

    Returns a list of tags from TAXONOMY. Multi-tag is allowed.
    If nothing matches, returns ['other'].
    """
    prepared = _prepare_text(text, source)
    if not prepared:
        return ["other"]

    text_l = prepared.lower()

    hits: List[Tuple[str, int]] = []
    for tag, needles in _RULES:
        score = _score_matches(text_l, needles)
        if score > 0:
            hits.append((tag, score))

    # Promote speed_delays when there are explicit time words, even if sparse.
    if any(w in text_l for w in ("days", "weeks", "months", "since")) and not any(t == "speed_delays" for t, _ in hits):
        hits.append(("speed_delays", 1))

    if not hits:
        return ["other"]

    # Keep all matched tags; stable order by score desc then taxonomy order.
    order = {k: i for i, k in enumerate(TAXONOMY)}
    hits_sorted = sorted(hits, key=lambda x: (-x[1], order.get(x[0], 999)))
    out: List[str] = []
    seen = set()
    for tag, _ in hits_sorted:
        if tag in TAXONOMY and tag not in seen:
            seen.add(tag)
            out.append(tag)
    return out or ["other"]

