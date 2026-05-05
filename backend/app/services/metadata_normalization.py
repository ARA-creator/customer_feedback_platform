from __future__ import annotations

from typing import Any, Dict, Optional, Tuple


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


def customer_identity_from(feedback, meta: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    if getattr(feedback, "customer_id", None):
        value = str(feedback.customer_id).strip()
        if value:
            return f"customer:{value}", value

    if getattr(feedback, "email_hash", None):
        value = str(feedback.email_hash).strip()
        if value:
            label = meta.get("sender_name") or meta.get("sender_email") or "Email contact"
            return f"email_hash:{value}", str(label)

    for key, prefix, label_key in [
        ("author_id", "author", "author_username"),
        ("sender_id", "sender", "from_username"),
        ("wa_id", "wa", "from_number_masked"),
        ("message_sid", "msg", "from_number_masked"),
        ("thread_id", "thread", "author_handle"),
    ]:
        value = str(meta.get(key) or "").strip()
        if value:
            label = meta.get(label_key) or meta.get("author_name") or value
            return f"{prefix}:{value}", str(label)

    for key in ["author_handle", "author_username", "from_username", "from_name", "sender_name"]:
        value = str(meta.get(key) or "").strip()
        if value:
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
    elif src in {"facebook", "instagram"}:
        out.setdefault("provider", src)
    elif src == "email":
        out.setdefault("provider", "email")
        out.setdefault("author_handle", out.get("sender_name"))
        out.setdefault("thread_id", out.get("message_id"))
    elif src == "whatsapp":
        out.setdefault("provider", out.get("provider") or "whatsapp")
        out.setdefault("thread_id", out.get("message_id") or out.get("message_sid"))
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
