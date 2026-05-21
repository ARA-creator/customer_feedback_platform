"""Microsoft Entra ID (Azure AD) OAuth2 login for enterprise users."""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

import requests
from flask import session

from ..database import SessionLocal
from ..models import Role, User, UserRole
from .auth_account import (
    azure_sso_configured,
    enterprise_domains,
    is_enterprise_email,
    unusable_password_hash,
)
from .enterprise_sso_config import (
    default_azure_role,
    get_effective_azure_config,
    parse_azure_role_mapping,
)
from .rbac import normalize_role_name

logger = logging.getLogger(__name__)

SCOPES = "openid profile email offline_access User.Read GroupMember.Read.All"


def _cfg() -> dict[str, Any]:
    return get_effective_azure_config()


def _tenant_authority() -> str:
    tenant = _cfg()["tenant_id"]
    return f"https://login.microsoftonline.com/{tenant}"


def build_authorize_url(state: str) -> str:
    c = _cfg()
    params = {
        "client_id": c["client_id"],
        "response_type": "code",
        "redirect_uri": c["redirect_uri"],
        "response_mode": "query",
        "scope": SCOPES,
        "state": state,
    }
    return f"{_tenant_authority()}/oauth2/v2.0/authorize?{urlencode(params)}"


def exchange_code_for_tokens(code: str) -> dict[str, Any]:
    c = _cfg()
    token_url = f"{_tenant_authority()}/oauth2/v2.0/token"
    data = {
        "client_id": c["client_id"],
        "client_secret": c["client_secret"],
        "code": code,
        "redirect_uri": c["redirect_uri"],
        "grant_type": "authorization_code",
        "scope": SCOPES,
    }
    resp = requests.post(token_url, data=data, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_graph_profile(access_token: str) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {access_token}"}
    me = requests.get(
        "https://graph.microsoft.com/v1.0/me",
        headers=headers,
        params={"$select": "id,mail,userPrincipalName,displayName"},
        timeout=30,
    )
    me.raise_for_status()
    profile = me.json()

    groups: list[str] = []
    try:
        gr = requests.get(
            "https://graph.microsoft.com/v1.0/me/memberOf",
            headers=headers,
            params={"$select": "displayName"},
            timeout=30,
        )
        if gr.ok:
            for item in gr.json().get("value") or []:
                name = (item.get("displayName") or "").strip()
                if name:
                    groups.append(name)
    except Exception:
        logger.exception("Failed to load Azure AD groups for user")

    email = (profile.get("mail") or profile.get("userPrincipalName") or "").strip().lower()
    return {
        "oid": str(profile.get("id") or ""),
        "email": email,
        "full_name": (profile.get("displayName") or "").strip() or None,
        "groups": groups,
    }


def map_groups_to_roles(group_names: list[str]) -> list[str]:
    mapping = parse_azure_role_mapping()
    roles: list[str] = []
    for g in group_names:
        role = mapping.get(g)
        if role:
            normalized = normalize_role_name(role)
            if normalized and normalized not in roles:
                roles.append(normalized)
    if not roles:
        default = default_azure_role()
        if default:
            roles.append(default)
    return roles


def _assign_user_roles(db, user_id: int, role_names: list[str]) -> None:
    if not role_names:
        return
    existing = db.query(UserRole).filter(UserRole.user_id == user_id).all()
    for row in existing:
        db.delete(row)
    for name in role_names:
        r = db.query(Role).filter(Role.name == name).first()
        if r:
            db.add(UserRole(user_id=user_id, role_id=r.id))
    db.commit()


def upsert_enterprise_user(profile: dict[str, Any]) -> User:
    email = profile["email"]
    if not email:
        raise ValueError("No email in Microsoft profile")
    if not is_enterprise_email(email):
        allowed = ", ".join(enterprise_domains()) or "(not configured)"
        raise ValueError(f"Email domain is not an approved enterprise domain. Allowed: {allowed}")

    role_names = map_groups_to_roles(profile.get("groups") or [])
    primary_role = role_names[0] if role_names else normalize_role_name("agent")
    now = datetime.now(tz=timezone.utc)
    oid = profile.get("oid") or ""

    db = SessionLocal()
    try:
        user = None
        if oid:
            user = db.query(User).filter(User.provider_subject == oid).first()
        if not user:
            user = db.query(User).filter(User.email == email).first()

        if user:
            user.email = email
            user.full_name = profile.get("full_name") or user.full_name
            user.account_type = "enterprise"
            user.auth_provider = "azure_ad"
            user.provider_subject = oid or user.provider_subject
            user.approved_at = now
            user.is_active = True
            user.email_verified_at = user.email_verified_at or now
            user.role = primary_role
            if not user.password_hash:
                user.password_hash = unusable_password_hash()
        else:
            user = User(
                email=email,
                password_hash=unusable_password_hash(),
                full_name=profile.get("full_name"),
                role=primary_role,
                account_type="enterprise",
                auth_provider="azure_ad",
                provider_subject=oid or None,
                approved_at=now,
                is_active=True,
                email_verified_at=now,
            )
            db.add(user)
        db.commit()
        db.refresh(user)
        _assign_user_roles(db, user.id, role_names)
        return user
    finally:
        db.close()


def start_enterprise_login() -> str:
    if not azure_sso_configured():
        raise RuntimeError("Enterprise sign-in is not configured. Contact IT.")
    state = secrets.token_urlsafe(32)
    session["azure_oauth_state"] = state
    return build_authorize_url(state)


def complete_enterprise_login(code: str, state: str) -> User:
    expected = session.pop("azure_oauth_state", None)
    if not expected or not state or not secrets.compare_digest(str(expected), str(state)):
        raise ValueError("Invalid OAuth state")
    tokens = exchange_code_for_tokens(code)
    access_token = tokens.get("access_token")
    if not access_token:
        raise ValueError("No access token from Microsoft")
    profile = fetch_graph_profile(access_token)
    return upsert_enterprise_user(profile)
