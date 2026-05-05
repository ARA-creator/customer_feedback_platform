import hashlib
import logging
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import feedparser
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


DEFAULT_KEYWORDS = [
    "Enterprise Insurance Ghana",
    "Enterprise Life Ghana",
    "Enterprise Group Ghana",
    "Enterprise Ghana insurance",
]


@dataclass(frozen=True)
class WebMention:
    url: str
    title: str
    publisher: Optional[str]
    published_at: Optional[str]
    matched_keyword: Optional[str]
    feed_url: Optional[str]
    snippet: str
    query: Optional[str] = None


def _sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="ignore")).hexdigest()


def normalize_keywords(value: Optional[str]) -> List[str]:
    """
    Accepts comma-separated keywords. Falls back to DEFAULT_KEYWORDS.
    """
    if not value:
        return list(DEFAULT_KEYWORDS)
    parts = [p.strip() for p in value.split(",")]
    return [p for p in parts if p] or list(DEFAULT_KEYWORDS)


def normalize_feed_list(value: Optional[str]) -> List[str]:
    if not value:
        return []
    parts = [p.strip() for p in value.split(",")]
    return [p for p in parts if p]


def _extract_published_at(entry: Dict) -> Optional[str]:
    # feedparser may set published_parsed / updated_parsed as time tuples
    for key in ("published_parsed", "updated_parsed"):
        parsed = entry.get(key)
        if parsed:
            try:
                dt = datetime(*parsed[:6], tzinfo=timezone.utc)
                return dt.isoformat()
            except Exception:
                pass
    for key in ("published", "updated", "date"):
        v = entry.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def _clean_text(text) -> str:
    """
    Coerce arbitrary values (incl. feedparser dict-like objects) to safe text.
    """
    if text is None:
        s = ""
    elif isinstance(text, bytes):
        s = text.decode("utf-8", errors="ignore")
    elif isinstance(text, str):
        s = text
    else:
        # feedparser frequently returns FeedParserDict / nested objects
        s = str(text)
    return re.sub(r"\s+", " ", s.strip())


def extract_readable_text_from_html(html: str) -> str:
    soup = BeautifulSoup(html or "", "html.parser")
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()
    text = soup.get_text(" ", strip=True)
    return _clean_text(text)


def fetch_url_text(
    url: str,
    *,
    timeout_seconds: int = 12,
    user_agent: str = "CustomerFeedbackPlatformWebMonitor/1.0",
) -> Optional[str]:
    try:
        resp = requests.get(
            url,
            timeout=timeout_seconds,
            headers={"User-Agent": user_agent, "Accept": "text/html,application/xhtml+xml"},
        )
        if resp.status_code != 200:
            return None
        content_type = (resp.headers.get("Content-Type") or "").lower()
        if "text/html" not in content_type and "application/xhtml" not in content_type:
            # Some RSS links may be PDFs or other binaries; skip.
            return None
        return extract_readable_text_from_html(resp.text)
    except Exception:
        logger.exception("Web monitor: failed fetching url=%s", url)
        return None


def _match_keyword(haystack: str, keywords: Sequence[str]) -> Optional[str]:
    h = (haystack or "").lower()
    for kw in keywords:
        if kw.lower() in h:
            return kw
    return None


def parse_feeds_for_mentions(
    feed_urls: Sequence[str],
    *,
    keywords: Sequence[str],
    max_items: int = 20,
    polite_delay_seconds: float = 0.3,
) -> List[Tuple[str, Dict]]:
    """
    Returns a list of (feed_url, entry_dict) for entries matching keywords.
    """
    matches: List[Tuple[str, Dict]] = []
    for feed_url in feed_urls:
        try:
            parsed = feedparser.parse(feed_url)
            entries = list(parsed.entries or [])
        except Exception:
            logger.exception("Web monitor: failed parsing feed=%s", feed_url)
            continue

        for entry in entries[: max_items * 2]:
            link = entry.get("link") or entry.get("id")
            title = entry.get("title") or ""
            summary = entry.get("summary") or entry.get("description") or ""
            combined = f"{title}\n{summary}\n{link or ''}"
            if _match_keyword(combined, keywords):
                matches.append((feed_url, dict(entry)))
                if len(matches) >= max_items:
                    return matches

        time.sleep(polite_delay_seconds)

    return matches[:max_items]


def build_web_mentions(
    *,
    feed_urls: Sequence[str],
    keywords: Sequence[str],
    max_items: int = 20,
    max_snippet_chars: int = 1800,
    timeout_seconds: int = 12,
    polite_delay_seconds: float = 0.3,
) -> List[WebMention]:
    """
    Discover RSS entries, fetch article pages, and extract a text snippet.
    """
    mentions: List[WebMention] = []
    entries = parse_feeds_for_mentions(
        feed_urls,
        keywords=keywords,
        max_items=max_items,
        polite_delay_seconds=polite_delay_seconds,
    )

    for feed_url, entry in entries:
        url = (entry.get("link") or entry.get("id") or "").strip()
        if not url:
            continue

        title = _clean_text(entry.get("title") or "")
        publisher = _clean_text(entry.get("author") or entry.get("source", "") or "") or None
        published_at = _extract_published_at(entry)

        summary = _clean_text(entry.get("summary") or entry.get("description") or "")
        matched_kw = _match_keyword(f"{title}\n{summary}\n{url}", keywords)

        article_text = fetch_url_text(url, timeout_seconds=timeout_seconds) or ""
        # Prefer fetched article text; fall back to RSS summary if fetch fails.
        base_text = article_text if len(article_text) >= 80 else summary
        base_text = _clean_text(base_text)
        if not base_text:
            continue

        snippet = base_text[:max_snippet_chars]
        mentions.append(
            WebMention(
                url=url,
                title=title or "Web mention",
                publisher=publisher,
                published_at=published_at,
                matched_keyword=matched_kw,
                feed_url=feed_url,
                snippet=snippet,
            )
        )

        time.sleep(polite_delay_seconds)

    return mentions


