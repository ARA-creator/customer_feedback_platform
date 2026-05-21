"""Helpers for enterprise vs external account access rules."""

from __future__ import annotations

from ..models import User
from .enterprise_sso_config import (
    azure_sso_configured,
    enterprise_domains,
    parse_azure_role_mapping,
)


def email_domain(email: str) -> str:
    e = (email or "").strip().lower()
    if "@" not in e:
        return ""
    return e.split("@", 1)[1]


def is_enterprise_email(email: str) -> bool:
    domain = email_domain(email)
    if not domain:
        return False
    allowed = enterprise_domains()
    if not allowed:
        return False
    return domain in allowed or any(domain.endswith(f".{d}") for d in allowed)


def account_type_of(user: User | None) -> str | None:
    if not user:
        return None
    return getattr(user, "account_type", None) or None


def is_external_pending(user: User | None) -> bool:
    if not user or getattr(user, "deleted_at", None):
        return False
    at = account_type_of(user)
    if at != "external":
        return False
    return getattr(user, "approved_at", None) is None


def access_block_reason(user: User | None) -> str | None:
    """Return an error message if the user may not use the app, else None."""
    if not user or getattr(user, "deleted_at", None):
        return "Not authenticated"
    if is_external_pending(user):
        return "Account pending admin approval"
    if getattr(user, "is_active", True) is False:
        return "Account is suspended"
    return None


def unusable_password_hash() -> str:
    import secrets

    from passlib.hash import argon2

    return argon2.hash(secrets.token_urlsafe(48))


__all__ = [
    "email_domain",
    "enterprise_domains",
    "is_enterprise_email",
    "account_type_of",
    "is_external_pending",
    "access_block_reason",
    "azure_sso_configured",
    "parse_azure_role_mapping",
    "unusable_password_hash",
]
