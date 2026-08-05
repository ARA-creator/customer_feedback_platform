import os

from sqlalchemy import create_engine
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
_connect_args = {}
_engine_kwargs = {
    "echo": config.SQLALCHEMY_ECHO,
    "future": True,
    "pool_pre_ping": True,
    "pool_recycle": max(60, _pool_recycle),
}
if _db_uri.startswith("postgresql"):
    _connect_args["connect_timeout"] = int(os.getenv("DB_CONNECT_TIMEOUT_SECONDS", "10"))
    # Neon: keep a few warm connections; allow burst for feed + background pollers.
    _engine_kwargs.update(
        {
            "pool_size": int(os.getenv("SQLALCHEMY_POOL_SIZE", "5")),
            "max_overflow": int(os.getenv("SQLALCHEMY_MAX_OVERFLOW", "10")),
            "pool_timeout": int(os.getenv("SQLALCHEMY_POOL_TIMEOUT", "30")),
            "connect_args": _connect_args,
        }
    )
elif _connect_args:
    _engine_kwargs["connect_args"] = _connect_args

engine = create_engine(_db_uri, **_engine_kwargs)

SessionLocal = scoped_session(
    sessionmaker(
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
        bind=engine,
    )
)