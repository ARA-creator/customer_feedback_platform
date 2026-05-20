"""Helpers for enterprise vs external account access rules."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from flask import current_app

from ..models import User


def email_domain(email: str) -> str:
    e = (email or "").strip().lower()
    if "@" not in e:
        return ""
    return e.split("@", 1)[1]


def enterprise_domains() -> list[str]:
    return list(current_app.config.get("ENTERPRISE_EMAIL_DOMAINS") or [])


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


def azure_sso_configured() -> bool:
    cfg = current_app.config
    return bool(
        cfg.get("AZURE_AD_TENANT_ID")
        and cfg.get("AZURE_AD_CLIENT_ID")
        and cfg.get("AZURE_AD_CLIENT_SECRET")
        and cfg.get("AZURE_AD_REDIRECT_URI")
    )


def parse_azure_role_mapping() -> dict[str, str]:
    import json
    import os

    raw = os.getenv("AZURE_AD_ROLE_MAPPING", "{}") or "{}"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    if not isinstance(data, dict):
        return {}
    out: dict[str, str] = {}
    for k, v in data.items():
        if k and v:
            out[str(k).strip()] = str(v).strip()
    return out


def unusable_password_hash() -> str:
    import secrets

    from passlib.hash import argon2

    return argon2.hash(secrets.token_urlsafe(48))
