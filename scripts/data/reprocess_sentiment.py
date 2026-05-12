#!/usr/bin/env python3
"""
Recompute and persist ``sentiment_label`` / ``sentiment_score`` on Feedback rows.

Uses the same logic as ``POST /api/admin/reprocess-sentiment`` (decrypt message,
optional insurance tag backfill, ``analyze_sentiment``).

Environment (same as the Flask app — load from repo-root ``.env`` via ``app.core.config``):

- ``DATABASE_URL`` — SQLAlchemy URL for your Postgres database. With **Neon**, copy the
  connection string from the Neon console (same value as Vercel ``DATABASE_URL`` when
  updating production data). Include ``sslmode=require`` if the console provides it.
  On startup the script prints ``database_target`` (host + DB name) so you can confirm
  updates go to Neon before any commit.
- ``SECRET_KEY`` — must match the key used to encrypt stored messages or decrypt will fail.

Examples::

    cd customer_feedback_platform
    python scripts/data/reprocess_sentiment.py --force

    # Full history in one go (pages internally)
    python scripts/data/reprocess_sentiment.py --force --until-done --order oldest

    # Dry run (no DB writes)
    python scripts/data/reprocess_sentiment.py --force --dry-run

    # Only rows missing sentiment (same as API default)
    python scripts/data/reprocess_sentiment.py

    # Recent window + cap
    python scripts/data/reprocess_sentiment.py --force --range-days 90 --limit 2000
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

import app.core.config  # noqa: F401 — loads repo-root .env

from sqlalchemy import asc, desc, or_  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models import Feedback  # noqa: E402
from app.routes.api._helpers import _safe_json_dumps  # noqa: E402
from app.security import decrypt_text  # noqa: E402
from app.sentiment_analyzer import analyze_sentiment  # noqa: E402
from app.services.insurance_tags import categorize_insurance_tags  # noqa: E402
from app.services.metadata_normalization import normalize_channel_metadata  # noqa: E402


def _describe_database_target() -> str:
    """
    Human-readable DB target (no password). Helps confirm Neon vs local before commits.
    """
    from app.core.config import get_config

    uri = (get_config().SQLALCHEMY_DATABASE_URI or "").strip()
    if not uri or ":memory:" in uri:
        return "WARNING: empty or in-memory DATABASE_URL — set Neon/production URL in repo-root .env"
    try:
        parsed = urlparse(uri)
        host = (parsed.hostname or "").lower()
        dbname = (parsed.path or "/").strip("/") or "?"
        if "neon.tech" in host:
            kind = "Neon Postgres"
        elif host:
            kind = "Postgres"
        else:
            kind = "SQL database"
        return f"{kind} @ {host or '?'} database={dbname} — UPDATE feedback SET sentiment_* goes here"
    except Exception:
        return "DATABASE_URL is set (could not parse host; commits still use this URL)"


@dataclass
class BatchResult:
    scanned: int
    updated: int
    skipped: int
    next_cursor_id: Optional[int]
    batch_rows: int


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--force",
        action="store_true",
        help="Rewrite sentiment even when label/score already set (recommended after model changes).",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Scan and count updates but do not commit changes.",
    )
    p.add_argument(
        "--until-done",
        action="store_true",
        help="Keep paging with --limit until all matching rows are processed (not with --dry-run).",
    )
    p.add_argument(
        "--range-days",
        type=int,
        choices=(7, 30, 90),
        default=None,
        metavar="N",
        help="Only feedback created within the last N days (omit for all time).",
    )
    p.add_argument(
        "--limit",
        type=int,
        default=500,
        help="Max rows per batch (default 500, max 5000).",
    )
    p.add_argument(
        "--order",
        choices=("newest", "oldest"),
        default="newest",
        help="Process newest or oldest ids first (default newest).",
    )
    p.add_argument(
        "--cursor-id",
        type=int,
        default=None,
        help="Resume from a feedback id (use next_cursor_id from a previous run if paging).",
    )
    p.add_argument(
        "--commit-every",
        type=int,
        default=200,
        metavar="N",
        help="Commit every N updated rows (default 200).",
    )
    p.add_argument(
        "--quiet",
        action="store_true",
        help="Do not print the database target line before running.",
    )
    return p.parse_args()


def _process_batch(
    db,
    *,
    force: bool,
    dry_run: bool,
    range_days: Optional[int],
    limit: int,
    order_oldest: bool,
    now: datetime,
    cursor_id: Optional[int],
    commit_every: int,
) -> BatchResult:
    q = db.query(Feedback).filter(Feedback.deleted_at.is_(None))
    if range_days in (7, 30, 90):
        q = q.filter(Feedback.created_at >= (now - timedelta(days=range_days)))
    if not force:
        q = q.filter(or_(Feedback.sentiment_label.is_(None), Feedback.sentiment_label == ""))

    if cursor_id is not None:
        if order_oldest:
            q = q.filter(Feedback.id > cursor_id)
        else:
            q = q.filter(Feedback.id < cursor_id)

    q = q.order_by(asc(Feedback.id) if order_oldest else desc(Feedback.id))
    rows = q.limit(limit).all()

    scanned = 0
    updated = 0
    skipped = 0
    pending_commit = 0

    for fb in rows:
        scanned += 1
        try:
            msg = decrypt_text(fb.message_encrypted) or ""
        except Exception:
            skipped += 1
            continue
        msg = str(msg).strip()
        if not msg:
            skipped += 1
            continue

        meta_fb = normalize_channel_metadata(getattr(fb, "source", None), fb.channel_metadata) or {}
        raw_ins = meta_fb.get("insurance_tags")
        ins_list = None
        if isinstance(raw_ins, list) and len(raw_ins) > 0:
            ins_list = [str(t).strip().lower() for t in raw_ins if str(t).strip()]
        else:
            try:
                computed = categorize_insurance_tags(msg, source=getattr(fb, "source", None))
            except Exception:
                computed = []
            if isinstance(computed, list) and computed:
                ins_list = [str(t).strip().lower() for t in computed if str(t).strip()]
                if not dry_run:
                    meta_fb["insurance_tags"] = ins_list
                    fb.channel_metadata = _safe_json_dumps(meta_fb)

        sentiment = analyze_sentiment(msg, source=getattr(fb, "source", None), insurance_tags=ins_list)
        label = sentiment.get("label")
        score = sentiment.get("score")
        if label not in {"positive", "neutral", "negative"}:
            skipped += 1
            continue

        if dry_run:
            updated += 1
            continue

        fb.sentiment_label = label
        fb.sentiment_score = float(score) if score is not None else None
        updated += 1
        pending_commit += 1
        if pending_commit >= commit_every:
            db.commit()
            pending_commit = 0
            print(f"Committed progress… updated={updated} scanned={scanned}", flush=True)

    if not dry_run and pending_commit:
        db.commit()

    last = rows[-1] if rows else None
    next_hint: Optional[int] = None
    if last and len(rows) == limit:
        more_q = db.query(Feedback.id).filter(Feedback.deleted_at.is_(None))
        if range_days in (7, 30, 90):
            more_q = more_q.filter(Feedback.created_at >= (now - timedelta(days=range_days)))
        if not force:
            more_q = more_q.filter(or_(Feedback.sentiment_label.is_(None), Feedback.sentiment_label == ""))
        more_q = more_q.filter(Feedback.id > last.id if order_oldest else Feedback.id < last.id)
        if more_q.first() is not None:
            next_hint = last.id

    return BatchResult(
        scanned=scanned,
        updated=updated,
        skipped=skipped,
        next_cursor_id=next_hint,
        batch_rows=len(rows),
    )


def main() -> int:
    args = _parse_args()
    if args.dry_run and args.until_done:
        print("error: --until-done cannot be used with --dry-run", file=sys.stderr)
        return 2

    limit = max(1, min(int(args.limit), 5000))
    order_oldest = args.order == "oldest"
    now = datetime.now(tz=timezone.utc)

    if not args.quiet:
        print({"database_target": _describe_database_target()}, flush=True)

    cursor_id: Optional[int] = args.cursor_id
    grand_scanned = 0
    grand_updated = 0
    grand_skipped = 0
    batches = 0

    db = SessionLocal()
    try:
        while True:
            batches += 1
            if batches > 50_000:
                print("error: exceeded 50000 batches; stop and narrow filters", file=sys.stderr)
                return 1

            br = _process_batch(
                db,
                force=args.force,
                dry_run=args.dry_run,
                range_days=args.range_days,
                limit=limit,
                order_oldest=order_oldest,
                now=now,
                cursor_id=cursor_id,
                commit_every=args.commit_every,
            )
            grand_scanned += br.scanned
            grand_updated += br.updated
            grand_skipped += br.skipped

            if args.until_done:
                print(
                    {
                        "batch": batches,
                        "scanned": br.scanned,
                        "updated": br.updated,
                        "skipped": br.skipped,
                        "next_cursor_id": br.next_cursor_id,
                        "batch_rows": br.batch_rows,
                    },
                    flush=True,
                )

            if not args.until_done:
                print(
                    {
                        "ok": True,
                        "total_scanned": grand_scanned,
                        "total_updated": grand_updated,
                        "total_skipped": grand_skipped,
                        "dry_run": args.dry_run,
                        "force": args.force,
                        "range_days": args.range_days,
                        "limit": limit,
                        "order": args.order,
                        "next_cursor_id": br.next_cursor_id,
                        "done": br.next_cursor_id is None,
                    },
                    flush=True,
                )
                if br.next_cursor_id is not None:
                    print(
                        f"\nMore rows remain. Re-run with: --cursor-id {br.next_cursor_id} --order {args.order} "
                        f"{'--force ' if args.force else ''}"
                        f"{'--range-days ' + str(args.range_days) + ' ' if args.range_days else ''}"
                        f"--limit {limit}",
                        flush=True,
                    )
                return 0

            if br.next_cursor_id is None or br.batch_rows == 0:
                print(
                    {
                        "ok": True,
                        "total_scanned": grand_scanned,
                        "total_updated": grand_updated,
                        "total_skipped": grand_skipped,
                        "batches": batches,
                        "done": True,
                    },
                    flush=True,
                )
                return 0

            cursor_id = br.next_cursor_id
    except Exception as exc:
        db.rollback()
        print(f"Error: {exc}", file=sys.stderr, flush=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
