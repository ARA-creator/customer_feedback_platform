import email
import imaplib
import logging
import re
from datetime import datetime
from email.header import decode_header
from email.utils import parseaddr
from typing import Dict, List, Optional, Sequence, Tuple

logger = logging.getLogger(__name__)

# Common IMAP Sent folder names (Gmail, Outlook, Exchange, Dovecot, etc.)
DEFAULT_SENT_FOLDER_CANDIDATES: Tuple[str, ...] = (
    "Sent",
    "INBOX.Sent",
    "[Gmail]/Sent Mail",
    "Sent Items",
    "Sent Messages",
    "INBOX.Sent Items",
)


def _decode_header_value(raw) -> str:
    if raw is None:
        return ""
    parts = decode_header(raw)
    if not parts:
        return ""
    return "".join(
        part.decode(encoding or "utf-8", errors="ignore") if isinstance(part, bytes) else str(part)
        for part, encoding in parts
    )


def normalize_message_id(value: Optional[str]) -> Optional[str]:
    """Normalize an RFC Message-ID for comparison (angle brackets, lowercased)."""
    if not value:
        return None
    mid = str(value).strip()
    if not mid:
        return None
    mid = mid.strip().strip("<>").strip()
    if not mid:
        return None
    return f"<{mid.lower()}>"


def parse_message_id_list(value: Optional[str]) -> List[str]:
    """Parse In-Reply-To or References into a list of normalized Message-IDs."""
    if not value:
        return []
    raw = str(value)
    found: List[str] = []
    for match in re.finditer(r"<[^>]+>", raw):
        n = normalize_message_id(match.group(0))
        if n and n not in found:
            found.append(n)
    if not found:
        # Bare id without brackets
        n = normalize_message_id(raw)
        if n:
            found.append(n)
    return found


def normalize_subject(subject: Optional[str]) -> str:
    """Strip Re:/Fw:/Fwd: prefixes for reply subject matching."""
    s = (subject or "").strip()
    while True:
        new = re.sub(r"^(re|fw|fwd)\s*:\s*", "", s, flags=re.IGNORECASE).strip()
        if new == s:
            break
        s = new
    return s.lower()


def extract_email_addresses(header_value: Optional[str]) -> List[str]:
    """Extract lowercase email addresses from a To/Cc/From header value."""
    if not header_value:
        return []
    text = _decode_header_value(header_value)
    emails: List[str] = []
    for part in text.split(","):
        _, addr = parseaddr(part)
        addr = (addr or "").strip().lower()
        if addr and "@" in addr and addr not in emails:
            emails.append(addr)
    return emails


def parse_email_message(msg) -> Optional[Dict]:
    """Extract text content and metadata from an email message."""
    try:
        subject = _decode_header_value(msg.get("Subject", ""))
        body = ""
        sender_email = ""
        sender_name = ""

        from_str = _decode_header_value(msg.get("From"))
        if from_str:
            if "<" in from_str and ">" in from_str:
                sender_email = from_str.split("<")[1].split(">")[0].strip()
                sender_name = from_str.split("<")[0].strip()
            else:
                sender_email = from_str.strip()

        to_raw = msg.get("To")
        to_emails = extract_email_addresses(to_raw)
        to_header = _decode_header_value(to_raw)

        # Prefer plain text; convert HTML to readable plain text (with links expanded).
        html_body = ""
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                if content_type == "text/plain":
                    payload = part.get_payload(decode=True)
                    if payload:
                        body = payload.decode("utf-8", errors="ignore")
                        break
                elif content_type == "text/html" and not html_body:
                    payload = part.get_payload(decode=True)
                    if payload:
                        html_body = payload.decode("utf-8", errors="ignore")
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                decoded = payload.decode("utf-8", errors="ignore")
                ctype = (msg.get_content_type() or "").lower()
                if ctype == "text/html" or ("<html" in decoded.lower() or "<!doctype" in decoded.lower()):
                    html_body = decoded
                else:
                    body = decoded

        if not body.strip() and html_body:
            from ..services.html_text import html_to_plain_text

            body = html_to_plain_text(html_body)
        else:
            from ..services.html_text import looks_like_html, html_to_plain_text

            if looks_like_html(body):
                body = html_to_plain_text(body)

        if not body.strip() and not subject.strip():
            return None

        message_id = normalize_message_id(msg.get("Message-ID"))
        in_reply_to = parse_message_id_list(msg.get("In-Reply-To"))
        references = parse_message_id_list(msg.get("References"))

        return {
            "subject": subject,
            "body": (body or "").strip(),
            "sender_email": sender_email,
            "sender_name": sender_name,
            "date": msg.get("Date"),
            "message_id": message_id,
            "in_reply_to": in_reply_to[0] if in_reply_to else None,
            "in_reply_to_ids": in_reply_to,
            "references": references,
            "to": to_header,
            "to_emails": to_emails,
            "recipient_email": to_emails[0] if to_emails else None,
        }

    except Exception as e:
        logger.exception(f"Error parsing email: {e}")
        return None


