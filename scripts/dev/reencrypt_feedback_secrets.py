#!/usr/bin/env python3
"""
Re-encrypt feedback (and related) ciphertext that was encrypted under an older SECRET_KEY.

Usage (from repo root):
  .venv/bin/python scripts/dev/reencrypt_feedback_secrets.py
  .venv/bin/python scripts/dev/reencrypt_feedback_secrets.py --dry-run
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Re-encrypt feedback rows to current SECRET_KEY")
    parser.add_argument("--dry-run", action="store_true", help="Report only; do not write")
    parser.add_argument("--limit", type=int, default=0, help="Optional max rows to scan (0 = all)")
    parser.add_argument(
        "--from-search-docs",
        action="store_true",
        help="If ciphertext cannot be decrypted, rebuild from feedback_search_documents.message_search_text",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[2]
    _load_dotenv(root / ".env")
    sys.path.insert(0, str(root / "backend"))

    from app.database import SessionLocal
    from app.models import CustomerProfile, Feedback
    from app.core.config import get_config
    from app.core.security import (
        _fallback_secret_keys,
        decrypt_text_with_key,
        encrypt_text,
    )

    cfg = get_config()
    current = str(cfg.SECRET_KEY or "")
    candidates = _fallback_secret_keys()
    print(f"Current SECRET_KEY length={len(current)} candidates={len(candidates)}")

    db = SessionLocal()
    updated_messages = 0
    updated_emails = 0
    updated_profiles = 0
    already_ok = 0
    failed = 0
    scanned = 0

    try:
        q = db.query(Feedback).order_by(Feedback.id.asc())
        if args.limit and args.limit > 0:
            q = q.limit(int(args.limit))
        rows = q.all()
        print(f"Scanning {len(rows)} feedback rows...")

        for fb in rows:
            scanned += 1
            token = fb.message_encrypted
            if not token:
                continue

            if decrypt_text_with_key(token, current) is not None:
                already_ok += 1
            else:
                plaintext = None
                for secret in candidates:
                    if secret == current:
                        continue
                    plaintext = decrypt_text_with_key(token, secret)
                    if plaintext is not None:
                        break
                if plaintext is None and args.from_search_docs:
                    from app.models import FeedbackSearchDocument

                    doc = (
                        db.query(FeedbackSearchDocument.message_search_text)
                        .filter(FeedbackSearchDocument.feedback_id == fb.id)
                        .first()
                    )
                    plaintext = (doc[0] if doc else None) or None
                    if plaintext:
                        plaintext = str(plaintext).strip() or None
                if plaintext is None:
                    failed += 1
                    print(f"  FAIL message feedback_id={fb.id}")
                else:
                    new_token = encrypt_text(plaintext)
                    if new_token and new_token != token:
                        if not args.dry_run:
                            fb.message_encrypted = new_token
                        updated_messages += 1

            email_token = getattr(fb, "email_encrypted", None)
            if email_token:
                if decrypt_text_with_key(email_token, current) is None:
                    email_plain = None
                    for secret in candidates:
                        if secret == current:
                            continue
                        email_plain = decrypt_text_with_key(email_token, secret)
                        if email_plain is not None:
                            break
                    if email_plain is not None:
                        new_email = encrypt_text(email_plain)
                        if new_email and new_email != email_token:
                            if not args.dry_run:
                                fb.email_encrypted = new_email
                            updated_emails += 1

            if scanned % 100 == 0:
                print(f"  ...scanned {scanned}")

        profiles = db.query(CustomerProfile).all()
        for profile in profiles:
            email_token = getattr(profile, "primary_email_encrypted", None)
            if not email_token:
                continue
            if decrypt_text_with_key(email_token, current) is not None:
                continue
            email_plain = None
            for secret in candidates:
                if secret == current:
                    continue
                email_plain = decrypt_text_with_key(email_token, secret)
                if email_plain is not None:
                    break
            if email_plain is None:
                continue
            new_email = encrypt_text(email_plain)
            if new_email and new_email != email_token:
                if not args.dry_run:
                    profile.primary_email_encrypted = new_email
                updated_profiles += 1

        if not args.dry_run:
            db.commit()
            print("Committed updates.")
        else:
            db.rollback()
            print("Dry run - no changes written.")

        print(
            "Done:",
            {
                "scanned": scanned,
                "already_ok": already_ok,
                "messages_reencrypted": updated_messages,
                "emails_reencrypted": updated_emails,
                "profiles_reencrypted": updated_profiles,
                "failed": failed,
                "dry_run": bool(args.dry_run),
            },
        )
        return 0 if failed == 0 else 2
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
