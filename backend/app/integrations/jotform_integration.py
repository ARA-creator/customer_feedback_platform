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
_RATING_KEYS = ("rating", "score", "nps")
_CATEGORY_KEYS = (
    "category",
    "which category",
    "feedback fall in",
    "topic",
    "type",
    "department",
)
_NAME_FIRST_KEYS = ("first name", "firstname", "given name")
_NAME_LAST_KEYS = ("last name", "lastname", "surname", "family name")
_OTHER_CATEGORY_KEYS = ("if other", "complaint fall under", "other category")
_CONSENT_KEYS = ("recorded your feedback", "record feedback", "consent")
_SKIP_IN_MESSAGE_FALLBACK = (
    "first name",
    "last name",
    "name",
    "category",
    "which category",
    "if other",
    "complaint fall under",
    "recorded your feedback",
    "record feedback",
    "consent",
    "email",
)


def _norm_key(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def _answer_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        for key in ("answer", "text", "prettyFormat"):
            if value.get(key):
                return str(value[key]).strip()
        return ""
    if isinstance(value, list):
        return ", ".join(str(v).strip() for v in value if v is not None and str(v).strip())
    return str(value).strip()


def _flatten_answers(raw: Any) -> Dict[str, str]:
    """Normalize JotForm rawRequest / answers into {field_label: text}."""
    out: Dict[str, str] = {}
    if not isinstance(raw, dict):
        return out

    # API-style nested answers: {"3": {"name": "email", "answer": "..."}}
    if any(isinstance(v, dict) and ("answer" in v or "text" in v) for v in raw.values()):
        for entry in raw.values():
            if not isinstance(entry, dict):
                continue
            label = entry.get("name") or entry.get("text") or entry.get("type") or "field"
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


def _should_skip_in_message_fallback(key: str) -> bool:
    nk = _norm_key(key)
    return any(part in nk for part in _SKIP_IN_MESSAGE_FALLBACK)


def _customer_name_from_answers(answers: Dict[str, str]) -> Optional[str]:
    first = _pick_by_keys(answers, _NAME_FIRST_KEYS)
    last = _pick_by_keys(answers, _NAME_LAST_KEYS)
    combined = " ".join(p for p in [first, last] if p).strip()
    if combined:
        return combined
    return _pick_by_keys(answers, ("name", "full name"))


def _resolve_category(answers: Dict[str, str]) -> Optional[str]:
    category = _pick_by_keys(answers, _CATEGORY_KEYS)
    other_detail = _pick_by_keys(answers, _OTHER_CATEGORY_KEYS)
    if category and "other" in _norm_key(category) and other_detail:
        return other_detail
    if not category and other_detail:
        return other_detail
    return category


def _coerce_rating(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        rating = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    return rating if 1 <= rating <= 10 else None


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

    message = (
        _pick_by_keys(answers, _MESSAGE_KEYS)
        or (pretty.strip() if pretty else None)
        or (next(iter(answers.values())).strip() if len(answers) == 1 else None)
    )
    if not message and answers:
        # Fallback: concatenate substantive answers only (skip name/category/consent fields).
        parts = [f"{k}: {v}" for k, v in answers.items() if v and not _should_skip_in_message_fallback(k)]
        message = "\n".join(parts).strip()
    if not message:
        return None

    email = _pick_by_keys(answers, _EMAIL_KEYS)
    category = _resolve_category(answers)
    rating = _coerce_rating(_pick_by_keys(answers, _RATING_KEYS))
    customer_name = _customer_name_from_answers(answers)
    recording_consent = _pick_by_keys(answers, _CONSENT_KEYS)

    channel_metadata = {
        "provider": "jotform",
        "form_id": form_id or None,
        "submission_id": submission_id or None,
        "timestamp": timestamp or None,
        "ip": ip or None,
        "answers": answers or None,
        "pretty": pretty or None,
    }
    if customer_name:
        channel_metadata["customer_name"] = customer_name
        channel_metadata["customer_label"] = customer_name
    if recording_consent:
        channel_metadata["recording_consent"] = recording_consent

    return {
        "message": message,
        "source": "jotform",
        "email": email,
        "rating": rating,
        "category": category,
        "channel_metadata": channel_metadata,
    }


def parse_jotform_webhook_request(form_data: Dict[str, Any], json_payload: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """
    Parse JotForm multipart form POST or a direct JSON test payload.
    """
    if json_payload and isinstance(json_payload, dict):
        if json_payload.get("message"):
            meta = json_payload.get("channel_metadata") if isinstance(json_payload.get("channel_metadata"), dict) else {}
            return {
                "message": str(json_payload.get("message") or "").strip(),
                "source": "jotform",
                "email": json_payload.get("email"),
                "rating": _coerce_rating(json_payload.get("rating")),
                "category": json_payload.get("category"),
                "channel_metadata": {
                    "provider": "jotform",
                    "form_id": json_payload.get("form_id") or meta.get("form_id"),
                    "submission_id": json_payload.get("submission_id") or meta.get("submission_id"),
                    "timestamp": json_payload.get("timestamp") or meta.get("timestamp"),
                    "answers": json_payload.get("answers") if isinstance(json_payload.get("answers"), dict) else meta.get("answers"),
                },
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
