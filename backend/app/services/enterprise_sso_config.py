"""Load and persist Enterprise SSO (Azure AD) settings from AppSetting + env."""

from __future__ import annotations

import json
import logging
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

import requests
from flask import current_app

from ..core.security import decrypt_text, encrypt_text
from ..database import SessionLocal
from ..models import AppSetting
from ..services.rbac import normalize_role_name

logger = logging.getLogger(__name__)

SETTING_KEY = "auth.enterprise_sso"


def _env_config() -> dict[str, Any]:
    import os

    cfg = current_app.config
    domains_raw = cfg.get("ENTERPRISE_EMAIL_DOMAINS") or []
    if isinstance(domains_raw, str):
        domains = [d.strip().lower() for d in domains_raw.split(",") if d.strip()]
    else:
        domains = [str(d).strip().lower() for d in domains_raw if d]

    mapping_raw = os.getenv("AZURE_AD_ROLE_MAPPING", "{}") or "{}"
    role_mapping: list[dict[str, str]] = []
    try:
        parsed = json.loads(mapping_raw)
        if isinstance(parsed, dict):
            for k, v in parsed.items():
                if k and v:
                    role_mapping.append(
                        {"azure_group": str(k).strip(), "role": normalize_role_name(str(v)) or str(v)}
                    )
    except json.JSONDecodeError:
        pass

    secret = (cfg.get("AZURE_AD_CLIENT_SECRET") or "") or ""
    return {
        "enabled": bool(cfg.get("AZURE_AD_TENANT_ID") and cfg.get("AZURE_AD_CLIENT_ID")),
        "tenant_id": (cfg.get("AZURE_AD_TENANT_ID") or "") or "",
        "client_id": (cfg.get("AZURE_AD_CLIENT_ID") or "") or "",
        "redirect_uri": (cfg.get("AZURE_AD_REDIRECT_URI") or "") or "",
        "client_secret": secret if secret else None,
        "enterprise_email_domains": domains,
        "default_role": normalize_role_name(cfg.get("AZURE_AD_DEFAULT_ROLE") or "agent") or "agent",
        "role_mapping": role_mapping,
        "source": "environment",
    }


def _load_db_setting() -> dict[str, Any] | None:
    db = SessionLocal()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == SETTING_KEY).first()
        if not row or not row.value:
            return None
        data = json.loads(row.value)
        if not isinstance(data, dict):
            return None
        data["source"] = "database"
        data["updated_at"] = row.updated_at.isoformat() if row.updated_at else None
        return data
    except Exception:
        logger.exception("Failed to load enterprise SSO setting")
        return None
    finally:
        db.close()


def _role_mapping_to_dict(rows: list[dict[str, str]]) -> dict[str, str]:
    out: dict[str, str] = {}
    for row in rows or []:
        g = (row.get("azure_group") or row.get("group") or "").strip()
        r = normalize_role_name(row.get("role") or "") or (row.get("role") or "").strip()
        if g and r:
            out[g] = r
    return out


def get_effective_azure_config() -> dict[str, Any]:
    """Merged config: database overrides environment for non-secret fields."""
    env = _env_config()
    db = _load_db_setting()
    if not db:
        return env

    merged = deepcopy(env)
    merged["source"] = "database"

    for key in (
        "enabled",
        "tenant_id",
        "client_id",
        "redirect_uri",
        "enterprise_email_domains",
        "default_role",
    ):
        if db.get(key) is not None and db.get(key) != "":
            merged[key] = db[key]

    if db.get("role_mapping") is not None:
        merged["role_mapping"] = db["role_mapping"]

    enc = db.get("client_secret_encrypted")
    if enc:
        decrypted = decrypt_text(enc)
        if decrypted:
            merged["client_secret"] = decrypted
    elif db.get("client_secret_cleared"):
        merged["client_secret"] = None

    return merged


def azure_sso_configured() -> bool:
    cfg = get_effective_azure_config()
    if not cfg.get("enabled", True):
        return False
    return bool(
        cfg.get("tenant_id")
        and cfg.get("client_id")
        and cfg.get("client_secret")
        and cfg.get("redirect_uri")
    )


def enterprise_domains() -> list[str]:
    cfg = get_effective_azure_config()
    domains = cfg.get("enterprise_email_domains") or []
    return [str(d).strip().lower() for d in domains if d]


def parse_azure_role_mapping() -> dict[str, str]:
    cfg = get_effective_azure_config()
    return _role_mapping_to_dict(cfg.get("role_mapping") or [])


def default_azure_role() -> str:
    cfg = get_effective_azure_config()
    return normalize_role_name(cfg.get("default_role") or "agent") or "agent"


