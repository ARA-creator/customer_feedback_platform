import json
import logging
from datetime import datetime, timedelta, timezone

from flask import Blueprint, render_template, request, jsonify, redirect, url_for
from sqlalchemy import func, desc
from sqlalchemy.exc import SQLAlchemyError

from ..database import SessionLocal
from ..models import Feedback, FeedbackPolicyMatch
from ..security import decrypt_text, encrypt_text, hash_email
from ..services.policy_detection import detect_policies
from ..services.insurance_tags import categorize_insurance_tags
from ..sentiment_analyzer import analyze_sentiment
logger = logging.getLogger(__name__)

views_bp = Blueprint("views", __name__)


@views_bp.route("/")
def dashboard():
    """Main dashboard showing feedback overview and analytics."""
    db = SessionLocal()
    try:
        # Get recent feedback (last 50, excluding soft-deleted)
        recent = (
            db.query(Feedback)
            .filter(Feedback.deleted_at.is_(None))
            .order_by(desc(Feedback.created_at))
            .limit(50)
            .all()
        )

        # For dashboard display, we need to decrypt messages
        # TODO: consider caching this or doing it in batches
        feedback_list = []
        for f in recent:
            msg = decrypt_text(f.message_encrypted)
            feedback_list.append({
                "id": f.id,
                "source": f.source,
                "customer_id": f.customer_id,
                "message": msg or "[encrypted]",
                "rating": f.rating,
                "category": f.category,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "sentiment_label": f.sentiment_label,
                "sentiment_score": f.sentiment_score,
                "priority": f.priority,
                "tags": f.tags,
            })

        # Get counts for charts
        sentiment_counts = (
            db.query(Feedback.sentiment_label, func.count(Feedback.id))
            .filter(Feedback.deleted_at.is_(None))
            .group_by(Feedback.sentiment_label)
            .all()
        )

        category_counts = (
            db.query(Feedback.category, func.count(Feedback.id))
            .filter(Feedback.deleted_at.is_(None))
            .filter(Feedback.category.isnot(None))
            .group_by(Feedback.category)
            .order_by(desc(func.count(Feedback.id)))
            .limit(10)
            .all()
        )

        # Priority queue - top 20 by priority
        priority_queue = (
            db.query(Feedback)
            .filter(Feedback.deleted_at.is_(None))
            .filter(Feedback.priority.isnot(None))
            .order_by(desc(Feedback.priority), desc(Feedback.created_at))
            .limit(20)
            .all()
        )

        priority_list = []
        for f in priority_queue:
            msg = decrypt_text(f.message_encrypted)
            priority_list.append({
                "id": f.id,
                "priority": f.priority,
                "sentiment_label": f.sentiment_label,
                "category": f.category,
                "rating": f.rating,
                "message_preview": (msg or "[encrypted]")[:100] if msg else "[encrypted]",
                "created_at": f.created_at.isoformat() if f.created_at else None,
            })

        # Format for Chart.js
        sentiment_data = {label or "unknown": count for label, count in sentiment_counts}
        category_data = {cat or "uncategorized": count for cat, count in category_counts}

        # Calculate metrics for dashboard cards
        total_feedback = db.query(func.count(Feedback.id)).filter(Feedback.deleted_at.is_(None)).scalar() or 0
        positive_count = sum(count for label, count in sentiment_counts if label == "positive")
        negative_count = sum(count for label, count in sentiment_counts if label == "negative")
        neutral_count = sum(count for label, count in sentiment_counts if label == "neutral")
        
        # Calculate average sentiment score
        avg_sentiment = db.query(func.avg(Feedback.sentiment_score)).filter(
            Feedback.deleted_at.is_(None),
            Feedback.sentiment_score.isnot(None)
        ).scalar() or 0.0
        
        # High priority count (priority >= 100)
        high_priority_count = db.query(func.count(Feedback.id)).filter(
            Feedback.deleted_at.is_(None),
            Feedback.priority >= 100
        ).scalar() or 0

        return render_template(
            "dashboard.html",
            feedback_list=feedback_list,
            sentiment_data=sentiment_data,
            category_data=category_data,
            priority_queue=priority_list,
            total_feedback=total_feedback,
            positive_count=positive_count,
            negative_count=negative_count,
            neutral_count=neutral_count,
            avg_sentiment=round(float(avg_sentiment), 2),
            high_priority_count=high_priority_count,
        )

    except SQLAlchemyError:
        logger.exception("Database error in dashboard")
        return render_template("dashboard.html", error="Failed to load data"), 500
    finally:
        db.close()


@views_bp.route("/submit", methods=["GET", "POST"])
def submit_feedback():
    """
    Removed: public web submission UI.
    """
    return jsonify({"error": "Web feedback submission has been removed."}), 410


# Add this to app/routes/views.py temporarily
@views_bp.route("/debug/feedback")
def debug_feedback():
    from ..database import SessionLocal
    from ..models import Feedback
    from ..security import decrypt_text
    
    db = SessionLocal()
    try:
        all_feedback = db.query(Feedback).order_by(Feedback.id.desc()).limit(10).all()
        result = []
        for f in all_feedback:
            msg = decrypt_text(f.message_encrypted)
            result.append({
                "id": f.id,
                "source": f.source,
                "message_preview": (msg or "[encrypted]")[:100] if msg else "[encrypted]",
                "created_at": str(f.created_at),
                "sentiment": f.sentiment_label,
            })
        return jsonify({"count": len(result), "feedback": result})
    finally:
        db.close()
