"""
Policy-match routes for the /api blueprint.

Moved from legacy `backend/app/routes/api.py`.
"""

from __future__ import annotations

from typing import Any, Dict, List

from flask import jsonify, request
from sqlalchemy import desc

from ...database import SessionLocal
from ...models import Feedback, FeedbackPolicyMatch
from ...services.policy_detection import detect_policies
from . import api_bp
from ._helpers import _current_user, _scope_feedback_query, _user_permission_keys


@api_bp.route("/feedback/<int:feedback_id>/policy-matches", methods=["GET", "POST"])
def feedback_policy_matches(feedback_id: int):
    """
    Review / correct policy matches for a feedback item.

    GET: returns current matches.
    POST: supports:
      - set_primary_policy_hash: str
      - remove_policy_hashes: list[str]
      - add_policy_number: str (raw; server hashes + masks; raw is not persisted)
    """
    db = SessionLocal()
    try:
        user = _current_user(db)
        perms = _user_permission_keys(db, getattr(user, "id", None))

        q = db.query(Feedback).filter(Feedback.deleted_at.is_(None)).filter(Feedback.id == feedback_id)
        if user and perms:
            q = _scope_feedback_query(db, q, user=user, perms=perms)
        fb = q.first()
        if not fb:
            return jsonify({"error": "Feedback not found"}), 404

        if request.method == "GET":
            rows = (
                db.query(FeedbackPolicyMatch)
                .filter(FeedbackPolicyMatch.feedback_id == feedback_id)
                .order_by(desc(FeedbackPolicyMatch.is_primary), desc(FeedbackPolicyMatch.confidence), desc(FeedbackPolicyMatch.id))
                .all()
            )
            return (
                jsonify(
                    {
                        "feedback_id": feedback_id,
                        "items": [
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
                            for r in (rows or [])
                        ],
                    }
                ),
                200,
            )

        payload = request.get_json(silent=True) or {}
        set_primary = str(payload.get("set_primary_policy_hash") or "").strip()
        remove_hashes_in = payload.get("remove_policy_hashes")
        remove_hashes: List[str] = []
        if isinstance(remove_hashes_in, list):
            remove_hashes = [str(x or "").strip() for x in remove_hashes_in if str(x or "").strip()]

        add_policy_number = str(payload.get("add_policy_number") or "").strip()

        changed = False

        if remove_hashes:
            (
                db.query(FeedbackPolicyMatch)
                .filter(FeedbackPolicyMatch.feedback_id == feedback_id)
                .filter(FeedbackPolicyMatch.policy_hash.in_(remove_hashes))
                .delete(synchronize_session=False)
            )
            changed = True

        if add_policy_number:
            try:
                detected, _dbg = detect_policies(add_policy_number)
                for d in detected:
                    exists = (
                        db.query(FeedbackPolicyMatch.id)
                        .filter(FeedbackPolicyMatch.feedback_id == feedback_id)
                        .filter(FeedbackPolicyMatch.policy_hash == d.policy_hash)
                        .first()
                    )
                    if exists:
                        continue
                    db.add(
                        FeedbackPolicyMatch(
                            feedback_id=feedback_id,
                            policy_hash=d.policy_hash,
                            policy_masked=d.masked,
                            product_prefix=d.product_prefix,
                            product_group=d.product_group,
                            product_description=d.product_description,
                            confidence=float(d.confidence or 0.0),
                            is_primary=bool(d.is_primary),
                            needs_review=bool(d.needs_review),
                        )
                    )
                changed = True
            except Exception:
                return jsonify({"error": "Invalid policy number"}), 400

        if set_primary:
            rows = db.query(FeedbackPolicyMatch).filter(FeedbackPolicyMatch.feedback_id == feedback_id).all()
            found = False
            for r in rows:
                if r.policy_hash == set_primary:
                    r.is_primary = True
                    r.needs_review = False
                    found = True
                else:
                    r.is_primary = False
            if not found:
                return jsonify({"error": "primary policy hash not found"}), 404
            changed = True

        if changed:
            db.commit()

        rows = (
            db.query(FeedbackPolicyMatch)
            .filter(FeedbackPolicyMatch.feedback_id == feedback_id)
            .order_by(desc(FeedbackPolicyMatch.is_primary), desc(FeedbackPolicyMatch.confidence), desc(FeedbackPolicyMatch.id))
            .all()
        )
        return (
            jsonify(
                {
                    "feedback_id": feedback_id,
                    "items": [
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
                        for r in (rows or [])
                    ],
                }
            ),
            200,
        )
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    except Exception:
        db.rollback()
        return jsonify({"error": "Internal server error"}), 500
    finally:
        db.close()

