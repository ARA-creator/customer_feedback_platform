import logging
import os
import threading
import time
from datetime import timedelta

from flask import Flask, request, session
from flask_cors import CORS
from sqlalchemy import text

from .core.config import get_config
from .core.database import engine, Base
from .routes.api import api_bp
from .routes.pages import views_bp
from .routes.integrations import (
    integrations_bp,
    poll_email_and_ingest,
    poll_twilio_whatsapp_and_ingest,
    poll_x_and_ingest,
    poll_tiktok_and_ingest,
)
from .integrations.web_monitor import (
    build_web_mentions,
    build_web_mentions_from_serpapi,
    mention_to_feedback_payload,
    normalize_feed_list,
    normalize_keywords,
    url_hash as web_url_hash,
)
from .routes.integrations import _submit_to_feedback_api
from .core.database import SessionLocal
from .models import ExternalIngestedItem
from .services.rbac import seed_rbac
from .extensions import limiter


def create_app() -> Flask:
    """Application factory to create and configure the Flask app."""
    app = Flask(__name__)
    config = get_config()
    app.config.from_object(config)
    app.permanent_session_lifetime = timedelta(
        seconds=int(getattr(config, "PERMANENT_SESSION_LIFETIME_SECONDS", 1209600))
    )

    # Basic logging configuration
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    # Enable CORS for React frontend
    CORS(
        app,
        supports_credentials=True,
        resources={
            r"/api/*": {
                "origins": [
                    "http://localhost:5173",
                    "http://localhost:3000",
                    "http://127.0.0.1:5173",
                ]
            },
            r"/wordcloud.png": {
                "origins": [
                    "http://localhost:5173",
                    "http://localhost:3000",
                    "http://127.0.0.1:5173",
                ]
            },
            r"/integrations/*": {"origins": "*"},  # Webhooks need to accept from anywhere
        },
    )

    # Register blueprints
    app.register_blueprint(api_bp)
    app.register_blueprint(views_bp)
    app.register_blueprint(integrations_bp)

    # Rate limiting (Flask-Limiter).
    limiter.enabled = bool(getattr(config, "RATE_LIMIT_AUTH", ""))
    limiter.storage_uri = os.getenv("RATE_LIMIT_STORAGE_URI", "memory://")
    limiter.init_app(app)

    @app.before_request
    def _csrf_protect():
        """
        CSRF protection for cookie-based sessions.

        - For state-changing requests, require `X-CSRF-Token` to match the session token.
        - Exempt unauthenticated auth endpoints (login/signup/forgot/reset/verify) so users can start sessions.
        """
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            return None

        path = request.path or ""
        if not path.startswith("/api/"):
            return None

        # No session: nothing to protect (and we don't want to block login/signup).
        if not session.get("user_id"):
            return None

        # Exempt auth endpoints involved in initial auth / email flows.
        if path.startswith("/api/auth/") and any(
            path.endswith(s)
            for s in (
                "/login",
                "/signup",
                "/forgot-password",
                "/reset-password",
                "/verify-email",
                "/logout",
            )
        ):
            return None

        expected = session.get("csrf_token")
        provided = request.headers.get("X-CSRF-Token")
        if not expected or not provided or str(provided) != str(expected):
            return {"error": "CSRF token missing or invalid"}, 403
        return None

    # Ensure tables exist for the current models (dev-friendly).
    # For production, prefer migrations; but this keeps local setups working.
    Base.metadata.create_all(bind=engine)
    seed_rbac()

    # Lightweight dev migration for auth table schema changes.
    # SQLAlchemy create_all() does not alter existing tables.
    try:
        with engine.connect() as conn:
            dialect = engine.dialect.name
            cols: set[str] = set()

            if dialect == "sqlite":
                info = conn.execute(text("PRAGMA table_info(users)")).fetchall()
                if info:
                    cols = {row[1] for row in info}  # (cid, name, type, notnull, dflt_value, pk)
            elif dialect in {"postgresql", "postgres"}:
                rows = conn.execute(
                    text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_schema = 'public' AND table_name = 'users'"
                    )
                ).fetchall()
                cols = {r[0] for r in rows}
            else:
                cols = set()

            if cols:
                # Use dialect-appropriate types.
                dt = "DATETIME" if dialect == "sqlite" else "TIMESTAMP WITH TIME ZONE"
                add_if_missing: list[tuple[str, str]] = [
                    ("role", "VARCHAR(50)"),
                    ("created_at", dt),
                    ("is_active", "BOOLEAN"),
                    ("suspended_at", dt),
                    ("deleted_at", dt),
                    ("full_name", "VARCHAR(160)"),
                    ("email_verified_at", dt),
                    ("email_verification_nonce", "VARCHAR(64)"),
                    ("email_verification_code_hash", "VARCHAR(128)"),
                    ("email_verification_code_expires_at", dt),
                    ("password_reset_nonce", "VARCHAR(64)"),
                    ("password_reset_code_hash", "VARCHAR(128)"),
                    ("password_reset_code_expires_at", dt),
                    ("last_login_at", dt),
                ]

                for name, col_type in add_if_missing:
                    if name in cols:
                        continue
                    if dialect in {"postgresql", "postgres"}:
                        conn.execute(
                            text(f'ALTER TABLE users ADD COLUMN IF NOT EXISTS "{name}" {col_type}')
                        )
                    else:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {col_type}"))
                conn.commit()
    except Exception:
        logging.getLogger(__name__).exception("Failed to run users table dev migration")

    # Lightweight dev migration for reply draft approval fields.
    try:
        with engine.connect() as conn:
            info = conn.execute(text("PRAGMA table_info(feedback_reply_drafts)")).fetchall()
            if info:
                cols = {row[1] for row in info}  # (cid, name, type, notnull, dflt_value, pk)
                if "approval_note" not in cols:
                    conn.execute(text("ALTER TABLE feedback_reply_drafts ADD COLUMN approval_note TEXT"))
                if "approval_assigned_to_user_id" not in cols:
                    conn.execute(text("ALTER TABLE feedback_reply_drafts ADD COLUMN approval_assigned_to_user_id INTEGER"))
                conn.commit()
    except Exception:
        logging.getLogger(__name__).exception("Failed to run feedback_reply_drafts table dev migration")

    # Make config available in templates
    @app.context_processor
    def inject_config():
        from pathlib import Path
        css_exists = (Path(__file__).parent.parent / "app" / "static" / "css" / "output.css").exists()
        return {"config": config, "css_built": css_exists}

    def _should_start_email_poller() -> bool:
        """
        Start at most one poller thread for a dev server process.

        - Werkzeug reloader runs the app twice; only start in the "main" process.
        - In production (e.g., gunicorn), prefer running worker_email_poll.py instead.
        """
        # Avoid duplicate threads in debug reloader
        if app.debug and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
            return False

        # Enable if explicitly requested, or implicitly for dev when credentials exist
        creds_present = bool(getattr(config, "EMAIL_IMAP_SERVER", None) and getattr(config, "EMAIL_USERNAME", None) and getattr(config, "EMAIL_PASSWORD", None))
        enabled = bool(getattr(config, "EMAIL_POLL_ENABLED", False) or (getattr(config, "ENV", "development") == "development" and creds_present))
        return enabled and creds_present

    def _start_email_poller_once() -> None:
        if app.extensions.get("email_poller_started"):
            return
        if not _should_start_email_poller():
            return

        interval = int(getattr(config, "EMAIL_POLL_INTERVAL_SECONDS", 60))
        hours_back = int(getattr(config, "EMAIL_POLL_HOURS_BACK", 24))
        folder = getattr(config, "EMAIL_POLL_FOLDER", "INBOX")
        server = getattr(config, "EMAIL_IMAP_SERVER", None)
        port = int(getattr(config, "EMAIL_IMAP_PORT", 993))
        username = getattr(config, "EMAIL_USERNAME", None)
        password = getattr(config, "EMAIL_PASSWORD", None)

        logger = logging.getLogger(__name__)

        def loop() -> None:
            logger.info(
                "Email auto-poller started (interval=%ss, hours_back=%s, folder=%s, username=%s)",
                interval,
                hours_back,
                folder,
                username,
            )
            # Small delay so the app is fully up before first poll
            time.sleep(1.0)
            while True:
                try:
                    result = poll_email_and_ingest(
                        imap_server=server,
                        imap_port=port,
                        username=username,
                        password=password,
                        folder=folder,
                        hours_back=hours_back,
                    )
                    if result.get("processed", 0) or result.get("emails_found", 0):
                        logger.info("Email auto-poller: %s", result)
                except Exception:
                    logger.exception("Email auto-poller: failed poll cycle")
                time.sleep(max(10, interval))

        t = threading.Thread(target=loop, name="email-auto-poller", daemon=True)
        t.start()
        app.extensions["email_poller_started"] = True

    def _should_start_web_monitor() -> bool:
        if app.debug and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
            return False
        feeds = normalize_feed_list(getattr(config, "WEB_MONITOR_RSS_FEEDS", ""))
        enabled = bool(getattr(config, "WEB_MONITOR_ENABLED", False) or (getattr(config, "ENV", "development") == "development" and bool(feeds)))
        return enabled and bool(feeds)

    def _should_start_x_poller() -> bool:
        if app.debug and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
            return False
        bearer = (getattr(config, "X_BEARER_TOKEN", "") or "").strip()
        query = (getattr(config, "X_QUERY", "") or "").strip()
        enabled = bool(getattr(config, "X_POLL_ENABLED", False))
        return enabled and bool(bearer) and bool(query)

    def _start_x_poller_once() -> None:
        if app.extensions.get("x_poller_started"):
            return
        if not _should_start_x_poller():
            return

        interval = int(getattr(config, "X_POLL_INTERVAL_SECONDS", 900))
        max_results = int(getattr(config, "X_POLL_MAX_RESULTS", 25))
        bearer = (getattr(config, "X_BEARER_TOKEN", "") or "").strip()
        query = (getattr(config, "X_QUERY", "") or "").strip()

        logger = logging.getLogger(__name__)

        def loop() -> None:
            logger.info("X poller started (interval=%ss, max_results=%s)", interval, max_results)
            time.sleep(2.0)
            while True:
                try:
                    result = poll_x_and_ingest(
                        bearer_token=bearer, query=query, max_results=max(10, min(max_results, 100))
                    )
                    if result.get("processed", 0) or result.get("items_found", 0):
                        logger.info("X poller: %s", result)
                except Exception:
                    logger.exception("X poller: failed poll cycle")
                time.sleep(max(30, interval))

        t = threading.Thread(target=loop, name="x-poller", daemon=True)
        t.start()
        app.extensions["x_poller_started"] = True

    def _should_start_tiktok_poller() -> bool:
        if app.debug and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
            return False
        access_token = (getattr(config, "TIKTOK_ACCESS_TOKEN", "") or "").strip()
        base_url = (getattr(config, "TIKTOK_API_BASE_URL", "") or "").strip()
        enabled = bool(getattr(config, "TIKTOK_POLL_ENABLED", False))
        return enabled and bool(access_token) and bool(base_url)

    def _start_tiktok_poller_once() -> None:
        if app.extensions.get("tiktok_poller_started"):
            return
        if not _should_start_tiktok_poller():
            return

        interval = int(getattr(config, "TIKTOK_POLL_INTERVAL_SECONDS", 900))
        limit = int(getattr(config, "TIKTOK_POLL_LIMIT", 25))
        query = (getattr(config, "TIKTOK_POLL_QUERY", "enterprise ghana") or "").strip()
        access_token = (getattr(config, "TIKTOK_ACCESS_TOKEN", "") or "").strip()
        base_url = (getattr(config, "TIKTOK_API_BASE_URL", "") or "").strip()

        logger = logging.getLogger(__name__)

        def loop() -> None:
            logger.info("TikTok poller started (interval=%ss, limit=%s)", interval, limit)
            time.sleep(2.0)
            while True:
                try:
                    result = poll_tiktok_and_ingest(
                        access_token=access_token,
                        base_url=base_url,
                        query=query or "enterprise ghana",
                        limit=max(1, min(limit, 100)),
                    )
                    if result.get("processed", 0) or result.get("items_found", 0):
                        logger.info("TikTok poller: %s", result)
                except Exception:
                    logger.exception("TikTok poller: failed poll cycle")
                time.sleep(max(30, interval))

        t = threading.Thread(target=loop, name="tiktok-poller", daemon=True)
        t.start()
        app.extensions["tiktok_poller_started"] = True

    def _should_start_whatsapp_poller() -> bool:
        if app.debug and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
            return False
        account_sid = (getattr(config, "TWILIO_ACCOUNT_SID", "") or "").strip()
        auth_token = (getattr(config, "TWILIO_AUTH_TOKEN", "") or "").strip()
        creds_present = bool(account_sid and auth_token)
        poll_flag = bool(getattr(config, "WHATSAPP_POLL_ENABLED", False))
        dev_auto = getattr(config, "ENV", "development") == "development" and creds_present
        enabled = poll_flag or dev_auto
        return enabled and creds_present

    def _start_whatsapp_poller_once() -> None:
        if app.extensions.get("whatsapp_poller_started"):
            return
        if not _should_start_whatsapp_poller():
            return

        interval = int(getattr(config, "WHATSAPP_POLL_INTERVAL_SECONDS", 120))
        hours_back = int(getattr(config, "WHATSAPP_POLL_HOURS_BACK", 24))
        account_sid = (getattr(config, "TWILIO_ACCOUNT_SID", "") or "").strip()
        auth_token = (getattr(config, "TWILIO_AUTH_TOKEN", "") or "").strip()
        to_number = getattr(config, "TWILIO_WHATSAPP_TO_NUMBER", None)

        logger = logging.getLogger(__name__)

        def loop() -> None:
            logger.info(
                "WhatsApp (Twilio) auto-poller started (interval=%ss, hours_back=%s)",
                interval,
                hours_back,
            )
            time.sleep(1.0)
            while True:
                try:
                    result = poll_twilio_whatsapp_and_ingest(
                        account_sid=account_sid,
                        auth_token=auth_token,
                        hours_back=hours_back,
                        to_number=to_number,
                    )
                    if result.get("processed", 0) or result.get("messages_found", 0):
                        logger.info("WhatsApp auto-poller: %s", result)
                except Exception:
                    logger.exception("WhatsApp auto-poller: failed poll cycle")
                time.sleep(max(10, interval))

        t = threading.Thread(target=loop, name="whatsapp-twilio-poller", daemon=True)
        t.start()
        app.extensions["whatsapp_poller_started"] = True

    def _should_start_anomaly_detection() -> bool:
        if app.debug and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
            return False
        return bool(getattr(config, "ANOMALY_DETECTION_ENABLED", False))

    def _start_anomaly_detection_once() -> None:
        if app.extensions.get("anomaly_detection_started"):
            return
        if not _should_start_anomaly_detection():
            return

        interval = int(getattr(config, "ANOMALY_DETECTION_INTERVAL_SECONDS", 300))
        logger = logging.getLogger(__name__)

        def loop() -> None:
            logger.info("Anomaly detection worker started (interval=%ss)", interval)
            time.sleep(3.0)
            while True:
                try:
                    from .services.anomaly_detection import run_anomaly_detection_cycle

                    result = run_anomaly_detection_cycle()
                    if result.get("ok") and (result.get("alerts_evaluated", 0) or result.get("rows", 0)):
                        logger.info("Anomaly detection: %s", result)
                except Exception:
                    logger.exception("Anomaly detection: failed cycle")
                time.sleep(max(60, interval))

        t = threading.Thread(target=loop, name="anomaly-detection", daemon=True)
        t.start()
        app.extensions["anomaly_detection_started"] = True

    def _start_web_monitor_once() -> None:
        if app.extensions.get("web_monitor_started"):
            return
        if not _should_start_web_monitor():
            return

        interval = int(getattr(config, "WEB_MONITOR_INTERVAL_SECONDS", 300))
        max_items = int(getattr(config, "WEB_MONITOR_MAX_ITEMS_PER_RUN", 20))
        timeout_seconds = int(getattr(config, "WEB_MONITOR_ARTICLE_TIMEOUT_SECONDS", 12))
        max_snippet_chars = int(getattr(config, "WEB_MONITOR_MAX_SNIPPET_CHARS", 1800))
        feed_urls = normalize_feed_list(getattr(config, "WEB_MONITOR_RSS_FEEDS", ""))
        keywords = normalize_keywords(getattr(config, "WEB_MONITOR_KEYWORDS", ""))
        serpapi_key = (getattr(config, "SERPAPI_API_KEY", "") or "").strip()
        web_search_enabled = bool(getattr(config, "WEB_SEARCH_ENABLED", False) and serpapi_key)
        web_search_sites = [p.strip() for p in str(getattr(config, "WEB_SEARCH_SITES", ".gh,com.gh")).split(",") if p.strip()]
        web_search_results_per_keyword = int(getattr(config, "WEB_SEARCH_RESULTS_PER_KEYWORD", 10))

        logger = logging.getLogger(__name__)

        def loop() -> None:
            logger.info(
                "Web monitor started (interval=%ss, feeds=%s, max_items=%s)",
                interval,
                len(feed_urls),
                max_items,
            )
            time.sleep(2.0)
            while True:
                try:
                    mentions = []
                    if feed_urls:
                        mentions.extend(
                            build_web_mentions(
                                feed_urls=feed_urls,
                                keywords=keywords,
                                max_items=max_items,
                                timeout_seconds=timeout_seconds,
                                max_snippet_chars=max_snippet_chars,
                            )
                        )

                    if web_search_enabled:
                        mentions.extend(
                            build_web_mentions_from_serpapi(
                                api_key=serpapi_key,
                                keywords=keywords,
                                sites=web_search_sites,
                                results_per_keyword=web_search_results_per_keyword,
                                max_total_items=max_items,
                                timeout_seconds=timeout_seconds,
                                max_snippet_chars=max_snippet_chars,
                            )
                        )

                    processed = 0
                    db = SessionLocal()
                    try:
                        for m in mentions:
                            h = web_url_hash(m.url)
                            exists = db.query(ExternalIngestedItem.id).filter(ExternalIngestedItem.url_hash == h).first()
                            if exists:
                                continue
                            db.add(ExternalIngestedItem(source="web", url=m.url, url_hash=h))
                            db.commit()

                            payload = mention_to_feedback_payload(m)
                            result = _submit_to_feedback_api(payload)
                            if result:
                                processed += 1
                            else:
                                db.query(ExternalIngestedItem).filter(ExternalIngestedItem.url_hash == h).delete()
                                db.commit()
                    finally:
                        db.close()

                    if processed or mentions:
                        logger.info("Web monitor: processed=%s found=%s", processed, len(mentions))
                except Exception:
                    logger.exception("Web monitor: failed poll cycle")

                time.sleep(max(30, interval))

        t = threading.Thread(target=loop, name="web-monitor", daemon=True)
        t.start()
        app.extensions["web_monitor_started"] = True

    @app.before_request
    def _kickoff_background_workers():
        # Start lazily on first request so it also works under some WSGI servers.
        _start_email_poller_once()
        _start_web_monitor_once()
        _start_x_poller_once()
        _start_tiktok_poller_once()
        _start_whatsapp_poller_once()
        _start_anomaly_detection_once()

    return app


def init_db() -> None:
    """Create database tables based on ORM models."""
    Base.metadata.create_all(bind=engine)