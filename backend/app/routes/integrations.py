import json
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests
from flask import Blueprint, request, jsonify
from flask import Response as FlaskResponse

from ..config import get_config
from ..database import SessionLocal
from ..integrations.web_monitor import (
    build_web_mentions,
    build_web_mentions_from_serpapi,
    mention_to_feedback_payload,
    normalize_feed_list,
    normalize_keywords,
    url_hash as web_url_hash,
)
from ..integrations.email_integration import fetch_emails, process_email_to_feedback
from ..integrations.meta_integration import (
    parse_facebook_webhook,
    parse_instagram_webhook,
    verify_meta_webhook_signature,
)
from ..integrations.whatsapp_integration import (
    parse_meta_whatsapp_webhook,
    parse_twilio_webhook,
    verify_twilio_signature,
)
from ..integrations.x_integration import (
    search_recent as x_search_recent,
    x_item_hash,
    x_item_to_feedback_payload,
)
from ..integrations.tiktok_integration import (
    poll_comments_or_mentions as tiktok_poll_comments_or_mentions,
    tiktok_item_hash,
    tiktok_item_to_feedback_payload,
)
from ..integrations.twilio_whatsapp_poll import fetch_recent_inbound_whatsapp_form_messages
from ..models import Feedback, FeedbackPolicyMatch, ExternalIngestedItem
from ..security import encrypt_text, hash_email
from ..sentiment_analyzer import analyze_sentiment
from ..services.policy_detection import detect_policies
from ..services.metadata_normalization import normalize_channel_metadata
from ..services.insurance_tags import categorize_insurance_tags

logger = logging.getLogger(__name__)

integrations_bp = Blueprint("integrations", __name__, url_prefix="/integrations")

def _sha256_hex(value: str) -> str:
    import hashlib

    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()


def poll_x_and_ingest(*, bearer_token: str, query: str, max_results: int = 25) -> dict:
    """
    Poll X recent search and ingest new items as feedback.

    Dedupe uses ExternalIngestedItem.url_hash = sha256(tweet_url).
    """
    items = x_search_recent(bearer_token=bearer_token, query=query, max_results=max_results)
    processed = 0

    db = SessionLocal()
    try:
        for it in items:
            h = x_item_hash(it)
            exists = db.query(ExternalIngestedItem.id).filter(ExternalIngestedItem.url_hash == h).first()
            if exists:
                continue

            db.add(ExternalIngestedItem(source="x", url=it.url, url_hash=h))
            db.commit()

            payload = x_item_to_feedback_payload(it)
            result = _submit_to_feedback_api(payload)
            if result:
                processed += 1
            else:
                db.query(ExternalIngestedItem).filter(ExternalIngestedItem.url_hash == h).delete()
                db.commit()
    finally:
        db.close()

    return {
        "message": f"Processed {processed} X items",
        "items_found": len(items),
        "processed": processed,
    }


def poll_tiktok_and_ingest(*, access_token: str, base_url: str, query: str, limit: int = 25) -> dict:
    """
    Poll TikTok comments/mentions (where available) and ingest new items as feedback.
    """
    items = tiktok_poll_comments_or_mentions(
        access_token=access_token, base_url=base_url, query=query, limit=limit
    )
    processed = 0

    db = SessionLocal()
    try:
        for it in items:
            h = tiktok_item_hash(it)
            exists = db.query(ExternalIngestedItem.id).filter(ExternalIngestedItem.url_hash == h).first()
            if exists:
                continue

            db.add(ExternalIngestedItem(source="tiktok", url=it.url, url_hash=h))
            db.commit()

            payload = tiktok_item_to_feedback_payload(it)
            result = _submit_to_feedback_api(payload)
            if result:
                processed += 1
            else:
                db.query(ExternalIngestedItem).filter(ExternalIngestedItem.url_hash == h).delete()
                db.commit()
    finally:
        db.close()

    return {
        "message": f"Processed {processed} TikTok items",
        "items_found": len(items),
        "processed": processed,
    }