def _list_mailbox_names(mail: imaplib.IMAP4) -> List[str]:
    status, data = mail.list()
    if status != "OK" or not data:
        return []
    names: List[str] = []
    for raw in data:
        if not raw:
            continue
        line = raw.decode("utf-8", errors="ignore") if isinstance(raw, bytes) else str(raw)
        # IMAP LIST: (...flags...) "delimiter" "name"  OR  name at end
        match = re.search(r' "([^"]+)"\s*$', line) or re.search(r' ([^\s]+)\s*$', line)
        if match:
            names.append(match.group(1))
    return names


def quote_imap_mailbox(folder: str) -> str:
    """
    Quote an IMAP mailbox name when required.

    Gmail folders like ``[Gmail]/Sent Mail`` must be sent as
    ``"[Gmail]/Sent Mail"`` or SELECT fails with BAD Could not parse command.
    """
    name = str(folder or "").strip()
    if not name:
        return '""'
    if name.startswith('"') and name.endswith('"'):
        return name
    if re.search(r'[\s\[\]{}()"]', name):
        escaped = name.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'
    return name


def resolve_sent_folder(
    mail: imaplib.IMAP4,
    configured: Optional[str] = None,
    candidates: Optional[Sequence[str]] = None,
) -> Optional[str]:
    """
    Resolve which IMAP folder to use for Sent mail.

    Prefer ``configured`` (EMAIL_SENT_FOLDER) when set; otherwise pick the first
    candidate that exists on the server.
    """
    configured = (configured or "").strip()
    if configured:
        return configured

    available = {n.strip() for n in _list_mailbox_names(mail)}
    # Also try case-insensitive match
    available_lower = {n.lower(): n for n in available}
    for name in candidates or DEFAULT_SENT_FOLDER_CANDIDATES:
        if name in available:
            return name
        alt = available_lower.get(name.lower())
        if alt:
            return alt
    # Fuzzy: any folder containing "sent"
    for n in available:
        if "sent" in n.lower():
            return n
    return None


def fetch_emails(
    imap_server: str,
    imap_port: int,
    username: str,
    password: str,
    folder: str = "INBOX",
    since_date: Optional[datetime] = None,
) -> List[Dict]:
    """
    Fetch emails from IMAP server and return parsed messages.

    Args:
        imap_server: IMAP server hostname
        imap_port: IMAP port (usually 993 for SSL)
        username: Email username
        password: Email password or app password
        folder: Mailbox folder to check (default: INBOX)
        since_date: Only fetch emails since this date

    Returns:
        List of parsed email dictionaries
    """
    emails = []
    mail = None

    try:
        mail = imaplib.IMAP4_SSL(imap_server, imap_port)
        mail.login(username, password)
        mailbox = quote_imap_mailbox(folder)
        status, _ = mail.select(mailbox)
        if status != "OK":
            logger.warning("IMAP select failed for folder %r (quoted=%r)", folder, mailbox)
            return emails

        search_criteria = "ALL"
        if since_date:
            date_str = since_date.strftime("%d-%b-%Y")
            search_criteria = f'(SINCE "{date_str}")'

        status, messages = mail.search(None, search_criteria)
        if status != "OK":
            logger.warning(f"IMAP search failed: {messages}")
            return emails

        email_ids = messages[0].split()
        logger.info(f"Found {len(email_ids)} emails to process in {folder!r}")

        for email_id in email_ids[-50:]:  # limit to last 50 to avoid overload
            try:
                status, msg_data = mail.fetch(email_id, "(RFC822)")
                if status != "OK":
                    continue

                raw_email = msg_data[0][1]
                email_message = email.message_from_bytes(raw_email)
                parsed = parse_email_message(email_message)

                if parsed:
                    parsed["email_id"] = email_id.decode() if isinstance(email_id, bytes) else str(email_id)
                    parsed["folder"] = folder
                    emails.append(parsed)

            except Exception as e:
                logger.exception(f"Error processing email {email_id}: {e}")
                continue

    except imaplib.IMAP4.error as e:
        logger.error(f"IMAP error: {e}")
    except Exception as e:
        logger.exception(f"Unexpected error fetching emails: {e}")
    finally:
        if mail:
            try:
                mail.close()
                mail.logout()
            except Exception:
                pass

    return emails


