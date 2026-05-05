"""
Auth routes for the /api blueprint.

Populated incrementally during the api.py split.
"""

from flask import jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from ...database import SessionLocal
from ...models import Role, User, UserRole
from ...services.rbac import normalize_role_name
from . import api_bp
from ._helpers import _current_user, _require_user, _user_permission_keys


@api_bp.route("/auth/me", methods=["GET"])
def auth_me():
    db = SessionLocal()
    try:
        user = _current_user(db)
        if not user:
            return jsonify({"authenticated": False}), 200
        perms = sorted(_user_permission_keys(db, user.id))
        return jsonify(
            {
                "authenticated": True,
                "user": {"id": user.id, "email": user.email, "role": user.role, "permissions": perms},
            }
        )
    finally:
        db.close()


@api_bp.route("/auth/signup", methods=["POST"])
def auth_signup():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email") or "").strip().lower()
    password = str(payload.get("password") or "")
    role = str(payload.get("role") or "").strip() or None
    role_name = normalize_role_name(role) or "agent"

    if not email:
        return jsonify({"error": "Email is required"}), 400
    if not password or len(password) < 12:
        return jsonify({"error": "Password must be at least 12 characters"}), 400

    db = SessionLocal()
    try:
        exists = db.query(User.id).filter(User.email == email).first()
        if exists:
            return jsonify({"error": "Account already exists"}), 409

        user = User(
            email=email,
            password_hash=generate_password_hash(password),
            role=role_name,
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

        session["user_id"] = user.id
        perms = sorted(_user_permission_keys(db, user.id))
        return jsonify({"user": {"id": user.id, "email": user.email, "role": user.role, "permissions": perms}}), 201
    finally:
        db.close()


@api_bp.route("/auth/login", methods=["POST"])
def auth_login():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email") or "").strip().lower()
    password = str(payload.get("password") or "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return jsonify({"error": "No account found"}), 404
        if getattr(user, "deleted_at", None):
            return jsonify({"error": "No account found"}), 404
        if getattr(user, "is_active", True) is False:
            return jsonify({"error": "Account is suspended"}), 403
        if not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Incorrect password"}), 401

        session["user_id"] = user.id
        perms = sorted(_user_permission_keys(db, user.id))
        return jsonify({"user": {"id": user.id, "email": user.email, "role": user.role, "permissions": perms}}), 200
    finally:
        db.close()


@api_bp.route("/auth/logout", methods=["POST"])
def auth_logout():
    session.pop("user_id", None)
    return jsonify({"ok": True})