def _submit_to_feedback_api(payload: dict) -> dict:
    """
    Helper to submit feedback payload directly to database.
    Same logic as api.create_feedback but without HTTP overhead.
    """
    message = payload.get("message", "").strip()
    if not message:
        return {}

    source = payload.get("source", "unknown")
    customer_id = payload.get("customer_id")
    email = payload.get("email")
    rating = payload.get("rating")
    category = payload.get("category")
    tags = payload.get("tags")
    consent_given = payload.get("consent_given", False)
    consent_text = payload.get("consent_text")
    channel_metadata = normalize_channel_metadata(source, payload.get("channel_metadata")) or {}
    try:
        channel_metadata["insurance_tags"] = categorize_insurance_tags(message, source=source)
    except Exception:
        channel_metadata["insurance_tags"] = channel_metadata.get("insurance_tags") or []

    # Ensure we persist `email_hash` for email-sourced feedback even when the caller
    # didn't pass `email` explicitly, so Customer 360 identity linking works.
    if not email:
        derived = str(channel_metadata.get("sender_email") or channel_metadata.get("from_email") or "").strip().lower()
        email = derived or None

    # sentiment analysis (uses insurance tags for domain-aware VADER gating)
    sentiment = analyze_sentiment(message, source=source, insurance_tags=channel_metadata.get("insurance_tags"))
    sentiment_label = sentiment["label"]
    sentiment_score = sentiment["score"]

    # priority calculation
    base_priority = 0
    if sentiment_label == "negative":
        base_priority = 100
    elif sentiment_label == "neutral":
        base_priority = 50
    else:
        base_priority = 10

    if isinstance(rating, int):
        base_priority += max(0, 6 - rating) * 10

    priority = base_priority

    # serialize metadata
    import json
    channel_metadata_str = json.dumps(channel_metadata) if channel_metadata else None
    tags_str = json.dumps(tags) if tags else None

    db = SessionLocal()
    try:
        from ..routes.api._helpers import (
            _ensure_workflow,
            _upsert_customer_entities,
            _upsert_search_document,
            _notif_publish,
            _prefs_allows,
            _safe_json_dumps,
            _user_permission_keys,
        )
        from ..routes.api.feedback import (
            _get_notification_prefs,
            _is_admin_ui,
            _serialize_notification,
        )
        from ..models import Notification, User
        from sqlalchemy import desc, func, or_

        feedback = Feedback(
            source=source,
            customer_id=customer_id,
            email_hash=hash_email(email),
            email_encrypted=encrypt_text(email),
            message_encrypted=encrypt_text(message),
            rating=rating,
            category=category,
            sentiment_label=sentiment_label,
            sentiment_score=sentiment_score,
            priority=priority,
            tags=tags_str,
            consent_given=consent_given,
            consent_text=consent_text,
            channel_metadata=channel_metadata_str,
        )

        db.add(feedback)
        db.flush()

        # Policy tracing (best-effort; privacy-safe: persist hash + masked only)
        try:
            detected, _debug = detect_policies(message)
            for d in detected:
                db.add(
                    FeedbackPolicyMatch(
                        feedback_id=feedback.id,
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
        except Exception:
            logger.exception("Policy tracing: failed to detect/store policy matches (integrations)")

        _upsert_customer_entities(db, feedback=feedback, message_plaintext=message)
        _upsert_search_document(db, feedback=feedback, message_plaintext=message)
        _ensure_workflow(db, feedback.id, feedback)
        db.commit()
        db.refresh(feedback)

        # Create Notifications (best-effort). Mirrors api.create_feedback behavior so ingested items notify too.
        try:
            users = (
                db.query(User)
                .filter(User.deleted_at.is_(None))
                .filter(or_(User.is_active.is_(True), User.is_active.is_(None)))
                .filter(or_(User.suspended_at.is_(None), User.suspended_at == None))  # noqa: E711
                .all()
            )
            created_for: list[int] = []
            for u in users:
                try:
                    perms_u = _user_permission_keys(db, u.id)
                    is_admin = _is_admin_ui(u, perms_u)
                    prefs = _get_notification_prefs(db, u.id, is_admin=is_admin)
                    if not _prefs_allows(prefs, "new_feedback"):
                        continue
                    # Admins only get new feedback if they explicitly enabled it (default off).
                    if is_admin and not bool(prefs.get("new_feedback")):
                        continue
                    title = "New feedback received"
                    body = f"{(feedback.source or 'source').upper()} · {feedback.sentiment_label or 'unknown'}"
                    meta = {
                        "feedback_id": feedback.id,
                        "source": feedback.source,
                        "sentiment_label": feedback.sentiment_label,
                        "priority": feedback.priority,
                        "created_at": feedback.created_at.isoformat() if feedback.created_at else None,
                    }
                    n = Notification(
                        user_id=u.id,
                        type="new_feedback",
                        title=title,
                        body=body,
                        href="inbox",
                        meta=_safe_json_dumps(meta),
                    )
                    db.add(n)
                    created_for.append(u.id)
                except Exception:
                    continue
            if created_for:
                db.commit()
                for uid in created_for:
                    try:
                        unread = (
                            db.query(func.count(Notification.id))
                            .filter(Notification.user_id == uid)
                            .filter(Notification.read_at.is_(None))
                            .scalar()
                            or 0
                        )
                        last = (
                            db.query(Notification)
                            .filter(Notification.user_id == uid)
                            .order_by(desc(Notification.created_at), desc(Notification.id))
                            .first()
                        )
                        _notif_publish(
                            uid,
                            {
                                "type": "notification.created",
                                "notification": _serialize_notification(last) if last else None,
                                "unread": int(unread),
                            },
                        )
                    except Exception:
                        pass
        except Exception:
            logger.exception("Failed to create notifications for ingested feedback")

        return {"id": feedback.id, "status": "created"}
    except Exception as e:
        db.rollback()
        logger.exception(f"Error saving feedback: {e}")
        return {}
    finally:
        db.close()


def poll_email_and_ingest(
    *,
    imap_server: str,
    imap_port: int,
    username: str,
    password: str,
    folder: str = "INBOX",
    hours_back: int = 24,
) -> dict:
    """
    Poll an IMAP inbox and ingest messages as feedback records.

    Returns a summary dict similar to the /integrations/email/poll response.
    """
    since_date = datetime.now() - timedelta(hours=hours_back)
    emails = fetch_emails(imap_server, imap_port, username, password, folder, since_date)
    processed_count = 0

    def _email_dedupe_key(email_data: dict) -> str:
        # Prefer RFC822 Message-ID (stable across fetches).
        mid = (email_data.get("message_id") or "").strip()
        if mid:
            return f"message-id:{mid}"
        # Fallback to IMAP server id (may change across servers, but better than nothing).
        eid = (email_data.get("email_id") or "").strip()
        if eid:
            return f"imap-id:{eid}"
        # Last-resort: content-ish fingerprint.
        sender = (email_data.get("sender_email") or "").strip().lower()
        subj = (email_data.get("subject") or "").strip().lower()
        dt = (email_data.get("date") or "").strip()
        return f"fp:{sender}|{subj}|{dt}"

    db = SessionLocal()
    try:
        for email_data in emails:
            key = _email_dedupe_key(email_data)
            h = _sha256_hex(key)
            exists = db.query(ExternalIngestedItem.id).filter(ExternalIngestedItem.url_hash == h).first()
            if exists:
                continue

            # Mark seen before ingest to avoid duplicates on retries.
            db.add(ExternalIngestedItem(source="email", url=key, url_hash=h))
            db.commit()

            feedback_payload = process_email_to_feedback(email_data)
            result = _submit_to_feedback_api(feedback_payload)
            if result:
                processed_count += 1
            else:
                # Allow retry next poll if save failed.
                db.query(ExternalIngestedItem).filter(ExternalIngestedItem.url_hash == h).delete()
                db.commit()
    finally:
        db.close()

    return {
        "message": f"Processed {processed_count} emails",
        "emails_found": len(emails),
        "processed": processed_count,
    }


def poll_twilio_whatsapp_and_ingest(
    *,
    account_sid: str,
    auth_token: str,
    hours_back: int = 24,
    to_number: Optional[str] = None,
) -> dict:
    """
    Poll Twilio REST for inbound WhatsApp messages and ingest as feedback (like webhooks, without public URL).

    Dedupe: ExternalIngestedItem key ``twilio-wa:{MessageSid}``.
    """
    account_sid = (account_sid or "").strip()
    auth_token = (auth_token or "").strip()
    if not account_sid or not auth_token:
        return {"message": "Missing Twilio credentials", "messages_found": 0, "processed": 0, "error": "no_credentials"}

    to_filter = (to_number or "").strip() or None

    try:
        form_messages = fetch_recent_inbound_whatsapp_form_messages(
            account_sid,
            auth_token,
            hours_back=max(1, int(hours_back)),
            to_number_filter=to_filter,
            max_pages=5,
        )
    except Exception as e:
        logger.exception("Twilio WhatsApp poll fetch failed")
        return {"message": str(e), "messages_found": 0, "processed": 0, "error": "twilio_api"}

    processed_count = 0
    candidates = 0

    db = SessionLocal()
    try:
        for form in form_messages:
            sid = (form.get("MessageSid") or "").strip()
            if not sid:
                continue

            candidates += 1
            dedupe_key = f"twilio-wa:{sid}"
            h = _sha256_hex(dedupe_key)
            exists = db.query(ExternalIngestedItem.id).filter(ExternalIngestedItem.url_hash == h).first()
            if exists:
                continue

            db.add(ExternalIngestedItem(source="whatsapp", url=dedupe_key, url_hash=h))
            db.commit()

            feedback_payload = parse_twilio_webhook(form)
            if not feedback_payload:
                db.query(ExternalIngestedItem).filter(ExternalIngestedItem.url_hash == h).delete()
                db.commit()
                continue

            result = _submit_to_feedback_api(feedback_payload)
            if result:
                processed_count += 1
            else:
                db.query(ExternalIngestedItem).filter(ExternalIngestedItem.url_hash == h).delete()
                db.commit()
    finally:
        db.close()

    return {
        "message": f"Processed {processed_count} WhatsApp messages (Twilio poll)",
        "messages_found": len(form_messages),
        "inbound_whatsapp_candidates": candidates,
        "processed": processed_count,
    }


@integrations_bp.route("/google/forms", methods=["GET", "POST"])
def google_forms_webhook():
    """
    Google Forms ingestion via Apps Script webhook.

    Expected: JSON payload from Apps Script (doPost).
    Security: validate `X-Webhook-Secret` header matches GOOGLE_FORMS_WEBHOOK_SECRET.
    Dedupe: uses form_id + response_id if provided; else falls back to a content fingerprint.
    """
    config = get_config()
    expected = (getattr(config, "GOOGLE_FORMS_WEBHOOK_SECRET", "") or "").strip()

    if request.method == "GET":
        return jsonify(
            {
                "name": "Google Forms webhook",
                "method": "POST",
                "path": "/integrations/google/forms",
                "requires_env": ["GOOGLE_FORMS_WEBHOOK_SECRET"],
                "expects": {
                    "form_id": "string",
                    "response_id": "string",
                    "timestamp": "ISO string",
                    "email": "string (optional)",
                    "message": "string (required)",
                    "rating": "int 1-5 (optional)",
                    "category": "string (optional)",
                    "answers": "object (optional)",
                },
            }
        )

    if expected:
        provided = (request.headers.get("X-Webhook-Secret", "") or "").strip()
        if provided != expected:
            return jsonify({"error": "Invalid webhook secret"}), 403

    payload = request.get_json(silent=True) or {}
    message = (payload.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Missing message"}), 400

    form_id = (payload.get("form_id") or "").strip()
    response_id = (payload.get("response_id") or "").strip()
    timestamp = (payload.get("timestamp") or "").strip()
    email = (payload.get("email") or "").strip() or None
    category = (payload.get("category") or "").strip() or None
    rating = payload.get("rating")
    answers = payload.get("answers")

    if form_id and response_id:
        dedupe_key = f"google-forms:{form_id}:{response_id}"
    else:
        dedupe_key = f"google-forms:fp:{email or ''}|{timestamp}|{message[:200]}"
    h = _sha256_hex(dedupe_key)

    db = SessionLocal()
    try:
        exists = db.query(ExternalIngestedItem.id).filter(ExternalIngestedItem.url_hash == h).first()
        if exists:
            return jsonify({"status": "duplicate_skipped"}), 200

        db.add(ExternalIngestedItem(source="google_forms", url=dedupe_key, url_hash=h))
        db.commit()

        feedback_payload = {
            "message": message,
            "source": "google_forms",
            "email": email,
            "rating": rating if isinstance(rating, int) else None,
            "category": category,
            "channel_metadata": {
                "provider": "google_forms",
                "form_id": form_id or None,
                "response_id": response_id or None,
                "timestamp": timestamp or None,
                "answers": answers if isinstance(answers, dict) else None,
            },
        }

        result = _submit_to_feedback_api(feedback_payload)
        if result:
            return jsonify({"status": "ok", "feedback_id": result.get("id")}), 200

        db.query(ExternalIngestedItem).filter(ExternalIngestedItem.url_hash == h).delete()
        db.commit()
        return jsonify({"error": "Failed to process"}), 500
    except Exception as e:
        db.rollback()
        logger.exception("Error ingesting Google Forms payload")
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()


@integrations_bp.route("/email/poll", methods=["POST"])
def email_poll():
    """
    Poll email inbox for new messages and process them as feedback.

    Expects JSON with:
        - imap_server: str
        - imap_port: int (default 993)
        - username: str
        - password: str
        - folder: str (default "INBOX")
        - hours_back: int (default 24)

    Or reads from config if not provided.
    """
    config = get_config()
    data = request.get_json(silent=True) or {}

    imap_server = data.get("imap_server") or getattr(config, "EMAIL_IMAP_SERVER", None)
    imap_port = data.get("imap_port", 993)
    username = data.get("username") or getattr(config, "EMAIL_USERNAME", None)
    password = data.get("password") or getattr(config, "EMAIL_PASSWORD", None)
    folder = data.get("folder", "INBOX")
    hours_back = data.get("hours_back", 24)

    if not all([imap_server, username, password]):
        return jsonify({"error": "Missing email configuration"}), 400

    try:
        result = poll_email_and_ingest(
            imap_server=imap_server,
            imap_port=imap_port,
            username=username,
            password=password,
            folder=folder,
            hours_back=hours_back,
        )
        return jsonify(result)

    except Exception as e:
        logger.exception("Error polling email")
        return jsonify({"error": str(e)}), 500


@integrations_bp.route("/web/poll", methods=["POST"])
def web_poll():
    """
    Poll configured RSS feeds for web mentions and ingest them as feedback.

    Expects JSON with optional overrides:
        - rss_feeds: str (comma-separated) or list[str]
        - keywords: str (comma-separated) or list[str]
        - max_items: int
        - timeout_seconds: int
        - max_snippet_chars: int
    """
    config = get_config()
    data = request.get_json(silent=True) or {}

    rss_feeds_raw = data.get("rss_feeds", None)
    keywords_raw = data.get("keywords", None)

    if isinstance(rss_feeds_raw, list):
        feed_urls = [str(x).strip() for x in rss_feeds_raw if str(x).strip()]
    else:
        feed_urls = normalize_feed_list(
            rss_feeds_raw if isinstance(rss_feeds_raw, str) else getattr(config, "WEB_MONITOR_RSS_FEEDS", "")
        )

    if isinstance(keywords_raw, list):
        keywords = [str(x).strip() for x in keywords_raw if str(x).strip()]
    else:
        keywords = normalize_keywords(
            keywords_raw if isinstance(keywords_raw, str) else getattr(config, "WEB_MONITOR_KEYWORDS", "")
        )

    max_items = int(data.get("max_items") or getattr(config, "WEB_MONITOR_MAX_ITEMS_PER_RUN", 20))
    timeout_seconds = int(data.get("timeout_seconds") or getattr(config, "WEB_MONITOR_ARTICLE_TIMEOUT_SECONDS", 12))
    max_snippet_chars = int(data.get("max_snippet_chars") or getattr(config, "WEB_MONITOR_MAX_SNIPPET_CHARS", 1800))

    if not feed_urls:
        return jsonify({"error": "No RSS feeds configured. Set WEB_MONITOR_RSS_FEEDS or pass rss_feeds."}), 400

    mentions = build_web_mentions(
        feed_urls=feed_urls,
        keywords=keywords,
        max_items=max_items,
        timeout_seconds=timeout_seconds,
        max_snippet_chars=max_snippet_chars,
    )

    db = SessionLocal()
    processed = 0
    try:
        for m in mentions:
            h = web_url_hash(m.url)

            # Dedupe at DB level
            exists = db.query(ExternalIngestedItem.id).filter(ExternalIngestedItem.url_hash == h).first()
            if exists:
                continue

            # Track as seen first; if ingestion fails, rollback removes it.
            db.add(ExternalIngestedItem(source="web", url=m.url, url_hash=h))
            db.commit()

            payload = mention_to_feedback_payload(m)
            result = _submit_to_feedback_api(payload)
            if result:
                processed += 1
            else:
                # If feedback save failed for some reason, allow retry next poll
                db.query(ExternalIngestedItem).filter(ExternalIngestedItem.url_hash == h).delete()
                db.commit()

        return jsonify(
            {
                "message": f"Processed {processed} web items",
                "items_found": len(mentions),
                "processed": processed,
            }
        )
    except Exception as e:
        db.rollback()
        logger.exception("Error polling web monitor")
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()


@integrations_bp.route("/x/poll", methods=["GET", "POST"])
def x_poll():
    """
    Poll X (Twitter) recent search and ingest new items.

    Dedupe uses ExternalIngestedItem.url_hash = sha256(tweet_url).
    """
    config = get_config()
    bearer = getattr(config, "X_BEARER_TOKEN", "")
    query = (getattr(config, "X_QUERY", "") or "").strip()

    if request.method == "GET":
        return jsonify(
            {
                "name": "X poll endpoint",
                "method": "POST",
                "path": "/integrations/x/poll",
                "requires_env": ["X_BEARER_TOKEN", "X_QUERY"],
                "example": {
                    "curl": "curl -X POST http://127.0.0.1:5000/integrations/x/poll -H 'Content-Type: application/json' -d '{\"max_results\":25}'"
                },
            }
        )

    if not bearer:
        return jsonify({"error": "Missing X_BEARER_TOKEN"}), 400
    if not query:
        return jsonify({"error": "Missing X_QUERY"}), 400

    max_results = int((request.get_json(silent=True) or {}).get("max_results") or 25)
    max_results = max(10, min(max_results, 100))

    try:
        result = poll_x_and_ingest(bearer_token=bearer, query=query, max_results=max_results)
        return jsonify(result)
    except Exception as e:
        logger.exception("Error polling X")
        return jsonify({"error": str(e)}), 500


@integrations_bp.route("/tiktok/poll", methods=["GET", "POST"])
def tiktok_poll():
    """
    Poll TikTok comments/mentions (where available) and ingest new items.

    This integration is intentionally flexible: set `TIKTOK_API_BASE_URL` to the API
    base your TikTok program exposes, and ensure it supports either `/mentions` or
    `/comments` for polling.
    """
    config = get_config()
    access_token = (getattr(config, "TIKTOK_ACCESS_TOKEN", "") or "").strip()
    base_url = (getattr(config, "TIKTOK_API_BASE_URL", "") or "").strip()
    query = (request.get_json(silent=True) or {}).get("query") or "enterprise ghana"
    query = (query or "").strip()

    if request.method == "GET":
        return jsonify(
            {
                "name": "TikTok poll endpoint",
                "method": "POST",
                "path": "/integrations/tiktok/poll",
                "requires_env": ["TIKTOK_ACCESS_TOKEN", "TIKTOK_API_BASE_URL"],
                "example": {
                    "curl": "curl -X POST http://127.0.0.1:5000/integrations/tiktok/poll -H 'Content-Type: application/json' -d '{\"query\":\"enterprise ghana\",\"limit\":25}'"
                },
                "note": "This endpoint depends on your TikTok API program/access. It expects your configured API base to support /mentions or /comments.",
            }
        )

    if not access_token:
        return jsonify({"error": "Missing TIKTOK_ACCESS_TOKEN"}), 400
    if not base_url:
        return jsonify({"error": "Missing TIKTOK_API_BASE_URL"}), 400
    if not query:
        return jsonify({"error": "Missing query"}), 400

    limit = int((request.get_json(silent=True) or {}).get("limit") or 25)
    limit = max(1, min(limit, 100))

    try:
        result = poll_tiktok_and_ingest(
            access_token=access_token, base_url=base_url, query=query, limit=limit
        )
        return jsonify(result)
    except Exception as e:
        logger.exception("Error polling TikTok")
        return jsonify({"error": str(e)}), 500


@integrations_bp.route("/web/search/poll", methods=["POST"])
def web_search_poll():
    """
    Search the Ghana web via SerpAPI and ingest results as feedback (source=web).

    Expects JSON with optional overrides:
      - keywords: str (comma-separated) or list[str]
      - sites: str (comma-separated) or list[str] (default: .gh,com.gh)
      - results_per_keyword: int
      - max_total_items: int
    """
    config = get_config()
    data = request.get_json(silent=True) or {}

    api_key = (data.get("serpapi_api_key") or getattr(config, "SERPAPI_API_KEY", "") or "").strip()
    if not api_key:
        return jsonify({"error": "Missing SERPAPI_API_KEY"}), 400

    keywords_raw = data.get("keywords", None)
    if isinstance(keywords_raw, list):
        keywords = [str(x).strip() for x in keywords_raw if str(x).strip()]
    else:
        keywords = normalize_keywords(
            keywords_raw if isinstance(keywords_raw, str) else getattr(config, "WEB_MONITOR_KEYWORDS", "")
        )

    sites_raw = data.get("sites", None)
    if isinstance(sites_raw, list):
        sites = [str(x).strip() for x in sites_raw if str(x).strip()]
    else:
        sites = [p.strip() for p in str(sites_raw or getattr(config, "WEB_SEARCH_SITES", ".gh,com.gh")).split(",") if p.strip()]

    results_per_keyword = int(data.get("results_per_keyword") or getattr(config, "WEB_SEARCH_RESULTS_PER_KEYWORD", 10))
    max_total_items = int(data.get("max_total_items") or getattr(config, "WEB_MONITOR_MAX_ITEMS_PER_RUN", 20))
    timeout_seconds = int(data.get("timeout_seconds") or getattr(config, "WEB_MONITOR_ARTICLE_TIMEOUT_SECONDS", 12))
    max_snippet_chars = int(data.get("max_snippet_chars") or getattr(config, "WEB_MONITOR_MAX_SNIPPET_CHARS", 1800))

    mentions = build_web_mentions_from_serpapi(
        api_key=api_key,
        keywords=keywords,
        sites=sites,
        results_per_keyword=results_per_keyword,
        max_total_items=max_total_items,
        timeout_seconds=timeout_seconds,
        max_snippet_chars=max_snippet_chars,
    )

    db = SessionLocal()
    processed = 0
    try:
        for m in mentions:
            h = web_url_hash(m.url)
            exists = db.query(ExternalIngestedItem.id).filter(ExternalIngestedItem.url_hash == h).first()
            if exists:
                continue

            db.add(ExternalIngestedItem(source="web", url=m.url, url_hash=h))
            db.commit()

            payload = mention_to_feedback_payload(m)
            result = _submit_to_feedback_api(payload)
            if result:
                processed += 1
            else:
                db.query(ExternalIngestedItem).filter(ExternalIngestedItem.url_hash == h).delete()
                db.commit()

        return jsonify(
            {
                "message": f"Processed {processed} web search items",
                "items_found": len(mentions),
                "processed": processed,
            }
        )
    except Exception as e:
        db.rollback()
        logger.exception("Error polling web search")
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()


@integrations_bp.route("/whatsapp/poll", methods=["POST"])
def whatsapp_poll():
    """
    Poll Twilio REST for recent inbound WhatsApp messages and ingest them as feedback.

    Optional JSON overrides:
        account_sid, auth_token, hours_back, to_number (e.g. whatsapp:+15551234567)

    If omitted, uses TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, WHATSAPP_POLL_HOURS_BACK,
    TWILIO_WHATSAPP_TO_NUMBER from config.
    """
    config = get_config()
    data = request.get_json(silent=True) or {}

    account_sid = data.get("account_sid") or getattr(config, "TWILIO_ACCOUNT_SID", None)
    auth_token = data.get("auth_token") or getattr(config, "TWILIO_AUTH_TOKEN", None)
    hours_back = data.get("hours_back")
    if hours_back is None:
        hours_back = int(getattr(config, "WHATSAPP_POLL_HOURS_BACK", 24))
    to_number = data.get("to_number")
    if to_number is None:
        to_number = getattr(config, "TWILIO_WHATSAPP_TO_NUMBER", None)

    if not account_sid or not auth_token:
        return jsonify({"error": "Missing Twilio credentials"}), 400

    try:
        result = poll_twilio_whatsapp_and_ingest(
            account_sid=str(account_sid).strip(),
            auth_token=str(auth_token).strip(),
            hours_back=int(hours_back),
            to_number=(str(to_number).strip() if to_number else None),
        )
        return jsonify(result)
    except Exception as e:
        logger.exception("Error polling WhatsApp (Twilio)")
        return jsonify({"error": str(e)}), 500


@integrations_bp.route("/whatsapp/twilio", methods=["GET", "POST"])
def whatsapp_twilio_webhook():
    """
    Twilio WhatsApp webhook endpoint.

    Verifies signature and processes incoming WhatsApp messages.
    """
    config = get_config()
    twilio_auth_token = getattr(config, "TWILIO_AUTH_TOKEN", None)

    if request.method == "GET":
        return jsonify(
            {
                "name": "Twilio WhatsApp webhook",
                "method": "POST",
                "path": "/integrations/whatsapp/twilio",
                "requires_env": ["TWILIO_AUTH_TOKEN (recommended)"],
                "note": "Twilio will send application/x-www-form-urlencoded (not JSON).",
            }
        )

    form_data = request.form.to_dict()

    # verify signature if token is configured
    if twilio_auth_token:
        url = request.url
        if not verify_twilio_signature(url, form_data, twilio_auth_token):
            logger.warning("Invalid Twilio signature")
            return jsonify({"error": "Invalid signature"}), 403

    def _twiml_ok() -> FlaskResponse:
        # Twilio expects TwiML (XML) or an empty 2xx response.
        # Returning empty TwiML avoids Twilio's default demo auto-replies.
        return FlaskResponse("<Response></Response>", status=200, mimetype="application/xml")

    feedback_payload = parse_twilio_webhook(form_data)
    if not feedback_payload:
        # Might be a status update, not a user message - that's ok.
        return _twiml_ok()

    result = _submit_to_feedback_api(feedback_payload)
    if result:
        return _twiml_ok()
    else:
        return jsonify({"error": "Failed to process"}), 500


@integrations_bp.route("/whatsapp/meta", methods=["POST"])
def whatsapp_meta_webhook():
    """
    Meta WhatsApp Business API webhook endpoint.
    """
    config = get_config()
    app_secret = getattr(config, "META_APP_SECRET", None)

    # verify webhook challenge (for initial setup)
    if request.args.get("hub.mode") == "subscribe":
        challenge = request.args.get("hub.challenge")
        verify_token = request.args.get("hub.verify_token")
        expected_token = getattr(config, "META_VERIFY_TOKEN", None)

        if verify_token == expected_token:
            return challenge, 200
        else:
            return jsonify({"error": "Invalid verify token"}), 403

    # verify signature
    if app_secret:
        signature = request.headers.get("X-Hub-Signature-256", "")
        payload_str = request.get_data(as_text=True)
        if not verify_meta_webhook_signature(payload_str, signature, app_secret):
            logger.warning("Invalid Meta webhook signature")
            return jsonify({"error": "Invalid signature"}), 403

    payload = request.get_json(silent=True) or {}
    feedback_payload = parse_meta_whatsapp_webhook(payload)

    if not feedback_payload:
        return jsonify({"status": "ok"}), 200

    result = _submit_to_feedback_api(feedback_payload)
    return jsonify({"status": "ok"}), 200


@integrations_bp.route("/instagram/webhook", methods=["GET", "POST"])
def instagram_webhook():
    """
    Instagram webhook endpoint (DMs and comments).
    """
    config = get_config()
    app_secret = getattr(config, "META_APP_SECRET", None)

    # handle webhook verification
    if request.method == "GET":
        mode = request.args.get("hub.mode")
        challenge = request.args.get("hub.challenge")
        verify_token = request.args.get("hub.verify_token")
        expected_token = getattr(config, "META_VERIFY_TOKEN", None)

        if mode == "subscribe":
            if verify_token == expected_token:
                return challenge, 200
            return jsonify({"error": "Invalid verify token"}), 403

        # opened in a browser (no hub.* params)
        return jsonify(
            {
                "name": "Instagram webhook",
                "method": "POST (from Meta) / GET (verification only)",
                "path": "/integrations/instagram/webhook",
                "meta_verification": {
                    "callback_url": "/integrations/instagram/webhook",
                    "verify_token_env": "META_VERIFY_TOKEN",
                },
                "note": "This endpoint is called by Meta, not manually in a browser.",
            }
        )

    # verify signature
    if app_secret:
        signature = request.headers.get("X-Hub-Signature-256", "")
        payload_str = request.get_data(as_text=True)
        if not verify_meta_webhook_signature(payload_str, signature, app_secret):
            logger.warning("Invalid Instagram webhook signature")
            return jsonify({"error": "Invalid signature"}), 403

    payload = request.get_json(silent=True) or {}
    feedback_payload = parse_instagram_webhook(payload)

    if not feedback_payload:
        return jsonify({"status": "ok"}), 200

    result = _submit_to_feedback_api(feedback_payload)
    return jsonify({"status": "ok"}), 200


@integrations_bp.route("/facebook/webhook", methods=["GET", "POST"])
def facebook_webhook():
    """
    Facebook Messenger/Page webhook endpoint.
    """
    config = get_config()
    app_secret = getattr(config, "META_APP_SECRET", None)

    # handle webhook verification
    if request.method == "GET":
        mode = request.args.get("hub.mode")
        challenge = request.args.get("hub.challenge")
        verify_token = request.args.get("hub.verify_token")
        expected_token = getattr(config, "META_VERIFY_TOKEN", None)

        if mode == "subscribe":
            if verify_token == expected_token:
                return challenge, 200
            return jsonify({"error": "Invalid verify token"}), 403

        # opened in a browser (no hub.* params)
        return jsonify(
            {
                "name": "Facebook webhook",
                "method": "POST (from Meta) / GET (verification only)",
                "path": "/integrations/facebook/webhook",
                "meta_verification": {
                    "callback_url": "/integrations/facebook/webhook",
                    "verify_token_env": "META_VERIFY_TOKEN",
                },
                "note": "This endpoint is called by Meta, not manually in a browser.",
            }
        )

    # verify signature
    if app_secret:
        signature = request.headers.get("X-Hub-Signature-256", "")
        payload_str = request.get_data(as_text=True)
        if not verify_meta_webhook_signature(payload_str, signature, app_secret):
            logger.warning("Invalid Facebook webhook signature")
            return jsonify({"error": "Invalid signature"}), 403

    payload = request.get_json(silent=True) or {}
    feedback_payload = parse_facebook_webhook(payload)

    if not feedback_payload:
        return jsonify({"status": "ok"}), 200

    result = _submit_to_feedback_api(feedback_payload)
    return jsonify({"status": "ok"}), 200
