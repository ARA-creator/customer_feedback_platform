import os
import sys
from pathlib import Path

# Bind SQLAlchemy engine before `app.database` is first imported.
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret-key-pytest"
os.environ["HASH_SALT"] = "test-hash-salt-pytest"

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import pytest


@pytest.fixture
def app():
    from app import create_app, init_db

    flask_app = create_app()
    flask_app.config["TESTING"] = True
    init_db()
    yield flask_app


@pytest.fixture(autouse=True)
def _truncate_all_tables(app):
    """
    sqlite :memory: is tied to the process-global SQLAlchemy engine, so rows persist
    across tests unless we clear them. Wipe ORM tables in FK-safe order before each test.
    """
    from sqlalchemy import delete

    from app.core.database import engine
    from app.models import Base

    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(delete(table))

    from app.services.rbac import seed_rbac

    seed_rbac()
    yield


@pytest.fixture
def client(app):
    return app.test_client()
