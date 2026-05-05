"""
One-off script to initialize the database schema.

Usage:
    python init_db.py

Environment:
    - DATABASE_URL: SQLAlchemy database URL. If not set, falls back to local SQLite.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app import init_db


def main() -> None:
    """Create all database tables."""
    init_db()
    print("Database tables created successfully.")


if __name__ == "__main__":
    main()