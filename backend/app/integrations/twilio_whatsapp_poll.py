"""
Poll Twilio REST API for recent inbound WhatsApp messages (no public webhook required).

Used by the same background poller pattern as IMAP email. Keep this file free of
Flask route handlers so it stays testable and small.

The ingest/dedupe loop lives in routes/integrations.py — this module only fetches
and normalizes messages for parse_twilio_webhook().
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import requests

from .whatsapp_integration import parse_message_datetime, twilio_rest_message_to_webhook_form

logger = logging.getLogger(__name__)

TWILIO_API_BASE = "https://api.twilio.com/2010-04-01"


def twilio_api_list_messages(
    account_sid: str,
    auth_token: str,
    *,
    page_size: int = 100,
    max_pages: int = 5,
) -> List[Dict[str, Any]]:
    """
    Fetch message records from Twilio (newest first). Follows next_page_uri up to max_pages.
    """
    if not account_sid or not auth_token:
        return []

    out: List[Dict[str, Any]] = []
    url = f"{TWILIO_API_BASE}/Accounts/{account_sid}/Messages.json"
    params: Dict[str, Any] = {"PageSize": min(100, max(1, page_size))}

    for _ in range(max(1, max_pages)):
        try:
            resp = requests.get(
                url,
                auth=(account_sid, auth_token),
                params=params,
                timeout=45,
            )
            resp.raise_for_status()
            data = resp.json() or {}
        except Exception:
            logger.exception("Twilio Messages.list HTTP failed")
            break

        msgs = data.get("messages") or data.get("Messages")
        if isinstance(msgs, list):
            out.extend(msgs)

        nxt = data.get("next_page_uri") or data.get("NextPageUri")
        if not nxt:
            break
        if isinstance(nxt, str) and nxt.startswith("/"):
            url = f"https://api.twilio.com{nxt}"
            params = {}
        elif isinstance(nxt, str) and nxt.startswith("http"):
            url = nxt
            params = {}
        else:
            break

    return out


def fetch_recent_inbound_whatsapp_form_messages(
    account_sid: str,
    auth_token: str,
    *,
    hours_back: int = 24,
    to_number_filter: Optional[str] = None,
    max_pages: int = 5,
) -> List[Dict[str, str]]:
    """
    Return webhook-shaped dicts for inbound WhatsApp messages received within hours_back.

    - Only messages with From containing ``whatsapp`` (Twilio WhatsApp channel).
    - Optional to_number_filter: if set, only messages where To equals this
      (e.g. whatsapp:+15551234567).
    """
    since = datetime.now(tz=timezone.utc) - timedelta(hours=max(1, hours_back))
    raw = twilio_api_list_messages(account_sid, auth_token, max_pages=max_pages)
    result: List[Dict[str, str]] = []

    for msg in raw:
        if not isinstance(msg, dict):
            continue
        direction = str(msg.get("direction") or "").lower()
        if direction and direction != "inbound":
            continue
        from_ = str(msg.get("from") or "")
        if "whatsapp" not in from_.lower():
            continue
        to_ = str(msg.get("to") or "")
        if to_number_filter and to_number_filter.strip():
            if to_.strip().lower() != to_number_filter.strip().lower():
                continue

        dt = parse_message_datetime(msg)
        if dt is not None and dt < since:
            continue

        form = twilio_rest_message_to_webhook_form(msg)
        if not (form.get("Body") or "").strip():
            continue
        result.append(form)

    return result
