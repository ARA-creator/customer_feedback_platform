"""
Admin routes for the /api blueprint.

Moved incrementally from legacy `backend/app/routes/api.py`.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote_plus
from typing import Any, Dict, List, Optional

from flask import current_app, jsonify, make_response, request, session
from sqlalchemy import asc, desc, func, or_
from sqlalchemy import create_engine, text as sql_text
from werkzeug.security import generate_password_hash

from ...database import SessionLocal
from ...models import (
    AppSetting,
    Feedback,
    FeedbackWorkflow,
    Notification,
    Permission,
    ReportSchedule,
    Role,
    RolePermission,
    User,
    UserRole,
)
from ...security import decrypt_text
from ...sentiment_analyzer import analyze_sentiment
from ...services.insurance_tags import categorize_insurance_tags
from ...services.metadata_normalization import normalize_channel_metadata, safe_json_loads
from ...services.rbac import normalize_role_name
from . import api_bp
from ._helpers import (
    _audit_log,
    _get_setting_json,
    _notif_publish,
    _prefs_allows,
    _require_any_permission,
    _require_permission,
    _safe_json_dumps,
    _set_setting_json,
)

logger = logging.getLogger(__name__)


def _serialize_notification(row: Notification) -> Dict[str, Any]:
    return {
        "id": row.id,
        "type": row.type,
        "title": row.title,
        "body": row.body,
        "href": row.href,
        "meta": safe_json_loads(row.meta) if row.meta else {},
        "read_at": row.read_at.isoformat() if row.read_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _is_admin_ui(user: User, perms: set[str]) -> bool:
    return (
        "admin.manage_users" in perms
        or "admin.manage_roles" in perms
        or "admin.manage_integrations" in perms
        or str(getattr(user, "role", "") or "").lower() == "super_admin"
    )


def _get_notification_prefs(db, user_id: int, *, is_admin: bool) -> Dict[str, bool]:
    from ...models import NotificationPreference

    row = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
    base = safe_json_loads(row.prefs) if row and row.prefs else {}
    defaults = {
        "new_feedback": True,
        "assigned_to_me": True,
        "admin_user_events": bool(is_admin),
        "realtime": True,
        "anomaly_alerts": not bool(is_admin),
    }
    out = {**defaults}
    for k, v in (base or {}).items():
        if k in defaults:
            out[k] = bool(v)
    return out


def _notify_admins_user_roles_changed(db, *, changed_user: User, roles: List[str]) -> None:
    try:
        admin_perm_keys = ["admin.manage_users", "admin.manage_roles", "admin.manage_integrations"]
        admin_ids = set()
        rows = (
            db.query(UserRole.user_id)
            .join(Role, Role.id == UserRole.role_id)
            .join(RolePermission, RolePermission.role_id == Role.id)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .filter(Permission.key.in_(admin_perm_keys))
            .all()
        )
        for r in rows:
            if r and r[0]:
                admin_ids.add(int(r[0]))
        super_rows = db.query(User.id).filter(func.lower(User.role) == "super_admin").all()
        for r in super_rows:
            if r and r[0]:
                admin_ids.add(int(r[0]))

        created_for: List[int] = []
        for admin_id in sorted(list(admin_ids)):
            try:
                prefs = _get_notification_prefs(db, admin_id, is_admin=True)
                if not _prefs_allows(prefs, "admin_user_events"):
                    continue
                n = Notification(
                    user_id=admin_id,
                    type="admin_user_event",
                    title="User roles updated",
                    body=f"{changed_user.email}: {', '.join(roles)}",
                    href="admin_users",
                    meta=_safe_json_dumps({"user_id": changed_user.id, "email": changed_user.email, "roles": roles}),
                )
                db.add(n)
                created_for.append(admin_id)
            except Exception:
                continue
        if created_for:
            db.commit()
            for uid in created_for:
                try:
                    unread = (
                        db.query(func.count(Notification.id))
                        .filter(Notification.user_id == uid)
                        .filter(Notification.read_at.is_(None))
                        .scalar()
                        or 0
                    )
                    last = (
                        db.query(Notification)
                        .filter(Notification.user_id == uid)
                        .order_by(desc(Notification.created_at), desc(Notification.id))
                        .first()
                    )
                    _notif_publish(
                        uid,
                        {
                            "type": "notification.created",
                            "notification": _serialize_notification(last) if last else None,
                            "unread": int(unread),
                        },
                    )
                except Exception:
                    pass
    except Exception:
        logger.exception("Failed to create admin notification for role change")


def _mask_db_url(url: str) -> str:
    """
    Best-effort masking for UI display/logs.
    """
    u = (url or "").strip()
    if not u:
        return ""
    # Mask basic "scheme://user:pass@host/..." patterns
    # Keep it simple to avoid accidentally logging secrets.
    try:
        if "://" in u and "@" in u and ":" in u.split("://", 1)[1].split("@", 1)[0]:
            scheme, rest = u.split("://", 1)
            creds, after = rest.split("@", 1)
            user = creds.split(":", 1)[0]
            return f"{scheme}://{user}:***@{after}"
    except Exception:
        pass
    return u


def _build_db_url(payload: Dict[str, Any]) -> str:
    """
    Build a SQLAlchemy DB URL from user-supplied parameters.

    Supported:
      - mysql (mysql+pymysql)
      - postgres (postgresql+psycopg2)
      - sqlite (sqlite:///path or sqlite:///:memory:)

    Also accepts `url` in payload to use directly.
    """
    raw = str(payload.get("url") or "").strip()
    if raw:
        return raw

    dialect = str(payload.get("dialect") or "").strip().lower()
    driver = str(payload.get("driver") or "").strip().lower()

    if dialect in {"sqlite"}:
        path = str(payload.get("path") or "").strip()
        if path in {":memory:", "memory"}:
            return "sqlite:///:memory:"
        if not path:
            # Prefer in-memory sqlite when no path is provided, to avoid
            # creating stateful DB files on disk (especially in serverless).
            return "sqlite:///:memory:"
        if path.startswith("sqlite:"):
            return path
        # allow relative file paths
        if path.startswith("/"):
            return f"sqlite:///{path}"
        return f"sqlite:///{path}"

    host = str(payload.get("host") or "").strip()
    database = str(payload.get("database") or "").strip()
    username = str(payload.get("username") or "").strip()
    password = str(payload.get("password") or "")
    port = payload.get("port")
    port_s = str(port).strip() if port is not None and str(port).strip() != "" else ""

    if dialect in {"mysql"}:
        # Default driver commonly used with SQLAlchemy
        d = "mysql+pymysql" if not driver else f"mysql+{driver}"
    elif dialect in {"postgres", "postgresql"}:
        d = "postgresql+psycopg2" if not driver else f"postgresql+{driver}"
    else:
        raise ValueError("Unsupported dialect")

    if not host or not database:
        raise ValueError("host and database are required")

    auth = ""
    if username:
        auth = quote_plus(username)
        if password:
            auth = f"{auth}:{quote_plus(password)}"
        auth = f"{auth}@"

    port_part = f":{port_s}" if port_s else ""
    # Optional query params as dict -> "?k=v&..."
    params = payload.get("params")
    qs = ""
    if isinstance(params, dict) and params:
        parts = []
        for k, v in params.items():
            kk = str(k).strip()
            if not kk:
                continue
            parts.append(f"{quote_plus(kk)}={quote_plus(str(v))}")
        if parts:
            qs = "?" + "&".join(parts)

    return f"{d}://{auth}{host}{port_part}/{database}{qs}"


def _write_env_database_url(database_url: str) -> None:
    """
    Persist DATABASE_URL into the repo-root `.env` file so it takes effect on restart.
    """
    from ...core.config import PROJECT_ROOT

    env_path = Path(PROJECT_ROOT) / ".env"
    existing = ""
    if env_path.exists():
        existing = env_path.read_text(encoding="utf-8")

    lines = existing.splitlines() if existing else []
    out: List[str] = []
    replaced = False
    for line in lines:
        if line.strip().startswith("DATABASE_URL="):
            out.append(f"DATABASE_URL={database_url}")
            replaced = True
        else:
            out.append(line)
    if not replaced:
        if out and out[-1].strip() != "":
            out.append("")
        out.append(f"DATABASE_URL={database_url}")
    env_path.write_text("\n".join(out) + "\n", encoding="utf-8")


@api_bp.route("/admin/approval-queue", methods=["GET"])
def admin_approval_queue():
    return jsonify({"error": "Approvals have been removed in the streamlined platform."}), 410


@api_bp.route("/admin/scoring-config", methods=["GET", "POST"])
def admin_scoring_config():
    return jsonify({"error": "Scoring configuration has been removed in the streamlined platform."}), 410


@api_bp.route("/admin/permissions", methods=["GET"])
def admin_permissions():
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_roles")
        rows = db.query(Permission).order_by(Permission.key.asc(), Permission.id.asc()).all()
        return jsonify({"permissions": [{"id": p.id, "key": p.key, "description": p.description} for p in rows]})
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/admin/db/config", methods=["GET"])
def admin_db_config():
    """
    Returns the currently configured DB URL (masked).
    """
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_integrations")
        # Prefer env/config, fall back to saved setting (if any)
        from ...core.config import get_config

        cfg = get_config()
        current = str(getattr(cfg, "SQLALCHEMY_DATABASE_URI", "") or "").strip()
        saved = _get_setting_json(db, "db.database_url", None)
        return jsonify(
            {
                "current_database_url_masked": _mask_db_url(current),
                "saved_database_url_masked": _mask_db_url(str(saved or "")),
                "note": "Saved DATABASE_URL takes effect after server restart.",
            }
        )
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/admin/db/test", methods=["POST"])
def admin_db_test_connection():
    """
    Test a database connection using provided parameters.
    Does NOT save anything.
    """
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_integrations")
        payload = request.get_json(silent=True) or {}
        try:
            url = _build_db_url(payload)
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 400

        timeout_s = payload.get("connect_timeout_seconds")
        try:
            timeout_i = int(timeout_s) if timeout_s is not None else 5
        except Exception:
            timeout_i = 5
        timeout_i = max(1, min(timeout_i, 20))

        try:
            engine = create_engine(url, pool_pre_ping=True, pool_recycle=1800, connect_args={})
            with engine.connect() as conn:
                conn.execute(sql_text("SELECT 1"))
            return jsonify({"ok": True, "database_url_masked": _mask_db_url(url), "connect_timeout_seconds": timeout_i})
        except Exception as e:
            return jsonify({"ok": False, "database_url_masked": _mask_db_url(url), "error": str(e)}), 400
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/admin/db/save", methods=["POST"])
def admin_db_save_connection():
    """
    Save DATABASE_URL after a successful test.

    Note: changing the app's *primary* DB requires a server restart.
    """
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_integrations")
        payload = request.get_json(silent=True) or {}
        try:
            url = _build_db_url(payload)
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 400

        # Always test first (server-side), then persist
        try:
            engine = create_engine(url, pool_pre_ping=True, pool_recycle=1800, connect_args={})
            with engine.connect() as conn:
                conn.execute(sql_text("SELECT 1"))
        except Exception as e:
            return jsonify({"ok": False, "database_url_masked": _mask_db_url(url), "error": f"Test failed: {e}"}), 400

        # Save into AppSetting (audit trail / UI readback)
        _set_setting_json(db, "db.database_url", url)
        _audit_log(
            db,
            actor_user_id=session.get("user_id"),
            action="admin.db.save",
            target_type="app_setting",
            target_id="db.database_url",
            meta={"database_url_masked": _mask_db_url(url)},
        )

        # Also write to .env so it takes effect on restart
        try:
            _write_env_database_url(url)
        except Exception as e:
            # Still saved in AppSetting; env write is best-effort
            logger.exception("Failed to write DATABASE_URL to .env")
            return jsonify(
                {
                    "ok": True,
                    "database_url_masked": _mask_db_url(url),
                    "saved": True,
                    "restart_required": True,
                    "warning": f"Saved, but failed to write .env: {e}",
                }
            )

        return jsonify(
            {
                "ok": True,
                "database_url_masked": _mask_db_url(url),
                "saved": True,
                "restart_required": True,
            }
        )
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/admin/auth/enterprise", methods=["GET"])
def admin_enterprise_auth_get():
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_integrations")
        from ...services.enterprise_sso_config import admin_public_view

        return jsonify(admin_public_view())
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/admin/auth/enterprise/test", methods=["POST"])
def admin_enterprise_auth_test():
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_integrations")
        from ...services.enterprise_sso_config import get_effective_azure_config, test_azure_connection

        payload = request.get_json(silent=True) or {}
        effective = get_effective_azure_config()

        tenant_id = str(payload.get("tenant_id") or effective.get("tenant_id") or "").strip()
        client_id = str(payload.get("client_id") or effective.get("client_id") or "").strip()
        client_secret = payload.get("client_secret")
        if isinstance(client_secret, str) and not client_secret.strip():
            client_secret = None
        elif not isinstance(client_secret, str):
            client_secret = effective.get("client_secret")

        result = test_azure_connection(tenant_id, client_id, client_secret)
        status = 200 if result.get("ok") else 400
        return jsonify(result), status
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/admin/auth/enterprise", methods=["POST"])
def admin_enterprise_auth_save():
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_integrations")
        from ...services.enterprise_sso_config import admin_public_view, save_admin_config

        payload = request.get_json(silent=True) or {}
        actor_id = session.get("user_id")
        try:
            actor_id = int(actor_id) if actor_id is not None else None
        except (TypeError, ValueError):
            actor_id = None

        view = save_admin_config(payload, actor_user_id=actor_id)
        _audit_log(
            db,
            actor_user_id=actor_id,
            action="admin.auth.enterprise.save",
            target_type="app_setting",
            target_id="auth.enterprise_sso",
            meta={
                "tenant_id": view.get("tenant_id"),
                "client_id": view.get("client_id"),
                "configured": view.get("configured"),
            },
        )
        return jsonify({"ok": True, **view})
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/admin/reprocess-sentiment", methods=["GET", "POST"])
def admin_reprocess_sentiment():
    db = SessionLocal()
    try:
        if request.method == "GET":
            return jsonify(
                {
                    "name": "Reprocess sentiment (admin)",
                    "method": "POST",
                    "path": "/admin/reprocess-sentiment",
                    "auth": (
                        "Session with permission admin.manage_integrations, "
                        "or query param token matching env ADMIN_ACTION_TOKEN when set"
                    ),
                    "params": {
                        "range_days": "7|30|90 (optional)",
                        "limit": "default 500, max 5000",
                        "force": "true|false (default false)",
                        "dry_run": "true|false (default false)",
                        "order": "newest|oldest (default newest)",
                        "cursor_id": "integer; from prior response next_cursor for paged backfill",
                        "token": "optional ADMIN_ACTION_TOKEN (if session auth not available)",
                    },
                    "notes": (
                        "Use force=true to refresh all rows. For full history, POST with order=oldest and loop "
                        "cursor_id until done=true. Rows missing insurance_tags get tags computed and stored so "
                        "insurance-aware sentiment gating applies."
                    ),
                }
            )

        # Auth: either an admin session OR a one-off token (if configured).
        try:
            _require_permission(db, "admin.manage_integrations")
        except PermissionError:
            from ...core.config import get_config

            cfg = get_config()
            expected = str(getattr(cfg, "ADMIN_ACTION_TOKEN", "") or "").strip()
            provided = str(request.args.get("token") or "").strip()
            if not expected or provided != expected:
                raise

        range_days = request.args.get("range_days", type=int)
        limit = request.args.get("limit", type=int) or 500
        limit = max(1, min(limit, 5000))
        force = (request.args.get("force") or "").strip().lower() in {"1", "true", "yes", "on"}
        dry_run = (request.args.get("dry_run") or "").strip().lower() in {"1", "true", "yes", "on"}
        order_raw = (request.args.get("order") or "newest").strip().lower()
        order_oldest = order_raw in {"oldest", "asc", "oldest_first"}
        cursor_id = request.args.get("cursor_id", type=int)
        has_cursor_id = "cursor_id" in request.args and str(request.args.get("cursor_id", "")).strip() != ""
        if has_cursor_id and cursor_id is None:
            return jsonify({"error": "cursor_id must be an integer when provided"}), 400

        now = datetime.now(tz=timezone.utc)
        q = db.query(Feedback).filter(Feedback.deleted_at.is_(None))
        if range_days in (7, 30, 90):
            q = q.filter(Feedback.created_at >= (now - timedelta(days=range_days)))
        if not force:
            q = q.filter(or_(Feedback.sentiment_label.is_(None), Feedback.sentiment_label == ""))

        if cursor_id is not None:
            if order_oldest:
                q = q.filter(Feedback.id > cursor_id)
            else:
                q = q.filter(Feedback.id < cursor_id)

        q = q.order_by(asc(Feedback.id) if order_oldest else desc(Feedback.id))

        rows = q.limit(limit).all()
        scanned = len(rows)
        updated = 0
        skipped = 0

        for fb in rows:
            msg = ""
            try:
                msg = decrypt_text(fb.message_encrypted) or ""
            except Exception:
                skipped += 1
                continue
            msg = str(msg).strip()
            if not msg:
                skipped += 1
                continue

            meta_fb = normalize_channel_metadata(getattr(fb, "source", None), fb.channel_metadata) or {}
            raw_ins = meta_fb.get("insurance_tags")
            ins_list: Optional[List[str]] = None
            if isinstance(raw_ins, list) and len(raw_ins) > 0:
                ins_list = [str(t).strip().lower() for t in raw_ins if str(t).strip()]
            else:
                try:
                    computed = categorize_insurance_tags(msg, source=getattr(fb, "source", None))
                except Exception:
                    computed = []
                if isinstance(computed, list) and computed:
                    ins_list = [str(t).strip().lower() for t in computed if str(t).strip()]
                    if not dry_run:
                        meta_fb["insurance_tags"] = ins_list
                        fb.channel_metadata = _safe_json_dumps(meta_fb)

            sentiment = analyze_sentiment(msg, source=getattr(fb, "source", None), insurance_tags=ins_list)
            label = sentiment.get("label")
            score = sentiment.get("score")
            if label not in {"positive", "neutral", "negative"}:
                skipped += 1
                continue

            if dry_run:
                updated += 1
                continue

            fb.sentiment_label = label
            fb.sentiment_score = float(score) if score is not None else None
            updated += 1

        if not dry_run:
            db.commit()

        next_cursor = None
        done = True
        if rows and scanned == limit:
            last = rows[-1]
            more_q = db.query(Feedback.id).filter(Feedback.deleted_at.is_(None))
            if range_days in (7, 30, 90):
                more_q = more_q.filter(Feedback.created_at >= (now - timedelta(days=range_days)))
            if not force:
                more_q = more_q.filter(or_(Feedback.sentiment_label.is_(None), Feedback.sentiment_label == ""))
            more_q = more_q.filter(Feedback.id > last.id if order_oldest else Feedback.id < last.id)
            if more_q.first() is not None:
                next_cursor = {"cursor_id": last.id}
                done = False

        return jsonify(
            {
                "ok": True,
                "scanned": scanned,
                "updated": updated,
                "skipped": skipped,
                "dry_run": dry_run,
                "force": force,
                "range_days": range_days,
                "limit": limit,
                "order": "oldest" if order_oldest else "newest",
                "next_cursor": next_cursor,
                "done": done,
            }
        )
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    except Exception:
        db.rollback()
        logger.exception("Error reprocessing sentiment")
        return jsonify({"error": "Failed to reprocess sentiment"}), 500
    finally:
        db.close()


@api_bp.route("/admin/reprocess-insurance-tags", methods=["GET", "POST"])
def admin_reprocess_insurance_tags():
    """
    Admin utility: compute insurance categorization tags for existing feedback rows.

    Query params (POST recommended):
      - range_days: 7|30|90 (optional) only process recent feedback
      - limit: max rows to process (default 500, max 5000)
      - force: 1|true to recompute even if insurance_tags already set (default false)
      - dry_run: 1|true to only count affected rows without writing (default false)
      - order: newest (default) | oldest — sort direction for scanning rows (use oldest for historical backfill)
      - cursor_id: feedback id for keyset pagination; omit on first page. Next page uses the cursor_id from prior next_cursor.
    """
    db = SessionLocal()
    try:
        if request.method == "GET":
            return jsonify(
                {
                    "name": "Reprocess insurance tags (admin)",
                    "method": "POST",
                    "path": "/admin/reprocess-insurance-tags",
                    "auth": (
                        "Session with permission admin.manage_integrations, "
                        "or query param token matching env ADMIN_ACTION_TOKEN when set"
                    ),
                    "params": {
                        "range_days": "7|30|90 (optional)",
                        "limit": "default 500, max 5000",
                        "force": "true|false (default false)",
                        "dry_run": "true|false (default false)",
                        "order": "newest|oldest (default newest)",
                        "cursor_id": "integer; from prior response next_cursor (id-only keyset; stable across DB backends)",
                        "token": "optional ADMIN_ACTION_TOKEN (if session auth not available)",
                    },
                    "notes": (
                        "For full backfill of old rows, use order=oldest and loop: pass cursor_id from each "
                        "response next_cursor until done=true. Ordering is by feedback.id (asc for oldest, desc for newest)."
                    ),
                }
            )

        # Auth: either an admin session OR a one-off token (if configured).
        try:
            _require_permission(db, "admin.manage_integrations")
        except PermissionError:
            from ...core.config import get_config

            cfg = get_config()
            expected = str(getattr(cfg, "ADMIN_ACTION_TOKEN", "") or "").strip()
            provided = str(request.args.get("token") or "").strip()
            if not expected or provided != expected:
                raise

        range_days = request.args.get("range_days", type=int)
        limit = request.args.get("limit", type=int) or 500
        limit = max(1, min(limit, 5000))
        force = (request.args.get("force") or "").strip().lower() in {"1", "true", "yes", "on"}
        dry_run = (request.args.get("dry_run") or "").strip().lower() in {"1", "true", "yes", "on"}
        order_raw = (request.args.get("order") or "newest").strip().lower()
        order_oldest = order_raw in {"oldest", "asc", "oldest_first"}
        cursor_id = request.args.get("cursor_id", type=int)
        has_cursor_id = "cursor_id" in request.args and str(request.args.get("cursor_id", "")).strip() != ""
        if has_cursor_id and cursor_id is None:
            return jsonify({"error": "cursor_id must be an integer when provided"}), 400

        now = datetime.now(tz=timezone.utc)
        q = db.query(Feedback).filter(Feedback.deleted_at.is_(None))
        if range_days in (7, 30, 90):
            q = q.filter(Feedback.created_at >= (now - timedelta(days=range_days)))

        if cursor_id is not None:
            if order_oldest:
                q = q.filter(Feedback.id > cursor_id)
            else:
                q = q.filter(Feedback.id < cursor_id)

        q = q.order_by(asc(Feedback.id) if order_oldest else desc(Feedback.id))

        rows = q.limit(limit).all()
        scanned = len(rows)
        updated = 0
        skipped = 0

        for fb in rows:
            msg = ""
            try:
                msg = decrypt_text(fb.message_encrypted) or ""
            except Exception:
                skipped += 1
                continue
            msg = str(msg).strip()
            if not msg:
                skipped += 1
                continue

            meta = normalize_channel_metadata(getattr(fb, "source", None), fb.channel_metadata) or {}
            existing = meta.get("insurance_tags")
            if (not force) and isinstance(existing, list) and len(existing) > 0:
                skipped += 1
                continue

            tags = categorize_insurance_tags(msg, source=getattr(fb, "source", None))
            if not isinstance(tags, list):
                skipped += 1
                continue

            if dry_run:
                updated += 1
                continue

            meta["insurance_tags"] = tags
            fb.channel_metadata = _safe_json_dumps(meta)
            updated += 1

        if not dry_run:
            db.commit()

        next_cursor = None
        done = True
        if rows and scanned == limit:
            last = rows[-1]
            more_q = db.query(Feedback.id).filter(Feedback.deleted_at.is_(None))
            if range_days in (7, 30, 90):
                more_q = more_q.filter(Feedback.created_at >= (now - timedelta(days=range_days)))
            more_q = more_q.filter(Feedback.id > last.id if order_oldest else Feedback.id < last.id)
            if more_q.first() is not None:
                next_cursor = {"cursor_id": last.id}
                done = False

        return jsonify(
            {
                "ok": True,
                "scanned": scanned,
                "updated": updated,
                "skipped": skipped,
                "dry_run": dry_run,
                "force": force,
                "range_days": range_days,
                "limit": limit,
                "order": "oldest" if order_oldest else "newest",
                "next_cursor": next_cursor,
                "done": done,
            }
        )
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    except Exception:
        db.rollback()
        logger.exception("Error reprocessing insurance tags")
        return jsonify({"error": "Failed to reprocess insurance tags"}), 500
    finally:
        db.close()


@api_bp.route("/admin/roles", methods=["GET"])
def admin_roles():
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_roles")
        roles = db.query(Role).order_by(Role.name.asc(), Role.id.asc()).all()
        perms = db.query(Permission).all()
        perm_by_id = {p.id: p for p in perms}
        rp = db.query(RolePermission).all()

        perms_by_role: Dict[int, List[str]] = {}
        for row in rp:
            perms_by_role.setdefault(row.role_id, []).append(
                perm_by_id.get(row.permission_id).key if perm_by_id.get(row.permission_id) else ""
            )
        out = []
        for r in roles:
            keys = [k for k in sorted(perms_by_role.get(r.id, [])) if k]
            out.append(
                {
                    "id": r.id,
                    "name": r.name,
                    "description": r.description,
                    "is_system": bool(r.is_system),
                    "permission_keys": keys,
                }
            )
        return jsonify({"roles": out})
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/admin/roles/<int:role_id>/permissions", methods=["POST"])
def admin_set_role_permissions(role_id: int):
    """Replace all permission mappings for a role (full set from client)."""
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_roles")
        role = db.query(Role).filter(Role.id == role_id).first()
        if not role:
            return jsonify({"error": "Role not found"}), 404

        payload = request.get_json(silent=True) or {}
        keys_in = payload.get("permission_keys")
        if not isinstance(keys_in, list):
            return jsonify({"error": "permission_keys must be a list"}), 400

        normalized: List[str] = []
        seen: set[str] = set()
        for raw in keys_in:
            k = str(raw or "").strip().lower()
            if not k or k in seen:
                continue
            seen.add(k)
            normalized.append(k)

        found_by_key: Dict[str, Permission] = {}
        if normalized:
            rows = db.query(Permission).filter(Permission.key.in_(normalized)).all()
            found_by_key = {p.key.lower(): p for p in rows}
            missing = [k for k in normalized if k not in found_by_key]
            if missing:
                return jsonify({"error": "Unknown permission keys", "unknown": missing}), 400

        db.query(RolePermission).filter(RolePermission.role_id == role_id).delete()
        for k in normalized:
            p = found_by_key.get(k)
            if p:
                db.add(RolePermission(role_id=role_id, permission_id=p.id))
        db.commit()

        saved_keys = sorted({found_by_key[k].key for k in normalized})
        _audit_log(
            db,
            actor_user_id=session.get("user_id"),
            action="admin.role.set_permissions",
            target_type="role",
            target_id=str(role_id),
            meta={"role": role.name, "permission_keys": saved_keys},
        )
        return jsonify({"ok": True, "permission_keys": saved_keys})
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/admin/users", methods=["GET", "POST"])
def admin_users():
    db = SessionLocal()
    try:
        if request.method == "GET":
            _require_permission(db, "admin.manage_users")
            scope = (request.args.get("scope") or "active").strip().lower()
            if scope not in ("active", "recycle", "all", "pending"):
                scope = "active"
            q = db.query(User)
            if scope == "active":
                q = q.filter(User.deleted_at.is_(None)).filter(
                    or_(
                        User.account_type.is_(None),
                        User.account_type != "external",
                        User.approved_at.isnot(None),
                    )
                )
            elif scope == "pending":
                q = q.filter(
                    User.deleted_at.is_(None),
                    User.account_type == "external",
                    User.approved_at.is_(None),
                )
            elif scope == "recycle":
                q = q.filter(User.deleted_at.isnot(None))
            users = q.order_by(User.created_at.desc(), User.id.desc()).all()
            roles = db.query(Role).all()
            role_by_id = {r.id: r for r in roles}
            mappings = db.query(UserRole).all()
            role_names_by_user: Dict[int, List[str]] = {}
            scope_by_user: Dict[int, Dict[str, Optional[str]]] = {}
            for m in mappings:
                r = role_by_id.get(m.role_id)
                if r:
                    role_names_by_user.setdefault(m.user_id, []).append(r.name)
                if m.user_id not in scope_by_user:
                    scope_by_user[m.user_id] = {"team": m.team, "region": m.region}
            out = []
            for u in users:
                out.append(
                    {
                        "id": u.id,
                        "email": u.email,
                        "role": u.role,
                        "created_at": u.created_at.isoformat() if u.created_at else None,
                        "is_active": bool(getattr(u, "is_active", True)),
                        "suspended_at": (u.suspended_at.isoformat() if getattr(u, "suspended_at", None) else None),
                        "deleted_at": (u.deleted_at.isoformat() if getattr(u, "deleted_at", None) else None),
                        "roles": sorted(list(set(role_names_by_user.get(u.id, [])))),
                        "team": (scope_by_user.get(u.id) or {}).get("team"),
                        "region": (scope_by_user.get(u.id) or {}).get("region"),
                        "account_type": getattr(u, "account_type", None),
                        "auth_provider": getattr(u, "auth_provider", None),
                        "approved_at": (
                            u.approved_at.isoformat() if getattr(u, "approved_at", None) else None
                        ),
                        "full_name": getattr(u, "full_name", None),
                        "pending_approval": (
                            getattr(u, "account_type", None) == "external"
                            and getattr(u, "approved_at", None) is None
                            and getattr(u, "deleted_at", None) is None
                        ),
                    }
                )
            return jsonify({"users": out})

        # POST create user
        _require_permission(db, "admin.manage_users")
        payload = request.get_json(silent=True) or {}
        email = str(payload.get("email") or "").strip().lower()
        password = str(payload.get("password") or "")
        roles_in = payload.get("roles") or []
        if isinstance(roles_in, str):
            roles_in = [r.strip() for r in roles_in.split(",") if r.strip()]
        if not isinstance(roles_in, list):
            roles_in = []

        if not email:
            return jsonify({"error": "Email is required"}), 400
        if not password or len(password) < 12:
            return jsonify({"error": "Password must be at least 12 characters"}), 400
        exists = db.query(User.id).filter(User.email == email).first()
        if exists:
            return jsonify({"error": "Account already exists"}), 409

        primary_role = (
            normalize_role_name(str(payload.get("primary_role") or ""))
            or (normalize_role_name(roles_in[0]) if roles_in else None)
            or "agent"
        )
        verify_required = bool(current_app.config.get("REQUIRE_EMAIL_VERIFICATION"))
        now = datetime.now(tz=timezone.utc)
        user = User(
            email=email,
            password_hash=generate_password_hash(password),
            role=primary_role,
            account_type="enterprise",
            auth_provider="local",
            approved_at=now,
            is_active=True,
            email_verified_at=None if verify_required else now,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        role_rows = (
            db.query(Role).filter(Role.name.in_([normalize_role_name(r) for r in roles_in if r])).all() if roles_in else []
        )
        for r in role_rows:
            db.add(UserRole(user_id=user.id, role_id=r.id))
        db.commit()

        _audit_log(
            db,
            actor_user_id=session.get("user_id"),
            action="admin.user.create",
            target_type="user",
            target_id=str(user.id),
            meta={"email": email, "roles": [r.name for r in role_rows] if role_rows else []},
        )

        # Admin notifications (best-effort): new user created
        try:
            admin_perm_keys = ["admin.manage_users", "admin.manage_roles", "admin.manage_integrations"]
            admin_ids = set()
            rows = (
                db.query(UserRole.user_id)
                .join(Role, Role.id == UserRole.role_id)
                .join(RolePermission, RolePermission.role_id == Role.id)
                .join(Permission, Permission.id == RolePermission.permission_id)
                .filter(Permission.key.in_(admin_perm_keys))
                .all()
            )
            for r in rows:
                if r and r[0]:
                    admin_ids.add(int(r[0]))
            super_rows = db.query(User.id).filter(func.lower(User.role) == "super_admin").all()
            for r in super_rows:
                if r and r[0]:
                    admin_ids.add(int(r[0]))

            created_for: List[int] = []
            for admin_id in sorted(list(admin_ids)):
                try:
                    prefs = _get_notification_prefs(db, admin_id, is_admin=True)
                    if not _prefs_allows(prefs, "admin_user_events"):
                        continue
                    n = Notification(
                        user_id=admin_id,
                        type="admin_user_event",
                        title="New user created",
                        body=f"{email}",
                        href="admin_users",
                        meta=_safe_json_dumps({"user_id": user.id, "email": email}),
                    )
                    db.add(n)
                    created_for.append(admin_id)
                except Exception:
                    continue
            if created_for:
                db.commit()
                for uid in created_for:
                    try:
                        unread = (
                            db.query(func.count(Notification.id))
                            .filter(Notification.user_id == uid)
                            .filter(Notification.read_at.is_(None))
                            .scalar()
                            or 0
                        )
                        last = (
                            db.query(Notification)
                            .filter(Notification.user_id == uid)
                            .order_by(desc(Notification.created_at), desc(Notification.id))
                            .first()
                        )
                        _notif_publish(
                            uid,
                            {
                                "type": "notification.created",
                                "notification": _serialize_notification(last) if last else None,
                                "unread": int(unread),
                            },
                        )
                    except Exception:
                        pass
        except Exception:
            logger.exception("Failed to create admin notification for user create")

        return jsonify({"user": {"id": user.id, "email": user.email, "role": user.role}}), 201
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/admin/users/<int:user_id>/roles", methods=["POST"])
def admin_set_user_roles(user_id: int):
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_users")
        payload = request.get_json(silent=True) or {}
        roles_in = payload.get("roles") or []
        if isinstance(roles_in, str):
            roles_in = [r.strip() for r in roles_in.split(",") if r.strip()]
        if not isinstance(roles_in, list):
            return jsonify({"error": "roles must be a list"}), 400

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return jsonify({"error": "User not found"}), 404
        if getattr(user, "deleted_at", None):
            return jsonify({"error": "User is in the recycle bin; restore before changing roles"}), 400

        role_names = [normalize_role_name(r) for r in roles_in if r]
        role_rows = db.query(Role).filter(Role.name.in_(role_names)).all()
        role_ids = {r.id for r in role_rows}

        db.query(UserRole).filter(UserRole.user_id == user_id).delete()
        for rid in role_ids:
            db.add(UserRole(user_id=user_id, role_id=rid))
        db.commit()

        user.role = (role_rows[0].name if role_rows else user.role) or user.role
        db.commit()

        _audit_log(
            db,
            actor_user_id=session.get("user_id"),
            action="admin.user.set_roles",
            target_type="user",
            target_id=str(user_id),
            meta={"roles": [r.name for r in role_rows]},
        )
        try:
            _notify_admins_user_roles_changed(db, changed_user=user, roles=[r.name for r in role_rows])
        except Exception:
            pass
        return jsonify({"ok": True, "roles": [r.name for r in role_rows]})
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/admin/users/<int:user_id>/status", methods=["POST"])
def admin_set_user_status(user_id: int):
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_users")
        payload = request.get_json(silent=True) or {}
        is_active = payload.get("is_active")
        if not isinstance(is_active, bool):
            return jsonify({"error": "is_active must be a boolean"}), 400

        user = db.query(User).filter(User.id == user_id).first()
        if not user or getattr(user, "deleted_at", None):
            return jsonify({"error": "User not found"}), 404

        user.is_active = bool(is_active)
        user.suspended_at = None if is_active else datetime.now(tz=timezone.utc)
        db.commit()

        _audit_log(
            db,
            actor_user_id=session.get("user_id"),
            action="admin.user.set_status",
            target_type="user",
            target_id=str(user_id),
            meta={"is_active": bool(is_active)},
        )
        return jsonify(
            {
                "ok": True,
                "user": {
                    "id": user.id,
                    "is_active": bool(user.is_active),
                    "suspended_at": user.suspended_at.isoformat() if user.suspended_at else None,
                },
            }
        )
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/admin/users/<int:user_id>/approve", methods=["POST"])
def admin_approve_user(user_id: int):
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_users")
        user = db.query(User).filter(User.id == user_id).first()
        if not user or getattr(user, "deleted_at", None):
            return jsonify({"error": "User not found"}), 404
        if getattr(user, "account_type", None) != "external":
            return jsonify({"error": "Only external accounts require approval"}), 400
        if getattr(user, "approved_at", None):
            return jsonify({"ok": True, "message": "Already approved"}), 200

        payload = request.get_json(silent=True) or {}
        roles_in = payload.get("roles") or []
        if isinstance(roles_in, str):
            roles_in = [r.strip() for r in roles_in.split(",") if r.strip()]
        if not isinstance(roles_in, list):
            roles_in = []
        primary_role = (
            normalize_role_name(str(payload.get("primary_role") or ""))
            or (normalize_role_name(roles_in[0]) if roles_in else None)
            or "agent"
        )

        now = datetime.now(tz=timezone.utc)
        user.approved_at = now
        user.is_active = True
        user.role = primary_role
        user.email_verified_at = user.email_verified_at or now
        db.commit()

        db.query(UserRole).filter(UserRole.user_id == user_id).delete()
        role_rows = (
            db.query(Role).filter(Role.name.in_([normalize_role_name(r) for r in roles_in if r])).all()
            if roles_in
            else db.query(Role).filter(Role.name == primary_role).all()
        )
        for r in role_rows:
            db.add(UserRole(user_id=user_id, role_id=r.id))
        if not role_rows:
            r = db.query(Role).filter(Role.name == primary_role).first()
            if r:
                db.add(UserRole(user_id=user_id, role_id=r.id))
        db.commit()

        _audit_log(
            db,
            actor_user_id=session.get("user_id"),
            action="admin.user.approve",
            target_type="user",
            target_id=str(user_id),
            meta={"email": user.email, "roles": [r.name for r in role_rows] if role_rows else [primary_role]},
        )
        return jsonify({"ok": True}), 200
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/admin/users/<int:user_id>/reject", methods=["POST"])
def admin_reject_user(user_id: int):
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_users")
        user = db.query(User).filter(User.id == user_id).first()
        if not user or getattr(user, "deleted_at", None):
            return jsonify({"error": "User not found"}), 404
        if getattr(user, "account_type", None) != "external":
            return jsonify({"error": "Only external accounts can be rejected this way"}), 400

        payload = request.get_json(silent=True) or {}
        reason = str(payload.get("reason") or "").strip() or None
        user.deleted_at = datetime.now(tz=timezone.utc)
        user.is_active = False
        user.suspended_at = user.suspended_at or user.deleted_at
        db.commit()

        _audit_log(
            db,
            actor_user_id=session.get("user_id"),
            action="admin.user.reject",
            target_type="user",
            target_id=str(user_id),
            meta={"email": user.email, "reason": reason},
        )
        return jsonify({"ok": True}), 200
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/admin/users/<int:user_id>", methods=["DELETE"])
def admin_delete_user(user_id: int):
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_users")
        user = db.query(User).filter(User.id == user_id).first()
        if not user or getattr(user, "deleted_at", None):
            return jsonify({"error": "User not found"}), 404

        user.deleted_at = datetime.now(tz=timezone.utc)
        user.is_active = False
        user.suspended_at = user.suspended_at or user.deleted_at
        db.commit()

        _audit_log(
            db,
            actor_user_id=session.get("user_id"),
            action="admin.user.delete",
            target_type="user",
            target_id=str(user_id),
            meta={"email": user.email},
        )
        return jsonify({"ok": True})
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/admin/users/<int:user_id>/restore", methods=["POST"])
def admin_restore_user(user_id: int):
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_users")
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not getattr(user, "deleted_at", None):
            return jsonify({"error": "User not found or not in recycle bin"}), 404

        user.deleted_at = None
        user.is_active = True
        user.suspended_at = None
        db.commit()

        _audit_log(
            db,
            actor_user_id=session.get("user_id"),
            action="admin.user.restore",
            target_type="user",
            target_id=str(user_id),
            meta={"email": user.email},
        )
        return jsonify({"ok": True})
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/admin/users/<int:user_id>/purge", methods=["POST"])
def admin_purge_user(user_id: int):
    """Permanently delete a user that is already in the recycle bin (soft-deleted)."""
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_users")
        actor_id = session.get("user_id")
        if actor_id and int(actor_id) == int(user_id):
            return jsonify({"error": "You cannot permanently delete your own account"}), 400

        user = db.query(User).filter(User.id == user_id).first()
        if not user or not getattr(user, "deleted_at", None):
            return jsonify({"error": "User not found or not in recycle bin"}), 404

        email = user.email
        db.query(ReportSchedule).filter(ReportSchedule.user_id == user_id).delete()
        db.query(UserRole).filter(UserRole.user_id == user_id).delete()
        db.delete(user)
        db.commit()

        _audit_log(
            db,
            actor_user_id=actor_id,
            action="admin.user.purge",
            target_type="user",
            target_id=str(user_id),
            meta={"email": email},
        )
        return jsonify({"ok": True})
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/admin/users/<int:user_id>/scope", methods=["POST"])
def admin_set_user_scope(user_id: int):
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_users")
        user = db.query(User).filter(User.id == user_id).first()
        if not user or getattr(user, "deleted_at", None):
            return jsonify({"error": "User not found"}), 404

        payload = request.get_json(silent=True) or {}
        team = (payload.get("team") or "").strip() or None
        region = (payload.get("region") or "").strip() or None

        rows = db.query(UserRole).filter(UserRole.user_id == user_id).all()
        if not rows:
            return jsonify({"error": "User has no roles assigned"}), 400
        for row in rows:
            row.team = team
            row.region = region
        db.commit()

        _audit_log(
            db,
            actor_user_id=session.get("user_id"),
            action="admin.user.set_scope",
            target_type="user",
            target_id=str(user_id),
            meta={"team": team, "region": region},
        )
        return jsonify({"ok": True, "team": team, "region": region})
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/admin/audit-logs", methods=["GET"])
def admin_audit_logs():
    return jsonify({"error": "Audit logs have been removed in the streamlined platform."}), 410


@api_bp.route("/admin/overview", methods=["GET"])
def admin_overview():
    db = SessionLocal()
    try:
        _require_any_permission(db, ["admin.manage_integrations", "admin.manage_users", "admin.manage_roles"])
        last_by_source = (
            db.query(Feedback.source, func.max(Feedback.created_at))
            .filter(Feedback.deleted_at.is_(None))
            .group_by(Feedback.source)
            .all()
        )
        ingestion = [{"source": source or "—", "last_seen_at": ts.isoformat() if ts else None} for source, ts in last_by_source]
        payload = {
            "overview_api": "v2",
            "org_health": {"ingestion": ingestion, "queue": {"open": None, "sla_breaches": None, "approval_pending": None}},
        }
        resp = make_response(jsonify(payload))
        resp.headers["Cache-Control"] = "no-store, max-age=0"
        return resp
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/admin/integrations/status", methods=["GET"])
def admin_integrations_status():
    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_integrations")
        last_by_source = (
            db.query(Feedback.source, func.max(Feedback.created_at))
            .filter(Feedback.deleted_at.is_(None))
            .group_by(Feedback.source)
            .all()
        )
        sources = []
        for source, ts in last_by_source:
            sources.append({"source": source, "last_ingested_at": ts.isoformat() if ts else None, "status": "ok" if ts else "unknown"})
        return jsonify({"sources": sources})
    except PermissionError as e:
        msg = str(e)
        return jsonify({"error": msg}), 401 if "authenticated" in msg.lower() else 403
    finally:
        db.close()


@api_bp.route("/channels/status", methods=["GET"])
def channels_status():
    """
    Lightweight channel status endpoint for the UI (admin-only).

    Only returns whether required env vars are present; never returns secrets.
    """
    from ...core.config import get_config

    cfg = get_config()

    def present(value: Any) -> bool:
        return bool(str(value or "").strip())

    db = SessionLocal()
    try:
        _require_permission(db, "admin.manage_integrations")

        def _seen_like(pattern: str) -> bool:
            return (
                db.query(Feedback.id)
                .filter(Feedback.deleted_at.is_(None))
                .filter(func.lower(Feedback.source).like(pattern))
                .first()
                is not None
            )

        whatsapp_seen = _seen_like("%whatsapp%")
        google_forms_seen = _seen_like("%google%")
        x_seen = _seen_like("%x%") or _seen_like("%twitter%")
        tiktok_seen = _seen_like("%tiktok%")
        meta_seen = _seen_like("%instagram%") or _seen_like("%facebook%")
        email_seen = _seen_like("%email%") or present(getattr(cfg, "EMAIL_USERNAME", ""))
        web_seen = _seen_like("%web%") or present(getattr(cfg, "WEB_MONITOR_ENABLED", False))
    finally:
        db.close()

    # "enabled" reflects observed ingestion (connected) rather than env vars present.
    return jsonify(
        {
            "whatsapp_twilio": {"enabled": whatsapp_seen},
            "meta": {"enabled": meta_seen},
            "x": {"enabled": x_seen, "auto_poll": bool(getattr(cfg, "X_POLL_ENABLED", False))},
            "tiktok": {"enabled": tiktok_seen, "auto_poll": bool(getattr(cfg, "TIKTOK_POLL_ENABLED", False))},
            "google_forms": {"enabled": google_forms_seen},
            "web": {"enabled": bool(web_seen)},
            "email": {"enabled": bool(email_seen)},
        }
    )


@api_bp.route("/admin/templates", methods=["GET", "POST"])
def admin_templates():
    return jsonify({"error": "Templates have been removed in the streamlined platform."}), 410


@api_bp.route("/admin/retention", methods=["GET", "POST"])
def admin_retention():
    return jsonify({"error": "Retention settings have been removed in the streamlined platform."}), 410


@api_bp.route("/admin/routing-rules", methods=["GET", "POST"])
def admin_routing_rules():
    return jsonify({"error": "Routing rules have been removed in the streamlined platform."}), 410


@api_bp.route("/admin/analytics", methods=["GET"])
def admin_analytics():
    return jsonify({"error": "Admin analytics has been removed in the streamlined platform."}), 410

