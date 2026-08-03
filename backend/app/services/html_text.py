"""Convert HTML email bodies into readable plain text for inbox/export."""

from __future__ import annotations

import re
from html import unescape
from typing import Optional

_HTML_HINT = re.compile(
    r"(?is)<\s*(!doctype|html|head|body|div|table|p|br|a\s|span|style|meta)\b"
)


def looks_like_html(text: Optional[str]) -> bool:
    s = str(text or "").strip()
    if not s or "<" not in s:
        return False
    return bool(_HTML_HINT.search(s))


def html_to_plain_text(html: Optional[str], *, max_len: int = 20000) -> str:
    """
    Turn an HTML email into plain text suitable for CX officers.

    - Keeps visible copy
    - Expands links to ``label (url)`` so they stay clickable in the inbox
    - Drops scripts/styles/DOCTYPE chrome
    """
    raw = str(html or "").strip()
    if not raw:
        return ""
    if not looks_like_html(raw):
        return raw

    try:
        from bs4 import BeautifulSoup
    except Exception:
        return _regex_html_to_text(raw, max_len=max_len)

    soup = BeautifulSoup(raw, "html.parser")
    for tag in soup(["script", "style", "head", "noscript", "svg", "iframe"]):
        tag.decompose()

    for br in soup.find_all("br"):
        br.replace_with("\n")
    for block in soup.find_all(["p", "div", "tr", "li", "h1", "h2", "h3", "h4", "blockquote", "section"]):
        block.append("\n")

    for a in soup.find_all("a", href=True):
        href = str(a.get("href") or "").strip()
        label = a.get_text(" ", strip=True)
        if href.startswith(("http://", "https://", "mailto:")):
            if label and label.rstrip(".") != href:
                a.replace_with(f"{label} ({href})")
            else:
                a.replace_with(href)
        else:
            a.replace_with(label or "")

    text = soup.get_text("\n")
    text = unescape(text)
    text = text.replace("\xa0", " ").replace("\u200c", "")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = text.strip()
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip() + "…"
    return text


def _regex_html_to_text(html: str, *, max_len: int = 20000) -> str:
    t = re.sub(r"(?is)<(script|style|head|noscript)[^>]*>.*?</\1>", " ", html)
    t = re.sub(r"(?is)<!--.*?-->", " ", t)

    def _link_repl(m: re.Match) -> str:
        href = (m.group(1) or "").strip()
        label = re.sub(r"(?is)<[^>]+>", "", m.group(2) or "").strip()
        if href.startswith(("http://", "https://", "mailto:")):
            if label and label != href:
                return f"{label} ({href})"
            return href
        return label or ""

    t = re.sub(r'(?is)<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', _link_repl, t)
    t = re.sub(r"(?is)<br\s*/?>", "\n", t)
    t = re.sub(r"(?is)</(p|div|tr|li|h[1-6]|blockquote)>", "\n", t)
    t = re.sub(r"(?is)<[^>]+>", " ", t)
    t = unescape(t)
    t = re.sub(r"[ \t]+\n", "\n", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    t = re.sub(r"[ \t]{2,}", " ", t).strip()
    if max_len and len(t) > max_len:
        return t[:max_len].rstrip() + "…"
    return t


def normalize_message_text(text: Optional[str]) -> str:
    """Plain-ify a stored feedback message if it still contains HTML."""
    s = str(text or "")
    if looks_like_html(s):
        return html_to_plain_text(s)
    return s
