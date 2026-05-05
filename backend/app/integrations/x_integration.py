import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional

import requests

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class XItem:
    tweet_id: str
    url: str
    text: str
    created_at: Optional[str]
    author_id: Optional[str]
    author_username: Optional[str]
    author_name: Optional[str]
    query: str


def _x_url_for_tweet(tweet_id: str) -> str:
    return f"https://x.com/i/web/status/{tweet_id}"


def _sha256_hex(value: str) -> str:
    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()


def x_item_hash(item: XItem) -> str:
    # Stable dedupe key: tweet id is enough, but we hash the canonical URL.
    return _sha256_hex(item.url)


def _x_api_get(*, bearer_token: str, path: str, params: Dict) -> Dict:
    if not bearer_token:
        raise ValueError("Missing X_BEARER_TOKEN")

    base = "https://api.x.com/2"
    url = f"{base}{path}"
    headers = {"Authorization": f"Bearer {bearer_token}"}
    r = requests.get(url, headers=headers, params=params, timeout=20)
    if r.status_code >= 400:
        raise RuntimeError(f"X API error {r.status_code}: {r.text}")
    return r.json()


def search_recent(*, bearer_token: str, query: str, max_results: int = 10) -> List[XItem]:
    """
    Minimal X recent search ingestion:
    - Uses /2/tweets/search/recent
    - Enriches with username/name via expansions when available
    """
    q = (query or "").strip()
    if not q:
        return []

    data = _x_api_get(
        bearer_token=bearer_token,
        path="/tweets/search/recent",
        params={
            "query": q,
            "max_results": max(10, min(int(max_results or 10), 100)),
            "tweet.fields": "created_at,author_id,lang",
            "expansions": "author_id",
            "user.fields": "username,name",
        },
    )

    users_by_id = {}
    for u in (data.get("includes", {}) or {}).get("users", []) or []:
        uid = str(u.get("id") or "")
        if uid:
            users_by_id[uid] = u

    items: List[XItem] = []
    for t in data.get("data", []) or []:
        tid = str(t.get("id") or "").strip()
        if not tid:
            continue
        author_id = str(t.get("author_id") or "").strip() or None
        user = users_by_id.get(author_id or "", {}) if author_id else {}
        items.append(
            XItem(
                tweet_id=tid,
                url=_x_url_for_tweet(tid),
                text=(t.get("text") or "").strip(),
                created_at=t.get("created_at"),
                author_id=author_id,
                author_username=user.get("username"),
                author_name=user.get("name"),
                query=q,
            )
        )

    return items


def x_item_to_feedback_payload(item: XItem) -> Dict:
    handle = item.author_username
    who = f"@{handle}" if handle else (item.author_name or "X user")
    msg = f"{who}: {item.text}".strip()

    return {
        "message": msg,
        "source": "x",
        "category": None,
        "channel_metadata": {
            "provider": "x",
            "tweet_id": item.tweet_id,
            "tweet_url": item.url,
            "author_id": item.author_id,
            "author_username": item.author_username,
            "author_handle": item.author_username,
            "author_name": item.author_name,
            "created_at": item.created_at,
            "query": item.query,
            "thread_id": item.tweet_id,
            "campaign": None,
            "location": None,
            "language": "en",
            "customer_tier": None,
            "engagement": None,
            "media": [{"type": "link", "url": item.url, "thumb_url": None, "width": None, "height": None, "duration_s": None, "caption": None, "mime_type": None}],
            "ingested_at_utc": datetime.utcnow().isoformat() + "Z",
        },
    }

