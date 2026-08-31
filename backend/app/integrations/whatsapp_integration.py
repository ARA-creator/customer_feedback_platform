import hashlib
import hmac
import json
import logging
import base64
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
from dateutil import parser as date_parser
from flask import request

logger = logging.getLogger(__name__)


def phone_from_twilio_address(addr: str) -> str:
    phone = (addr or "").strip()
    if phone.lower().startswith("whatsapp:"):
        phone = phone.split(":", 1)[1].strip()
    return phone


def parse_twilio_outbound_record(msg: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Parse a Twilio REST outbound WhatsApp message (console / API send).

    Customer phone is in ``To``; business number is in ``From``.
    """
    from ..services.metadata_normalization import normalize_phone_identity

    body = str(msg.get("body") or "").strip()
    if not body:
        return None

    to_raw = str(msg.get("to") or "")
    from_raw = str(msg.get("from") or "")
    if "whatsapp" not in to_raw.lower():
        return None

    customer_phone = phone_from_twilio_address(to_raw)
    thread_key = normalize_phone_identity(customer_phone)
    if not thread_key:
        digits = "".join(ch for ch in customer_phone if ch.isdigit())
        if len(digits) < 7:
            return None
        thread_key = normalize_phone_identity(digits) or f"+{digits}"

    sid = str(msg.get("sid") or msg.get("MessageSid") or "").strip()
    sent_at = parse_message_datetime(msg)

    return {
        "thread_key": thread_key,
        "body": body,
        "message_sid": sid or None,
        "sent_at": sent_at,
        "from_number": phone_from_twilio_address(from_raw) or from_raw,
        "to_number": customer_phone or to_raw,
        "direction": "outbound",
    }


def verify_twilio_signature(url: str, params: Dict, auth_token: str) -> bool:
    """
    Verify Twilio webhook signature.

    Args:
        url: The full URL of the webhook endpoint
        params: Request parameters (form data)
        auth_token: Twilio auth token

    Returns:
        True if signature is valid
    """
    signature = request.headers.get("X-Twilio-Signature", "")
    if not signature:
        return False

    # build signature string
    sorted_params = sorted((params or {}).items())
    signature_string = url + "".join(f"{k}{v}" for k, v in sorted_params)

    # compute expected signature
    digest = hmac.new(
        auth_token.encode("utf-8"),
        signature_string.encode("utf-8"),
        hashlib.sha1,
    ).digest()
    expected = base64.b64encode(digest).decode("utf-8")

    return hmac.compare_digest(expected, signature)


def normalize_whatsapp_address(addr: str) -> str:
    """Normalize Twilio-style WhatsApp identifiers for comparison."""
    a = (addr or "").strip().lower()
    if not a:
        return ""
    if a.startswith("whatsapp:"):
        return a
    if a.startswith("+"):
        return f"whatsapp:{a}"
    return f"whatsapp:+{a.lstrip('+')}"


def twilio_rest_message_to_webhook_form(msg: Dict[str, Any]) -> Dict[str, str]:
    """
    Map a Twilio REST API Message JSON object to the form keys expected by parse_twilio_webhook.

    Optionally enriches MediaUrl*/MediaContentType* when num_media > 0 (requires separate Media API calls).
    """
    sid = str(msg.get("sid") or "")
    body = str(msg.get("body") or "")
    from_raw = str(msg.get("from") or "")
    to_raw = str(msg.get("to") or "")
    account_sid = str(msg.get("account_sid") or "")
    nm = msg.get("num_media")
    if nm is None:
        nm = 0
    try:
        num_media = int(nm)
    except (TypeError, ValueError):
        num_media = 0

    out: Dict[str, str] = {
        "Body": body,
        "From": from_raw,
        "To": to_raw,
        "MessageSid": sid,
        "AccountSid": account_sid,
        "NumMedia": str(num_media),
    }
    return out


def fetch_twilio_message_media_fields(
    *,
    account_sid: str,
    auth_token: str,
    message_sid: str,
    max_media: int = 10,
) -> Tuple[List[str], List[str]]:
    """
    List media URLs and content types for a Message (Twilio subresource).
    """
    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages/{message_sid}/Media.json"
    try:
        r = requests.get(url, auth=(account_sid, auth_token), timeout=30)
        r.raise_for_status()
        data = r.json() or {}
    except Exception:
        logger.exception("Twilio media list failed for message %s", message_sid)
        return [], []

    media_items = data.get("media") or []
    urls: List[str] = []
    types: List[str] = []
    for i, m in enumerate(media_items[:max_media]):
        uri = (m or {}).get("uri") or ""
        if not uri:
            continue
        if uri.startswith("http"):
            full = uri.replace(".json", "")
        else:
            full = f"https://api.twilio.com{uri.replace('.json', '')}"
        urls.append(full)
        types.append(str((m or {}).get("content_type") or ""))
    return urls, types


def parse_message_datetime(msg: Dict[str, Any]) -> Optional[datetime]:
    """Best-effort parse of Twilio message sent/created time (UTC)."""
    raw = msg.get("date_sent") or msg.get("date_created")
    if not raw:
        return None
    try:
        dt = date_parser.parse(str(raw))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def parse_twilio_webhook(form_data: Dict) -> Optional[Dict]:
    """
    Parse Twilio WhatsApp webhook payload.

    Returns dict ready to POST to /api/feedback, or None if invalid
    """
    message_body = form_data.get("Body", "").strip()
    if not message_body:
        return None

    from_number = form_data.get("From", "")
    to_number = form_data.get("To", "")
    message_sid = form_data.get("MessageSid", "")
    account_sid = form_data.get("AccountSid", "")
    num_media = int(form_data.get("NumMedia", "0") or 0)
    media_urls = []
    media_types = []
    for i in range(min(num_media, 10)):
        u = form_data.get(f"MediaUrl{i}")
        ct = form_data.get(f"MediaContentType{i}")
        if u:
            media_urls.append(u)
        if ct:
            media_types.append(ct)

    # Store the real E.164 phone (officers need it); keep a masked copy only as fallback display.
    phone = (from_number or "").strip()
    if phone.lower().startswith("whatsapp:"):
        phone = phone.split(":", 1)[1].strip()
    masked_number = ("*" * max(0, len(phone) - 4) + phone[-4:]) if phone else None
    wa_id = "".join(ch for ch in phone if ch.isdigit()) or None

    return {
        "message": message_body,
        "source": "whatsapp",
        "category": None,
        "channel_metadata": {
            "from_number": phone or None,
            "phone": phone or None,
            "from_number_masked": masked_number,
            "wa_id": wa_id,
            "to_number": to_number,
            "message_sid": message_sid,
            "account_sid": account_sid,
            "provider": "twilio",
            # Stable conversation key = phone, not per-message MessageSid.
            "thread_id": wa_id or phone or message_sid,
            "author_handle": phone or masked_number,
            "campaign": None,
            "location": None,
            "language": "en",
            "customer_tier": None,
            "engagement": None,
            "num_media": num_media,
            "media_urls": media_urls or None,
            "media_types": media_types or None,
        },
    }


def parse_meta_whatsapp_webhook(payload: Dict) -> Optional[Dict]:
    """
    Parse Meta WhatsApp Business API webhook payload.

    Expected format from Meta Graph API webhooks.
    """
    try:
        entry = payload.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})

        # check if it's a message
        messages = value.get("messages", [])
        if not messages:
            return None

        message = messages[0]
        message_text = message.get("text", {}).get("body", "").strip()
        if not message_text:
            return None

        contacts = value.get("contacts", [{}])
        contact = contacts[0] if contacts else {}
        from_number = str(message.get("from", "") or "").strip()
        wa_id = str(contact.get("wa_id", "") or from_number or "").strip()
        phone = from_number
        if phone and not phone.startswith("+") and phone.isdigit():
            phone = f"+{phone}"
        masked_number = ("*" * max(0, len(phone) - 4) + phone[-4:]) if phone else None

        return {
            "message": message_text,
            "source": "whatsapp",
            "category": None,
            "channel_metadata": {
                "from_number": phone or None,
                "phone": phone or None,
                "from_number_masked": masked_number,
                "wa_id": wa_id or None,
                "message_id": message.get("id"),
                "provider": "meta",
                "thread_id": wa_id or phone or message.get("id"),
                "author_handle": phone or wa_id or masked_number,
                "campaign": None,
                "location": None,
                "language": "en",
                "customer_tier": None,
                "engagement": None,
                "media": [],
            },
        }

    except (KeyError, IndexError, TypeError) as e:
        logger.exception(f"Error parsing Meta WhatsApp webhook: {e}")
        return None
