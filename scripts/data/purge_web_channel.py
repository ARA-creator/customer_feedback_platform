#!/usr/bin/env python3
"""
Remove all web-monitor feedback (source=web), linked notifications, and dedupe rows.

Uses repo-root .env (DATABASE_URL). Irreversible — back up Neon first.

  python scripts/data/purge_web_channel.py --dry-run
  python scripts/data/purge_web_channel.py --execute --confirm PURGE-WEB
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "scripts" / "data"))

import app.core.config  # noqa: F401

from sqlalchemy import func  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models import ExternalIngestedItem, Feedback, Notification  # noqa: E402

# Reuse hard-delete cascade for feedback dependents.
from hard_delete_feedback import _delete_for_ids, _describe_database_target  # noqa: E402


def _web_feedback_ids(db) -> list[int]:
    return [
        int(r[0])
        for r in db.query(Feedback.id)
        .filter(func.lower(Feedback.source) == "web")
        .order_by(Feedback.id.asc())
        .all()
    ]


def _web_notification_ids(db) -> list[int]:
    rows = (
        db.query(Notification.id, Notification.meta)
        .filter(Notification.meta.isnot(None))
        .filter(Notification.meta != "")
        .all()
    )
    out: list[int] = []
    for nid, meta_raw in rows:
        try:
            obj = json.loads(meta_raw or "{}")
        except Exception:
            continue
        if str(obj.get("source") or "").lower() == "web":
            out.append(int(nid))
    return out


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--execute", action="store_true")
    p.add_argument("--confirm", default="", help="Required with --execute: PURGE-WEB")
    args = p.parse_args()

    if args.execute and args.dry_run:
        print("error: use only one of --execute or --dry-run", file=sys.stderr)
        return 2
    if not args.execute and not args.dry_run:
        args.dry_run = True
        print("note: defaulting to --dry-run; pass --execute --confirm PURGE-WEB to delete.", file=sys.stderr)

    if args.execute and (args.confirm or "").strip() != "PURGE-WEB":
        print("error: pass --confirm PURGE-WEB with --execute", file=sys.stderr)
        return 2

    print({"database_target": _describe_database_target()}, flush=True)

    db = SessionLocal()
    try:
        fb_ids = _web_feedback_ids(db)
        notif_ids = _web_notification_ids(db)
        ext_count = (
            db.query(ExternalIngestedItem.id).filter(func.lower(ExternalIngestedItem.source) == "web").count()
        )

        print(
            {
                "web_feedback_ids": len(fb_ids),
                "web_notifications_meta": len(notif_ids),
                "external_ingested_web": int(ext_count),
                "first_feedback_ids": fb_ids[:15],
            },
            flush=True,
        )

        if not fb_ids and not notif_ids and not ext_count:
            print({"ok": True, "message": "Nothing to purge"}, flush=True)
            return 0

        counts: dict = {}
        if fb_ids:
            counts["feedback_cascade"] = _delete_for_ids(db, fb_ids, dry_run=args.dry_run)

        leftover_notif = _web_notification_ids(db)
        counts["notifications_web_meta_remaining"] = len(leftover_notif)
        if leftover_notif and not args.dry_run:
            db.query(Notification).filter(Notification.id.in_(tuple(leftover_notif))).delete(
                synchronize_session=False
            )
            counts["notifications_web_meta_deleted"] = len(leftover_notif)

        if ext_count and not args.dry_run:
            deleted_ext = (
                db.query(ExternalIngestedItem)
                .filter(func.lower(ExternalIngestedItem.source) == "web")
                .delete(synchronize_session=False)
            )
            counts["external_ingested_deleted"] = int(deleted_ext)
        elif ext_count:
            counts["external_ingested_matched"] = int(ext_count)

        print({"dry_run": args.dry_run, "counts": counts}, flush=True)

        if args.execute:
            db.commit()
            print({"ok": True, "committed": True}, flush=True)
        return 0
    except Exception as exc:
        db.rollback()
        print(f"Error: {exc}", file=sys.stderr, flush=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
