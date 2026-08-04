"""
Shared helpers for the /api blueprint.

These helpers are extracted from the legacy `backend/app/routes/api.py` so
route modules can stay small and avoid circular imports.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from queue import Queue
from typing import Any, Dict, List, Optional, Tuple

from flask import request, session
from sqlalchemy import and_, desc, func, or_
from sqlalchemy.orm import load_only

from ...database import SessionLocal
from ...models import (
    AuditLog,
    CustomerDemographics,
    CustomerIdentifier,
    CustomerProfile,
    CustomerPurchase,
    CustomerSupportTicket,
    Feedback,
    FeedbackPolicyMatch,
    FeedbackSearchDocument,
    FeedbackWorkflow,
    AuditLog,
    AppSetting,
    Permission,
    Role,
    RolePermission,
    User,
    UserRole,
)
from ...security import decrypt_text, hash_email
from ...services.metadata_normalization import (
    build_search_text,
    customer_identity_from,
    normalize_channel_metadata,
    normalize_phone_identity,
    normalized_media,
    safe_json_loads,
)
from ...services.prioritization import normalize_source_group, score_feedback

logger = logging.getLogger(__name__)

# Simple in-memory event queue for Server-Sent Events (SSE).
# Suitable for dev / single-process deployments.
event_queue: "Queue[Dict[str, Any]]" = Queue()

# Per-user SSE queues for Notifications (best-effort, single-process).
_notif_streams: Dict[int, List["Queue[Dict[str, Any]]"]] = {}


def _notif_publish(user_id: int, event: Dict[str, Any]) -> None:
    qs = _notif_streams.get(int(user_id) if user_id else 0) or []
    for q in list(qs):
        try:
            q.put_nowait(event)
        except Exception:
            pass


def _prefs_allows(prefs: dict, key: str) -> bool:
    return bool((prefs or {}).get(key, False))


def _metadata_text_match(column, key: str, value: Optional[str]):
    needle = str(value or "").strip().lower()
    if not needle or needle == "all":
        return None
    return func.lower(column).like(f'%"{key}":%{needle}%')


def _apply_insurance_tag_metadata_filters(q, channel_metadata_col, insurance_tag: Optional[str], insurance_tags_any: Optional[str]):
    tag = (insurance_tag or "").strip().lower()
    if tag and tag != "all":
        return q.filter(
            channel_metadata_col.contains('"insurance_tags"'),
            channel_metadata_col.contains(f'"{tag}"'),
        )
    csv = (insurance_tags_any or "").strip()
    if csv:
        parts = [p.strip().lower() for p in csv.split(",") if p.strip()]
        if parts:
            return q.filter(
                or_(
                    *[
                        and_(
                            channel_metadata_col.contains('"insurance_tags"'),
                            channel_metadata_col.contains(f'"{p}"'),
                        )
                        for p in parts
                    ]
                )
            )
    return q


def _impact_score_for(feedback: Feedback, meta: Dict[str, Any]) -> int:
    return score_feedback(feedback=feedback, meta=meta).get("impact_score", 0)


def _coerce_user_id(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        uid = int(value)
    except (TypeError, ValueError):
        return None
    return uid if uid > 0 else None


def _user_email_by_id(db, user_id: Optional[int]) -> Optional[str]:
    uid = _coerce_user_id(user_id)
    if uid is None:
        return None
    row = db.query(User.email).filter(User.id == uid).first()
    if not row or not row.email:
        return None
    s = str(row.email).strip()
    return s or None


def _prepare_audit_log_payload(
    db,
    *,
    actor_user_id: Optional[int],
    target_type: str,
    target_id: Optional[str],
    meta: Optional[Dict[str, Any]],
) -> Tuple[Optional[int], Dict[str, Any]]:
    """Resolve actor from API session and enrich meta with actor/target emails."""
    merged: Dict[str, Any] = dict(meta or {})

    user = _current_user(db)
    if user:
        resolved_actor_id = int(user.id)
        if user.email:
            merged.setdefault("actor_email", str(user.email).strip())
    else:
        resolved_actor_id = _coerce_user_id(actor_user_id)
        if resolved_actor_id is not None:
            actor_email = _user_email_by_id(db, resolved_actor_id)
            if actor_email:
                merged.setdefault("actor_email", actor_email)

    if target_type == "user" and target_id is not None and not merged.get("email"):
        target_user_email = _user_email_by_id(db, _coerce_user_id(target_id))
        if target_user_email:
            merged["email"] = target_user_email

    return resolved_actor_id, merged


def _append_audit_log(
    db,
    *,
    actor_user_id: Optional[int],
    action: str,
    target_type: str,
    target_id: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> None:
    """Stage an audit row on the current session (caller commits)."""
    resolved_actor_id, merged_meta = _prepare_audit_log_payload(
        db,
        actor_user_id=actor_user_id,
        target_type=target_type,
        target_id=target_id,
        meta=meta,
    )
    db.add(
        AuditLog(
            actor_user_id=resolved_actor_id,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id is not None else None,
            meta=json.dumps(merged_meta),
        )
    )


def _audit_log(
    db,
    *,
    actor_user_id: Optional[int],
    action: str,
    target_type: str,
    target_id: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> None:
    try:
        _append_audit_log(
            db,
            actor_user_id=actor_user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            meta=meta,
        )
        db.commit()
    except Exception:
        logger.exception("Failed to write audit log")
        try:
            db.rollback()
        except Exception:
            pass


def _get_setting_json(db, key: str, default):
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not row or not row.value:
        return default
    try:
        return json.loads(row.value)
    except Exception:
        return default


def _set_setting_json(db, key: str, value) -> None:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    payload = _safe_json_dumps(value)
    ts = datetime.now(tz=timezone.utc)
    if not row:
        row = AppSetting(key=key, value=payload, updated_at=ts)
        db.add(row)
    else:
        row.value = payload
        row.updated_at = ts
    db.commit()


def _require_any_permission(db, perms: List[str]) -> Tuple[User, set[str]]:
    user = _current_user(db)
    if not user:
        raise PermissionError("Not authenticated")
    keys = _user_permission_keys(db, user.id)
    if not any(p in keys for p in perms):
        raise PermissionError(f"Missing permission: one of {perms}")
    return user, keys


def _scope_feedback_query(db, q, *, user: User, perms: set[str]):
    """
    Apply least-privilege visibility rules to a Feedback query.

    - feedback.view_all: no scoping
    - feedback.view_team: scoped by UserRole.team (if present), else fallback to assigned_user_id
    - feedback.view_assigned: assigned_user_id only
    """
    if "feedback.view_all" in perms:
        return q

    # Join workflow for scoping.
    q = q.outerjoin(FeedbackWorkflow, FeedbackWorkflow.feedback_id == Feedback.id)

    if "feedback.view_team" in perms:
        team = (
            db.query(UserRole.team)
            .filter(UserRole.user_id == user.id)
            .filter(UserRole.team.isnot(None))
            .first()
        )
        team_value = (team[0] if team else None) or None
        if team_value:
            # Show team queue plus unassigned items so new feedback is visible by default.
            return q.filter(or_(FeedbackWorkflow.assigned_team == team_value, FeedbackWorkflow.assigned_team.is_(None)))

    # Default: assigned only.
    # Also include unassigned items; otherwise new feedback without a workflow assignment
    # can disappear entirely for agents on fresh deployments.
    return q.filter(or_(FeedbackWorkflow.assigned_user_id == user.id, FeedbackWorkflow.assigned_user_id.is_(None)))


def _get_bearer_token() -> Optional[str]:
    """Bearer token from Authorization header or ?access_token= (SSE only)."""
    auth = request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        if token:
            return token
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        q = request.args.get("access_token")
        if q:
            return str(q).strip() or None
    return None


def _user_load_options():
    return load_only(
        User.id,
        User.email,
        User.role,
        User.is_active,
        User.deleted_at,
        User.email_verified_at,
        User.account_type,
        User.auth_provider,
        User.approved_at,
    )


def _load_user_by_id(db: SessionLocal, uid: int) -> Optional[User]:
    from ...services.auth_account import access_block_reason

    user = (
        db.query(User)
        .options(_user_load_options())
        .filter(User.id == uid)
        .first()
    )
    if not user:
        return None
    if getattr(user, "deleted_at", None):
        return None
    if access_block_reason(user):
        return None
    return user


def _current_user(db: SessionLocal) -> Optional[User]:
    bearer = _get_bearer_token()
    if bearer:
        from ...services.api_sessions import resolve_api_session

        row = resolve_api_session(db, bearer)
        if not row:
            return None
        return _load_user_by_id(db, int(row.user_id))

    uid_raw = session.get("user_id")
    if not uid_raw:
        return None
    try:
        uid = int(uid_raw)
    except (TypeError, ValueError):
        session.pop("user_id", None)
        return None
    user = _load_user_by_id(db, uid)
    if not user:
        session.pop("user_id", None)
        return None
    return user


def _require_user(db: SessionLocal) -> User:
    user = _current_user(db)
    if not user:
        raise PermissionError("Not authenticated")
    return user


def _user_permission_keys(db, user_id: Optional[int]) -> set[str]:
    if not user_id:
        return set()
    rows = (
        db.query(Permission.key)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(Role, Role.id == RolePermission.role_id)
        .join(UserRole, UserRole.role_id == Role.id)
        .filter(UserRole.user_id == user_id)
        .all()
    )
    return {str(r[0]) for r in rows if r and r[0]}


def _require_permission(db, perm: str) -> Tuple[User, set[str]]:
    user = _current_user(db)
    if not user:
        raise PermissionError("Not authenticated")
    keys = _user_permission_keys(db, user.id)
    if perm not in keys:
        raise PermissionError(f"Missing permission: {perm}")
    return user, keys


def _safe_json_dumps(value: Any) -> Optional[str]:
    try:
        return json.dumps(value)
    except Exception:
        return None


def _safe_json_loads(value: Any) -> Dict[str, Any]:
    return safe_json_loads(value)


def _normalize_source_group(value: Optional[str]) -> Optional[str]:
    return normalize_source_group(value)


def _normalized_media(meta: Dict[str, Any]) -> List[Dict[str, Any]]:
    return normalized_media(meta)


def _customer_identity(feedback: Feedback, meta: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    return customer_identity_from(feedback, meta)


def _normalize_metadata(feedback: Feedback) -> Dict[str, Any]:
    meta = normalize_channel_metadata(feedback.source, feedback.channel_metadata)
    normalized = {**meta}
    customer_key, customer_label = _customer_identity(feedback, meta)
    normalized["media"] = _normalized_media(meta)
    if customer_key:
        normalized["customer_key"] = customer_key
    if customer_label:
        normalized["customer_label"] = customer_label
    return normalized


def _find_customer_profile(db, feedback: Optional[Feedback] = None, customer_key: Optional[str] = None):
    if feedback is not None:
        meta = _normalize_metadata(feedback)
        customer_key = meta.get("customer_key")
    if not customer_key:
        return None
    ident = db.query(CustomerIdentifier).filter(CustomerIdentifier.identifier_value == customer_key).first()
    if ident:
        return db.query(CustomerProfile).filter(CustomerProfile.id == ident.customer_profile_id).first()
    return None


def _merge_customer_profiles(db, *, keep: CustomerProfile, absorb: CustomerProfile) -> CustomerProfile:
    """Merge absorb into keep so shared policy/channel identifiers unify Customer 360."""
    if not keep or not absorb:
        return keep or absorb
    if int(keep.id) == int(absorb.id):
        return keep

    for row in db.query(CustomerIdentifier).filter(CustomerIdentifier.customer_profile_id == absorb.id).all():
        clash = (
            db.query(CustomerIdentifier)
            .filter(
                CustomerIdentifier.customer_profile_id == keep.id,
                CustomerIdentifier.identifier_value == row.identifier_value,
            )
            .first()
        )
        if clash:
            db.delete(row)
        else:
            row.customer_profile_id = keep.id

    for row in db.query(CustomerPurchase).filter(CustomerPurchase.customer_profile_id == absorb.id).all():
        row.customer_profile_id = keep.id
    for row in db.query(CustomerSupportTicket).filter(CustomerSupportTicket.customer_profile_id == absorb.id).all():
        row.customer_profile_id = keep.id

    absorb_demo = (
        db.query(CustomerDemographics).filter(CustomerDemographics.customer_profile_id == absorb.id).first()
    )
    keep_demo = db.query(CustomerDemographics).filter(CustomerDemographics.customer_profile_id == keep.id).first()
    if absorb_demo and keep_demo:
        keep_demo.location = keep_demo.location or absorb_demo.location
        keep_demo.language = keep_demo.language or absorb_demo.language
        keep_demo.segment = keep_demo.segment or absorb_demo.segment
        keep_demo.age_range = keep_demo.age_range or absorb_demo.age_range
        keep_demo.gender = keep_demo.gender or absorb_demo.gender
        keep_demo.occupation = keep_demo.occupation or absorb_demo.occupation
        keep_demo.updated_at = datetime.now(tz=timezone.utc)
        db.delete(absorb_demo)
    elif absorb_demo and not keep_demo:
        absorb_demo.customer_profile_id = keep.id

    if absorb.display_name and not keep.display_name:
        keep.display_name = absorb.display_name
    if absorb.external_customer_id and not keep.external_customer_id:
        keep.external_customer_id = absorb.external_customer_id
    if absorb.primary_email_hash and not keep.primary_email_hash:
        keep.primary_email_hash = absorb.primary_email_hash
        keep.primary_email_encrypted = absorb.primary_email_encrypted
    if absorb.customer_tier and not keep.customer_tier:
        keep.customer_tier = absorb.customer_tier
    if absorb.company and not keep.company:
        keep.company = absorb.company
    keep.updated_at = datetime.now(tz=timezone.utc)

    db.delete(absorb)
    db.flush()
    return keep


def _normalize_phone_identity(raw: Optional[str]) -> Optional[str]:
    return normalize_phone_identity(raw)


def _phone_identity_variants(phone_or_raw: Optional[str]) -> List[str]:
    """All identifier_value forms that should count as the same phone person."""
    phone = normalize_phone_identity(phone_or_raw)
    if not phone:
        return []
    digits = "".join(ch for ch in phone if ch.isdigit())
    variants = [
        f"phone:{phone}",
        f"phone:{digits}",
        f"wa:{digits}",
        f"wa:{phone}",
    ]
    # De-dupe preserving order
    out = []
    seen = set()
    for v in variants:
        if v not in seen:
            seen.add(v)
            out.append(v)
    return out


def _is_unstable_message_key(value: str) -> bool:
    """Per-message Twilio/Meta ids must not be used for customer matching."""
    v = str(value or "").strip()
    if not v:
        return True
    upper = v.upper()
    if upper.startswith("SM") and len(v) >= 32:
        return True
    if upper.startswith("MM") and len(v) >= 32:
        return True
    if v.lower().startswith("wamid."):
        return True
    return False


def _collect_matchable_identities(feedback: Feedback, meta: Dict[str, Any]) -> List[Tuple[str, str, Optional[str]]]:
    """
    Every stable identity we can use to recognize the same person across channels.
    Returns list of (identifier_type, identifier_value, label).
    """
    out: List[Tuple[str, str, Optional[str]]] = []
    seen = set()

    def add(itype: str, ivalue: str, label: Optional[str] = None) -> None:
        ivalue = str(ivalue or "").strip()
        if not ivalue or ivalue in seen:
            return
        if _is_unstable_message_key(ivalue.split(":", 1)[-1] if ":" in ivalue else ivalue):
            return
        seen.add(ivalue)
        out.append((itype, ivalue, label))

    if getattr(feedback, "customer_id", None):
        cid = str(feedback.customer_id).strip()
        if cid:
            add("customer", f"customer:{cid}", cid)

    email_hash_val = str(getattr(feedback, "email_hash", None) or "").strip()
    if not email_hash_val:
        for key in ("sender_email", "email", "from_email"):
            cand = str(meta.get(key) or "").strip()
            if cand and "@" in cand:
                email_hash_val = str(hash_email(cand) or "").strip()
                if email_hash_val:
                    break
    if email_hash_val:
        add(
            "email_hash",
            f"email_hash:{email_hash_val}",
            meta.get("sender_email") or meta.get("customer_label") or "Email contact",
        )

    phone = normalize_phone_identity(meta.get("phone") or meta.get("from_number") or meta.get("wa_id"))
    if phone:
        # Canonical phone key + legacy variants so older rows still merge.
        for variant in _phone_identity_variants(phone):
            itype = "phone" if variant.startswith("phone:") else "wa"
            add(itype, variant, phone)

    wa_id = str(meta.get("wa_id") or "").strip()
    if wa_id and not wa_id.startswith("*") and not normalize_phone_identity(wa_id):
        add("wa", f"wa:{wa_id}", wa_id)

    for key, prefix, label_key in [
        ("author_id", "author", "author_username"),
        ("sender_id", "sender", "from_username"),
        ("external_user_id", "external", "author_handle"),
        ("user_id", "user", "author_handle"),
        ("psid", "psid", "author_handle"),
        ("ig_user_id", "ig", "author_handle"),
    ]:
        value = str(meta.get(key) or "").strip()
        if value:
            add(prefix, f"{prefix}:{value}", meta.get(label_key) or value)

    thread = str(meta.get("thread_id") or "").strip()
    if thread and not _is_unstable_message_key(thread):
        # Phone-shaped threads are already covered by phone variants.
        if not normalize_phone_identity(thread):
            add("thread", f"thread:{thread}", meta.get("author_handle") or thread)

    for key in ("author_handle", "author_username", "from_username"):
        value = str(meta.get(key) or "").strip()
        if not value or value.startswith("*"):
            continue
        if normalize_phone_identity(value):
            continue
        handle = value.lstrip("@").lower()
        add("handle", f"handle:{handle}", value)

    # Primary customer_key — rewrite phone keys to canonical form first.
    customer_key = str(meta.get("customer_key") or "").strip()
    if customer_key.startswith("phone:") or customer_key.startswith("wa:"):
        canon = normalize_phone_identity(customer_key.split(":", 1)[1])
        if canon:
            add("phone", f"phone:{canon}", canon)
    elif customer_key:
        add(customer_key.split(":", 1)[0], customer_key, meta.get("customer_label"))

    return out


def _link_identifier_or_merge(
    db,
    *,
    profile: CustomerProfile,
    identifier_type: str,
    identifier_value: str,
    label: Optional[str] = None,
    source: Optional[str] = None,
) -> CustomerProfile:
    """
    Attach an identity key to this profile, or merge with the profile that already owns it.
    Any shared identity (email, phone, policy, handle, channel id, …) unifies the person.
    """
    if not profile or not identifier_value:
        return profile
    existing = (
        db.query(CustomerIdentifier)
        .filter(CustomerIdentifier.identifier_value == identifier_value)
        .first()
    )
    if existing:
        if int(existing.customer_profile_id) == int(profile.id):
            if label and not existing.label:
                existing.label = label
            return profile
        owner = db.query(CustomerProfile).filter(CustomerProfile.id == existing.customer_profile_id).first()
        if not owner:
            return profile
        keep, absorb = (owner, profile)
        if profile.created_at and owner.created_at and profile.created_at < owner.created_at:
            keep, absorb = (profile, owner)
        return _merge_customer_profiles(db, keep=keep, absorb=absorb)

    db.add(
        CustomerIdentifier(
            customer_profile_id=profile.id,
            identifier_type=identifier_type,
            identifier_value=identifier_value,
            label=label,
            source=source,
        )
    )
    return profile


def _find_profile_for_identities(db, identities: List[Tuple[str, str, Optional[str]]]) -> Optional[CustomerProfile]:
    """Find an existing profile that already owns any of these identity keys."""
    if not identities:
        return None
    values = [ivalue for _, ivalue, _ in identities if ivalue]
    # Expand phone lookups to every equivalent stored form.
    expanded = list(values)
    for _, ivalue, _ in identities:
        if ivalue.startswith("phone:") or ivalue.startswith("wa:"):
            expanded.extend(_phone_identity_variants(ivalue.split(":", 1)[1]))
    values = list(dict.fromkeys(expanded))
    if not values:
        return None
    rows = (
        db.query(CustomerIdentifier)
        .filter(CustomerIdentifier.identifier_value.in_(values))
        .all()
    )
    if not rows:
        return None
    profile_ids = []
    seen_pids = set()
    for row in rows:
        pid = int(row.customer_profile_id)
        if pid in seen_pids:
            continue
        seen_pids.add(pid)
        profile_ids.append(pid)
    profiles = (
        db.query(CustomerProfile)
        .filter(CustomerProfile.id.in_(profile_ids))
        .order_by(CustomerProfile.created_at.asc(), CustomerProfile.id.asc())
        .all()
    )
    if not profiles:
        return None
    keep = profiles[0]
    for other in profiles[1:]:
        keep = _merge_customer_profiles(db, keep=keep, absorb=other)
    return keep


def _upsert_customer_entities(db, *, feedback: Feedback, message_plaintext: str) -> Optional[CustomerProfile]:
    """
    Ensure a CustomerProfile exists for this feedback and keep identifiers up to date.

    Cross-channel unification: any shared stable identity (email, phone, policy number,
    channel user id, handle, customer id, …) merges profiles into one Customer 360.
    """
    meta = _normalize_metadata(feedback)
    customer_key = meta.get("customer_key")
    customer_label = meta.get("customer_label")
    identities = _collect_matchable_identities(feedback, meta)

    # Always include detected policy numbers as match keys.
    try:
        pol_rows = (
            db.query(FeedbackPolicyMatch)
            .filter(FeedbackPolicyMatch.feedback_id == feedback.id)
            .all()
        )
        for r in pol_rows or []:
            if not r or not r.policy_hash:
                continue
            label_bits = []
            if r.product_group or r.product_prefix:
                label_bits.append(r.product_group or r.product_prefix)
            if r.policy_masked:
                label_bits.append(r.policy_masked)
            identities.append(
                (
                    "policy_hash",
                    f"policy_hash:{r.policy_hash}",
                    " · ".join(label_bits) if label_bits else None,
                )
            )
    except Exception:
        logger.exception("Failed to load policy matches for customer linking")

    # De-dupe identity list after policy append.
    deduped: List[Tuple[str, str, Optional[str]]] = []
    seen_vals = set()
    for itype, ivalue, label in identities:
        if not ivalue or ivalue in seen_vals:
            continue
        seen_vals.add(ivalue)
        deduped.append((itype, ivalue, label))
    identities = deduped

    if not customer_key and not identities:
        return None

    profile = _find_profile_for_identities(db, identities)
    if not profile and customer_key:
        ident = db.query(CustomerIdentifier).filter(CustomerIdentifier.identifier_value == customer_key).first()
        if ident:
            profile = db.query(CustomerProfile).filter(CustomerProfile.id == ident.customer_profile_id).first()

    if not profile:
        profile = CustomerProfile(
            external_customer_id=feedback.customer_id,
            display_name=customer_label,
            primary_email_hash=feedback.email_hash,
            primary_email_encrypted=feedback.email_encrypted,
            customer_tier=meta.get("customer_tier"),
            lifecycle_stage="active",
            company=meta.get("company"),
            notes=f"Auto-created from {feedback.source} feedback",
        )
        db.add(profile)
        db.flush()
    else:
        if customer_label and not profile.display_name:
            profile.display_name = customer_label
        if feedback.customer_id and not profile.external_customer_id:
            profile.external_customer_id = feedback.customer_id
        if feedback.email_hash and not profile.primary_email_hash:
            profile.primary_email_hash = feedback.email_hash
            profile.primary_email_encrypted = feedback.email_encrypted
        if meta.get("customer_tier"):
            profile.customer_tier = meta.get("customer_tier")
        profile.updated_at = datetime.now(tz=timezone.utc)

    # Link every identity onto this profile (merges if another profile already owns one).
    try:
        for itype, ivalue, label in identities:
            profile = _link_identifier_or_merge(
                db,
                profile=profile,
                identifier_type=itype,
                identifier_value=ivalue,
                label=label or customer_label,
                source=feedback.source,
            )
    except Exception:
        logger.exception("Failed to link/merge customer identifiers")

    if meta.get("location") or meta.get("language") or meta.get("segment"):
        demo = db.query(CustomerDemographics).filter(CustomerDemographics.customer_profile_id == profile.id).first()
        if not demo:
            demo = CustomerDemographics(
                customer_profile_id=profile.id,
                location=meta.get("location"),
                language=meta.get("language"),
                segment=meta.get("segment"),
                demographics_metadata=_safe_json_dumps({"last_message_excerpt": (message_plaintext or "")[:200]}),
            )
            db.add(demo)
        else:
            demo.location = demo.location or meta.get("location")
            demo.language = demo.language or meta.get("language")
            demo.segment = demo.segment or meta.get("segment")
            demo.updated_at = datetime.now(tz=timezone.utc)

    return profile


def _ticket_summary_for_customer(db, customer_profile_id: Optional[int]) -> Dict[str, Any]:
    if not customer_profile_id:
        return {"open_count": 0, "complaint_count": 0}
    rows = db.query(CustomerSupportTicket).filter(CustomerSupportTicket.customer_profile_id == customer_profile_id).all()
    open_count = 0
    complaint_count = 0
    recent = []
    for row in rows:
        if str(row.status or "").lower() not in {"closed", "resolved"}:
            open_count += 1
        if str(row.priority or "").lower() in {"high", "urgent", "critical"}:
            complaint_count += 1
        recent.append(row)
    return {"open_count": open_count, "complaint_count": complaint_count, "tickets": recent}


def _purchase_summary_for_customer(db, customer_profile_id: Optional[int], fallback_tier: Optional[str] = None) -> Dict[str, Any]:
    if not customer_profile_id:
        return {"total_spend": 0.0, "customer_tier": fallback_tier}
    purchases = db.query(CustomerPurchase).filter(CustomerPurchase.customer_profile_id == customer_profile_id).all()
    total_spend = sum(float(p.amount or 0.0) for p in purchases)
    return {"total_spend": total_spend, "customer_tier": fallback_tier, "purchases": purchases}


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        if len(value) == 10:
            return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _ensure_workflow(db, feedback_id: int, feedback: Optional[Feedback] = None) -> FeedbackWorkflow:
    row = db.query(FeedbackWorkflow).filter(FeedbackWorkflow.feedback_id == feedback_id).first()
    if row:
        return row
    source = (feedback.source if feedback else "").lower() if feedback else ""
    approval_required = source in {"x", "twitter", "facebook", "instagram", "web"}
    status = "Open"
    sla_due_at = None
    if feedback and feedback.created_at:
        hours = 4 if (feedback.priority or 0) >= 100 else 24
        sla_due_at = feedback.created_at + timedelta(hours=hours)
    row = FeedbackWorkflow(
        feedback_id=feedback_id,
        status=status,
        approval_required=approval_required,
        approval_status="required" if approval_required else "not_requested",
        sla_due_at=sla_due_at,
    )
    db.add(row)
    db.flush()
    return row


def _upsert_search_document(db, *, feedback: Feedback, message_plaintext: str):
    meta = _normalize_metadata(feedback)
    customer_key = meta.get("customer_key")
    customer_label = meta.get("customer_label")
    tags = json.loads(feedback.tags) if feedback.tags else None
    search_bits = build_search_text(
        message=message_plaintext,
        category=feedback.category,
        tags=tags,
        customer_label=customer_label,
        meta=meta,
        source=feedback.source,
    )
    existing = db.query(FeedbackSearchDocument).filter(FeedbackSearchDocument.feedback_id == feedback.id).first()
    payload = {
        "feedback_id": feedback.id,
        "source": feedback.source,
        "category": feedback.category,
        "customer_key": customer_key,
        "customer_label": customer_label,
        "campaign": meta.get("campaign"),
        "location": meta.get("location"),
        "language": meta.get("language"),
        "customer_tier": meta.get("customer_tier"),
        "tags_text": search_bits.get("tags_text"),
        "message_search_text": search_bits.get("message_search_text") or "",
        "metadata_search_text": search_bits.get("metadata_search_text"),
        "updated_at": datetime.now(tz=timezone.utc),
    }
    if existing:
        for key, value in payload.items():
            setattr(existing, key, value)
    else:
        db.add(FeedbackSearchDocument(**payload))


def _serialize_feedback_batch(
    db,
    rows: List[Feedback],
    *,
    purchase_summary: Optional[Dict[str, Any]] = None,
    ticket_summary: Optional[Dict[str, Any]] = None,
    profile_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Serialize many feedback rows with one DB session and batched policy-match lookup."""
    if not rows:
        return []

    purchase_summary = purchase_summary or {}
    ticket_summary = ticket_summary or {}
    ids = [int(r.id) for r in rows if getattr(r, "id", None)]
    pol_by_fid: Dict[int, List[FeedbackPolicyMatch]] = {i: [] for i in ids}
    search_by_fid: Dict[int, str] = {}
    if ids:
        all_pol = (
            db.query(FeedbackPolicyMatch)
            .filter(FeedbackPolicyMatch.feedback_id.in_(ids))
            .order_by(
                desc(FeedbackPolicyMatch.is_primary),
                desc(FeedbackPolicyMatch.confidence),
                desc(FeedbackPolicyMatch.id),
            )
            .all()
        )
        for pm in all_pol:
            fid = getattr(pm, "feedback_id", None)
            if fid in pol_by_fid:
                pol_by_fid[fid].append(pm)
        for fid, text in (
            db.query(FeedbackSearchDocument.feedback_id, FeedbackSearchDocument.message_search_text)
            .filter(FeedbackSearchDocument.feedback_id.in_(ids))
            .all()
        ):
            if fid is None:
                continue
            search_by_fid[int(fid)] = (text or "").strip()

    out: List[Dict[str, Any]] = []
    for feedback in rows:
        meta = _normalize_metadata(feedback)
        customer_key = meta.get("customer_key")
        customer_label = meta.get("customer_label")
        # Prefer search-document plaintext (already decrypted/normalized) to avoid
        # Fernet decrypt of large HTML bodies on every inbox page load.
        msg = search_by_fid.get(int(feedback.id)) if feedback.id else None
        if not msg:
            msg = decrypt_text(feedback.message_encrypted)
        from ...services.html_text import normalize_message_text

        msg = normalize_message_text(msg)
        pol_rows = pol_by_fid.get(int(feedback.id), []) if feedback.id else []
        score = score_feedback(
            feedback=feedback,
            meta=meta,
            purchase_summary=purchase_summary,
            ticket_summary=ticket_summary,
        )
        policy_matches = [
            {
                "policy_hash": r.policy_hash,
                "policy_masked": r.policy_masked,
                "policy_number": r.policy_masked if r.policy_masked and "(name match)" not in str(r.policy_masked) else None,
                "product_prefix": r.product_prefix,
                "product_group": r.product_group,
                "product_description": r.product_description,
                "confidence": r.confidence,
                "is_primary": bool(r.is_primary),
                "needs_review": bool(r.needs_review),
            }
            for r in pol_rows
        ]
        from ...services.policy_detection import summarize_policy_matches

        policy_summary = summarize_policy_matches(policy_matches)
        out.append(
            {
                "id": feedback.id,
                "source": feedback.source,
                "source_group": _normalize_source_group(feedback.source),
                "customer_id": feedback.customer_id,
                "customer_key": customer_key,
                "customer_label": customer_label,
                "message": msg or "[encrypted]",
                "message_preview": (msg or "[encrypted]")[:180],
                "rating": feedback.rating,
                "category": feedback.category,
                "created_at": feedback.created_at.isoformat() if feedback.created_at else None,
                "sentiment_label": feedback.sentiment_label,
                "sentiment_score": feedback.sentiment_score,
                "priority": feedback.priority,
                "impact_score": score.get("impact_score"),
                "impact_factors": score.get("impact_factors"),
                "priority_reason_summary": score.get("priority_reason_summary"),
                "tags": json.loads(feedback.tags) if feedback.tags else None,
                "channel_metadata": meta,
                "insurance_tags": meta.get("insurance_tags") if isinstance(meta, dict) else None,
                "policy_matches": policy_matches,
                "policy_holder_status": policy_summary.get("policy_holder_status"),
                "has_policy_number": policy_summary.get("has_policy_number"),
                "customer_profile_id": profile_id,
                "replied_at": feedback.replied_at.isoformat() if getattr(feedback, "replied_at", None) else None,
            }
        )
    return out