def fetch_sent_emails(
    imap_server: str,
    imap_port: int,
    username: str,
    password: str,
    since_date: Optional[datetime] = None,
    sent_folder: Optional[str] = None,
) -> Tuple[List[Dict], Optional[str]]:
    """
    Fetch messages from the mailbox Sent folder (does not ingest as feedback).

    Returns (emails, resolved_folder_name).
    """
    mail = None
    emails: List[Dict] = []
    resolved: Optional[str] = None
    try:
        mail = imaplib.IMAP4_SSL(imap_server, imap_port)
        mail.login(username, password)
        resolved = resolve_sent_folder(mail, configured=sent_folder)
        if not resolved:
            logger.warning("No Sent folder found; set EMAIL_SENT_FOLDER to override")
            return [], None
        # Reuse fetch_emails path via a second connection would re-login; select here
        mail.logout()
        mail = None
        emails = fetch_emails(
            imap_server=imap_server,
            imap_port=imap_port,
            username=username,
            password=password,
            folder=resolved,
            since_date=since_date,
        )
        return emails, resolved
    except Exception as e:
        logger.exception(f"Error fetching sent emails: {e}")
        return [], resolved
    finally:
        if mail:
            try:
                mail.logout()
            except Exception:
                pass




def resolve_email_channel_label(
    *,
    mailbox_username: str = None,
    mailbox_label: str = None,
    recipient_email: str = None,
    to_emails: Sequence[str] = None,
    text_blob: str = None,
) -> Optional[str]:
    """
    Map an inbound email to a channel label.

    lexietate10@gmail.com  → HNW email
    mysmartelecthub@gmail.com → CX
    """
    label = (mailbox_label or "").strip()
    if label:
        return label

    candidates = []
    for raw in (
        mailbox_username,
        recipient_email,
        *list(to_emails or []),
    ):
        v = (raw or "").strip().lower()
        if v and "@" in v:
            candidates.append(v)

    blob = (text_blob or "").lower()
    for needle, mapped in (
        ("mysmartelecthub@gmail.com", "CX"),
        ("lexietate10@gmail.com", "HNW email"),
    ):
        if needle in candidates or needle in blob:
            return mapped

    for v in candidates:
        if "mysmartelecthub" in v:
            return "CX"
        if "lexietate10" in v:
            return "HNW email"
    return None


def process_email_to_feedback(
    email_data: Dict,
    *,
    mailbox_username: str = None,
    mailbox_label: str = None,
) -> Dict:
    """
    Convert parsed email data into feedback payload format.

    Returns dict ready to POST to /api/feedback.
    mailbox_username / mailbox_label tag which inbox received the message
    (e.g. HNW email vs CX) so officers can tell channels apart in the UI.
    """
    message_text = email_data.get("subject", "")
    body_text = email_data.get("body", "")
    if message_text and body_text:
        full_message = f"{message_text}\n\n{body_text}"
    else:
        full_message = message_text or body_text

    mailbox = (mailbox_username or "").strip()
    label = resolve_email_channel_label(
        mailbox_username=mailbox,
        mailbox_label=mailbox_label,
        recipient_email=email_data.get("recipient_email"),
        to_emails=email_data.get("to_emails") if isinstance(email_data.get("to_emails"), list) else None,
        text_blob=f"{email_data.get('subject') or ''} {email_data.get('body') or ''} {email_data.get('to') or ''}",
    ) or (mailbox_label or "").strip() or "Email"

    meta = {
        "provider": "email",
        "sender_name": email_data.get("sender_name"),
        "sender_email": email_data.get("sender_email"),
        "email_subject": email_data.get("subject"),
        "message_id": email_data.get("message_id"),
        "in_reply_to": email_data.get("in_reply_to"),
        "references": email_data.get("references") or [],
        "email_date": email_data.get("date"),
        "thread_id": email_data.get("message_id"),
        "author_handle": email_data.get("sender_name"),
        "campaign": None,
        "location": None,
        "language": "en",
        "customer_tier": None,
        "engagement": None,
        "media": [],
    }
    recipient = (email_data.get("recipient_email") or "").strip()
    to_emails = email_data.get("to_emails") if isinstance(email_data.get("to_emails"), list) else []
    if recipient:
        meta["recipient_email"] = recipient
    if to_emails:
        meta["to_emails"] = [str(x).strip().lower() for x in to_emails if x]
    if email_data.get("to"):
        meta["to"] = email_data.get("to")
    if mailbox:
        meta["mailbox"] = mailbox
    if label:
        meta["channel_label"] = label
        meta["mailbox_label"] = label

    return {
        "message": full_message,
        "source": "email",
        "email": email_data.get("sender_email"),
        "category": None,
        "channel_metadata": meta,
    }
