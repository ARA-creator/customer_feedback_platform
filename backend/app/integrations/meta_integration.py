import hashlib
import hmac
import json
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def meta_event_dedupe_hash(source: str, channel_metadata: Dict[str, Any]) -> Optional[str]:
    """
    Stable hash for Instagram/Facebook webhook dedupe (message_id, comment_id, etc.).
    """
    meta = channel_metadata or {}
    parts = []
    for key in ("message_id", "comment_id", "thread_id"):
        val = meta.get(key)
        if val:
            parts.append(f"{key}:{val}")
    entry_id = meta.get("entry_id")
    if entry_id and not parts:
        parts.append(f"entry_id:{entry_id}")
    if not parts:
        return None
    raw = f"{source}|{'|'.join(parts)}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def verify_meta_webhook_signature(payload: str, signature: str, app_secret: str) -> bool:
    """
    Verify Meta webhook signature (Instagram/Facebook).

    Args:
        payload: Raw request body as string
        signature: X-Hub-Signature-256 header value
        app_secret: Meta app secret

    Returns:
        True if signature is valid
    """
    if not signature:
        return False

    # Meta sends signature as "sha256=<hash>"
    if signature.startswith("sha256="):
        signature = signature[7:]

    expected = hmac.new(
        app_secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, signature)


def parse_instagram_webhook(payload: Dict) -> Optional[Dict]:
    """
    Parse Instagram webhook payload (DMs/comments).

    Returns dict ready to POST to /api/feedback, or None if not a message/comment
    """
    try:
        for entry in payload.get("entry", []):
            for message_data in entry.get("messaging") or []:
                parsed = _parse_instagram_messaging(entry, message_data, payload)
                if parsed:
                    return parsed
            for change in entry.get("changes") or []:
                parsed = parse_instagram_comment(entry, change, payload)
                if parsed:
                    return parsed
        return None
    except (KeyError, IndexError, TypeError) as e:
        logger.exception(f"Error parsing Instagram webhook: {e}")
        return None


def _parse_instagram_messaging(entry: Dict, message_data: Dict, payload: Dict) -> Optional[Dict]:
    message = message_data.get("message", {})
    message_text = (message.get("text") or "").strip()
    if not message_text:
        return None
    if message.get("is_echo"):
        return None

    sender = message_data.get("sender", {}).get("id", "")
    recipient = message_data.get("recipient", {}).get("id", "")
    timestamp = message_data.get("timestamp")

    return {
        "message": message_text,
        "source": "instagram",
        "category": None,
        "channel_metadata": {
            "provider": "instagram",
            "object": payload.get("object"),
            "entry_id": entry.get("id"),
            "sender_id": sender,
            "recipient_id": recipient,
            "timestamp": timestamp,
            "message_id": message.get("mid"),
            "type": "dm",
            "thread_id": message.get("mid"),
            "author_handle": None,
            "campaign": None,
            "location": None,
            "language": "en",
            "customer_tier": None,
            "engagement": None,
            "media": [],
        },
    }


def parse_instagram_comment(entry: Dict, change: Dict, payload: Optional[Dict] = None) -> Optional[Dict]:
    """Parse Instagram comment webhook."""
    try:
        payload = payload or {}
        value = change.get("value", {}) or {}
        if change.get("field") not in (None, "comments", "feed"):
            return None

        comment_text = (value.get("text") or value.get("message") or "").strip()
        if not comment_text:
            return None

        verb = str(value.get("verb") or "add").strip().lower()
        if verb in ("remove", "delete", "hide"):
            return None

        from_user = value.get("from", {}).get("username", "") or value.get("from", {}).get("name", "")
        media_id = value.get("media", {}).get("id", "") if isinstance(value.get("media"), dict) else value.get("media_id", "")

        return {
            "message": comment_text,
            "source": "instagram",
            "category": None,
            "channel_metadata": {
                "provider": "instagram",
                "object": payload.get("object"),
                "entry_id": entry.get("id"),
                "field": change.get("field"),
                "from_username": from_user,
                "author_handle": from_user,
                "media_id": media_id,
                "comment_id": value.get("id") or value.get("comment_id"),
                "type": "comment",
                "thread_id": value.get("id") or value.get("comment_id"),
                "campaign": None,
                "location": None,
                "language": "en",
                "customer_tier": None,
                "engagement": None,
                "media": [],
            },
        }

    except (KeyError, IndexError, TypeError) as e:
        logger.exception(f"Error parsing Instagram comment: {e}")
        return None


