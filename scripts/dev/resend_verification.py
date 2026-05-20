#!/usr/bin/env python3
"""Resend the 6-digit email verification code for a pending signup."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

import app.core.config  # noqa: F401

from app.database import SessionLocal  # noqa: E402
from app.models import User  # noqa: E402
from app.routes.api.auth import _issue_email_verification_code  # noqa: E402
from app.services.emailer import smtp_is_configured  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("email", help="Account email (same as signup)")
    args = p.parse_args()
    email = args.email.strip().lower()
    if not email:
        print("error: email required", file=sys.stderr)
        return 2

    if not smtp_is_configured():
        print(
            "error: SMTP is not configured. Set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, "
            "SMTP_FROM_EMAIL in .env (or Vercel project env) and retry.",
            file=sys.stderr,
        )
        return 2

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"error: no user with email {email!r}", file=sys.stderr)
            return 1
        if getattr(user, "email_verified_at", None):
            print(f"ok: {email} is already verified")
            return 0
        _issue_email_verification_code(db, user)
        print(f"ok: verification email sent to {email}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
