import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "backend"))

from app.database import SessionLocal  # noqa: E402
from app.models import Feedback  # noqa: E402
from app.routes.api import _upsert_customer_entities, _upsert_search_document  # noqa: E402
from app.security import decrypt_text  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        rows = db.query(Feedback).filter(Feedback.deleted_at.is_(None)).order_by(Feedback.id.asc()).all()
        count = 0
        for row in rows:
            message = decrypt_text(row.message_encrypted) or ""
            _upsert_customer_entities(db, feedback=row, message_plaintext=message)
            _upsert_search_document(db, feedback=row, message_plaintext=message)
            count += 1
            if count % 200 == 0:
                db.commit()
                print(f"Reindexed {count} feedback rows...")
        db.commit()
        print(f"Done. Reindexed {count} feedback rows.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
