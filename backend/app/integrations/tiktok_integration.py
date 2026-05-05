import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional

import requests

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TikTokItem:
    """
    Normalized TikTok item (comment/mention) for ingestion.

    Note: TikTok’s available APIs vary by product/program. This integration is designed
    to work with whichever comment/mention endpoint your account has access to, using
    a configurable API base URL.
    """

    item_id: str
    url: str
    text: str
    author_username: Optional[str]
    created_at: Optional[str]
    query: str


def _sha256_hex(value: str) -> str:
    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()


def tiktok_item_hash(item: TikTokItem) -> str:
    return _sha256_hex(item.url or item.item_id)


def _api_get(*, access_token: str, base_url: str, path: str, params: Dict) -> Dict:
    if not access_token:
        raise ValueError("Missing TIKTOK_ACCESS_TOKEN")
    if not base_url:
        raise ValueError("Missing TIKTOK_API_BASE_URL")

    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
    headers = {"Authorization": f"Bearer {access_token}"}
    r = requests.get(url, headers=headers, params=params, timeout=25)
    if r.status_code >= 400:
        raise RuntimeError(f"TikTok API error {r.status_code}: {r.text}")
    return r.json()


def poll_comments_or_mentions(
    *, access_token: str, base_url: str, query: str, limit: int = 25
) -> List[TikTokItem]:
    """
    Poll TikTok items via a configurable endpoint.

    Because TikTok’s official endpoints differ across products, this function expects:
    - `TIKTOK_API_BASE_URL` points to the API host you’re using.
    - The endpoint `GET /mentions` OR `GET /comments` is implemented by that API.

    Response mapping expectations (best-effort):
    - A list under one of: `data`, `items`, `comments`, `mentions`
    - Each item has: `id` (or `comment_id`), `text` (or `message`), optional `url`
    """
    q = (query or "").strip()
    if not q:
        return []

    # Try "mentions" first, then "comments".
    last_err: Optional[Exception] = None
    for path in ("/mentions", "/comments"):
        try:
            resp = _api_get(
                access_token=access_token,
                base_url=base_url,
                path=path,
                params={"q": q, "limit": max(1, min(int(limit or 25), 100))},
            )
            raw_items = (
                resp.get("data")
                or resp.get("items")
                or resp.get("comments")
                or resp.get("mentions")
                or []
            )
            out: List[TikTokItem] = []
            for it in raw_items or []:
                item_id = str(it.get("id") or it.get("comment_id") or "").strip()
                text = str(it.get("text") or it.get("message") or "").strip()
                if not item_id or not text:
                    continue
                url = str(it.get("url") or "").strip() or f"tiktok://{item_id}"
                out.append(
                    TikTokItem(
                        item_id=item_id,
                        url=url,
                        text=text,
                        author_username=it.get("author_username") or it.get("username"),
                        created_at=it.get("created_at") or it.get("timestamp"),
                        query=q,
                    )
                )
            return out
        except Exception as e:
            last_err = e
            continue

    if last_err:
        raise last_err
    return []


def tiktok_item_to_feedback_payload(item: TikTokItem) -> Dict:
    who = f"@{item.author_username}" if item.author_username else "TikTok user"
    msg = f"{who}: {item.text}".strip()

    return {
        "message": msg,
        "source": "tiktok",
        "category": None,
        "channel_metadata": {
            "provider": "tiktok",
            "item_id": item.item_id,
            "item_url": item.url,
            "author_username": item.author_username,
            "author_handle": item.author_username,
            "created_at": item.created_at,
            "query": item.query,
            "thread_id": item.item_id,
            "campaign": None,
            "location": None,
            "language": "en",
            "customer_tier": None,
            "engagement": None,
            "media": [{"type": "link", "url": item.url, "thumb_url": None, "width": None, "height": None, "duration_s": None, "caption": None, "mime_type": None}],
            "ingested_at_utc": datetime.utcnow().isoformat() + "Z",
        },
    }

