"""
Customer 360 routes for the /api blueprint.

Moved from legacy `backend/app/routes/api.py`.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict
from urllib.parse import unquote

from flask import jsonify, request
from sqlalchemy import desc, func

from ...database import SessionLocal
from ...models import (
    CustomerDemographics,
    CustomerIdentifier,
    CustomerProfile,
    CustomerPurchase,
    CustomerSupportTicket,
    Feedback,
    FeedbackPolicyMatch,
)
from ...security import encrypt_text, hash_email
from ...services.metadata_normalization import safe_json_loads
from . import api_bp
from ._helpers import (
    _find_customer_profile,
    _parse_dt,
    _require_user,
    _scope_feedback_query,
    _safe_json_dumps,
    _serialize_feedback,
    _user_permission_keys,
)


@api_bp.route("/customers/<path:customer_key>", methods=["GET"])
def customer_profile(customer_key: str):
    db = SessionLocal()
    try:
        # Allow any authenticated agent/admin to access Customer 360, but only for feedback
        # rows they are scoped to see. (Customer lookups are derived from feedback visibility.)
        try:
            user = _require_user(db)
            perms = _user_permission_keys(db, user.id)
        except PermissionError as e:
            return jsonify({"error": str(e)}), 401

        # Path may arrive with literal %3A (no ':') or double-encoded %253A after some
        # clients/proxies; normalize so "email_hash:<hex>" always parses.
        ck = (customer_key or "").strip()
        while True:
            decoded = unquote(ck)
            if decoded == ck:
                break
            ck = decoded
        customer_key = ck.strip()

        if ":" not in customer_key:
            return jsonify({"error": "Invalid customer key"}), 400
        prefix, raw_value = customer_key.split(":", 1)
        prefix = prefix.strip().lower()
        raw_value = raw_value.strip()
        if not raw_value:
            return jsonify({"error": "Invalid customer key"}), 400

        q = db.query(Feedback).filter(Feedback.deleted_at.is_(None))
        q = _scope_feedback_query(db, q, user=user, perms=perms)
        if prefix == "customer":
            q = q.filter(Feedback.customer_id == raw_value)
        elif prefix == "email_hash":
            q = q.filter(Feedback.email_hash == raw_value)
        elif prefix == "policy_hash":
            # Prefer primary policy matches, but allow fallback to any match.
            q_primary = (
                q.join(FeedbackPolicyMatch, FeedbackPolicyMatch.feedback_id == Feedback.id)
                .filter(FeedbackPolicyMatch.policy_hash == raw_value)
                .filter(FeedbackPolicyMatch.is_primary.is_(True))
            )
            rows = q_primary.order_by(desc(Feedback.created_at), desc(Feedback.id)).limit(100).all()
            if not rows:
                q_any = q.join(FeedbackPolicyMatch, FeedbackPolicyMatch.feedback_id == Feedback.id).filter(
                    FeedbackPolicyMatch.policy_hash == raw_value
                )
                rows = q_any.order_by(desc(Feedback.created_at), desc(Feedback.id)).limit(100).all()
        else:
            q = q.filter(func.lower(Feedback.channel_metadata).like(f"%{raw_value.lower()}%"))
            rows = q.order_by(desc(Feedback.created_at), desc(Feedback.id)).limit(100).all()

        if prefix in ("customer", "email_hash"):
            rows = q.order_by(desc(Feedback.created_at), desc(Feedback.id)).limit(100).all()
        if not rows:
            return jsonify({"error": "Customer not found"}), 404

        serialized = [_serialize_feedback(row) for row in rows]
        profile = _find_customer_profile(db, customer_key=customer_key)
        source_counts: Dict[str, int] = {}
        sentiment_counts: Dict[str, int] = {}
        customer_label = None
        for item in serialized:
            src = item.get("source_group") or item.get("source") or "unknown"
            source_counts[src] = source_counts.get(src, 0) + 1
            sent = (item.get("sentiment_label") or "unknown").lower()
            sentiment_counts[sent] = sentiment_counts.get(sent, 0) + 1
            if not customer_label:
                customer_label = item.get("customer_label") or item.get("customer_id")

        identifiers = []
        purchases_payload = []
        tickets_payload = []
        demographics_payload = None
        if profile:
            identifiers = (
                db.query(CustomerIdentifier)
                .filter(CustomerIdentifier.customer_profile_id == profile.id)
                .order_by(CustomerIdentifier.created_at.desc(), CustomerIdentifier.id.desc())
                .all()
            )
            purchases = (
                db.query(CustomerPurchase)
                .filter(CustomerPurchase.customer_profile_id == profile.id)
                .order_by(desc(CustomerPurchase.purchased_at), desc(CustomerPurchase.id))
                .all()
            )
            tickets = (
                db.query(CustomerSupportTicket)
                .filter(CustomerSupportTicket.customer_profile_id == profile.id)
                .order_by(desc(CustomerSupportTicket.opened_at), desc(CustomerSupportTicket.id))
                .all()
            )
            demographics = db.query(CustomerDemographics).filter(CustomerDemographics.customer_profile_id == profile.id).first()
            purchases_payload = [
                {
                    "id": p.id,
                    "purchase_ref": p.purchase_ref,
                    "product_name": p.product_name,
                    "product_line": p.product_line,
                    "amount": p.amount,
                    "currency": p.currency,
                    "status": p.status,
                    "purchased_at": p.purchased_at.isoformat() if p.purchased_at else None,
                    "renewal_at": p.renewal_at.isoformat() if p.renewal_at else None,
                }
                for p in purchases
            ]
            tickets_payload = [
                {
                    "id": t.id,
                    "ticket_ref": t.ticket_ref,
                    "subject": t.subject,
                    "status": t.status,
                    "priority": t.priority,
                    "opened_at": t.opened_at.isoformat() if t.opened_at else None,
                    "closed_at": t.closed_at.isoformat() if t.closed_at else None,
                    "channel": t.channel,
                    "summary": t.summary,
                }
                for t in tickets
            ]
            if demographics:
                demographics_payload = {
                    "age_range": demographics.age_range,
                    "gender": demographics.gender,
                    "location": demographics.location,
                    "language": demographics.language,
                    "segment": demographics.segment,
                    "occupation": demographics.occupation,
                    "metadata": safe_json_loads(demographics.demographics_metadata),
                }

        return jsonify(
            {
                "customer": {
                    "customer_key": customer_key,
                    "label": customer_label or raw_value,
                    "profile_id": getattr(profile, "id", None),
                    "external_customer_id": getattr(profile, "external_customer_id", None),
                    "customer_tier": getattr(profile, "customer_tier", None),
                    "lifecycle_stage": getattr(profile, "lifecycle_stage", None),
                    "company": getattr(profile, "company", None),
                    "total_feedback": len(serialized),
                    "first_seen_at": serialized[-1].get("created_at"),
                    "last_seen_at": serialized[0].get("created_at"),
                    "source_counts": source_counts,
                    "sentiment_counts": sentiment_counts,
                },
                "identifiers": [
                    {
                        "id": ident.id,
                        "identifier_type": ident.identifier_type,
                        "identifier_value": ident.identifier_value,
                        "label": ident.label,
                        "source": ident.source,
                    }
                    for ident in identifiers
                ],
                "purchases": purchases_payload,
                "tickets": tickets_payload,
                "demographics": demographics_payload,
                "history": serialized[:25],
            }
        )
    except Exception:
        return jsonify({"error": "Failed to fetch customer profile"}), 500
    finally:
        db.close()


@api_bp.route("/customers", methods=["POST"])
def create_customer_profile():
    db = SessionLocal()
    try:
        payload = request.get_json(silent=True) or {}
        profile = CustomerProfile(
            external_customer_id=(payload.get("external_customer_id") or "").strip() or None,
            display_name=(payload.get("display_name") or "").strip() or None,
            primary_email_hash=hash_email((payload.get("email") or "").strip() or None),
            primary_email_encrypted=encrypt_text((payload.get("email") or "").strip() or None),
            customer_tier=(payload.get("customer_tier") or "").strip() or None,
            lifecycle_stage=(payload.get("lifecycle_stage") or "").strip() or None,
            company=(payload.get("company") or "").strip() or None,
            notes=(payload.get("notes") or "").strip() or None,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return jsonify({"id": profile.id}), 201
    finally:
        db.close()


@api_bp.route("/customers/<int:customer_id>/purchases", methods=["POST"])
def create_customer_purchase(customer_id: int):
    db = SessionLocal()
    try:
        payload = request.get_json(silent=True) or {}
        row = CustomerPurchase(
            customer_profile_id=customer_id,
            purchase_ref=(payload.get("purchase_ref") or "").strip() or None,
            product_name=(payload.get("product_name") or "").strip() or "Unknown product",
            product_line=(payload.get("product_line") or "").strip() or None,
            amount=float(payload.get("amount")) if payload.get("amount") is not None else None,
            currency=(payload.get("currency") or "GHS").strip(),
            status=(payload.get("status") or "").strip() or "active",
            purchased_at=_parse_dt(payload.get("purchased_at")),
            renewal_at=_parse_dt(payload.get("renewal_at")),
            purchase_metadata=_safe_json_dumps(payload.get("metadata")),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return jsonify({"id": row.id}), 201
    finally:
        db.close()


@api_bp.route("/customers/<int:customer_id>/tickets", methods=["POST"])
def create_customer_ticket(customer_id: int):
    db = SessionLocal()
    try:
        payload = request.get_json(silent=True) or {}
        row = CustomerSupportTicket(
            customer_profile_id=customer_id,
            ticket_ref=(payload.get("ticket_ref") or "").strip() or None,
            subject=(payload.get("subject") or "").strip() or "Customer support ticket",
            status=(payload.get("status") or "").strip() or "open",
            priority=(payload.get("priority") or "").strip() or "medium",
            opened_at=_parse_dt(payload.get("opened_at")),
            closed_at=_parse_dt(payload.get("closed_at")),
            channel=(payload.get("channel") or "").strip() or None,
            summary=(payload.get("summary") or "").strip() or None,
            ticket_metadata=_safe_json_dumps(payload.get("metadata")),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return jsonify({"id": row.id}), 201
    finally:
        db.close()


@api_bp.route("/customers/<int:customer_id>/demographics", methods=["POST"])
def upsert_customer_demographics(customer_id: int):
    db = SessionLocal()
    try:
        payload = request.get_json(silent=True) or {}
        row = db.query(CustomerDemographics).filter(CustomerDemographics.customer_profile_id == customer_id).first()
        if not row:
            row = CustomerDemographics(customer_profile_id=customer_id)
            db.add(row)
        row.age_range = (payload.get("age_range") or "").strip() or row.age_range
        row.gender = (payload.get("gender") or "").strip() or row.gender
        row.location = (payload.get("location") or "").strip() or row.location
        row.language = (payload.get("language") or "").strip() or row.language
        row.segment = (payload.get("segment") or "").strip() or row.segment
        row.occupation = (payload.get("occupation") or "").strip() or row.occupation
        row.demographics_metadata = _safe_json_dumps(payload.get("metadata")) or row.demographics_metadata
        row.updated_at = datetime.now(tz=timezone.utc)
        db.commit()
        db.refresh(row)
        return jsonify({"id": row.id}), 200
    finally:
        db.close()

