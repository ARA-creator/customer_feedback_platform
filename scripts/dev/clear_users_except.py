#!/usr/bin/env python3
"""
Deactivate and clear account details for all users except a keep-list.

Soft-deletes users (recycle bin), sets is_active=False, and clears verification/reset tokens.
Does not permanently purge rows.

Usage (from repo root):
  python scripts/dev/clear_users_except.py --dry-run
  python scripts/dev/clear_users_except.py --execute
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

# someone@example.com is the account in DB; someoneexample.com kept for literal match if added later
DEFAULT_KEEP = ("claptonnon@gmail.com", "someone@example.com", "someoneexample.com")


def _normalize_email(raw: str) -> str:
    e = (raw or "").strip().lower()
    if "@" not in e:
        return e
    try:
        from email_validator import validate_email

        return validate_email(e, check_deliverability=False).normalized
    except Exception:
        return e


def clear_user_fields(user, now: datetime) -> None:
    user.deleted_at = now
    user.is_active = False
    user.suspended_at = user.suspended_at or now
    user.email_verified_at = None
    user.email_verification_nonce = None
    user.email_verification_code_hash = None
    user.email_verification_code_expires_at = None
    user.password_reset_nonce = None
    user.password_reset_code_hash = None
    user.password_reset_code_expires_at = None
    user.provider_subject = None
    user.full_name = None


def main() -> None:
    parser = argparse.ArgumentParser(description="Clear/deactivate users except keep-list")
    parser.add_argument(
        "--keep",
        default=",".join(DEFAULT_KEEP),
        help="Comma-separated emails to preserve (unchanged)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print actions only")
    parser.add_argument("--execute", action="store_true", help="Apply changes to the database")
    args = parser.parse_args()

    if not args.dry_run and not args.execute:
        print("Specify --dry-run or --execute")
        sys.exit(1)

    keep = {_normalize_email(x) for x in args.keep.split(",") if x.strip()}
    if not keep:
        print("Keep-list is empty; refusing to run.")
        sys.exit(1)

    from app.database import SessionLocal
    from app.models import User

    now = datetime.now(tz=timezone.utc)
    db = SessionLocal()
    try:
        users = db.query(User).order_by(User.id).all()
        kept = []
        cleared = []

        for u in users:
            email = _normalize_email(u.email or "")
            if email in keep:
                kept.append((u.id, u.email))
                continue
            cleared.append((u.id, u.email, bool(u.deleted_at), bool(u.is_active)))
            if args.execute:
                clear_user_fields(u, now)

        print(f"Keep ({len(kept)}):")
        for uid, em in kept:
            print(f"  id={uid} {em}")

        print(f"\nClear/deactivate ({len(cleared)}):")
        for uid, em, was_deleted, was_active in cleared:
            print(f"  id={uid} {em} (deleted_at={'yes' if was_deleted else 'no'}, active={was_active})")

        if args.execute:
            db.commit()
            print("\nOK: changes committed.")
        else:
            print("\nDry run only — no changes written. Use --execute to apply.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
