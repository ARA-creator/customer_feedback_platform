import base64
import hashlib
import os
from typing import Iterable, List, Optional

from cryptography.fernet import Fernet, InvalidToken

from .config import get_config

_config = get_config()

# Keys that may have encrypted historical rows (e.g. before SECRET_KEY was set on Vercel).
_DEFAULT_FALLBACK_SECRET_KEYS = (
    "dev-insecure-change-me",
    "dev-secret-key-change-in-production",
)


def _derive_fernet_key(secret_key: str) -> bytes:
    """
    Derive a 32-byte key for Fernet from the application's SECRET_KEY.

    Fernet requires a URL-safe base64-encoded 32-byte key. We derive it by
    hashing the SECRET_KEY with SHA-256 and base64-encoding the result.
    """
    digest = hashlib.sha256(secret_key.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _get_fernet(secret_key: Optional[str] = None) -> Fernet:
    """Create a Fernet encryptor using the given or app SECRET_KEY."""
    key_material = secret_key if secret_key is not None else _config.SECRET_KEY
    key = _derive_fernet_key(str(key_material or ""))
    return Fernet(key)


def _fallback_secret_keys() -> List[str]:
    """Ordered unique secret keys to try when the primary decrypt fails."""
    primary = str(getattr(_config, "SECRET_KEY", "") or "").strip()
    keys: List[str] = []
    seen = set()

    def _add(value: Optional[str]) -> None:
        v = str(value or "").strip()
        if not v or v in seen:
            return
        seen.add(v)
        keys.append(v)

    _add(primary)
    env_fallbacks = os.getenv("SECRET_KEY_FALLBACKS", "") or ""
    for part in env_fallbacks.split(","):
        _add(part)
    for part in _DEFAULT_FALLBACK_SECRET_KEYS:
        _add(part)
    return keys


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

    Tries the current SECRET_KEY first, then configured/known fallback keys so
    rows encrypted under an older key (e.g. the Flask default before Vercel had
    SECRET_KEY set) still decrypt.

    If the token is invalid or None, returns None instead of raising.
    """
    if token is None:
        return None

    raw = str(token).strip()
    if not raw:
        return None

    for secret in _fallback_secret_keys():
        try:
            plaintext = _get_fernet(secret).decrypt(raw.encode("utf-8"))
            return plaintext.decode("utf-8")
        except (InvalidToken, ValueError):
            continue
    return None


def decrypt_text_with_key(token: Optional[str], secret_key: str) -> Optional[str]:
    """Decrypt using an explicit secret key (for migrations / diagnostics)."""
    if token is None:
        return None
    raw = str(token).strip()
    if not raw:
        return None
    try:
        plaintext = _get_fernet(secret_key).decrypt(raw.encode("utf-8"))
        return plaintext.decode("utf-8")
    except (InvalidToken, ValueError):
        return None


def reencrypt_text_to_current(token: Optional[str], candidate_keys: Optional[Iterable[str]] = None) -> Optional[str]:
    """
    Decrypt with any known key and re-encrypt with the current SECRET_KEY.

    Returns the new ciphertext, or None if decrypt failed / input empty.
    If already decryptable with the current key only, still returns a fresh
    ciphertext under the current key (or the original if re-encrypt is a no-op
    preference — callers that want identity can compare).
    """
    if token is None:
        return None
    raw = str(token).strip()
    if not raw:
        return None

    plaintext = None
    keys = list(candidate_keys) if candidate_keys is not None else _fallback_secret_keys()
    for secret in keys:
        plaintext = decrypt_text_with_key(raw, secret)
        if plaintext is not None:
            break
    if plaintext is None:
        return None
    return encrypt_text(plaintext)


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
