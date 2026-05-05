import hashlib
import hmac
import json
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)


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
        entry = payload.get("entry", [{}])[0]
        messaging = entry.get("messaging", [])

        if not messaging:
            # might be a comment instead
            return parse_instagram_comment(payload)

        message_data = messaging[0]
        message = message_data.get("message", {})
        message_text = message.get("text", "").strip()

        if not message_text:
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

    except (KeyError, IndexError, TypeError) as e:
        logger.exception(f"Error parsing Instagram webhook: {e}")
        return None


def parse_instagram_comment(payload: Dict) -> Optional[Dict]:
    """Parse Instagram comment webhook."""
    try:
        entry = payload.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})

        comment_text = value.get("text", "").strip()
        if not comment_text:
            return None

        from_user = value.get("from", {}).get("username", "")
        media_id = value.get("media", {}).get("id", "")

        return {
            "message": comment_text,
            "source": "instagram",
            "category": None,
            "channel_metadata": {
                "provider": "instagram",
                "object": payload.get("object"),
                "entry_id": entry.get("id"),
                "field": changes.get("field"),
                "from_username": from_user,
                "author_handle": from_user,
                "media_id": media_id,
                "comment_id": value.get("id"),
                "type": "comment",
                "thread_id": value.get("id"),
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

    Returns dict ready to POST to /api/feedback, or None if not a message
    """
    try:
        entry = payload.get("entry", [{}])[0]
        messaging = entry.get("messaging", [])

        if not messaging:
            # might be a page post comment
            return parse_facebook_comment(payload)

        message_data = messaging[0]
        message = message_data.get("message", {})
        message_text = message.get("text", "").strip()

        if not message_text:
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

    except (KeyError, IndexError, TypeError) as e:
        logger.exception(f"Error parsing Facebook webhook: {e}")
        return None


def parse_facebook_comment(payload: Dict) -> Optional[Dict]:
    """Parse Facebook page post comment webhook."""
    try:
        entry = payload.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})

        comment_text = value.get("message", "").strip()
        if not comment_text:
            return None

        from_user = value.get("from", {}).get("name", "")
        post_id = value.get("post_id", "")

        return {
            "message": comment_text,
            "source": "facebook",
            "category": None,
            "channel_metadata": {
                "provider": "facebook",
                "object": payload.get("object"),
                "entry_id": entry.get("id"),
                "field": changes.get("field"),
                "from_name": from_user,
                "author_handle": from_user,
                "post_id": post_id,
                "comment_id": value.get("id"),
                "type": "comment",
                "thread_id": value.get("id"),
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
