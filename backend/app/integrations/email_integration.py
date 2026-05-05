import email
import imaplib
import logging
from datetime import datetime
from email.header import decode_header
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


def parse_email_message(msg) -> Optional[Dict]:
    """Extract text content and metadata from an email message."""
    try:
        subject = ""
        body = ""
        sender_email = ""
        sender_name = ""

        # decode subject
        subject_parts = decode_header(msg.get("Subject", ""))
        if subject_parts:
            subject = "".join(
                part.decode(encoding or "utf-8") if isinstance(part, bytes) else part
                for part, encoding in subject_parts
            )

        # decode sender
        from_parts = decode_header(msg["From"])
        if from_parts:
            from_str = "".join(
                part.decode(encoding or "utf-8") if isinstance(part, bytes) else part
                for part, encoding in from_parts
            )
            # try to extract email from "Name <email@domain.com>" format
            if "<" in from_str and ">" in from_str:
                sender_email = from_str.split("<")[1].split(">")[0].strip()
                sender_name = from_str.split("<")[0].strip()
            else:
                sender_email = from_str

        # get body - prefer plain text, fallback to html
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                if content_type == "text/plain":
                    payload = part.get_payload(decode=True)
                    if payload:
                        body = payload.decode("utf-8", errors="ignore")
                        break
                elif content_type == "text/html" and not body:
                    payload = part.get_payload(decode=True)
                    if payload:
                        # simple html stripping - could use html2text later
                        body = payload.decode("utf-8", errors="ignore")
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                body = payload.decode("utf-8", errors="ignore")

        if not body.strip():
            return None

        return {
            "subject": subject,
            "body": body.strip(),
            "sender_email": sender_email,
            "sender_name": sender_name,
            "date": msg["Date"],
            "message_id": msg["Message-ID"],
        }

    except Exception as e:
        logger.exception(f"Error parsing email: {e}")
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
        mail.select(folder)

        # build search criteria
        search_criteria = "ALL"
        if since_date:
            date_str = since_date.strftime("%d-%b-%Y")
            search_criteria = f'(SINCE "{date_str}")'

        status, messages = mail.search(None, search_criteria)
        if status != "OK":
            logger.warning(f"IMAP search failed: {messages}")
            return emails

        email_ids = messages[0].split()
        logger.info(f"Found {len(email_ids)} emails to process")

        for email_id in email_ids[-50:]:  # limit to last 50 to avoid overload
            try:
                status, msg_data = mail.fetch(email_id, "(RFC822)")
                if status != "OK":
                    continue

                raw_email = msg_data[0][1]
                email_message = email.message_from_bytes(raw_email)
                parsed = parse_email_message(email_message)

                if parsed:
                    parsed["email_id"] = email_id.decode()
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
            except:
                pass

    return emails


def process_email_to_feedback(email_data: Dict) -> Dict:
    """
    Convert parsed email data into feedback payload format.

    Returns dict ready to POST to /api/feedback
    """
    # combine subject and body
    message_text = email_data.get("subject", "")
    body_text = email_data.get("body", "")
    if message_text and body_text:
        full_message = f"{message_text}\n\n{body_text}"
    else:
        full_message = message_text or body_text

    return {
        "message": full_message,
        "source": "email",
        "email": email_data.get("sender_email"),
        "category": None,  # could add email parsing logic to detect category
        "channel_metadata": {
            "provider": "email",
            "sender_name": email_data.get("sender_name"),
            "sender_email": email_data.get("sender_email"),
            "email_subject": email_data.get("subject"),
            "message_id": email_data.get("message_id"),
            "email_date": email_data.get("date"),
            "thread_id": email_data.get("message_id"),
            "author_handle": email_data.get("sender_name"),
            "campaign": None,
            "location": None,
            "language": "en",
            "customer_tier": None,
            "engagement": None,
            "media": [],
        },
    }
