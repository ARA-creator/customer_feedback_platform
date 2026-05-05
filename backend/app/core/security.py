import base64
import hashlib
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from .config import get_config

_config = get_config()


def _derive_fernet_key(secret_key: str) -> bytes:
    """
    Derive a 32-byte key for Fernet from the application's SECRET_KEY.

    Fernet requires a URL-safe base64-encoded 32-byte key. We derive it by
    hashing the SECRET_KEY with SHA-256 and base64-encoding the result.
    """
    digest = hashlib.sha256(secret_key.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _get_fernet() -> Fernet:
    """Create a Fernet encryptor using the app's SECRET_KEY."""
    key = _derive_fernet_key(_config.SECRET_KEY)
    return Fernet(key)


def encrypt_text(plaintext: Optional[str]) -> Optional[str]:
    """
    Encrypt a text string. Returns a string that can safely be stored in the DB.

    If plaintext is None or empty, returns None.
    """
    if plaintext is None:
        return None

    text = plaintext.strip()
    if not text:
        return None

    f = _get_fernet()
    token = f.encrypt(text.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_text(token: Optional[str]) -> Optional[str]:
    """
    Decrypt a previously encrypted text string.

    If the token is invalid or None, returns None instead of raising.
    """
    if token is None:
        return None

    f = _get_fernet()
    try:
        plaintext = f.decrypt(token.encode("utf-8"))
        return plaintext.decode("utf-8")
    except (InvalidToken, ValueError):
        return None


def hash_email(email: Optional[str]) -> Optional[str]:
    """
    Create a salted, one-way hash of an email address for lookup/deduplication.

    The raw email is normalized (lowercased, trimmed) and combined with HASH_SALT.
    If email is None or empty, returns None.
    """
    if email is None:
        return None

    normalized = email.strip().lower()
    if not normalized:
        return None

    salted = f"{_config.HASH_SALT}:{normalized}"
    digest = hashlib.sha256(salted.encode("utf-8")).hexdigest()
    return digest