"""
Trend + anomaly detection (rolling windows): negative sentiment spikes and topic surges.

Windows (UTC):
  - recent:    [now - 24h, now)
  - baseline: [now - 7d - 24h, now - 24h)  (7 full days before the last 24h)

Emits notifications via notify_users_anomaly_alert; dedupes with AnomalyDedupe + 6h cooldown.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from ..database import SessionLocal
from ..models import AnomalyDedupe, Feedback
from ..services.metadata_normalization import normalize_channel_metadata
from ..services.prioritization import normalize_source_group

logger = logging.getLogger(__name__)

COOLDOWN = timedelta(hours=6)
RECENT = timedelta(hours=24)
BASELINE = timedelta(days=7)

# Thresholds (tunable; keep explainable)
MIN_RECENT_TOTAL = 5
MIN_BASELINE_TOTAL = 12
MIN_RECENT_NEG = 3
NEG_SHARE_MULT = 1.6  # recent neg share >= baseline * this
MIN_TOPIC_RECENT = 4
MIN_TOPIC_BASELINE = 6
TOPIC_VOL_MULT = 1.45  # recent share of topic among channel >= baseline * this


@dataclass
class _Bucket:
    total: int = 0
    neg: int = 0


def _sha64(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:64]


def _primary_topic(fb: Feedback, meta: Dict[str, Any]) -> Optional[str]:
    tags = meta.get("insurance_tags")
    if isinstance(tags, list) and tags:
        t0 = str(tags[0] or "").strip().lower()
        return t0[:80] or None
    cat = (fb.category or "").strip().lower()
    return cat[:80] or None


def _location_key(meta: Dict[str, Any]) -> Optional[str]:
    loc = str(meta.get("location") or "").strip().lower()
    return loc[:120] or None


def _window_for_ts(ts: datetime, recent_start: datetime, baseline_start: datetime, baseline_end: datetime) -> Optional[str]:
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    else:
        ts = ts.astimezone(timezone.utc)
    if ts >= recent_start:
        return "recent"
    if baseline_start <= ts < baseline_end:
        return "baseline"
    return None


def _pct(n: int, d: int) -> float:
    if d <= 0:
        return 0.0
    return round(100.0 * n / d, 1)


def _maybe_fire(
    db,
    *,
    dedupe_parts: List[str],
    title: str,
    body: str,
    meta: Dict[str, Any],
) -> bool:
    key = _sha64("|".join(dedupe_parts))
    now = datetime.now(tz=timezone.utc)
    row = db.query(AnomalyDedupe).filter(AnomalyDedupe.dedupe_key == key).first()
    if row and (now - row.last_fired_at) < COOLDOWN:
        return False
    if not row:
        row = AnomalyDedupe(dedupe_key=key, last_fired_at=now)
        db.add(row)
    else:
        row.last_fired_at = now
    db.flush()

    from ..routes.api import notify_users_anomaly_alert

    notify_users_anomaly_alert(
        db,
        n_type="anomaly_alert",
        title=title,
        body=body,
        href="inbox",
        meta=meta,
    )
    return True


def run_anomaly_detection_cycle() -> Dict[str, Any]:
    """
    One evaluation pass. Safe to call from a background thread.
    """
    db = SessionLocal()
    emitted = 0
    try:
        now = datetime.now(tz=timezone.utc)
        recent_start = now - RECENT
        baseline_end = recent_start
        baseline_start = baseline_end - BASELINE
        # Load a little extra in case of clock skew
        load_from = baseline_start - timedelta(hours=1)

        rows = (
            db.query(Feedback)
            .filter(Feedback.deleted_at.is_(None))
            .filter(Feedback.created_at >= load_from)
            .order_by(Feedback.created_at)
            .all()
        )

        # scope -> window -> bucket
        ch_sent: Dict[str, Dict[str, _Bucket]] = {}
        ch_loc_sent: Dict[Tuple[str, str], Dict[str, _Bucket]] = {}
        ch_tag_sent: Dict[Tuple[str, str], Dict[str, _Bucket]] = {}
        ch_tot: Dict[str, Dict[str, _Bucket]] = {}

        for fb in rows:
            if not fb.created_at:
                continue
            meta = normalize_channel_metadata(fb.source, fb.channel_metadata) or {}
            ch = (normalize_source_group(fb.source) or str(fb.source or "unknown").lower() or "unknown")[:50]
            loc = _location_key(meta)
            ptag = _primary_topic(fb, meta)
            w = _window_for_ts(fb.created_at, recent_start, baseline_start, baseline_end)
            if not w:
                continue
            label = (fb.sentiment_label or "neutral").lower()
            is_neg = 1 if label == "negative" else 0

            def _add(m: Dict[Any, Dict[str, _Bucket]], k):
                b = m.setdefault(k, {"recent": _Bucket(), "baseline": _Bucket()})
                bk = b[w]
                bk.total += 1
                bk.neg += is_neg

            _add(ch_sent, ch)
            _add(ch_tot, ch)
            if loc:
                _add(ch_loc_sent, (ch, loc))
            if ptag:
                _add(ch_tag_sent, (ch, ptag))

        # 1) Negative sentiment spike per channel
        for ch, win in ch_sent.items():
            rr, br = win["recent"], win["baseline"]
            if rr.total < MIN_RECENT_TOTAL or br.total < MIN_BASELINE_TOTAL:
                continue
            if rr.neg < MIN_RECENT_NEG:
                continue
            rs = rr.neg / max(rr.total, 1)
            bs = br.neg / max(br.total, 1)
            if rs < max(0.12, bs * NEG_SHARE_MULT):
                continue
            explain = (
                f"Negative share last 24h: {_pct(rr.neg, rr.total)}% ({rr.neg}/{rr.total}) vs "
                f"baseline 7d before that: {_pct(br.neg, br.total)}% ({br.neg}/{br.total}). "
                f"Channel: {ch}."
            )
            meta = {
                "anomaly": True,
                "kind": "sentiment_spike",
                "window": "24h_vs_7d_baseline",
                "channel": ch,
                "inbox_preset": {
                    "source": ch,
                    "sentiment": "negative",
                    "insurance_tag": "all",
                    "location": "",
                    "date_range": "7d",
                },
                "explain": explain,
            }
            if _maybe_fire(
                db,
                dedupe_parts=["sent", ch, "ch"],
                title=f"Negative sentiment spike: {ch}",
                body=explain,
                meta=meta,
            ):
                emitted += 1

        # 2) Channel + location (if location present in metadata for enough volume)
        for (ch, loc), win in ch_loc_sent.items():
            rr, br = win["recent"], win["baseline"]
            if rr.total < max(3, MIN_RECENT_TOTAL - 2) or br.total < max(5, MIN_BASELINE_TOTAL - 4):
                continue
            if rr.neg < max(2, MIN_RECENT_NEG - 1):
                continue
            rs = rr.neg / max(rr.total, 1)
            bs = br.neg / max(br.total, 1)
            if rs < max(0.15, bs * NEG_SHARE_MULT):
                continue
            explain = (
                f"Negative share last 24h in {loc}: {_pct(rr.neg, rr.total)}% ({rr.neg}/{rr.total}) vs "
                f"baseline: {_pct(br.neg, br.total)}% ({br.neg}/{br.total}). "
                f"Channel: {ch}."
            )
            meta = {
                "anomaly": True,
                "kind": "sentiment_spike",
                "window": "24h_vs_7d_baseline",
                "channel": ch,
                "location": loc,
                "inbox_preset": {
                    "source": ch,
                    "sentiment": "negative",
                    "insurance_tag": "all",
                    "location": loc,
                    "date_range": "7d",
                },
                "explain": explain,
            }
            if _maybe_fire(
                db,
                dedupe_parts=["sent", ch, "loc", loc],
                title=f"Spike in {ch} ({loc})",
                body=explain,
                meta=meta,
            ):
                emitted += 1

        # 3) Topic surge (primary insurance tag or category) — volume share within channel
        for (ch, tag), win in ch_tag_sent.items():
            rr, br = win["recent"], win["baseline"]
            tot = ch_tot.get(ch) or {"recent": _Bucket(), "baseline": _Bucket()}
            tr, tb = tot["recent"], tot["baseline"]
            if rr.total < MIN_TOPIC_RECENT or br.total < MIN_TOPIC_BASELINE:
                continue
            if tr.total < 1 or tb.total < 1:
                continue
            s_recent = rr.total / max(tr.total, 1)
            s_base = br.total / max(tb.total, 1)
            if s_recent < s_base * TOPIC_VOL_MULT:
                continue
            # Also require some negative weight in the topic in recent (topic “heat”)
            if rr.neg < 1:
                continue
            explain = (
                f"Topic “{tag}” share of {ch} volume last 24h: {_pct(rr.total, tr.total)}% ({rr.total}/{tr.total}) vs "
                f"baseline: {_pct(br.total, tb.total)}% ({br.total}/{tb.total}). "
            )
            meta = {
                "anomaly": True,
                "kind": "topic_surge",
                "window": "24h_vs_7d_baseline",
                "channel": ch,
                "topic": tag,
                "inbox_preset": {
                    "source": ch,
                    "sentiment": "all",
                    "insurance_tag": tag,
                    "location": "",
                    "date_range": "7d",
                },
                "explain": explain,
            }
            if _maybe_fire(
                db,
                dedupe_parts=["topic", ch, tag],
                title=f"Topic surge: {tag} ({ch})",
                body=explain,
                meta=meta,
            ):
                emitted += 1

        try:
            db.commit()
        except Exception:
            db.rollback()
            raise

        return {"ok": True, "alerts_evaluated": emitted, "rows": len(rows)}
    except Exception:
        db.rollback()
        logger.exception("anomaly detection cycle failed")
        return {"ok": False, "error": "failed"}
    finally:
        db.close()