def _serialize_feedback(feedback: Feedback) -> Dict[str, Any]:
    """
    Serialize a feedback row with normalized metadata, scoring, and policy matches.
    Extracted so Customer 360 and other modules can reuse it without importing the legacy api.py.
    """
    meta = _normalize_metadata(feedback)
    customer_key = meta.get("customer_key")
    customer_label = meta.get("customer_label")
    from ...services.html_text import normalize_message_text

    msg = normalize_message_text(decrypt_text(feedback.message_encrypted))
    profile = None
    purchase_summary: Dict[str, Any] = {}
    ticket_summary: Dict[str, Any] = {}
    try:
        db = SessionLocal()
        try:
            profile = _find_customer_profile(db, feedback=feedback)
            purchase_summary = _purchase_summary_for_customer(db, getattr(profile, "id", None), getattr(profile, "customer_tier", None))
            ticket_summary = _ticket_summary_for_customer(db, getattr(profile, "id", None))
            pol_rows = (
                db.query(FeedbackPolicyMatch)
                .filter(FeedbackPolicyMatch.feedback_id == feedback.id)
                .order_by(desc(FeedbackPolicyMatch.is_primary), desc(FeedbackPolicyMatch.confidence), desc(FeedbackPolicyMatch.id))
                .all()
            )
        finally:
            db.close()
    except Exception:
        profile = None
        pol_rows = []

    score = score_feedback(feedback=feedback, meta=meta, purchase_summary=purchase_summary, ticket_summary=ticket_summary)
    policy_matches = [
        {
            "policy_hash": r.policy_hash,
            "policy_masked": r.policy_masked,
            "policy_number": r.policy_masked if r.policy_masked and "(name match)" not in str(r.policy_masked) else None,
            "product_prefix": r.product_prefix,
            "product_group": r.product_group,
            "product_description": r.product_description,
            "confidence": r.confidence,
            "is_primary": bool(r.is_primary),
            "needs_review": bool(r.needs_review),
        }
        for r in (pol_rows or [])
    ]
    from ...services.policy_detection import summarize_policy_matches

    policy_summary = summarize_policy_matches(policy_matches)
    return {
        "id": feedback.id,
        "source": feedback.source,
        "source_group": _normalize_source_group(feedback.source),
        "customer_id": feedback.customer_id,
        "customer_key": customer_key,
        "customer_label": customer_label,
        "message": msg or "[encrypted]",
        "message_preview": (msg or "[encrypted]")[:180],
        "rating": feedback.rating,
        "category": feedback.category,
        "created_at": feedback.created_at.isoformat() if feedback.created_at else None,
        "sentiment_label": feedback.sentiment_label,
        "sentiment_score": feedback.sentiment_score,
        "priority": feedback.priority,
        "impact_score": score.get("impact_score"),
        "impact_factors": score.get("impact_factors"),
        "priority_reason_summary": score.get("priority_reason_summary"),
        "tags": json.loads(feedback.tags) if feedback.tags else None,
        "channel_metadata": meta,
        "insurance_tags": meta.get("insurance_tags") if isinstance(meta, dict) else None,
        "policy_matches": policy_matches,
        "policy_holder_status": policy_summary.get("policy_holder_status"),
        "has_policy_number": policy_summary.get("has_policy_number"),
        "customer_profile_id": getattr(profile, "id", None),
        "replied_at": feedback.replied_at.isoformat() if getattr(feedback, "replied_at", None) else None,
    }


def _safe_int(value: Any, default: int) -> int:
    try:
        if value is None:
            return int(default)
        if isinstance(value, int):
            return int(value)
        s = str(value).strip()
        if not s:
            return int(default)
        return int(float(s))
    except Exception:
        return int(default)


def _metadata_text_match(column, key: str, value: Optional[str]):
    """
    Best-effort substring matching for JSON stored as text (SQLite/Postgres portable).
    Matches: ... "key": ... value ...
    """
    needle = str(value or "").strip().lower()
    if not needle or needle == "all":
        return None
    return column.contains(f'"{key}"') & column.contains(needle)


