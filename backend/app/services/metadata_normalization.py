from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple


def safe_json_loads(value: Any) -> Dict[str, Any]:
    import json

    if isinstance(value, dict):
        return value
    if not value or not isinstance(value, str):
        return {}
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def normalized_media(meta: Dict[str, Any]) -> list[Dict[str, Any]]:
    media: list[Dict[str, Any]] = []
    raw_media = meta.get("media")
    if isinstance(raw_media, list):
        for item in raw_media:
            if isinstance(item, dict) and item.get("url"):
                media.append(
                    {
                        "type": item.get("type") or "file",
                        "url": item.get("url"),
                        "thumb_url": item.get("thumb_url"),
                        "width": item.get("width"),
                        "height": item.get("height"),
                        "duration_s": item.get("duration_s"),
                        "caption": item.get("caption"),
                        "mime_type": item.get("mime_type"),
                    }
                )

    urls = meta.get("media_urls") if isinstance(meta.get("media_urls"), list) else []
    types = meta.get("media_types") if isinstance(meta.get("media_types"), list) else []
    for idx, url in enumerate(urls):
        if not url:
            continue
        mime = str(types[idx] if idx < len(types) else "").lower()
        media_type = "image"
        if "video" in mime:
            media_type = "video"
        elif "audio" in mime:
            media_type = "audio"
        elif mime and "image" not in mime:
            media_type = "file"
        media.append(
            {
                "type": media_type,
                "url": url,
                "thumb_url": url if media_type == "image" else None,
                "width": None,
                "height": None,
                "duration_s": None,
                "caption": None,
                "mime_type": mime or None,
            }
        )

    for key, media_type in [("tweet_url", "link"), ("item_url", "link"), ("url", "link")]:
        url = meta.get(key)
        if url and not any(m.get("url") == url for m in media):
            media.append(
                {
                    "type": media_type,
                    "url": url,
                    "thumb_url": meta.get("thumb_url"),
                    "width": None,
                    "height": None,
                    "duration_s": None,
                    "caption": meta.get("caption"),
                    "mime_type": None,
                }
            )
    return media


def normalize_phone_identity(raw) -> Optional[str]:
    """
    Canonical E.164 phone key for customer matching.

    Ghana local forms are treated as synonymous:
      +233547890122  ==  233547890122  ==  0547890122  ==  547890122
    All normalize to +233547890122.
    """
    phone = str(raw or "").strip()
    if not phone or phone.startswith("*"):
        return None
    lower = phone.lower()
    if lower.startswith("whatsapp:"):
        phone = phone.split(":", 1)[1].strip()
    if lower.startswith("phone:"):
        phone = phone.split(":", 1)[1].strip()
    if lower.startswith("wa:"):
        phone = phone.split(":", 1)[1].strip()

    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) < 7:
        return None

    # Ghana: +233 / 233 / leading-0 local / bare 9-digit national number.
    if digits.startswith("233") and len(digits) == 12:
        return f"+{digits}"
    if digits.startswith("0") and len(digits) == 10:
        return f"+233{digits[1:]}"
    if len(digits) == 9 and digits[0] in "234567":
        # National number without trunk 0 (common in pasted WhatsApp / SMS text).
        return f"+233{digits}"
    # Legacy buggy form: +0547… stored as +0547… → digits still 0XXXXXXXXX
    if digits.startswith("2330") and len(digits) == 13:
        # +2330XXXXXXXXX → drop the extra trunk 0
        return f"+233{digits[4:]}"

    return f"+{digits}"


def phone_identity_variants(phone_or_raw) -> List[str]:
    """
    All identifier_value forms that should count as the same phone person.

    Includes Ghana +233 / 233 / 0… / bare national variants so older stored
    identifiers still merge with new canonical keys.
    """
    phone = normalize_phone_identity(phone_or_raw)
    if not phone:
        return []
    digits = "".join(ch for ch in phone if ch.isdigit())
    forms = [phone, digits]

    # Ghana expansions: +233XXXXXXXXX ↔ 0XXXXXXXXX ↔ XXXXXXXXX
    if digits.startswith("233") and len(digits) == 12:
        national = digits[3:]  # 9 digits
        local = f"0{national}"
        forms.extend(
            [
                local,
                f"+{local}",  # legacy buggy canonical (+0547…)
                national,
            ]
        )
    elif digits.startswith("0") and len(digits) == 10:
        national = digits[1:]
        intl = f"233{national}"
        forms.extend([f"+{intl}", intl, national])

    variants: List[str] = []
    seen = set()
    for form in forms:
        if not form:
            continue
        for prefix in ("phone:", "wa:"):
            key = f"{prefix}{form}"
            if key not in seen:
                seen.add(key)
                variants.append(key)
    return variants


