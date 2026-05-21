"""
Reply draft routes: compose, approve, and queue customer responses.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from flask import jsonify, request, session
from sqlalchemy import desc, func

from ...database import SessionLocal
from ...models import Feedback, FeedbackReplyDraft, User
from ...security import decrypt_text
from ...services.ai_drafts import generate_reply_draft, rephrase_reply_text
from ...services.metadata_normalization import safe_json_loads
from . import api_bp
from ._helpers import (
    _audit_log,
    _current_user,
    _find_customer_profile,
    _normalize_metadata,
    _require_any_permission,
    _require_permission,
    _safe_json_dumps,
    _scope_feedback_query,
    _serialize_feedback,
    _user_permission_keys,
)

logger = logging.getLogger(__name__)


def _can_approve_replies(perms: set[str]) -> bool:
    return "feedback.approve" in perms or "admin.manage_users" in perms


def _can_reply(perms: set[str]) -> bool:
    return "feedback.reply" in perms or "feedback.approve" in perms or "admin.manage_users" in perms


def _serialize_draft(
    db,
    draft: FeedbackReplyDraft,
    *,
    feedback: Optional[Feedback] = None,
) -> Dict[str, Any]:
    creator = None
    if draft.created_by_user_id:
        creator = db.query(User).filter(User.id == draft.created_by_user_id).first()
    approver = None
    if draft.approved_by_user_id:
        approver = db.query(User).filter(User.id == draft.approved_by_user_id).first()
    assignee = None
    if draft.approval_assigned_to_user_id:
        assignee = db.query(User).filter(User.id == draft.approval_assigned_to_user_id).first()

    fb = feedback
    if not fb and draft.feedback_id:
        fb = db.query(Feedback).filter(Feedback.id == draft.feedback_id).first()

    out: Dict[str, Any] = {
        "id": draft.id,
        "feedback_id": draft.feedback_id,
        "channel": draft.channel,
        "visibility": draft.visibility,
        "tone": draft.tone,
        "body": draft.body,
        "alt_body": draft.alt_body,
        "ai_generated": bool(draft.ai_generated),
        "model_name": draft.model_name,
        "approval_status": draft.approval_status,
        "approval_note": draft.approval_note,
        "approval_assigned_to_user_id": draft.approval_assigned_to_user_id,
        "send_status": draft.send_status,
        "send_error": draft.send_error,
        "sent_at": draft.sent_at.isoformat() if draft.sent_at else None,
        "created_at": draft.created_at.isoformat() if draft.created_at else None,
        "updated_at": draft.updated_at.isoformat() if draft.updated_at else None,
        "created_by_user_id": draft.created_by_user_id,
        "created_by_email": creator.email if creator else None,
        "approved_by_user_id": draft.approved_by_user_id,
        "approved_by_email": approver.email if approver else None,
        "approval_assigned_to_email": assignee.email if assignee else None,
    }
    if fb:
        meta = _normalize_metadata(fb)
        out["feedback"] = {
            "id": fb.id,
            "source": fb.source,
            "category": fb.category,
            "sentiment_label": fb.sentiment_label,
            "priority": fb.priority,
            "created_at": fb.created_at.isoformat() if fb.created_at else None,
            "customer_label": meta.get("customer_label"),
            "message_preview": (decrypt_text(fb.message_encrypted) or "")[:240],
        }
    return out


def _feedback_for_user(db, feedback_id: int, user: User, perms: set[str]) -> Optional[Feedback]:
    q = db.query(Feedback).filter(Feedback.id == feedback_id, Feedback.deleted_at.is_(None))
    q = _scope_feedback_query(db, q, user=user, perms=perms)
    return q.first()


def _approval_status_for_visibility(visibility: str) -> str:
    vis = (visibility or "private").strip().lower()
    return "pending" if vis in ("public", "dm", "email") else "approved"


@api_bp.route("/feedback/<int:feedback_id>/draft-replies", methods=["GET", "POST"])
def feedback_draft_replies(feedback_id: int):
    db = SessionLocal()
    try:
        user, perms = _require_any_permission(db, ["feedback.reply", "feedback.approve", "feedback.view_all", "feedback.view_team", "feedback.view_assigned"])
        if not _can_reply(perms) and request.method == "POST":
            return jsonify({"error": "Missing permission: feedback.reply"}), 403

        feedback = _feedback_for_user(db, feedback_id, user, perms)
        if not feedback:
            return jsonify({"error": "Feedback not found"}), 404

        if request.method == "GET":
            rows = (
                db.query(FeedbackReplyDraft)
                .filter(FeedbackReplyDraft.feedback_id == feedback_id)
                .order_by(desc(FeedbackReplyDraft.created_at), desc(FeedbackReplyDraft.id))
                .all()
            )
            return jsonify({"drafts": [_serialize_draft(db, d, feedback=feedback) for d in rows]})

        payload = request.get_json(silent=True) or {}
        body = str(payload.get("body") or "").strip()
        if not body:
            return jsonify({"error": "body is required"}), 400

        visibility = str(payload.get("visibility") or "private").strip().lower()
        channel = str(payload.get("channel") or feedback.source or "internal").strip().lower()
        draft = FeedbackReplyDraft(
            feedback_id=feedback_id,
            created_by_user_id=user.id,
            channel=channel,
            visibility=visibility,
            tone=payload.get("tone"),
            brand_guidelines=payload.get("brand_guidelines") or payload.get("brand_voice"),
            body=body,
            alt_body=payload.get("alt_body"),
            ai_generated=bool(payload.get("ai_generated")),
            model_name=payload.get("model_name"),
            approval_status=_approval_status_for_visibility(visibility),
            send_status="draft",
        )
        db.add(draft)
        db.commit()
        db.refresh(draft)

        _audit_log(
            db,
            actor_user_id=session.get("user_id"),
            action="feedback.reply_draft.create",
            target_type="feedback_reply_draft",
            target_id=str(draft.id),
            meta={"feedback_id": feedback_id, "visibility": visibility},
        )
        return jsonify({"draft": _serialize_draft(db, draft, feedback=feedback)}), 201
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/feedback/<int:feedback_id>/draft-replies/generate", methods=["POST"])
def feedback_generate_draft(feedback_id: int):
    db = SessionLocal()
    try:
        user, perms = _require_any_permission(db, ["feedback.reply", "feedback.approve"])
        payload = request.get_json(silent=True) or {}
        feedback = _feedback_for_user(db, feedback_id, user, perms)
        if not feedback:
            return jsonify({"error": "Feedback not found"}), 404

        meta = _normalize_metadata(feedback)
        msg = decrypt_text(feedback.message_encrypted) or ""
        profile = _find_customer_profile(db, feedback=feedback)
        customer_payload = None
        if profile:
            customer_payload = {"customer": {"label": profile.display_name, "id": profile.id}}

        generated = generate_reply_draft(
            feedback={
                "id": feedback.id,
                "message": msg,
                "source": feedback.source,
                "category": feedback.category,
                "sentiment_label": feedback.sentiment_label,
                "customer_label": meta.get("customer_label"),
            },
            customer_profile=customer_payload,
            tone=str(payload.get("tone") or "empathetic"),
            brand_voice=str(payload.get("brand_voice") or payload.get("brand_guidelines") or "professional, calm, reassuring"),
            public_response=bool(payload.get("public_response") or str(payload.get("visibility") or "").lower() == "public"),
        )

        visibility = "public" if payload.get("public_response") else str(payload.get("visibility") or "private")
        draft = FeedbackReplyDraft(
            feedback_id=feedback_id,
            created_by_user_id=user.id,
            channel=str(payload.get("channel") or feedback.source or "internal"),
            visibility=visibility,
            tone=payload.get("tone"),
            brand_guidelines=payload.get("brand_voice"),
            body=generated.get("body") or "",
            alt_body=generated.get("alt_body"),
            ai_generated=bool(generated.get("ai_generated", True)),
            model_name=generated.get("model_name"),
            approval_status=_approval_status_for_visibility(visibility),
            send_status="draft",
        )
        db.add(draft)
        db.commit()
        db.refresh(draft)
        return jsonify({"draft": _serialize_draft(db, draft, feedback=feedback)}), 201
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/feedback/<int:feedback_id>/draft-replies/rephrase", methods=["POST"])
def feedback_rephrase_draft(feedback_id: int):
    db = SessionLocal()
    try:
        user, perms = _require_any_permission(db, ["feedback.reply", "feedback.approve"])
        payload = request.get_json(silent=True) or {}
        text = str(payload.get("text") or payload.get("body") or "").strip()
        if not text:
            return jsonify({"error": "text is required"}), 400
        feedback = _feedback_for_user(db, feedback_id, user, perms)
        if not feedback:
            return jsonify({"error": "Feedback not found"}), 404

        result = rephrase_reply_text(
            text=text,
            tone=str(payload.get("tone") or "empathetic"),
            brand_voice=str(payload.get("brand_voice") or "professional, calm, reassuring"),
        )
        return jsonify(result)
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


def _get_draft_or_404(db, draft_id: int) -> Optional[FeedbackReplyDraft]:
    return db.query(FeedbackReplyDraft).filter(FeedbackReplyDraft.id == draft_id).first()


@api_bp.route("/feedback/replies/<int:draft_id>/approve", methods=["POST"])
def feedback_reply_approve(draft_id: int):
    db = SessionLocal()
    try:
        user, perms = _require_any_permission(db, ["feedback.approve", "admin.manage_users"])
        if not _can_approve_replies(perms):
            return jsonify({"error": "Missing permission: feedback.approve"}), 403

        draft = _get_draft_or_404(db, draft_id)
        if not draft:
            return jsonify({"error": "Draft not found"}), 404

        payload = request.get_json(silent=True) or {}
        note = str(payload.get("note") or "").strip() or None
        draft.approval_status = "approved"
        draft.approval_note = note
        draft.approved_by_user_id = user.id
        draft.updated_at = datetime.now(tz=timezone.utc)
        db.commit()

        _audit_log(
            db,
            actor_user_id=user.id,
            action="feedback.reply_draft.approve",
            target_type="feedback_reply_draft",
            target_id=str(draft_id),
            meta={"feedback_id": draft.feedback_id},
        )
        return jsonify({"ok": True, "draft": _serialize_draft(db, draft)})
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/feedback/replies/<int:draft_id>/reject", methods=["POST"])
def feedback_reply_reject(draft_id: int):
    db = SessionLocal()
    try:
        user, perms = _require_any_permission(db, ["feedback.approve", "admin.manage_users"])
        if not _can_approve_replies(perms):
            return jsonify({"error": "Missing permission: feedback.approve"}), 403

        draft = _get_draft_or_404(db, draft_id)
        if not draft:
            return jsonify({"error": "Draft not found"}), 404

        payload = request.get_json(silent=True) or {}
        note = str(payload.get("note") or "").strip() or None
        if not note:
            return jsonify({"error": "A rejection note is required"}), 400

        draft.approval_status = "rejected"
        draft.approval_note = note
        draft.approved_by_user_id = user.id
        draft.send_status = "draft"
        draft.updated_at = datetime.now(tz=timezone.utc)
        db.commit()

        _audit_log(
            db,
            actor_user_id=user.id,
            action="feedback.reply_draft.reject",
            target_type="feedback_reply_draft",
            target_id=str(draft_id),
            meta={"feedback_id": draft.feedback_id, "note": note},
        )
        return jsonify({"ok": True, "draft": _serialize_draft(db, draft)})
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/feedback/replies/<int:draft_id>/assign-approver", methods=["POST"])
def feedback_reply_assign_approver(draft_id: int):
    db = SessionLocal()
    try:
        user, perms = _require_any_permission(db, ["feedback.approve", "admin.manage_users"])
        if not _can_approve_replies(perms):
            return jsonify({"error": "Missing permission: feedback.approve"}), 403

        draft = _get_draft_or_404(db, draft_id)
        if not draft:
            return jsonify({"error": "Draft not found"}), 404

        payload = request.get_json(silent=True) or {}
        approver_id = payload.get("approver_user_id")
        if approver_id is not None:
            approver = db.query(User).filter(User.id == int(approver_id), User.deleted_at.is_(None)).first()
            if not approver:
                return jsonify({"error": "Approver user not found"}), 404
            draft.approval_assigned_to_user_id = int(approver_id)
        else:
            draft.approval_assigned_to_user_id = None
        draft.updated_at = datetime.now(tz=timezone.utc)
        db.commit()
        return jsonify({"ok": True, "draft": _serialize_draft(db, draft)})
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/feedback/replies/<int:draft_id>/send", methods=["POST"])
def feedback_reply_send(draft_id: int):
    db = SessionLocal()
    try:
        user, perms = _require_any_permission(db, ["feedback.reply", "feedback.approve"])
        draft = _get_draft_or_404(db, draft_id)
        if not draft:
            return jsonify({"error": "Draft not found"}), 404

        if str(draft.approval_status or "").lower() == "pending":
            return jsonify({"error": "Reply must be approved before sending"}), 400
        if str(draft.approval_status or "").lower() == "rejected":
            return jsonify({"error": "Rejected drafts cannot be sent"}), 400

        draft.send_status = "queued_internal"
        draft.updated_at = datetime.now(tz=timezone.utc)
        db.commit()
        return jsonify({"ok": True, "draft": _serialize_draft(db, draft)})
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/feedback/replies/<int:draft_id>/seen", methods=["POST"])
def feedback_reply_seen(draft_id: int):
    db = SessionLocal()
    try:
        _require_any_permission(db, ["feedback.reply", "feedback.approve", "feedback.view_all"])
        draft = _get_draft_or_404(db, draft_id)
        if not draft:
            return jsonify({"error": "Draft not found"}), 404
        payload = request.get_json(silent=True) or {}
        draft.seen_status = str(payload.get("seen_status") or "seen")
        draft.seen_at = datetime.now(tz=timezone.utc)
        db.commit()
        return jsonify({"ok": True})
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()
