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

from flask import session
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
from ...security import decrypt_text
from ...services.metadata_normalization import (
    build_search_text,
    customer_identity_from,
    normalize_channel_metadata,
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
        db.add(
            AuditLog(
                actor_user_id=actor_user_id,
                action=action,
                target_type=target_type,
                target_id=str(target_id) if target_id is not None else None,
                meta=json.dumps(meta or {}),
            )
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
        db.add(
            AuditLog(
                actor_user_id=actor_user_id,
                action=action,
                target_type=target_type,
                target_id=str(target_id) if target_id is not None else None,
                meta=json.dumps(meta or {}),
            )
        )
        db.commit()
    except Exception:
        logger.exception("Failed to write audit log")
        try:
            db.rollback()
        except Exception:
            pass


def _impact_score_for(feedback: Feedback, meta: Dict[str, Any]) -> int:
    return score_feedback(feedback=feedback, meta=meta).get("impact_score", 0)


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


def _current_user(db: SessionLocal) -> Optional[User]:
    uid_raw = session.get("user_id")
    if not uid_raw:
        return None
    try:
        uid = int(uid_raw)
    except (TypeError, ValueError):
        session.pop("user_id", None)
        return None
    # Be careful selecting all columns: in production, schema may temporarily lag behind
    # mapped columns during deployments. Loading only the fields needed for access control
    # prevents hard failures (e.g., missing newly-added auth columns).
    user = (
        db.query(User)
        .options(
            load_only(
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
        )
        .filter(User.id == uid)
        .first()
    )
    if not user:
        return None
    if getattr(user, "deleted_at", None):
        # Soft-deleted accounts must not retain a session.
        session.pop("user_id", None)
        return None
    from ...services.auth_account import access_block_reason

    if access_block_reason(user):
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


def _upsert_customer_entities(db, *, feedback: Feedback, message_plaintext: str) -> Optional[CustomerProfile]:
    """
    Ensure a CustomerProfile exists for the feedback's customer_key and keep
    identifiers/demographics up to date. Also persists policy_hash identifiers
    for cross-platform unification (privacy-safe).
    """
    meta = _normalize_metadata(feedback)
    customer_key = meta.get("customer_key")
    customer_label = meta.get("customer_label")
    if not customer_key:
        return None

    ident = db.query(CustomerIdentifier).filter(CustomerIdentifier.identifier_value == customer_key).first()
    profile = None
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
        db.add(
            CustomerIdentifier(
                customer_profile_id=profile.id,
                identifier_type=customer_key.split(":", 1)[0],
                identifier_value=customer_key,
                label=customer_label,
                source=feedback.source,
            )
        )
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
        exists_ident = db.query(CustomerIdentifier).filter(CustomerIdentifier.identifier_value == customer_key).first()
        if not exists_ident:
            db.add(
                CustomerIdentifier(
                    customer_profile_id=profile.id,
                    identifier_type=customer_key.split(":", 1)[0],
                    identifier_value=customer_key,
                    label=customer_label,
                    source=feedback.source,
                )
            )

    # Policy-based unification: persist policy_hash identifiers (privacy-safe: hash + masked only).
    try:
        pol_rows = (
            db.query(FeedbackPolicyMatch)
            .filter(FeedbackPolicyMatch.feedback_id == feedback.id)
            .all()
        )
        seen_vals = set()
        for r in pol_rows or []:
            if not r or not r.policy_hash:
                continue
            ident_val = f"policy_hash:{r.policy_hash}"
            if ident_val in seen_vals:
                continue
            seen_vals.add(ident_val)
            exists_pol = db.query(CustomerIdentifier.id).filter(CustomerIdentifier.identifier_value == ident_val).first()
            if exists_pol:
                continue
            label_bits = []
            if r.product_group or r.product_prefix:
                label_bits.append(r.product_group or r.product_prefix)
            if r.policy_masked:
                label_bits.append(r.policy_masked)
            db.add(
                CustomerIdentifier(
                    customer_profile_id=profile.id,
                    identifier_type="policy_hash",
                    identifier_value=ident_val,
                    label=" · ".join(label_bits) if label_bits else None,
                    source=feedback.source,
                )
            )
    except Exception:
        logger.exception("Failed to upsert policy_hash customer identifiers")

    if meta.get("location") or meta.get("language") or meta.get("segment"):
        demo = db.query(CustomerDemographics).filter(CustomerDemographics.customer_profile_id == profile.id).first()
        if not demo:
            demo = CustomerDemographics(
                customer_profile_id=profile.id,
                location=meta.get("location"),
                language=meta.get("language"),
                segment=meta.get("segment"),
                metadata=_safe_json_dumps({"last_message_excerpt": (message_plaintext or "")[:200]}),
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


def _serialize_feedback(feedback: Feedback) -> Dict[str, Any]:
    """
    Serialize a feedback row with normalized metadata, scoring, and policy matches.
    Extracted so Customer 360 and other modules can reuse it without importing the legacy api.py.
    """
    meta = _normalize_metadata(feedback)
    customer_key = meta.get("customer_key")
    customer_label = meta.get("customer_label")
    msg = decrypt_text(feedback.message_encrypted)
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
            "product_prefix": r.product_prefix,
            "product_group": r.product_group,
            "product_description": r.product_description,
            "confidence": r.confidence,
            "is_primary": bool(r.is_primary),
            "needs_review": bool(r.needs_review),
        }
        for r in (pol_rows or [])
    ]
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
        "customer_profile_id": getattr(profile, "id", None),
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


