"""
Auth routes for the /api blueprint.

Populated incrementally during the api.py split.
"""

import hashlib
import hmac
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone

from email_validator import EmailNotValidError, validate_email
from flask import current_app, jsonify, request, session
from passlib.hash import argon2
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import load_only

from ...database import SessionLocal
from ...models import Role, User, UserRole
from ...services.rbac import normalize_role_name
from ...services.emailer import send_email_async
from ...emails.templates import reset_password_email, verify_email, welcome_email
from ...extensions import limiter
from . import api_bp
from ._helpers import _current_user, _require_user, _user_permission_keys

logger = logging.getLogger(__name__)


_CODE_RE = re.compile(r"^\d{6}$")


def _generate_6_digit_code() -> str:
    # 000000 - 999999, inclusive
    return f"{secrets.randbelow(1_000_000):06d}"


def _hash_code(*, purpose: str, email: str, code: str, nonce: str) -> str:
    """
    Create a stable, non-reversible hash for a 6-digit code.

    We bind the hash to:
      - app SECRET_KEY (server secret)
      - user email (prevents swapping codes across accounts)
      - purpose (verify vs reset)
      - a user-controlled nonce (lets us invalidate all previous codes)
    """
    key = str(current_app.config.get("SECRET_KEY") or "").encode("utf-8")
    msg = f"p={purpose}|e={email}|c={code}|n={nonce}".encode("utf-8")
    return hashlib.sha256(hmac.new(key, msg, hashlib.sha256).digest()).hexdigest()


def _validate_code(code: str) -> bool:
    return bool(code and _CODE_RE.match(str(code).strip()))


def _validate_password(pw: str) -> str | None:
    if not pw or len(pw) < 12:
        return "Password must be at least 12 characters"
    if len(pw) > 256:
        return "Password is too long"
    return None


def _check_password_reset_code(user: User | None, code: str) -> str | None:
    """Return an error message if the reset code is invalid, else None."""
    if not user or getattr(user, "deleted_at", None) or getattr(user, "is_active", True) is False:
        return "Invalid reset code"
    expires = getattr(user, "password_reset_code_expires_at", None)
    if not expires or expires < datetime.now(tz=timezone.utc):
        return "Reset code expired"
    nonce = str(getattr(user, "password_reset_nonce", "") or "")
    expected = str(getattr(user, "password_reset_code_hash", "") or "")
    if not nonce or not expected:
        return "Reset code expired"
    provided = _hash_code(purpose="reset", email=user.email, code=code, nonce=nonce)
    if not hmac.compare_digest(provided, expected):
        return "Invalid reset code"
    return None


def _ensure_csrf() -> str:
    token = session.get("csrf_token")
    if not token:
        token = secrets.token_urlsafe(32)
        session["csrf_token"] = token
    return str(token)


def _issue_email_verification_code(db, user: User) -> None:
    """Generate a fresh 6-digit verification code and email it to the user."""
    if getattr(user, "email_verified_at", None):
        return
    code = _generate_6_digit_code()
    nonce = user.email_verification_nonce or secrets.token_hex(16)
    user.email_verification_nonce = nonce
    user.email_verification_code_hash = _hash_code(
        purpose="verify", email=user.email, code=code, nonce=nonce
    )
    user.email_verification_code_expires_at = datetime.now(tz=timezone.utc) + timedelta(hours=24)
    db.commit()
    tpl = verify_email(name=user.full_name or "", code=code)
    send_email_async(to_email=user.email, subject=tpl.subject, html=tpl.html, text=tpl.text)


@api_bp.route("/auth/me", methods=["GET"])
def auth_me():
    db = SessionLocal()
    try:
        user = _current_user(db)
        if not user:
            return jsonify({"authenticated": False}), 200
        if not getattr(user, "email_verified_at", None):
            return jsonify({"authenticated": False, "error": "Email not verified"}), 401
        perms = sorted(_user_permission_keys(db, user.id))
        csrf = _ensure_csrf()
        return jsonify(
            {
                "authenticated": True,
                "csrf": csrf,
                "user": {"id": user.id, "email": user.email, "role": user.role, "permissions": perms},
            }
        )
    finally:
        db.close()


