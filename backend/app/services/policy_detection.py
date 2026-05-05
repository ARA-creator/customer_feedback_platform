"""
Policy number detection + product tracing from unstructured feedback text.

Business rules (current, per user-provided mapping):
  - Standard policy format: <4-char PRODUCT_PREFIX><7 digits>  => length 11
  - Exceptional policy length: 12 characters (format not confirmed)

We therefore accept:
  - prefix + 7 digits (high confidence)
  - prefix + 8 digits (supported but lower confidence; flag needs_review unless strong context)

Privacy:
  - Never persist raw policy numbers by default.
  - Persist salted hash for linking + a masked display string.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

from ..core.config import get_config


@dataclass(frozen=True)
class DetectedPolicy:
    policy_hash: str
    masked: str
    product_prefix: str
    product_group: str
    product_description: str
    confidence: float
    is_primary: bool
    needs_review: bool


@dataclass(frozen=True)
class _ProductRow:
    prefix: str
    group_name: str
    description: str


# Raw mapping rows from business table. Duplicate prefixes represent additional aliases.
_PRODUCT_ROWS: List[_ProductRow] = [
    _ProductRow("BB1V", "BBFP", "ABSA FAMILY FUNERAL PLAN"),
    _ProductRow("BB2V", "FUNERAL-FINANCE", "ABSA FUNERAL FINANCE"),
    _ProductRow("BB5V", "BBEDUCARE", "ABSA EDUCATION PLAN"),
    _ProductRow("BB6V", "BB-LADYCARE", "ABSA FAMILY FUNERAL PLAN"),
    _ProductRow("CB2V", "FUNERAL-FINANCE", "CBG FUNERAL FINANCE"),
    _ProductRow("CB3V", "END", "CBG LIFE TIME NEEDS PLUS"),
    _ProductRow("CB5V", "EDUCARE", "CBG ENHANCED EDUCATION PLAN"),
    _ProductRow("IC1V", "ICBFP", "ICB EASY FUNERAL PLAN"),
    _ProductRow("RB2V", "FUNERAL-FINANCE", "RB FUNERAL FINANCE"),
    _ProductRow("RB4V", "FIPP", "RB FAMILY INCOME PROTECTION PLAN ENHANCED"),
    _ProductRow("RB5V", "EDUCARE", "RB ENHANCED EDUCATION PLAN"),
    _ProductRow("SC1V", "SCBFP", "SCB FUNERAL PRODUCT"),
    _ProductRow("SC2V", "SCBFP", "SCB FUNERAL PRODUCT"),
    _ProductRow("SC4V", "SCBFIPP", "TERM ASSURE"),
    _ProductRow("SC5V", "SCBEDUCARE", "SCB EDUCATION PLAN"),
    _ProductRow("SC6V", "SCBLADYCARE", "SCB LADYCARE PLAN"),
    _ProductRow("GH1V", "FFUN", "FAMILY FUNERAL FINANCE PLAN"),
    _ProductRow("GH1V", "END", "LIFE TIME NEEDS PLAN"),
    _ProductRow("GH2V", "FFUN", "OLD FAMILY FUNERAL FINANCE PLAN"),
    _ProductRow("GH2V", "FUNERAL FINANCE", "FFP-UNLIMITED"),
    _ProductRow("GH3V", "END", "LIFE TIME NEEDS PLAN"),
    _ProductRow("GH4V", "FIPP", "FIPP"),
    _ProductRow("GH4V", "FIPP", "FIPP-ENHANCED (FISP)"),
    _ProductRow("GH5V", "EDUCARE", "EDUCATION ENDOWMENT"),
    _ProductRow("GH6V", "LADYCARE", "LADYCARE PLAN"),
    _ProductRow("GH6V", "LADYCARE", "BLOOM"),
    _ProductRow("GH7V", "EXECUTIVE-PLUS", "EXECUTIVE PLUS PLAN"),
    _ProductRow("GH8V", "LIVING-PLUS", "LIVING PLUS PLAN"),
    _ProductRow("GH9V", "TRANSITION", "TRANSITION"),
    _ProductRow("GHAV", "AKWANTU-PA", "AKWANTUPA"),
    _ProductRow("GH2A", "BELOW 100", "MY SMART PLAN - FUNERAL"),
    _ProductRow("GH3A", "BELOW 100", "MY SMARTPLAN SAVINGS"),
    _ProductRow("EB2V", "BUBBLE-LAST-EXPENSE", "BUBBLE-LAST-EXPENSE"),
    _ProductRow("EB3V", "BUBBLE-SAVINGS", "BUBBLE-SAVINGS"),
]


def _phrase_norm(text: str) -> str:
    t = str(text or "").upper()
    t = re.sub(r"[^A-Z0-9]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _compact_norm(text: str) -> str:
    t = _phrase_norm(text)
    return t.replace(" ", "")


_CATALOG_BY_PREFIX: Dict[str, Dict[str, Any]] = {}
for row in _PRODUCT_ROWS:
    bucket = _CATALOG_BY_PREFIX.setdefault(
        row.prefix,
        {
            "prefix": row.prefix,
            "group": row.group_name,
            "description": row.description,
            "groups": set(),
            "descriptions": set(),
            "aliases_phrase": set(),
            "aliases_compact": set(),
        },
    )
    bucket["groups"].add(row.group_name)
    bucket["descriptions"].add(row.description)

    for raw in (row.group_name, row.description):
        p = _phrase_norm(raw)
        c = _compact_norm(raw)
        if p:
            bucket["aliases_phrase"].add(p)
            # dash/space robust alias variants
            bucket["aliases_phrase"].add(p.replace("-", " "))
        if c:
            bucket["aliases_compact"].add(c)

# Prefix -> (group_name, description) canonicalized for persistence behavior.
PRODUCT_PREFIX_MAP: Dict[str, Tuple[str, str]] = {}
for prefix, c in _CATALOG_BY_PREFIX.items():
    group = sorted(c["groups"])[0] if c["groups"] else ""
    desc = " / ".join(sorted(c["descriptions"])) if c["descriptions"] else ""
    PRODUCT_PREFIX_MAP[prefix] = (group, desc)


_PREFIXES = sorted(PRODUCT_PREFIX_MAP.keys(), key=len, reverse=True)
_PREFIX_ALT = "|".join(map(re.escape, _PREFIXES))

# We normalize by stripping separators, so prefix+digits are expected contiguous.
_POLICY_RE = re.compile(rf"(?P<prefix>{_PREFIX_ALT})(?P<digits>\d{{7,8}})")

# Phone-ish candidates (Ghana includes +233 / 0xxxxxxxxx common). We only use this to avoid
# accidental misclassification and for potential future linking; we do not persist raw by default.
_PHONE_RE = re.compile(r"(?:(?:\+?233)\s?\d{8,9}|0\d{9}|\b\d{10,15}\b)")

_CTX_KEYWORDS = (
    "policy",
    "pol no",
    "policy no",
    "policy number",
    "member",
    "member id",
)


def _normalize_for_scan(text: str) -> str:
    t = (text or "").upper()
    # Keep letters/digits; treat common separators as removable.
    t = re.sub(r"[\s\-_\/]+", "", t)
    return t


def _mask_policy(prefix: str, digits: str) -> str:
    raw = f"{prefix}{digits}"
    if len(raw) <= 7:
        return raw
    # Show prefix + last 3 digits, mask the middle.
    return f"{prefix}•••••{digits[-3:]}"


def _hash_policy(prefix: str, digits: str) -> str:
    cfg = get_config()
    salt = str(getattr(cfg, "HASH_SALT", "") or "")
    normalized = f"{prefix}{digits}".upper()
    digest = hashlib.sha256(f"{salt}:policy:{normalized}".encode("utf-8")).hexdigest()
    return digest


def _hash_product_name(prefix: str, name_key: str) -> str:
    cfg = get_config()
    salt = str(getattr(cfg, "HASH_SALT", "") or "")
    normalized = f"{prefix}:{name_key}".upper()
    return hashlib.sha256(f"{salt}:product_name:{normalized}".encode("utf-8")).hexdigest()


def _mask_product_name(prefix: str, group_name: str) -> str:
    label = (group_name or "").strip() or "PRODUCT"
    return f"{prefix}:{label} (name match)"


def detect_policies(message_plaintext: str) -> Tuple[List[DetectedPolicy], Dict[str, Any]]:
    """
    Detect policy numbers from plaintext.

    Returns: (policies, debug)
      - policies: list of DetectedPolicy (may be empty)
      - debug: minimal info safe for logs (no raw policy numbers)
    """
    msg = message_plaintext or ""
    msg_lc = msg.lower()
    norm = _normalize_for_scan(msg)
    phrase_msg = _phrase_norm(msg)
    compact_msg = _compact_norm(msg)

    # Phone candidates (not persisted; used only to reduce false positives in scoring)
    phone_candidates = []
    try:
        phone_candidates = [m.group(0) for m in _PHONE_RE.finditer(msg or "")]
    except Exception:
        phone_candidates = []

    candidates: List[Tuple[str, str, int]] = []  # (prefix, digits, start_idx_in_norm)
    for m in _POLICY_RE.finditer(norm):
        prefix = m.group("prefix")
        digits = m.group("digits")
        candidates.append((prefix, digits, m.start()))

    detected: List[DetectedPolicy] = []
    number_candidates = 0
    for prefix, digits, start in candidates:
        number_candidates += 1
        group, desc = PRODUCT_PREFIX_MAP.get(prefix, ("UNKNOWN", ""))
        is_11 = len(digits) == 7
        is_12 = len(digits) == 8

        score = 0.60  # base for prefix match (prefix is required by regex)
        needs_review = False

        if is_11:
            score += 0.25
        elif is_12:
            score += 0.10
            needs_review = True  # until the 12-char format is confirmed
        else:
            # Shouldn't happen due to regex, but keep safe.
            needs_review = True

        # Context boost: look for keywords near the original text (not normalized)
        # Use a small window around the match location (approximate).
        # Since we matched on normalized, we only do a coarse check in original message.
        if any(k in msg_lc for k in _CTX_KEYWORDS):
            score += 0.07
            if is_12:
                needs_review = False  # strong context reduces review requirement

        # Clamp
        score = max(0.0, min(0.99, score))

        pol_hash = _hash_policy(prefix, digits)
        masked = _mask_policy(prefix, digits)
        detected.append(
            DetectedPolicy(
                policy_hash=pol_hash,
                masked=masked,
                product_prefix=prefix,
                product_group=group,
                product_description=desc,
                confidence=round(score, 3),
                is_primary=False,
                needs_review=bool(needs_review),
            )
        )

    # Product-name candidates (for messages without policy numbers or as secondary evidence)
    name_candidates = 0
    name_hits_by_prefix: Dict[str, int] = {}
    for prefix, cat in _CATALOG_BY_PREFIX.items():
        phrase_aliases: Set[str] = set(cat.get("aliases_phrase") or set())
        compact_aliases: Set[str] = set(cat.get("aliases_compact") or set())

        matched_aliases = 0
        for alias in phrase_aliases:
            if not alias:
                continue
            if len(alias) < 4:
                continue
            if f" {alias} " in f" {phrase_msg} ":
                matched_aliases += 1
        for alias in compact_aliases:
            if not alias:
                continue
            if len(alias) < 6:
                continue
            if alias in compact_msg:
                matched_aliases += 1

        if matched_aliases <= 0:
            continue

        name_candidates += 1
        name_hits_by_prefix[prefix] = matched_aliases
        group, desc = PRODUCT_PREFIX_MAP.get(prefix, ("UNKNOWN", ""))

        score = 0.52
        score += min(0.20, 0.06 * matched_aliases)
        if any(k in msg_lc for k in _CTX_KEYWORDS):
            score += 0.08
        if number_candidates > 0:
            # if number exists too, give modest boost for supporting evidence
            score += 0.04
        score = max(0.0, min(0.95, score))

        # If multiple distinct products match by name in one message, require review.
        needs_review = len(name_hits_by_prefix) > 1
        name_key = f"{prefix}:{matched_aliases}"
        detected.append(
            DetectedPolicy(
                policy_hash=_hash_product_name(prefix, name_key),
                masked=_mask_product_name(prefix, group),
                product_prefix=prefix,
                product_group=group,
                product_description=desc,
                confidence=round(score, 3),
                is_primary=False,
                needs_review=needs_review,
            )
        )

    # If multiple product-name prefixes matched, force review on all name-match candidates.
    if len(name_hits_by_prefix) > 1:
        updated: List[DetectedPolicy] = []
        for d in detected:
            if "(name match)" in (d.masked or ""):
                updated.append(DetectedPolicy(**{**d.__dict__, "needs_review": True}))
            else:
                updated.append(d)
        detected = updated

    # Dedupe by hash, keep highest confidence
    best_by_hash: Dict[str, DetectedPolicy] = {}
    for d in detected:
        prev = best_by_hash.get(d.policy_hash)
        if not prev or d.confidence > prev.confidence:
            best_by_hash[d.policy_hash] = d
    detected = list(best_by_hash.values())

    # Choose primary by highest confidence.
    # Tie-breaker: policy-number style candidates (masked with bullet middle) outrank name candidates.
    def _is_policy_number_style(d: DetectedPolicy) -> int:
        return 1 if "•••••" in (d.masked or "") else 0

    detected.sort(key=lambda x: (x.confidence, _is_policy_number_style(x)), reverse=True)
    if detected:
        top = detected[0]
        # If second is very close, avoid confidently picking one.
        if len(detected) > 1 and abs(detected[0].confidence - detected[1].confidence) < 0.03:
            detected = [
                DetectedPolicy(**{**d.__dict__, "is_primary": False, "needs_review": True}) for d in detected
            ]
        else:
            detected[0] = DetectedPolicy(**{**top.__dict__, "is_primary": True})

    debug = {
        "policies_found": len(detected),
        "policy_number_candidates": number_candidates,
        "product_name_candidates": name_candidates,
        "phones_found": len(phone_candidates),
        "has_any_keyword": any(k in (msg or "").lower() for k in _CTX_KEYWORDS),
    }
    return detected, debug