def parse_facebook_webhook(payload: Dict) -> Optional[Dict]:
    """
    Parse Facebook Messenger/Page webhook payload.

    Returns dict ready to POST to /api/feedback, or None if not a message/comment
    """
    try:
        for entry in payload.get("entry", []):
            for message_data in entry.get("messaging") or []:
                parsed = _parse_facebook_messaging(entry, message_data, payload)
                if parsed:
                    return parsed
            for change in entry.get("changes") or []:
                parsed = parse_facebook_comment(entry, change, payload)
                if parsed:
                    return parsed
        return None
    except (KeyError, IndexError, TypeError) as e:
        logger.exception(f"Error parsing Facebook webhook: {e}")
        return None


def _parse_facebook_messaging(entry: Dict, message_data: Dict, payload: Dict) -> Optional[Dict]:
    message = message_data.get("message", {})
    message_text = (message.get("text") or "").strip()
    if not message_text:
        return None
    if message.get("is_echo"):
        return None

    sender = message_data.get("sender", {}).get("id", "")
    recipient = message_data.get("recipient", {}).get("id", "")
    timestamp = message_data.get("timestamp")

    return {
        "message": message_text,
        "source": "facebook",
        "category": None,
        "channel_metadata": {
            "provider": "facebook",
            "object": payload.get("object"),
            "entry_id": entry.get("id"),
            "sender_id": sender,
            "recipient_id": recipient,
            "timestamp": timestamp,
            "message_id": message.get("mid"),
            "type": "messenger",
            "thread_id": message.get("mid"),
            "author_handle": None,
            "campaign": None,
            "location": None,
            "language": "en",
            "customer_tier": None,
            "engagement": None,
            "media": [],
        },
    }


def parse_facebook_comment(entry: Dict, change: Dict, payload: Optional[Dict] = None) -> Optional[Dict]:
    """Parse Facebook page post comment webhook."""
    try:
        payload = payload or {}
        field = str(change.get("field") or "").strip().lower()
        if field not in ("feed", "comments"):
            return None

        value = change.get("value", {}) or {}
        item = str(value.get("item") or "").strip().lower()
        if item and item not in ("comment", "status", "post"):
            return None

        verb = str(value.get("verb") or "add").strip().lower()
        if verb in ("remove", "delete", "hide", "unhide"):
            return None
        if verb not in ("add", "edit", "edited"):
            return None

        comment_text = (value.get("message") or value.get("text") or "").strip()
        if not comment_text:
            return None

        from_data = value.get("from") or {}
        from_id = str(from_data.get("id") or "").strip()
        from_user = from_data.get("name") or from_data.get("username") or ""
        page_id = str(entry.get("id") or "").strip()
        if page_id and from_id and from_id == page_id:
            return None

        post_id = value.get("post_id") or value.get("parent_id") or ""
        comment_id = value.get("comment_id") or value.get("id") or ""

        return {
            "message": comment_text,
            "source": "facebook",
            "category": None,
            "channel_metadata": {
                "provider": "facebook",
                "object": payload.get("object"),
                "entry_id": entry.get("id"),
                "field": change.get("field"),
                "from_id": from_id,
                "from_name": from_user,
                "author_handle": from_user,
                "post_id": post_id,
                "comment_id": comment_id,
                "type": "comment",
                "thread_id": comment_id or post_id,
                "campaign": None,
                "location": None,
                "language": "en",
                "customer_tier": None,
                "engagement": None,
                "media": [],
            },
        }

    except (KeyError, IndexError, TypeError) as e:
        logger.exception(f"Error parsing Facebook comment: {e}")
        return None