def customer_identity_from(feedback, meta: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    if getattr(feedback, "customer_id", None):
        value = str(feedback.customer_id).strip()
        if value:
            return f"customer:{value}", value

    if getattr(feedback, "email_hash", None):
        value = str(feedback.email_hash).strip()
        if value:
            label = (
                meta.get("customer_label")
                or meta.get("customer_name")
                or meta.get("sender_name")
                or meta.get("sender_email")
                or "Email contact"
            )
            return f"email_hash:{value}", str(label)

    # Prefer stable phone / WhatsApp ids over per-message SIDs.
    phone = normalize_phone_identity(meta.get("phone") or meta.get("from_number") or meta.get("wa_id"))
    if phone:
        return f"phone:{phone}", phone

    wa_id = str(meta.get("wa_id") or "").strip()
    if wa_id and not wa_id.startswith("*"):
        # Keep wa: as secondary only when it is not phone-shaped.
        if not normalize_phone_identity(wa_id):
            return f"wa:{wa_id}", str(meta.get("author_handle") or wa_id)

    for key, prefix, label_key in [
        ("author_id", "author", "author_username"),
        ("sender_id", "sender", "from_username"),
        ("thread_id", "thread", "author_handle"),
    ]:
        value = str(meta.get(key) or "").strip()
        if value:
            # Skip Twilio MessageSid-shaped thread keys (unstable per message).
            if prefix == "thread" and value.upper().startswith("SM") and len(value) >= 32:
                continue
            label = meta.get(label_key) or meta.get("author_name") or value
            return f"{prefix}:{value}", str(label)

    for key in ["author_handle", "author_username", "from_username", "from_name", "sender_name"]:
        value = str(meta.get(key) or "").strip()
        if value:
            # Skip masked phone placeholders like ****1234 as identity.
            if value.startswith("*"):
                continue
            if normalize_phone_identity(value):
                phone = normalize_phone_identity(value)
                return f"phone:{phone}", phone
            return f"handle:{value}", value
    return None, None


def normalize_channel_metadata(source: Optional[str], raw_meta: Any) -> Dict[str, Any]:
    meta = safe_json_loads(raw_meta)
    src = str(source or meta.get("provider") or "").lower()
    out: Dict[str, Any] = {**meta}

    out["campaign"] = out.get("campaign")
    out["location"] = out.get("location") or out.get("publisher")
    out["language"] = out.get("language") or "en"
    out["customer_tier"] = out.get("customer_tier")
    out["thread_id"] = out.get("thread_id") or out.get("message_id") or out.get("tweet_id") or out.get("item_id")
    out["author_handle"] = out.get("author_handle") or out.get("author_username") or out.get("from_username")

    if not isinstance(out.get("engagement"), dict):
        eng = {
            "likes": out.get("likes") or out.get("like_count") or 0,
            "comments": out.get("comments") or out.get("comment_count") or 0,
            "shares": out.get("shares") or out.get("share_count") or 0,
            "reposts": out.get("reposts") or out.get("retweet_count") or 0,
            "views": out.get("views") or out.get("view_count") or 0,
        }
        if any(v for v in eng.values()):
            out["engagement"] = eng

    if src in {"x", "twitter"}:
        out.setdefault("provider", "x")
        out.setdefault("author_handle", out.get("author_username"))
    elif src == "tiktok":
        out.setdefault("provider", "tiktok")
        out.setdefault("author_handle", out.get("author_username"))
    elif src == "jotform":
        out.setdefault("provider", "jotform")
    elif src in {"facebook", "instagram"}:
        out.setdefault("provider", src)
    elif src == "email":
        out.setdefault("provider", "email")
        out.setdefault("author_handle", out.get("sender_name"))
        out.setdefault("thread_id", out.get("message_id"))
    elif src == "whatsapp":
        out.setdefault("provider", out.get("provider") or "whatsapp")
        phone = normalize_phone_identity(out.get("phone") or out.get("from_number") or out.get("wa_id"))
        if phone:
            out["phone"] = phone
            out["from_number"] = phone
            out.setdefault("author_handle", phone)
            out.setdefault("wa_id", "".join(ch for ch in phone if ch.isdigit()))
        out.setdefault(
            "thread_id",
            out.get("wa_id") or out.get("phone") or out.get("message_id") or out.get("message_sid"),
        )
    elif src == "web":
        out.setdefault("provider", "web")
        out.setdefault("author_handle", out.get("publisher"))

    out["media"] = normalized_media(out)
    return out


def build_search_text(*, message: str, category: Optional[str], tags: Any, customer_label: Optional[str], meta: Dict[str, Any], source: Optional[str]) -> Dict[str, Any]:
    import json

    tags_list = []
    if isinstance(tags, list):
      tags_list = [str(t) for t in tags if t]
    elif isinstance(tags, str):
      tags_list = [tags]

    metadata_bits = [
        source,
        category,
        customer_label,
        meta.get("campaign"),
        meta.get("location"),
        meta.get("language"),
        meta.get("customer_tier"),
        meta.get("author_handle"),
        meta.get("publisher"),
        meta.get("query"),
        meta.get("matched_keyword"),
    ] + tags_list
    metadata_search_text = " ".join(str(v) for v in metadata_bits if v)
    return {
        "tags_text": json.dumps(tags_list) if tags_list else None,
        "metadata_search_text": metadata_search_text,
        "message_search_text": message or "",
    }
