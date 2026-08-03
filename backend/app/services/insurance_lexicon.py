"""Insurance lexicon: term matching for themes + sentiment polarity."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

logger = logging.getLogger(__name__)

_DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "insurance_lexicon.json"

_WORD_RE = re.compile(r"[a-z0-9][a-z0-9+'/-]*(?:\s+[a-z0-9][a-z0-9+'/-]*){0,5}", re.I)


@dataclass(frozen=True)
class LexiconHit:
    term: str
    normalized: str
    category: str
    theme: str
    polarity: str
    polarity_score: float
    plain_english: str


@lru_cache(maxsize=1)
def load_lexicon() -> Dict[str, Any]:
    try:
        raw = _DATA_PATH.read_text(encoding="utf-8")
        data = json.loads(raw)
        if not isinstance(data, dict) or not isinstance(data.get("entries"), list):
            return {"version": 0, "entries": [], "entry_count": 0}
        return data
    except Exception:
        logger.exception("Failed to load insurance lexicon from %s", _DATA_PATH)
        return {"version": 0, "entries": [], "entry_count": 0}


@lru_cache(maxsize=1)
def _index() -> Tuple[Dict[str, Dict[str, Any]], List[str]]:
    entries = load_lexicon().get("entries") or []
    by_norm: Dict[str, Dict[str, Any]] = {}
    for e in entries:
        if not isinstance(e, dict):
            continue
        norm = str(e.get("normalized") or "").strip().lower()
        if not norm:
            continue
        # Prefer curated / first entry
        by_norm.setdefault(norm, e)
    # Longest first for greedy phrase matching
    norms = sorted(by_norm.keys(), key=len, reverse=True)
    return by_norm, norms


def lexicon_entry_count() -> int:
    return int(load_lexicon().get("entry_count") or len(load_lexicon().get("entries") or []))


def match_lexicon(text: str, *, limit: int = 40) -> List[LexiconHit]:
    """Find lexicon terms mentioned in text (case-insensitive phrase match)."""
    prepared = str(text or "")
    if not prepared.strip():
        return []
    text_l = prepared.lower()
    by_norm, norms = _index()
    hits: List[LexiconHit] = []
    seen = set()
    for norm in norms:
        if norm in seen:
            continue
        # Word-boundary-ish match for short tokens; substring for multi-word
        if " " in norm or "-" in norm or "/" in norm or len(norm) >= 5:
            if norm not in text_l:
                continue
        else:
            if not re.search(rf"(?<![a-z0-9]){re.escape(norm)}(?![a-z0-9])", text_l):
                continue
        e = by_norm[norm]
        seen.add(norm)
        hits.append(
            LexiconHit(
                term=str(e.get("term") or norm),
                normalized=norm,
                category=str(e.get("category") or ""),
                theme=str(e.get("theme") or "other"),
                polarity=str(e.get("polarity") or "neutral"),
                polarity_score=float(e.get("polarity_score") or 0.0),
                plain_english=str(e.get("plain_english") or ""),
            )
        )
        if len(hits) >= max(1, int(limit)):
            break
    return hits


def themes_from_lexicon_hits(hits: Sequence[LexiconHit]) -> List[str]:
    out: List[str] = []
    seen = set()
    for h in hits:
        theme = (h.theme or "other").strip().lower()
        if not theme or theme in seen:
            continue
        seen.add(theme)
        out.append(theme)
    return out


def lexicon_sentiment_delta(text: str, hits: Optional[Sequence[LexiconHit]] = None) -> float:
    """
    Aggregate polarity nudge from matched lexicon terms.

    Context-polarity terms only count when complaint/praise cues appear nearby.
    """
    matched = list(hits) if hits is not None else match_lexicon(text)
    if not matched:
        return 0.0
    text_l = str(text or "").lower()
    complaint = bool(
        re.search(
            r"\b(terrible|awful|horrible|unacceptable|worst|angry|furious|unhappy|frustrated|"
            r"delay|delayed|still waiting|no update|not paid|unpaid|rejected|denied|rude|"
            r"useless|poor|bad|unfair|scam|fraud)\b",
            text_l,
        )
    )
    praise = bool(
        re.search(
            r"\b(excellent|outstanding|amazing|great|thank you|thanks|appreciate|helpful|"
            r"resolved|sorted|quick|fast|professional|wonderful)\b",
            text_l,
        )
    )
    total = 0.0
    for h in matched:
        score = float(h.polarity_score or 0.0)
        pol = (h.polarity or "neutral").lower()
        if pol == "neutral" or abs(score) < 1e-9:
            continue
        if pol == "context":
            if complaint:
                total += min(-0.08, score)
            elif praise:
                total += 0.08
            continue
        total += score
    # Keep domain nudge modest so VADER still matters
    return max(-0.55, min(0.45, total / max(1.0, (len(matched) ** 0.5))))


def enrich_insurance_tags_with_lexicon(text: str, existing_tags: Optional[Iterable[str]] = None) -> List[str]:
    """Merge rule-based tags with lexicon-derived themes."""
    from .insurance_tags import TAXONOMY

    base = [str(t).strip().lower() for t in (existing_tags or []) if str(t).strip()]
    hits = match_lexicon(text, limit=50)
    themes = themes_from_lexicon_hits(hits)
    order = {k: i for i, k in enumerate(TAXONOMY)}
    merged: List[str] = []
    seen = set()
    for t in base + themes:
        if t not in TAXONOMY:
            # map unknown to other only if nothing else
            continue
        if t in seen:
            continue
        seen.add(t)
        merged.append(t)
    if not merged:
        return ["other"]
    return sorted(merged, key=lambda x: order.get(x, 999))
