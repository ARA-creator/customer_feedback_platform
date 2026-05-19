#!/usr/bin/env python3
"""
Quick check that local .env points at the expected Neon DB and which accounts can sign in.

Usage (from repo root):
  python scripts/dev/check_shared_db.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")


def _mask_email(email: str) -> str:
    e = (email or "").strip()
    if "@" not in e:
        return "***"
    local, domain = e.split("@", 1)
    return f"{local[:2]}***@{domain}"


def main() -> None:
    url = (os.getenv("DATABASE_URL") or "").strip()
    if not url or url.startswith("sqlite"):
        print("DATABASE_URL is missing or points at SQLite — not shared production Neon.")
        print("Set DATABASE_URL in .env from Vercel (backend → Environment Variables).")
        sys.exit(1)

    p = urlparse(url)
    print(f"Host: {p.hostname}")
    print(f"Database: {(p.path or '').lstrip('/').split('?')[0]}")

    from sqlalchemy import create_engine, text

    engine = create_engine(url)
    with engine.connect() as conn:
        total = conn.execute(
            text("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL")
        ).scalar()
        verified = conn.execute(
            text(
                "SELECT COUNT(*) FROM users WHERE deleted_at IS NULL "
                "AND email_verified_at IS NOT NULL"
            )
        ).scalar()
        print(f"Active users: {total}")
        print(f"Can sign in (email verified): {verified}")
        print()
        print("Accounts (verified users can log in with production password):")
        rows = conn.execute(
            text(
                """
                SELECT email, email_verified_at IS NOT NULL AS ok
                FROM users
                WHERE deleted_at IS NULL
                ORDER BY email_verified_at DESC NULLS LAST, email
                LIMIT 25
                """
            )
        ).fetchall()
        for email, ok in rows:
            status = "yes" if ok else "no — verify email first"
            print(f"  {_mask_email(email)}  sign-in: {status}")

    print()
    print("If your production email is not listed, production may use a different DATABASE_URL on Vercel.")


if __name__ == "__main__":
    main()
