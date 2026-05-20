#!/usr/bin/env python3
"""
Mark all active users as email-verified (one-time unblock when verification is disabled).

Usage (from repo root):
  python scripts/dev/mark_all_users_verified.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")


def main() -> None:
    url = (os.getenv("DATABASE_URL") or "").strip()
    if not url or url.startswith("sqlite"):
        print("DATABASE_URL is missing or points at SQLite.")
        print("Set DATABASE_URL in .env from Neon/Vercel before running this script.")
        sys.exit(1)

    from sqlalchemy import create_engine, text

    engine = create_engine(url)
    with engine.begin() as conn:
        result = conn.execute(
            text(
                """
                UPDATE users
                SET email_verified_at = COALESCE(email_verified_at, NOW())
                WHERE deleted_at IS NULL
                """
            )
        )
        updated = result.rowcount
    print(f"Marked users as verified (rows touched): {updated}")
    print("Users with deleted_at set were skipped.")


if __name__ == "__main__":
    main()
