"""
Auth routes for the /api blueprint.

Populated incrementally during the api.py split.
"""

import hashlib
import hmac
import logging
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

from email_validator import EmailNotValidError, validate_email
from flask import current_app, jsonify, redirect, request, session
from passlib.hash import argon2
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import load_only

from ...database import SessionLocal
from ...models import Role, User, UserRole
from ...services.auth_account import (
    access_block_reason,
    azure_sso_configured,
    enterprise_domains,
    is_enterprise_email,

)
from ...services.enterprise_auth import complete_enterprise_login, start_enterprise_login
from ...services.rbac import normalize_role_name
from ...services.emailer import send_email_async, smtp_is_configured
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


def _email_verification_enabled() -> bool:
    return bool(current_app.config.get("REQUIRE_EMAIL_VERIFICATION"))


def _password_reset_enabled() -> bool:
    # OTP reset is tied to the same flag for now; re-enable both via REQUIRE_EMAIL_VERIFICATION=true.
    return _email_verification_enabled()


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


def _login_response(db, user: User):
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
        jsonify(
            {
                "csrf": csrf,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "role": user.role,
                    "permissions": perms,
                    "account_type": getattr(user, "account_type", None),
                },
            }
        ),
        200,
    )


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
    if smtp_is_configured():
        send_email_async(to_email=user.email, subject=tpl.subject, html=tpl.html, text=tpl.text)
    else:
        logger.warning(
            "SMTP not configured; verification email not sent to=%s. "
            "Set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL in .env (or Vercel env).",
            user.email,
        )
        if os.getenv("APP_ENV", "development").strip().lower() == "development":
            logger.warning("DEV ONLY — verification code for %s: %s", user.email, code)


@api_bp.route("/auth/config", methods=["GET"])
def auth_config():
    return jsonify(
        {
            "enterprise_sso_enabled": azure_sso_configured(),
            "external_signup_enabled": bool(current_app.config.get("EXTERNAL_SIGNUP_ENABLED")),
            "enterprise_domains": enterprise_domains(),
        }
    )


@api_bp.route("/auth/enterprise/login", methods=["GET"])
@limiter.limit("20 per minute")
def auth_enterprise_login():
    try:
        url = start_enterprise_login()
        return redirect(url)
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 503
    except Exception:
        logger.exception("Enterprise login redirect failed")
        return jsonify({"error": "Enterprise sign-in failed. Please try again."}), 500


@api_bp.route("/auth/enterprise/callback", methods=["GET"])
@limiter.limit("20 per minute")
def auth_enterprise_callback():
    err = request.args.get("error_description") or request.args.get("error")
    if err:
        front = current_app.config.get("FRONTEND_BASE_URL", "/")
        return redirect(f"{front}/?enterprise_error={err}")
    code = request.args.get("code") or ""
    state = request.args.get("state") or ""
    if not code:
        return jsonify({"error": "Missing authorization code"}), 400
    try:
        user = complete_enterprise_login(code, state)
    except ValueError as e:
        front = current_app.config.get("FRONTEND_BASE_URL", "/")
        return redirect(f"{front}/?enterprise_error={e}")
    except Exception:
        logger.exception("Enterprise OAuth callback failed")
        front = current_app.config.get("FRONTEND_BASE_URL", "/")
        return redirect(f"{front}/?enterprise_error=sign_in_failed")

    db = SessionLocal()
    try:
        session.clear()
        session["user_id"] = user.id
        _ensure_csrf()
        session.permanent = True
        user.last_login_at = datetime.now(tz=timezone.utc)
        db.merge(user)
        db.commit()
    finally:
        db.close()
    front = current_app.config.get("FRONTEND_BASE_URL", "/")
    return redirect(f"{front}/?enterprise_signed_in=1")


