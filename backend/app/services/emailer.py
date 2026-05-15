import logging
import smtplib
import threading
from email.message import EmailMessage
from typing import Optional

from ..core.config import get_config

logger = logging.getLogger(__name__)


def _smtp_is_configured(cfg) -> bool:
    return bool(cfg.SMTP_HOST and cfg.SMTP_FROM_EMAIL and cfg.SMTP_USERNAME and cfg.SMTP_PASSWORD)


def send_email(
    *,
    to_email: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
) -> bool:
    cfg = get_config()
    if not _smtp_is_configured(cfg):
        logger.warning("SMTP not configured; skipping email to=%s subject=%s", to_email, subject)
        return False

    msg = EmailMessage()
    msg["From"] = f"{cfg.SMTP_FROM_NAME} <{cfg.SMTP_FROM_EMAIL}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(text or "This email requires an HTML-capable client.")
    msg.add_alternative(html, subtype="html")

    try:
        if cfg.SMTP_USE_TLS:
            server = smtplib.SMTP(cfg.SMTP_HOST, int(cfg.SMTP_PORT), timeout=15)
            server.ehlo()
            server.starttls()
            server.ehlo()
        else:
            server = smtplib.SMTP(cfg.SMTP_HOST, int(cfg.SMTP_PORT), timeout=15)

        try:
            server.login(cfg.SMTP_USERNAME, cfg.SMTP_PASSWORD)
            server.send_message(msg)
            logger.info("Sent email to=%s subject=%s", to_email, subject)
        finally:
            try:
                server.quit()
            except Exception:
                pass
        return True
    except Exception:
        logger.exception("Failed to send email to=%s subject=%s", to_email, subject)
        return False


def send_email_async(**kwargs) -> None:
    def _run() -> None:
        try:
            send_email(**kwargs)
        except Exception:
            logger.exception("Async email send crashed")

    t = threading.Thread(target=_run, name="smtp-email", daemon=True)
    t.start()

