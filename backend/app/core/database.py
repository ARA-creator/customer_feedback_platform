import os

from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import scoped_session, sessionmaker, DeclarativeBase

from .config import get_config


def _normalize_database_uri(uri: str) -> str:
    """
    SQLAlchemy 2 prefers the canonical `postgresql://` dialect; Neon/Vercel
    dashboards sometimes expose `postgres://` which breaks driver lookup.
    """
    u = (uri or "").strip()
    if u.startswith("postgres://"):
        return "postgresql://" + u[len("postgres://") :]
    return u


config = get_config()


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


# For PostgreSQL in production: DATABASE_URL like:
_pool_recycle = int(os.getenv("SQLALCHEMY_POOL_RECYCLE_SECONDS", "280"))

_db_uri = _normalize_database_uri(config.SQLALCHEMY_DATABASE_URI)
_engine_kwargs = dict(
    echo=config.SQLALCHEMY_ECHO,
    future=True,
    pool_pre_ping=True,
    pool_recycle=max(60, _pool_recycle),
)

# SQLite needs special handling for serverless/dev ergonomics.
if _db_uri.startswith("sqlite:"):
    # Allow usage across threads (Flask dev server, background pollers).
    _engine_kwargs["connect_args"] = {"check_same_thread": False}

    # If someone still uses an in-memory sqlite URL, ensure a single shared connection.
    # This prevents "no such table" when different sessions open different connections.
    if _db_uri in {"sqlite:///:memory:", "sqlite://"}:
        _engine_kwargs["poolclass"] = StaticPool

engine = create_engine(_db_uri, **_engine_kwargs)

SessionLocal = scoped_session(
    sessionmaker(
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
        bind=engine,
    )
)