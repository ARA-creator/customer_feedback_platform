#!/usr/bin/env python3
"""
Soft-delete duplicated email feedback rows.

Deduplication key: channel_metadata.message_id (RFC822 Message-ID).

Why soft-delete?
- Keeps audit trail
- Keeps counts/analytics consistent (all queries already exclude deleted_at)

Usage:
  cd /path/to/customer_feedback_platform
  .venv/bin/python scripts/data/dedupe_email_feedback.py
"""

import json
import os
import sys
from datetime import datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, os.path.join(ROOT, "backend"))

from app.database import SessionLocal  # noqa: E402
from app.models import Feedback  # noqa: E402


def _parse_meta(meta_value):
    if not meta_value:
        return None
    if isinstance(meta_value, dict):
        return meta_value
    if not isinstance(meta_value, str):
        return None
    try:
        return json.loads(meta_value)
    except Exception:
        return None


def main():
    db = SessionLocal()
    try:
        rows = (
            db.query(Feedback)
            .filter(Feedback.deleted_at.is_(None))
            .filter(Feedback.source == "email")
            .order_by(Feedback.created_at.asc(), Feedback.id.asc())
            .all()
        )

        # Keep the first row we saw per message-id (oldest created_at / id),
        # soft-delete the rest.
        keep_by_mid = {}
        duplicates = []
        skipped_no_mid = 0

        for f in rows:
            meta = _parse_meta(f.channel_metadata)
            mid = None
            if isinstance(meta, dict):
                mid = (meta.get("message_id") or "").strip()
            if not mid:
                skipped_no_mid += 1
                continue

            if mid in keep_by_mid:
                duplicates.append(f)
            else:
                keep_by_mid[mid] = f.id

        now = datetime.now(tz=timezone.utc)
        for f in duplicates:
            f.deleted_at = now

        db.commit()

        print(
            json.dumps(
                {
                    "email_rows_total": len(rows),
                    "unique_message_ids": len(keep_by_mid),
                    "duplicates_soft_deleted": len(duplicates),
                    "skipped_no_message_id": skipped_no_mid,
                },
                indent=2,
            )
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()