@api_bp.route("/auth/me", methods=["GET"])
def auth_me():
    db = SessionLocal()
    try:
        user = _current_user(db)
        if not user:
            return jsonify({"authenticated": False}), 200
        if _email_verification_enabled() and not getattr(user, "email_verified_at", None):
            return jsonify({"authenticated": False, "error": "Email not verified"}), 401
        blocked = access_block_reason(user)
        if blocked:
            return jsonify({"authenticated": False, "error": blocked}), 401
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
    if not current_app.config.get("EXTERNAL_SIGNUP_ENABLED"):
        return jsonify({"error": "External signup is disabled"}), 403

    payload = request.get_json(silent=True) or {}
    email_raw = str(payload.get("email") or "").strip()
    full_name = str(payload.get("name") or "").strip() or None
    password = str(payload.get("password") or "")
    account_type = str(payload.get("account_type") or "external").strip().lower()
    if account_type != "external":
        return jsonify({"error": "Invalid signup path"}), 400

    if not email_raw:
        return jsonify({"error": "Email is required"}), 400
    try:
        email = validate_email(email_raw, check_deliverability=False).normalized
    except EmailNotValidError:
        return jsonify({"error": "Email is invalid"}), 400
    if is_enterprise_email(email):
        return (
            jsonify(
                {
                    "error": "Use “I have an Enterprise email” to sign in with your work account.",
                }
            ),
            400,
        )
    pw_err = _validate_password(password)
    if pw_err:
        return jsonify({"error": pw_err}), 400

    db = SessionLocal()
    try:
        exists = db.query(User.id).filter(User.email == email).first()
        if exists:
            return jsonify({"error": "Account already exists"}), 409

        now = datetime.now(tz=timezone.utc)
        role_name = "agent"
        user = User(
            email=email,
            password_hash=argon2.hash(password),
            full_name=full_name,
            role=role_name,
            account_type="external",
            auth_provider="local",
            approved_at=None,
            is_active=False,
            email_verification_nonce=secrets.token_hex(16),
            password_reset_nonce=secrets.token_hex(16),
            email_verified_at=now,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        try:
            tpl = welcome_email(name=user.full_name or "", email=user.email)
            send_email_async(to_email=user.email, subject=tpl.subject, html=tpl.html, text=tpl.text)
        except Exception:
            pass

        return (
            jsonify(
                {
                    "ok": True,
                    "email": user.email,
                    "pending_approval": True,
                    "message": "Your request was submitted. An administrator will approve your access.",
                }
            ),
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
                        User.account_type,
                        User.auth_provider,
                        User.approved_at,
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
        if getattr(user, "auth_provider", None) == "azure_ad":
            return (
                jsonify(
                    {
                        "error": "This account uses Enterprise sign-in. Click “I have an Enterprise email”.",
                    }
                ),
                403,
            )
        blocked = access_block_reason(user)
        if blocked:
            return jsonify({"error": blocked}), 403
        if _email_verification_enabled() and not getattr(user, "email_verified_at", None):
            return (
                jsonify(
                    {
                        "error": "Please verify your email before signing in.",
                        "needs_email_verification": True,
                    }
                ),
                403,
            )
        if not user.password_hash:
            return jsonify({"error": "This account cannot sign in with a password."}), 403
        try:
            password_ok = argon2.verify(password, user.password_hash)
        except Exception:
            logger.exception("Login failed: password verification error for %s", email)
            return jsonify({"error": "Incorrect password"}), 401
        if not password_ok:
            return jsonify({"error": "Incorrect password"}), 401

        return _login_response(db, user)
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
        if getattr(user, "auth_provider", None) == "azure_ad":
            return jsonify({"error": "Enterprise accounts cannot change password here."}), 400
        if not user.password_hash or not argon2.verify(current_password, user.password_hash):
            return jsonify({"error": "Current password is incorrect"}), 401
        user.password_hash = argon2.hash(new_password)
        db.commit()
        return jsonify({"ok": True}), 200
    finally:
        db.close()


@api_bp.route("/auth/verify-email", methods=["POST"])
@limiter.limit("10 per minute")
def auth_verify_email():
    if not _email_verification_enabled():
        return jsonify({"error": "Email verification is disabled"}), 410
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
    if not _email_verification_enabled():
        return jsonify({"error": "Email verification is disabled"}), 410
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
    if not _password_reset_enabled():
        return jsonify({"error": "Password reset is temporarily disabled. Contact an administrator."}), 503
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
    if not _password_reset_enabled():
        return jsonify({"error": "Password reset is temporarily disabled. Contact an administrator."}), 503
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
    if not _password_reset_enabled():
        return jsonify({"error": "Password reset is temporarily disabled. Contact an administrator."}), 503
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

