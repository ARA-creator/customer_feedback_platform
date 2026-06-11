"""Parse JotForm webhook submissions into feedback payloads."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

_MESSAGE_KEYS = (
    "feedback",
    "give your feedback",
    "message",
    "comments",
    "comment",
    "description",
    "details",
    "your feedback",
    "tell us",
    "how do you feel",
)
_EMAIL_KEYS = ("email", "email address", "e-mail")
_NAME_FIRST_KEYS = ("first name", "firstname", "given name")
_NAME_LAST_KEYS = ("last name", "lastname", "surname", "family name")
_POLICY_NUMBER_KEYS = (
    "policy number",
    "policy no",
    "policy no.",
    "pol no",
    "pol number",
    "certificate number",
    "contract number",
    "plan number",
    "member id",
    "member number",
)


def _norm_key(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def _format_name_answer(value: Any) -> str:
    if not isinstance(value, dict):
        return ""
    first = str(value.get("first") or value.get("firstName") or "").strip()
    last = str(value.get("last") or value.get("lastName") or "").strip()
    return " ".join(p for p in (first, last) if p).strip()


def _answer_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        name = _format_name_answer(value)
        if name:
            return name
        for key in ("answer", "text", "prettyFormat"):
            inner = value.get(key)
            if inner is None or inner == "":
                continue
            if isinstance(inner, dict):
                name = _format_name_answer(inner)
                if name:
                    return name
            return str(inner).strip()
        return ""
    if isinstance(value, list):
        return ", ".join(str(v).strip() for v in value if v is not None and str(v).strip())
    return str(value).strip()


def _flatten_answers(raw: Any) -> Dict[str, str]:
    """Normalize JotForm rawRequest / answers into {field_label: text}."""
    out: Dict[str, str] = {}
    if not isinstance(raw, dict):
        return out

    # API-style nested answers: {"q4_email": {"text": "Email", "name": "email", "answer": "..."}}
    if any(isinstance(v, dict) and ("answer" in v or "text" in v) for v in raw.values()):
        for entry in raw.values():
            if not isinstance(entry, dict):
                continue
            label = entry.get("text") or entry.get("name") or entry.get("type") or "field"
            text = _answer_text(entry)
            if text:
                out[str(label)] = text
        if out:
            return out

    for key, value in raw.items():
        if key.startswith("_") or key in {"slug", "event_id", "validatedNewRequiredFieldIDs", "path", "timeToSubmit"}:
            continue
        text = _answer_text(value)
        if not text:
            continue
        label = str(key)
        if label.startswith("q") and "_" in label:
            label = label.split("_", 1)[1]
        out[label.replace("_", " ")] = text
    return out


def _pick_by_keys(answers: Dict[str, str], candidates: Tuple[str, ...]) -> Optional[str]:
    if not answers:
        return None
    normalized = {_norm_key(k): v for k, v in answers.items()}
    for candidate in candidates:
        c = _norm_key(candidate)
        for key, val in normalized.items():
            if c == key or c in key:
                return val.strip() or None
    return None


def _pick_feedback_message(answers: Dict[str, str]) -> Optional[str]:
    """Extract only the free-text feedback field (not category/consent/etc.)."""
    if not answers:
        return None
    skip_parts = ("category", "consent", "recorded", "if other", "complaint fall under", "email", "name")
    normalized = {_norm_key(k): v for k, v in answers.items()}

    for candidate in _MESSAGE_KEYS:
        c = _norm_key(candidate)
        for key, val in normalized.items():
            if any(part in key for part in skip_parts):
                continue
            if key == c or key.startswith(f"{c}.") or key.startswith(f"{c} "):
                return val.strip() or None

    for candidate in _MESSAGE_KEYS:
        c = _norm_key(candidate)
        for key, val in normalized.items():
            if any(part in key for part in skip_parts):
                continue
            if c in key and any(token in key for token in ("feedback", "message", "comment", "tell us", "how do you feel")):
                return val.strip() or None
    return None


def _parse_pretty_fields(pretty: str) -> Dict[str, str]:
    """Parse JotForm's comma-separated `pretty` summary into field labels."""
    out: Dict[str, str] = {}
    text = str(pretty or "").strip()
    if not text:
        return out
    for part in text.split(", "):
        if ":" not in part:
            continue
        label, _, value = part.partition(":")
        label = label.strip()
        value = value.strip()
        if label and value:
            out[label] = value
    return out


def _merge_answers(*parts: Dict[str, str]) -> Dict[str, str]:
    merged: Dict[str, str] = {}
    for part in parts:
        for key, value in (part or {}).items():
            if value:
                merged[key] = value
    return merged