def admin_public_view() -> dict[str, Any]:
    """Safe fields for admin UI (no secrets)."""
    effective = get_effective_azure_config()
    env = _env_config()
    db = _load_db_setting()

    has_db_secret = bool(db and db.get("client_secret_encrypted"))
    has_env_secret = bool(env.get("client_secret"))

    return {
        "configured": azure_sso_configured(),
        "source": effective.get("source"),
        "enabled": bool(effective.get("enabled", True)),
        "tenant_id": effective.get("tenant_id") or "",
        "client_id": effective.get("client_id") or "",
        "redirect_uri": effective.get("redirect_uri") or "",
        "client_secret_configured": bool(has_db_secret or has_env_secret),
        "client_secret_from_database": has_db_secret,
        "client_secret_from_environment": has_env_secret and not has_db_secret,
        "enterprise_email_domains": effective.get("enterprise_email_domains") or [],
        "default_role": effective.get("default_role") or "agent",
        "role_mapping": effective.get("role_mapping") or [],
        "updated_at": (db or {}).get("updated_at"),
        "login_path": "/api/auth/enterprise/login",
    }


def save_admin_config(payload: dict[str, Any], *, actor_user_id: int | None) -> dict[str, Any]:
    existing = _load_db_setting() or {}
    secret_in_payload = payload.get("client_secret")
    clear_secret = bool(payload.get("clear_client_secret"))

    domains_in = payload.get("enterprise_email_domains")
    if isinstance(domains_in, str):
        domains = [d.strip().lower() for d in domains_in.split(",") if d.strip()]
    elif isinstance(domains_in, list):
        domains = [str(d).strip().lower() for d in domains_in if str(d).strip()]
    else:
        domains = existing.get("enterprise_email_domains") or []

    mapping_in = payload.get("role_mapping")
    role_mapping: list[dict[str, str]] = []
    if isinstance(mapping_in, list):
        for row in mapping_in:
            if not isinstance(row, dict):
                continue
            g = (row.get("azure_group") or row.get("group") or "").strip()
            r = normalize_role_name(row.get("role") or "") or ""
            if g and r:
                role_mapping.append({"azure_group": g, "role": r})

    stored: dict[str, Any] = {
        "enabled": bool(payload.get("enabled", existing.get("enabled", True))),
        "tenant_id": str(payload.get("tenant_id") or existing.get("tenant_id") or "").strip(),
        "client_id": str(payload.get("client_id") or existing.get("client_id") or "").strip(),
        "redirect_uri": str(payload.get("redirect_uri") or existing.get("redirect_uri") or "").strip(),
        "enterprise_email_domains": domains,
        "default_role": normalize_role_name(str(payload.get("default_role") or existing.get("default_role") or "agent"))
        or "agent",
        "role_mapping": role_mapping,
        "updated_by_user_id": actor_user_id,
    }

    if clear_secret:
        stored["client_secret_encrypted"] = None
        stored["client_secret_cleared"] = True
    elif isinstance(secret_in, str) and secret_in.strip():
        stored["client_secret_encrypted"] = encrypt_text(secret_in.strip())
        stored["client_secret_cleared"] = False
    elif existing.get("client_secret_encrypted"):
        stored["client_secret_encrypted"] = existing["client_secret_encrypted"]
        stored["client_secret_cleared"] = existing.get("client_secret_cleared", False)
    else:
        stored["client_secret_encrypted"] = None
        stored["client_secret_cleared"] = False

    db = SessionLocal()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == SETTING_KEY).first()
        payload_json = json.dumps(stored)
        now = datetime.now(tz=timezone.utc)
        if not row:
            row = AppSetting(key=SETTING_KEY, value=payload_json, updated_at=now)
            db.add(row)
        else:
            row.value = payload_json
            row.updated_at = now
        db.commit()
    finally:
        db.close()

    return admin_public_view()


def test_azure_connection(tenant_id: str, client_id: str, client_secret: str | None) -> dict[str, Any]:
    if not tenant_id or not client_id:
        return {"ok": False, "error": "Tenant ID and Client ID are required."}
    url = f"https://login.microsoftonline.com/{tenant_id}/v2.0/.well-known/openid-configuration"
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        meta = resp.json()
    except Exception as e:
        return {"ok": False, "error": f"Could not reach Microsoft login metadata: {e}"}

    if client_secret:
        token_url = meta.get("token_endpoint") or f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
        try:
            tr = requests.post(
                token_url,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "grant_type": "client_credentials",
                    "scope": "https://graph.microsoft.com/.default",
                },
                timeout=15,
            )
            if tr.status_code not in (200, 400, 401):
                tr.raise_for_status()
        except Exception as e:
            return {
                "ok": False,
                "error": f"Metadata OK but secret validation request failed: {e}",
                "issuer": meta.get("issuer"),
            }

    return {
        "ok": True,
        "issuer": meta.get("issuer"),
        "authorization_endpoint": meta.get("authorization_endpoint"),
        "message": "Microsoft login endpoint is reachable."
        + (" Client secret was sent for a basic validation request." if client_secret else ""),
    }
