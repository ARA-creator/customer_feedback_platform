#!/usr/bin/env python3
"""
Create or update a user directly in the database (bypasses signup UI).

Usage (from repo root):
  python scripts/dev/create_user_cli.py --email user@example.com --password 'SecretPass12!' \\
    --roles cx_manager,super_admin --primary-role cx_manager
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create/update a Customer Pulse user")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--name", default="")
    parser.add_argument("--roles", default="cx_manager", help="Comma-separated role names")
    parser.add_argument("--primary-role", default="")
    parser.add_argument("--account-type", default="external", choices=["external", "enterprise"])
    args = parser.parse_args()

    from email_validator import validate_email
    from passlib.hash import argon2

    from app.database import SessionLocal
    from app.models import Role, User, UserRole
    from app.services.rbac import normalize_role_name, seed_rbac

    email = validate_email(args.email.strip(), check_deliverability=False).normalized
    role_names = [normalize_role_name(r) for r in args.roles.split(",") if r.strip()]
    primary = normalize_role_name(args.primary_role) or (role_names[0] if role_names else "agent")
    now = datetime.now(tz=timezone.utc)

    db = SessionLocal()
    try:
        seed_rbac()
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.password_hash = argon2.hash(args.password)
            user.full_name = args.name.strip() or user.full_name
            user.role = primary
            user.account_type = args.account_type
            user.auth_provider = "local"
            user.approved_at = now
            user.is_active = True
            user.email_verified_at = user.email_verified_at or now
            user.deleted_at = None
            action = "updated"
        else:
            user = User(
                email=email,
                password_hash=argon2.hash(args.password),
                full_name=args.name.strip() or None,
                role=primary,
                account_type=args.account_type,
                auth_provider="local",
                approved_at=now,
                is_active=True,
                email_verified_at=now,
            )
            db.add(user)
            action = "created"
        db.commit()
        db.refresh(user)

        db.query(UserRole).filter(UserRole.user_id == user.id).delete()
        for name in role_names:
            r = db.query(Role).filter(Role.name == name).first()
            if r:
                db.add(UserRole(user_id=user.id, role_id=r.id))
        db.commit()

        print(f"OK: user {action} id={user.id} email={email} role={primary} roles={role_names}")
        print("They can sign in immediately via the external login path (not Enterprise SSO).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