def url_hash(url: str) -> str:
    return _sha256_hex((url or "").strip().lower())


def mention_to_feedback_payload(m: WebMention) -> Dict:
    message = m.title.strip()
    if m.snippet:
        message = f"{message}\n\n{m.snippet}"

    metadata = {
        "provider": "web",
        "url": m.url,
        "publisher": m.publisher,
        "published_at": m.published_at,
        "matched_keyword": m.matched_keyword,
        "feed_url": m.feed_url,
        "query": m.query,
        "author_handle": m.publisher,
        "thread_id": m.url,
        "campaign": None,
        "location": m.publisher,
        "language": "en",
        "customer_tier": None,
        "engagement": None,
        "media": [{"type": "link", "url": m.url, "thumb_url": None, "width": None, "height": None, "duration_s": None, "caption": None, "mime_type": None}],
    }

    return {
        "message": message,
        "source": "web",
        "category": "web_monitor",
        "channel_metadata": metadata,
    }


def _serpapi_google_search(
    *,
    api_key: str,
    query: str,
    num: int = 10,
    timeout_seconds: int = 20,
) -> List[Dict]:
    """
    Uses SerpAPI's Google engine.
    Docs: https://serpapi.com/search-api
    """
    params = {
        "engine": "google",
        "q": query,
        "api_key": api_key,
        "num": int(num),
        "hl": "en",
        "gl": "gh",
    }
    resp = requests.get("https://serpapi.com/search.json", params=params, timeout=timeout_seconds)
    resp.raise_for_status()
    data = resp.json() or {}
    return list(data.get("organic_results") or [])


def build_queries_for_keywords(
    keywords: Sequence[str],
    *,
    sites: Sequence[str],
) -> List[Tuple[str, str]]:
    """
    Returns list of (keyword, query_string).

    Example query:
      "\"Enterprise Life\" (site:.gh OR site:com.gh)"
    """
    site_terms = []
    for s in sites:
        s = (s or "").strip()
        if not s:
            continue
        # allow either ".gh" or "com.gh"
        if s.startswith("."):
            site_terms.append(f"site:{s}")
        else:
            site_terms.append(f"site:{s}")
    site_clause = " OR ".join(site_terms) if site_terms else ""
    if site_clause:
        site_clause = f"({site_clause})"

    queries: List[Tuple[str, str]] = []
    for kw in keywords:
        kw_clean = (kw or "").strip()
        if not kw_clean:
            continue
        quoted = f"\"{kw_clean}\"" if " " in kw_clean else kw_clean
        q = f"{quoted} {site_clause}".strip()
        queries.append((kw_clean, q))
    return queries


def build_web_mentions_from_serpapi(
    *,
    api_key: str,
    keywords: Sequence[str],
    sites: Sequence[str],
    results_per_keyword: int = 10,
    max_total_items: int = 30,
    timeout_seconds: int = 12,
    max_snippet_chars: int = 1800,
    polite_delay_seconds: float = 0.2,
) -> List[WebMention]:
    mentions: List[WebMention] = []
    queries = build_queries_for_keywords(keywords, sites=sites)

    for kw, q in queries:
        try:
            results = _serpapi_google_search(api_key=api_key, query=q, num=results_per_keyword)
        except Exception:
            logger.exception("Web search: SerpAPI failed for query=%s", q)
            continue

        for r in results:
            url = (r.get("link") or "").strip()
            if not url:
                continue

            title = _clean_text(r.get("title") or "Web mention")
            publisher = _clean_text(r.get("source") or r.get("displayed_link") or "") or None
            published_at = None
            matched_kw = kw

            article_text = fetch_url_text(url, timeout_seconds=timeout_seconds) or ""
            snippet = article_text[:max_snippet_chars] if article_text else ""
            if not snippet:
                snippet = _clean_text(r.get("snippet") or "")[:max_snippet_chars]
            snippet = _clean_text(snippet)
            if not snippet:
                continue

            mentions.append(
                WebMention(
                    url=url,
                    title=title,
                    publisher=publisher,
                    published_at=published_at,
                    matched_keyword=matched_kw,
                    feed_url=None,
                    snippet=snippet,
                    query=q,
                )
            )
            if len(mentions) >= max_total_items:
                return mentions

            time.sleep(polite_delay_seconds)

        time.sleep(polite_delay_seconds)

    return mentions