def _pick_policy_numbers(answers: Dict[str, str]) -> List[str]:
    """Extract dedicated policy-number fields (not persisted raw — used only for detection)."""
    if not answers:
        return []
    normalized = {_norm_key(k): v for k, v in answers.items()}
    found: List[str] = []
    seen = set()
    for candidate in _POLICY_NUMBER_KEYS:
        c = _norm_key(candidate)
        for key, val in normalized.items():
            if c != key and c not in key:
                continue
            text = str(val or "").strip()
            if not text or text in seen:
                continue
            seen.add(text)
            found.append(text)
    return found


def _customer_name_from_answers(answers: Dict[str, str]) -> Optional[str]:
    first = _pick_by_keys(answers, _NAME_FIRST_KEYS)
    last = _pick_by_keys(answers, _NAME_LAST_KEYS)
    combined = " ".join(p for p in [first, last] if p).strip()
    if combined:
        return re.sub(r"\s+", " ", combined).strip()
    name = _pick_by_keys(answers, ("name", "full name"))
    return re.sub(r"\s+", " ", name).strip() if name else None


def parse_jotform_submission(
    *,
    form_id: str = "",
    submission_id: str = "",
    timestamp: str = "",
    pretty: str = "",
    raw_request: Any = None,
    ip: str = "",
) -> Optional[Dict[str, Any]]:
    """
    Build a feedback-ready dict from JotForm webhook fields.

    Returns None when no message text can be extracted.
    """
    answers: Dict[str, str] = {}
    if isinstance(raw_request, dict):
        answers = _flatten_answers(raw_request)
    elif isinstance(raw_request, str) and raw_request.strip():
        try:
            parsed = json.loads(raw_request)
            answers = _flatten_answers(parsed if isinstance(parsed, dict) else {})
        except json.JSONDecodeError:
            logger.warning("JotForm rawRequest was not valid JSON")

    answers = _merge_answers(_parse_pretty_fields(pretty), answers)

    message = _pick_feedback_message(answers)
    if not message:
        return None

    email = _pick_by_keys(answers, _EMAIL_KEYS)
    customer_name = _customer_name_from_answers(answers)
    policy_number_hints = _pick_policy_numbers(answers)

    channel_metadata: Dict[str, Any] = {
        "provider": "jotform",
        "form_id": form_id or None,
        "submission_id": submission_id or None,
    }
    if customer_name:
        channel_metadata["customer_name"] = customer_name
        channel_metadata["customer_label"] = customer_name
    if email:
        channel_metadata["sender_email"] = email

    payload: Dict[str, Any] = {
        "message": message,
        "source": "jotform",
        "email": email,
        "channel_metadata": channel_metadata,
    }
    if policy_number_hints:
        payload["policy_number_hints"] = policy_number_hints
    return payload


def parse_jotform_webhook_request(form_data: Dict[str, Any], json_payload: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """
    Parse JotForm multipart form POST or a direct JSON test payload.
    """
    if json_payload and isinstance(json_payload, dict):
        if json_payload.get("message"):
            meta = json_payload.get("channel_metadata") if isinstance(json_payload.get("channel_metadata"), dict) else {}
            email = json_payload.get("email")
            customer_name = meta.get("customer_name") or meta.get("customer_label")
            channel_metadata: Dict[str, Any] = {
                "provider": "jotform",
                "form_id": json_payload.get("form_id") or meta.get("form_id"),
                "submission_id": json_payload.get("submission_id") or meta.get("submission_id"),
            }
            if customer_name:
                channel_metadata["customer_name"] = customer_name
                channel_metadata["customer_label"] = customer_name
            if email:
                channel_metadata["sender_email"] = email
            return {
                "message": str(json_payload.get("message") or "").strip(),
                "source": "jotform",
                "email": email,
                "channel_metadata": channel_metadata,
            }

    raw_request = form_data.get("rawRequest") or form_data.get("raw_request")
    if isinstance(raw_request, (dict, list)):
        raw_request = json.dumps(raw_request)

    return parse_jotform_submission(
        form_id=str(form_data.get("formID") or form_data.get("form_id") or "").strip(),
        submission_id=str(form_data.get("submissionID") or form_data.get("submission_id") or "").strip(),
        timestamp=str(form_data.get("created_at") or form_data.get("timestamp") or "").strip(),
        pretty=str(form_data.get("pretty") or "").strip(),
        raw_request=raw_request,
        ip=str(form_data.get("ip") or "").strip(),
    )
