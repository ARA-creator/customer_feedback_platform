import os
from pathlib import Path

from dotenv import load_dotenv

# Resolve directories from the new backend/app/core layout.
APP_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = Path(__file__).resolve().parents[3]

# Load environment variables from the repo root .env if present.
ENV_PATH = PROJECT_ROOT / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)


class BaseConfig:
    """Base configuration shared by all environments."""

    # Database: default to local SQLite for dev, override in production
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{PROJECT_ROOT / 'feedback.db'}",
    )

    SQLALCHEMY_ECHO = os.getenv("SQLALCHEMY_ECHO", "false").lower() == "true"

    # Application secret key (for sessions, encryption, etc.)
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-insecure-change-me")

    # Optional token for one-off admin maintenance actions (e.g., sentiment reprocessing)
    # If unset/empty, token-based access is disabled.
    ADMIN_ACTION_TOKEN = os.getenv("ADMIN_ACTION_TOKEN", "")

    # Crypto salt for hashing emails / identifiers
    HASH_SALT = os.getenv("HASH_SALT", "dev-hash-salt-change-me")

    # Ghana / region specific deployment hints
    REGION = os.getenv("REGION", "af-south-1")  # AWS Cape Town region

    # Environment name
    ENV = os.getenv("FLASK_ENV", "development")

    # Email integration (IMAP)
    EMAIL_IMAP_SERVER = os.getenv("EMAIL_IMAP_SERVER", None)
    EMAIL_IMAP_PORT = int(os.getenv("EMAIL_IMAP_PORT", "993"))
    EMAIL_USERNAME = os.getenv("EMAIL_USERNAME", None)
    EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", None)

    # Optional: automatic email polling (runs inside the Flask process)
    EMAIL_POLL_ENABLED = os.getenv("EMAIL_POLL_ENABLED", "").lower() in {"1", "true", "yes", "on"}
    EMAIL_POLL_INTERVAL_SECONDS = int(os.getenv("EMAIL_POLL_INTERVAL_SECONDS", "60"))
    EMAIL_POLL_HOURS_BACK = int(os.getenv("EMAIL_POLL_HOURS_BACK", "24"))
    EMAIL_POLL_FOLDER = os.getenv("EMAIL_POLL_FOLDER", "INBOX")

    # Web monitor (RSS-based) - Optional
    WEB_MONITOR_ENABLED = os.getenv("WEB_MONITOR_ENABLED", "").lower() in {"1", "true", "yes", "on"}
    WEB_MONITOR_INTERVAL_SECONDS = int(os.getenv("WEB_MONITOR_INTERVAL_SECONDS", "300"))
    WEB_MONITOR_KEYWORDS = os.getenv("WEB_MONITOR_KEYWORDS", "")
    WEB_MONITOR_RSS_FEEDS = os.getenv("WEB_MONITOR_RSS_FEEDS", "")
    WEB_MONITOR_MAX_ITEMS_PER_RUN = int(os.getenv("WEB_MONITOR_MAX_ITEMS_PER_RUN", "20"))
    WEB_MONITOR_ARTICLE_TIMEOUT_SECONDS = int(os.getenv("WEB_MONITOR_ARTICLE_TIMEOUT_SECONDS", "12"))
    WEB_MONITOR_MAX_SNIPPET_CHARS = int(os.getenv("WEB_MONITOR_MAX_SNIPPET_CHARS", "1800"))

    # Web search (SerpAPI) - Optional (best coverage for .gh / .com.gh)
    SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY", "")
    WEB_SEARCH_ENABLED = os.getenv("WEB_SEARCH_ENABLED", "").lower() in {"1", "true", "yes", "on"}
    WEB_SEARCH_INTERVAL_SECONDS = int(os.getenv("WEB_SEARCH_INTERVAL_SECONDS", "900"))
    WEB_SEARCH_SITES = os.getenv("WEB_SEARCH_SITES", ".gh,com.gh")
    WEB_SEARCH_RESULTS_PER_KEYWORD = int(os.getenv("WEB_SEARCH_RESULTS_PER_KEYWORD", "10"))

    # WhatsApp - Twilio
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", None)
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", None)
    # Optional: when set, only ingest inbound messages whose "To" matches (e.g. whatsapp:+15551234567)
    TWILIO_WHATSAPP_TO_NUMBER = os.getenv("TWILIO_WHATSAPP_TO_NUMBER", "").strip() or None

    # Optional: poll Twilio REST for inbound WhatsApp (same process as EMAIL_POLL_*)
    WHATSAPP_POLL_ENABLED = os.getenv("WHATSAPP_POLL_ENABLED", "").lower() in {"1", "true", "yes", "on"}
    WHATSAPP_POLL_INTERVAL_SECONDS = int(os.getenv("WHATSAPP_POLL_INTERVAL_SECONDS", "120"))
    WHATSAPP_POLL_HOURS_BACK = int(os.getenv("WHATSAPP_POLL_HOURS_BACK", "24"))

    # Meta (Facebook/Instagram/WhatsApp Business)
    META_APP_SECRET = os.getenv("META_APP_SECRET", None)
    META_VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN", "change-this-verify-token")
    META_ACCESS_TOKEN = os.getenv("META_ACCESS_TOKEN", None)

    # X (Twitter) API - polling
    X_BEARER_TOKEN = os.getenv("X_BEARER_TOKEN", "")
    X_QUERY = os.getenv("X_QUERY", "")
    X_POLL_INTERVAL_SECONDS = int(os.getenv("X_POLL_INTERVAL_SECONDS", "900"))
    X_POLL_ENABLED = os.getenv("X_POLL_ENABLED", "").lower() in {"1", "true", "yes", "on"}
    X_POLL_MAX_RESULTS = int(os.getenv("X_POLL_MAX_RESULTS", "25"))

    # TikTok API - polling (comments/mentions where available)
    TIKTOK_ACCESS_TOKEN = os.getenv("TIKTOK_ACCESS_TOKEN", "")
    TIKTOK_POLL_INTERVAL_SECONDS = int(os.getenv("TIKTOK_POLL_INTERVAL_SECONDS", "900"))
    # Optional escape hatch: some TikTok programs require different base URLs.
    TIKTOK_API_BASE_URL = os.getenv("TIKTOK_API_BASE_URL", "")
    TIKTOK_POLL_ENABLED = os.getenv("TIKTOK_POLL_ENABLED", "").lower() in {"1", "true", "yes", "on"}
    TIKTOK_POLL_QUERY = os.getenv("TIKTOK_POLL_QUERY", "enterprise ghana")
    TIKTOK_POLL_LIMIT = int(os.getenv("TIKTOK_POLL_LIMIT", "25"))

    # Google Forms (Apps Script -> webhook)
    GOOGLE_FORMS_WEBHOOK_SECRET = os.getenv("GOOGLE_FORMS_WEBHOOK_SECRET", "")

    # Gemini API
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    # Customer Pulse: rolling-window anomaly detection (thread inside app process; disable in production via env)
    _anom = os.getenv("ANOMALY_DETECTION_ENABLED", "").strip().lower()
    if _anom in {"1", "true", "yes", "on"}:
        ANOMALY_DETECTION_ENABLED = True
    elif _anom in {"0", "false", "no", "off"}:
        ANOMALY_DETECTION_ENABLED = False
    else:
        ANOMALY_DETECTION_ENABLED = os.getenv("APP_ENV", "development").lower() != "production"
    ANOMALY_DETECTION_INTERVAL_SECONDS = int(os.getenv("ANOMALY_DETECTION_INTERVAL_SECONDS", "300"))


class DevelopmentConfig(BaseConfig):
    DEBUG = True


class ProductionConfig(BaseConfig):
    DEBUG = False
    SQLALCHEMY_ECHO = False


def get_config():
    """Factory to select config class based on environment variable."""
    env = os.getenv("APP_ENV", "development").lower()
    if env == "production":
        return ProductionConfig()
    return DevelopmentConfig()