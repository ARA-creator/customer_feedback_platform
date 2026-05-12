#!/usr/bin/env python3
"""
Permanently remove feedback rows and dependent rows from the database.

Use the same repo-root ``.env`` as other scripts (``DATABASE_URL``). This is
**irreversible** — prefer Neon backup / branch snapshot before running.

Deletes (in order) for each target ``feedback.id``:
  ``notifications`` (rows whose JSON ``meta`` contains that ``feedback_id``) →
  ``feedback_surveys`` → ``feedback_reply_drafts`` → ``feedback_notes`` →
  ``feedback_policy_matches`` → ``feedback_workflows`` → ``feedback_search_documents`` → ``feedback``

Examples::

    cd customer_feedback_platform

    # Show what would be removed (no writes)
    python scripts/data/hard_delete_feedback.py --scope active --dry-run

    # Remove all rows where deleted_at IS NULL (typical \"inbox\" rows)
    python scripts/data/hard_delete_feedback.py --scope active --execute --confirm ACTIVE

    # Notifications only: drop \"new feedback\" rows whose feedback row was removed outside this script
    python scripts/data/hard_delete_feedback.py --orphan-feedback-notifications --dry-run
    python scripts/data/hard_delete_feedback.py --orphan-feedback-notifications --execute --confirm ORPHAN-NOTIFS

    # Notifications only: clear alerts for feedback you already soft-deleted (keeps feedback rows)
    python scripts/data/hard_delete_feedback.py --notifications-for-soft-deleted-feedback --dry-run
    python scripts/data/hard_delete_feedback.py --notifications-for-soft-deleted-feedback --execute --confirm PURGE-NOTIFS-SOFT-DELETED

    # Remove rows already soft-deleted (cleanup)
    python scripts/data/hard_delete_feedback.py --scope soft-deleted --execute --confirm SOFT-DELETED

    # Remove every feedback row (nuclear)
    python scripts/data/hard_delete_feedback.py --scope all --execute --confirm ALL-FEEDBACK
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import List, Sequence

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

import app.core.config  # noqa: F401 — loads .env

from app.database import SessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    Feedback,
    FeedbackNote,
    FeedbackPolicyMatch,
    FeedbackReplyDraft,
    FeedbackSearchDocument,
    FeedbackSurvey,
    FeedbackWorkflow,
    Notification,
)


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--scope",
        choices=("active", "soft-deleted", "all"),
        default="active",
        help="active: deleted_at IS NULL; soft-deleted: deleted_at IS NOT NULL; all: every feedback row.",
    )
    p.add_argument(
        "--ids",
        type=str,
        default="",
        help="Comma-separated feedback ids to delete (overrides --scope when set).",
    )
    p.add_argument("--dry-run", action="store_true", help="Only print counts; do not delete.")
    p.add_argument(
        "--execute",
        action="store_true",
        help="Perform deletes (required with matching --confirm).",
    )
    p.add_argument(
        "--confirm",
        type=str,
        default="",
        help="ACTIVE / SOFT-DELETED / ALL-FEEDBACK / IDS / ORPHAN-NOTIFS / PURGE-NOTIFS-SOFT-DELETED (see flags).",
    )
    p.add_argument(
        "--quiet",
        action="store_true",
        help="Skip printing database target line.",
    )
    p.add_argument(
        "--orphan-feedback-notifications",
        action="store_true",
        help="Only remove notifications (new_feedback / assigned_to_me) whose meta feedback_id "
        "no longer exists in feedback (e.g. after manual SQL deletes). Use --confirm ORPHAN-NOTIFS with --execute.",
    )
    p.add_argument(
        "--notifications-for-soft-deleted-feedback",
        action="store_true",
        help="Only remove notifications whose meta feedback_id points at a soft-deleted feedback row "
        "(deleted_at IS NOT NULL). Does not delete feedback. Use --confirm PURGE-NOTIFS-SOFT-DELETED with --execute.",
    )
    return p.parse_args()


def _describe_database_target() -> str:
    from app.core.config import get_config
    from urllib.parse import urlparse

    uri = (get_config().SQLALCHEMY_DATABASE_URI or "").strip()
    if not uri or ":memory:" in uri:
        return "WARNING: empty or in-memory DATABASE_URL"
    try:
        p = urlparse(uri)
        host = (p.hostname or "").lower()
        dbname = (p.path or "/").strip("/") or "?"
        kind = "Neon Postgres" if "neon.tech" in host else "Postgres"
        return f"{kind} @ {host} database={dbname}"
    except Exception:
        return "DATABASE_URL (host not parsed)"


def _feedback_ids_query(db, args: argparse.Namespace) -> List[int]:
    raw = (args.ids or "").strip()
    if raw:
        out: List[int] = []
        for part in raw.split(","):
            part = part.strip()
            if not part:
                continue
            out.append(int(part))
        return sorted(set(out))

    q = db.query(Feedback.id)
    if args.scope == "active":
        q = q.filter(Feedback.deleted_at.is_(None))
    elif args.scope == "soft-deleted":
        q = q.filter(Feedback.deleted_at.isnot(None))
    # all: no extra filter
    return [row[0] for row in q.order_by(Feedback.id.asc()).all()]


# Notification types that store ``feedback_id`` inside ``meta`` JSON (see integrations / feedback routes).
_NOTIFICATION_TYPES_WITH_FEEDBACK_META = frozenset({"new_feedback", "assigned_to_me"})


def _notification_ids_for_feedback(db, id_set: set[int]) -> list[int]:
    """Return notification primary keys whose meta JSON references a feedback id in id_set."""
    if not id_set:
        return []
    out: list[int] = []
    rows = (
        db.query(Notification.id, Notification.meta)
        .filter(Notification.type.in_(_NOTIFICATION_TYPES_WITH_FEEDBACK_META))
        .filter(Notification.meta.isnot(None))
        .filter(Notification.meta != "")
        .all()
    )
    for nid, meta_raw in rows:
        try:
            obj = json.loads(meta_raw or "{}")
        except Exception:
            continue
        raw_fid = obj.get("feedback_id")
        if raw_fid is None:
            continue
        try:
            fid = int(raw_fid)
        except (TypeError, ValueError):
            continue
        if fid in id_set:
            out.append(int(nid))
    return out


def _orphan_notification_ids_for_missing_feedback(db) -> list[int]:
    """Notifications referencing a feedback id that is not in ``feedback``."""
    rows = (
        db.query(Notification.id, Notification.meta)
        .filter(Notification.type.in_(_NOTIFICATION_TYPES_WITH_FEEDBACK_META))
        .filter(Notification.meta.isnot(None))
        .filter(Notification.meta != "")
        .all()
    )
    by_fid: dict[int, list[int]] = {}
    for nid, meta_raw in rows:
        try:
            obj = json.loads(meta_raw or "{}")
        except Exception:
            continue
        raw_fid = obj.get("feedback_id")
        if raw_fid is None:
            continue
        try:
            fid = int(raw_fid)
        except (TypeError, ValueError):
            continue
        by_fid.setdefault(fid, []).append(int(nid))
    if not by_fid:
        return []
    fid_list = list(by_fid.keys())
    existing = {int(r[0]) for r in db.query(Feedback.id).filter(Feedback.id.in_(fid_list)).all()}
    out: list[int] = []
    for fid, nids in by_fid.items():
        if fid not in existing:
            out.extend(nids)
    return out


def _soft_deleted_feedback_ids(db) -> set[int]:
    rows = db.query(Feedback.id).filter(Feedback.deleted_at.isnot(None)).all()
    return {int(r[0]) for r in rows}


def _purge_notifications_branch(
    db, *, n_ids: list[int], dry_run: bool, count_key: str, delete_key: str
) -> dict[str, int]:
    """Shared dry-run / delete for notification-only cleanup paths."""
    if dry_run:
        return {count_key: len(n_ids)}
    if n_ids:
        db.query(Notification).filter(Notification.id.in_(tuple(n_ids))).delete(synchronize_session=False)
    return {delete_key: len(n_ids)}


def _delete_for_ids(db, ids: Sequence[int], *, dry_run: bool) -> dict[str, int]:
    if not ids:
        return {}

    counts: dict[str, int] = {}
    id_tuple = tuple(ids)
    id_set = set(int(i) for i in ids)

    n_ids = _notification_ids_for_feedback(db, id_set)
    counts["notifications_matched"] = len(n_ids)

    def _count(model, name: str) -> int:
        n = db.query(model).filter(model.feedback_id.in_(id_tuple)).delete(synchronize_session=False)
        counts[name] = int(n)
        return int(n)

    if dry_run:
        counts["feedback_surveys"] = db.query(FeedbackSurvey).filter(FeedbackSurvey.feedback_id.in_(id_tuple)).count()
        counts["feedback_reply_drafts"] = (
            db.query(FeedbackReplyDraft).filter(FeedbackReplyDraft.feedback_id.in_(id_tuple)).count()
        )
        counts["feedback_notes"] = db.query(FeedbackNote).filter(FeedbackNote.feedback_id.in_(id_tuple)).count()
        counts["feedback_policy_matches"] = (
            db.query(FeedbackPolicyMatch).filter(FeedbackPolicyMatch.feedback_id.in_(id_tuple)).count()
        )
        counts["feedback_workflows"] = (
            db.query(FeedbackWorkflow).filter(FeedbackWorkflow.feedback_id.in_(id_tuple)).count()
        )
        counts["feedback_search_documents"] = (
            db.query(FeedbackSearchDocument).filter(FeedbackSearchDocument.feedback_id.in_(id_tuple)).count()
        )
        counts["feedback"] = db.query(Feedback).filter(Feedback.id.in_(id_tuple)).count()
        return counts

    if n_ids:
        db.query(Notification).filter(Notification.id.in_(tuple(n_ids))).delete(synchronize_session=False)
    counts["notifications_deleted"] = len(n_ids)

    _count(FeedbackSurvey, "feedback_surveys_deleted")
    _count(FeedbackReplyDraft, "feedback_reply_drafts_deleted")
    _count(FeedbackNote, "feedback_notes_deleted")
    _count(FeedbackPolicyMatch, "feedback_policy_matches_deleted")
    _count(FeedbackWorkflow, "feedback_workflows_deleted")
    _count(FeedbackSearchDocument, "feedback_search_documents_deleted")
    n_fb = db.query(Feedback).filter(Feedback.id.in_(id_tuple)).delete(synchronize_session=False)
    counts["feedback_deleted"] = int(n_fb)
    return counts


def _expected_confirm(scope: str, ids: str) -> str | None:
    if ids.strip():
        return None
    if scope == "active":
        return "ACTIVE"
    if scope == "soft-deleted":
        return "SOFT-DELETED"
    return "ALL-FEEDBACK"


def main() -> int:
    args = _parse_args()
    if args.execute and args.dry_run:
        print("error: use only one of --execute or --dry-run", file=sys.stderr)
        return 2

    if int(bool(args.orphan_feedback_notifications)) + int(bool(args.notifications_for_soft_deleted_feedback)) > 1:
        print(
            "error: use only one of --orphan-feedback-notifications or "
            "--notifications-for-soft-deleted-feedback",
            file=sys.stderr,
        )
        return 2

    if args.orphan_feedback_notifications:
        if (args.ids or "").strip():
            print("error: --orphan-feedback-notifications cannot be combined with --ids", file=sys.stderr)
            return 2
        if args.execute and (args.confirm or "").strip() != "ORPHAN-NOTIFS":
            print("error: pass --confirm ORPHAN-NOTIFS with --execute", file=sys.stderr)
            return 2
    elif args.notifications_for_soft_deleted_feedback:
        if (args.ids or "").strip():
            print(
                "error: --notifications-for-soft-deleted-feedback cannot be combined with --ids",
                file=sys.stderr,
            )
            return 2
        if args.execute and (args.confirm or "").strip() != "PURGE-NOTIFS-SOFT-DELETED":
            print("error: pass --confirm PURGE-NOTIFS-SOFT-DELETED with --execute", file=sys.stderr)
            return 2
    elif args.execute:
        expected = _expected_confirm(args.scope, args.ids)
        if expected is not None:
            if (args.confirm or "").strip() != expected:
                print(
                    f"error: for --scope {args.scope!r} you must pass --confirm {expected}",
                    file=sys.stderr,
                )
                return 2
        else:
            if (args.confirm or "").strip() != "IDS":
                print("error: when using --ids you must pass --confirm IDS", file=sys.stderr)
                return 2

    notif_only = args.orphan_feedback_notifications or args.notifications_for_soft_deleted_feedback
    if not args.dry_run and not args.execute:
        if notif_only:
            args.dry_run = True
            if not args.quiet:
                print(
                    "note: notification-only flags default to --dry-run; "
                    "pass --execute with the matching --confirm to delete rows.",
                    file=sys.stderr,
                    flush=True,
                )
        else:
            print("error: specify --dry-run or --execute", file=sys.stderr)
            return 2

    if not args.quiet:
        print({"database_target": _describe_database_target()}, flush=True)

    db = SessionLocal()
    try:
        if args.orphan_feedback_notifications:
            n_ids = _orphan_notification_ids_for_missing_feedback(db)
            print({"orphan_notification_ids": len(n_ids), "first_ids": n_ids[:20]}, flush=True)
            if not n_ids:
                print({"ok": True, "message": "No orphan feedback notifications"}, flush=True)
                return 0
            counts = _purge_notifications_branch(
                db,
                n_ids=n_ids,
                dry_run=args.dry_run,
                count_key="notifications_orphan_matched",
                delete_key="notifications_deleted",
            )
            print({"dry_run": args.dry_run, "counts": counts}, flush=True)
            if args.execute:
                db.commit()
                print({"ok": True, "committed": True}, flush=True)
            return 0

        if args.notifications_for_soft_deleted_feedback:
            sd = _soft_deleted_feedback_ids(db)
            n_ids = _notification_ids_for_feedback(db, sd)
            print(
                {
                    "soft_deleted_feedback_ids": len(sd),
                    "matching_notification_ids": len(n_ids),
                    "first_notification_ids": n_ids[:20],
                },
                flush=True,
            )
            if not n_ids:
                print({"ok": True, "message": "No notifications linked to soft-deleted feedback"}, flush=True)
                return 0
            counts = _purge_notifications_branch(
                db,
                n_ids=n_ids,
                dry_run=args.dry_run,
                count_key="notifications_soft_deleted_feedback_matched",
                delete_key="notifications_deleted",
            )
            print({"dry_run": args.dry_run, "counts": counts}, flush=True)
            if args.execute:
                db.commit()
                print({"ok": True, "committed": True}, flush=True)
            return 0

        ids = _feedback_ids_query(db, args)
        print({"feedback_ids_to_process": len(ids), "first_ids": ids[:20]}, flush=True)
        if not ids:
            print({"ok": True, "message": "No matching feedback rows"}, flush=True)
            return 0

        counts = _delete_for_ids(db, ids, dry_run=args.dry_run)
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