@api_bp.route("/auth/signup", methods=["POST"])
@limiter.limit("10 per minute")
def auth_signup():
    payload = request.get_json(silent=True) or {}
    email_raw = str(payload.get("email") or "").strip()
    full_name = str(payload.get("name") or "").strip() or None
    password = str(payload.get("password") or "")
    role = str(payload.get("role") or "").strip() or None
    role_name = normalize_role_name(role) or "agent"

    if not email_raw:
        return jsonify({"error": "Email is required"}), 400
    try:
        email = validate_email(email_raw, check_deliverability=False).normalized
    except EmailNotValidError:
        return jsonify({"error": "Email is invalid"}), 400
    pw_err = _validate_password(password)
    if pw_err:
        return jsonify({"error": pw_err}), 400

    db = SessionLocal()
    try:
        exists = db.query(User.id).filter(User.email == email).first()
        if exists:
            return jsonify({"error": "Account already exists"}), 409

        user = User(
            email=email,
            password_hash=argon2.hash(password),
            full_name=full_name,
            role=role_name,
            email_verification_nonce=secrets.token_hex(16),
            password_reset_nonce=secrets.token_hex(16),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Attach normalized role to the RBAC mapping table (idempotent for dev).
        r = db.query(Role).filter(Role.name == role_name).first()
        if r:
            has = (
                db.query(UserRole.id)
                .filter((UserRole.user_id == user.id) & (UserRole.role_id == r.id))
                .first()
            )
            if not has:
                db.add(UserRole(user_id=user.id, role_id=r.id))
                db.commit()

        # Email: welcome + verification (no session until email is verified)
        try:
            tpl = welcome_email(name=user.full_name or "", email=user.email)
            send_email_async(to_email=user.email, subject=tpl.subject, html=tpl.html, text=tpl.text)
        except Exception:
            pass

        try:
            _issue_email_verification_code(db, user)
        except Exception:
            pass

        return (
            jsonify({"ok": True, "needs_email_verification": True, "email": user.email}),
            201,
        )
    finally:
        db.close()


@api_bp.route("/auth/login", methods=["POST"])
@limiter.limit("10 per minute")
def auth_login():
    payload = request.get_json(silent=True) or {}
    email_raw = str(payload.get("email") or "").strip()
    password = str(payload.get("password") or "")

    if not email_raw or not password:
        return jsonify({"error": "Email and password are required"}), 400
    try:
        email = validate_email(email_raw, check_deliverability=False).normalized
    except EmailNotValidError:
        return jsonify({"error": "Email and password are required"}), 400

    db = SessionLocal()
    try:
        try:
            user = (
                db.query(User)
                .options(
                    load_only(
                        User.id,
                        User.email,
                        User.password_hash,
                        User.role,
                        User.deleted_at,
                        User.is_active,
                        User.email_verified_at,
                        User.last_login_at,
                    )
                )
                .filter(User.email == email)
                .first()
            )
        except SQLAlchemyError:
            logger.exception("Login failed: database error while loading user")
            db.rollback()
            return jsonify({"error": "Database is temporarily unavailable. Please try again."}), 503

        if not user:
            return jsonify({"error": "No account found"}), 404
        if getattr(user, "deleted_at", None):
            return jsonify({"error": "No account found"}), 404
        if getattr(user, "is_active", True) is False:
            return jsonify({"error": "Account is suspended"}), 403
        if not getattr(user, "email_verified_at", None):
            return (
                jsonify(
                    {
                        "error": "Please verify your email before signing in.",
                        "needs_email_verification": True,
                    }
                ),
                403,
            )
        try:
            password_ok = argon2.verify(password, user.password_hash)
        except Exception:
            logger.exception("Login failed: password verification error for %s", email)
            return jsonify({"error": "Incorrect password"}), 401
        if not password_ok:
            return jsonify({"error": "Incorrect password"}), 401

        session.clear()
        session["user_id"] = user.id
        csrf = _ensure_csrf()
        session.permanent = True
        try:
            user.last_login_at = datetime.now(tz=timezone.utc)
            db.commit()
        except SQLAlchemyError:
            logger.exception("Login failed: could not update last_login_at")
            db.rollback()
            return jsonify({"error": "Database is temporarily unavailable. Please try again."}), 503

        perms = sorted(_user_permission_keys(db, user.id))
        return (
            jsonify({"csrf": csrf, "user": {"id": user.id, "email": user.email, "role": user.role, "permissions": perms}}),
            200,
        )
    finally:
        db.close()


@api_bp.route("/auth/csrf", methods=["GET"])
def auth_csrf():
    db = SessionLocal()
    try:
        user = _current_user(db)
        if not user:
            return jsonify({"error": "Not authenticated"}), 401
        return jsonify({"csrf": _ensure_csrf()})
    finally:
        db.close()


@api_bp.route("/auth/logout", methods=["POST"])
def auth_logout():
    session.pop("user_id", None)
    return jsonify({"ok": True})


@api_bp.route("/auth/change-password", methods=["POST"])
@limiter.limit("10 per minute")
def auth_change_password():
    payload = request.get_json(silent=True) or {}
    current_password = str(payload.get("current_password") or "")
    new_password = str(payload.get("new_password") or "")
    confirm_password = str(payload.get("confirm_password") or "")

    if not current_password or not new_password:
        return jsonify({"error": "Current and new password are required"}), 400
    if new_password != confirm_password:
        return jsonify({"error": "New passwords do not match"}), 400
    pw_err = _validate_password(new_password)
    if pw_err:
        return jsonify({"error": pw_err}), 400

    db = SessionLocal()
    try:
        try:
            user = _require_user(db)
        except PermissionError:
            return jsonify({"error": "Not authenticated"}), 401
        if not argon2.verify(current_password, user.password_hash):
            return jsonify({"error": "Current password is incorrect"}), 401
        user.password_hash = argon2.hash(new_password)
        db.commit()
        return jsonify({"ok": True}), 200
    finally:
        db.close()


@api_bp.route("/auth/verify-email", methods=["POST"])
@limiter.limit("10 per minute")
def auth_verify_email():
    payload = request.get_json(silent=True) or {}
    email_raw = str(payload.get("email") or "").strip()
    code = str(payload.get("code") or "").strip()
    if not email_raw or not _validate_code(code):
        return jsonify({"error": "Email and 6-digit code are required"}), 400
    try:
        email = validate_email(email_raw, check_deliverability=False).normalized
    except EmailNotValidError:
        return jsonify({"error": "Email and 6-digit code are required"}), 400

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return jsonify({"error": "Invalid verification code"}), 400
        if getattr(user, "email_verified_at", None):
            return jsonify({"ok": True}), 200
        expires = getattr(user, "email_verification_code_expires_at", None)
        if not expires or expires < datetime.now(tz=timezone.utc):
            return jsonify({"error": "Verification code expired"}), 400
        nonce = str(getattr(user, "email_verification_nonce", "") or "")
        expected = str(getattr(user, "email_verification_code_hash", "") or "")
        if not nonce or not expected:
            return jsonify({"error": "Verification code expired"}), 400
        provided = _hash_code(purpose="verify", email=user.email, code=code, nonce=nonce)
        if not hmac.compare_digest(provided, expected):
            return jsonify({"error": "Invalid verification code"}), 400
        user.email_verified_at = datetime.now(tz=timezone.utc)
        user.email_verification_nonce = secrets.token_hex(16)
        user.email_verification_code_hash = None
        user.email_verification_code_expires_at = None
        db.commit()
        return jsonify({"ok": True}), 200
    finally:
        db.close()


@api_bp.route("/auth/resend-verification", methods=["POST"])
@limiter.limit("5 per minute")
def auth_resend_verification():
    payload = request.get_json(silent=True) or {}
    email_raw = str(payload.get("email") or "").strip()
    if not email_raw:
        return jsonify({"ok": True}), 200
    try:
        email = validate_email(email_raw, check_deliverability=False).normalized
    except EmailNotValidError:
        return jsonify({"ok": True}), 200

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user or getattr(user, "deleted_at", None) or getattr(user, "is_active", True) is False:
            return jsonify({"ok": True}), 200
        if getattr(user, "email_verified_at", None):
            return jsonify({"ok": True}), 200
        try:
            _issue_email_verification_code(db, user)
        except Exception:
            pass
        return jsonify({"ok": True}), 200
    finally:
        db.close()


@api_bp.route("/auth/forgot-password", methods=["POST"])
@limiter.limit("5 per minute")
def auth_forgot_password():
    payload = request.get_json(silent=True) or {}
    email_raw = str(payload.get("email") or "").strip()
    if not email_raw:
        # Avoid user enumeration; same response shape.
        return jsonify({"ok": True}), 200
    try:
        email = validate_email(email_raw, check_deliverability=False).normalized
    except EmailNotValidError:
        return jsonify({"ok": True}), 200

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user or getattr(user, "deleted_at", None) or getattr(user, "is_active", True) is False:
            return jsonify({"ok": True}), 200
        nonce = getattr(user, "password_reset_nonce", None) or secrets.token_hex(16)
        user.password_reset_nonce = nonce
        code = _generate_6_digit_code()
        user.password_reset_code_hash = _hash_code(purpose="reset", email=user.email, code=code, nonce=nonce)
        user.password_reset_code_expires_at = datetime.now(tz=timezone.utc) + timedelta(minutes=15)
        db.commit()

        tpl = reset_password_email(name=user.full_name or "", code=code)
        send_email_async(to_email=user.email, subject=tpl.subject, html=tpl.html, text=tpl.text)
        return jsonify({"ok": True}), 200
    finally:
        db.close()


@api_bp.route("/auth/verify-reset-code", methods=["POST"])
@limiter.limit("10 per minute")
def auth_verify_reset_code():
    payload = request.get_json(silent=True) or {}
    email_raw = str(payload.get("email") or "").strip()
    code = str(payload.get("code") or "").strip()
    if not email_raw or not _validate_code(code):
        return jsonify({"error": "Email and 6-digit code are required"}), 400
    try:
        email = validate_email(email_raw, check_deliverability=False).normalized
    except EmailNotValidError:
        return jsonify({"error": "Email and 6-digit code are required"}), 400

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        code_err = _check_password_reset_code(user, code)
        if code_err:
            return jsonify({"error": code_err}), 400
        return jsonify({"ok": True}), 200
    finally:
        db.close()


@api_bp.route("/auth/reset-password", methods=["POST"])
@limiter.limit("5 per minute")
def auth_reset_password():
    payload = request.get_json(silent=True) or {}
    email_raw = str(payload.get("email") or "").strip()
    code = str(payload.get("code") or "").strip()
    password = str(payload.get("password") or "")
    pw_err = _validate_password(password)
    if pw_err:
        return jsonify({"error": pw_err}), 400
    if not email_raw or not _validate_code(code):
        return jsonify({"error": "Email and 6-digit code are required"}), 400
    try:
        email = validate_email(email_raw, check_deliverability=False).normalized
    except EmailNotValidError:
        return jsonify({"error": "Email and 6-digit code are required"}), 400

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        code_err = _check_password_reset_code(user, code)
        if code_err:
            return jsonify({"error": code_err}), 400
        user.password_hash = argon2.hash(password)
        user.password_reset_nonce = secrets.token_hex(16)
        user.password_reset_code_hash = None
        user.password_reset_code_expires_at = None
        db.commit()
        # Best-effort: log user out everywhere by clearing session.
        session.pop("user_id", None)
        return jsonify({"ok": True}), 200
    finally:
        db.close()

