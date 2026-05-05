#!/usr/bin/env python3
"""
One-time migration:
  Feedback.source 'web_form' -> 'web'

Run:
  cd /path/to/customer_feedback_platform
  .venv/bin/python scripts/db/migrate_web_form_to_web.py
"""

import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, os.path.join(ROOT, "backend"))

from app.database import SessionLocal  # noqa: E402
from app.models import Feedback  # noqa: E402


def main():
    db = SessionLocal()
    try:
        rows = (
            db.query(Feedback)
            .filter(Feedback.source == "web_form")
            .all()
        )
        for f in rows:
            f.source = "web"
        db.commit()
        print({"updated": len(rows)})
    finally:
        db.close()


if __name__ == "__main__":
    main()

