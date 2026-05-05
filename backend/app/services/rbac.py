from __future__ import annotations

from typing import Dict, List, Optional

from sqlalchemy import and_

from ..database import SessionLocal
from ..models import Permission, Role, RolePermission, UserRole


def seed_rbac() -> None:
    """
    Create the baseline system roles + permissions.

    This is intentionally dev-friendly and idempotent (safe to call on startup).
    Production setups should move this into migrations/seed tooling later.
    """

    permissions: Dict[str, str] = {
        "feedback.view_assigned": "View only assigned feedback items",
        "feedback.view_team": "View team feedback queue",
        "feedback.view_all": "View all feedback in the organization",
        "feedback.reply": "Draft and send replies (subject to approval rules)",
        "feedback.approve": "Approve or reject public replies",
        "feedback.assign": "Assign or reassign feedback items",
        "feedback.resolve": "Mark feedback items as resolved/closed",
        "customer.view_limited": "View limited Customer 360 profile",
        "customer.view_full": "View full Customer 360 profile",
        "reports.view_team": "View team-level reports",
        "reports.view_org": "View organization-wide reports",
        "reports.export": "Export/download reports",
        "admin.manage_users": "Create/disable users and manage user access",
        "admin.manage_roles": "Create roles and assign permissions",
        "admin.manage_integrations": "Manage integrations and channel connectors",
        "admin.manage_automation": "Manage automation rules and templates",
        "admin.manage_scoring": "Manage scoring/prioritization configuration",
        "admin.view_audit_logs": "View audit logs",
    }

    role_permissions: Dict[str, List[str]] = {
        # User End
        "agent": [
            "feedback.view_assigned",
            "feedback.reply",
            "feedback.resolve",
            "customer.view_limited",
        ],
        "team_lead": [
            "feedback.view_assigned",
            "feedback.view_team",
            "feedback.reply",
            "feedback.approve",
            "feedback.assign",
            "feedback.resolve",
            "customer.view_limited",
            "reports.view_team",
        ],
        "analyst": [
            "feedback.view_all",
            "customer.view_full",
            "reports.view_org",
            "reports.export",
        ],
        "cx_manager": [
            "feedback.view_all",
            "feedback.assign",
            "feedback.approve",
            "feedback.resolve",
            "customer.view_full",
            "reports.view_org",
            "reports.export",
            "admin.manage_automation",
            "admin.manage_scoring",
        ],
        # Admin End
        "super_admin": list(permissions.keys()),
        "auditor": [
            "feedback.view_all",
            "customer.view_full",
            "reports.view_org",
            "admin.view_audit_logs",
        ],
    }

    role_descriptions: Dict[str, str] = {
        "agent": "Agent / Responder (assigned queue + replies)",
        "team_lead": "Team Lead / Supervisor (team queue + reassignment)",
        "analyst": "CX / Product Analyst (read + insights, no replying)",
        "cx_manager": "CX Manager (cross-team + automation/scoring oversight)",
        "super_admin": "Super Admin / Owner (full access)",
        "auditor": "Auditor (read-only access)",
    }

    db = SessionLocal()
    try:
        # permissions
        perm_by_key: Dict[str, Permission] = {}
        for key, desc in permissions.items():
            row = db.query(Permission).filter(Permission.key == key).first()
            if not row:
                row = Permission(key=key, description=desc)
                db.add(row)
                db.flush()
            perm_by_key[key] = row

        # roles
        role_by_name: Dict[str, Role] = {}
        for name, desc in role_descriptions.items():
            row = db.query(Role).filter(Role.name == name).first()
            if not row:
                row = Role(name=name, description=desc, is_system=True)
                db.add(row)
                db.flush()
            role_by_name[name] = row

        # mappings
        for role_name, perm_keys in role_permissions.items():
            role = role_by_name.get(role_name)
            if not role:
                continue
            for key in perm_keys:
                perm = perm_by_key.get(key)
                if not perm:
                    continue
                exists = (
                    db.query(RolePermission.id)
                    .filter(and_(RolePermission.role_id == role.id, RolePermission.permission_id == perm.id))
                    .first()
                )
                if not exists:
                    db.add(RolePermission(role_id=role.id, permission_id=perm.id))

        db.commit()
    finally:
        db.close()


def normalize_role_name(value: Optional[str]) -> Optional[str]:
    """
    Map UI role labels (legacy) to normalized system role names.
    """
    v = (value or "").strip().lower()
    if not v:
        return None

    # legacy UI labels -> system roles
    mapping = {
        "management": "cx_manager",
        "cx & support": "agent",
        "cx and support": "agent",
        "operations": "team_lead",
        "agent": "agent",
        "responder": "agent",
        "team lead": "team_lead",
        "team_lead": "team_lead",
        "analyst": "analyst",
        "cx manager": "cx_manager",
        "cx_manager": "cx_manager",
        "super admin": "super_admin",
        "owner": "super_admin",
        "super_admin": "super_admin",
        "auditor": "auditor",
    }
    return mapping.get(v, v.replace(" ", "_"))


def assign_user_role(*, user_id: int, role_name: str, team: Optional[str] = None, region: Optional[str] = None) -> None:
    """
    Ensure a user has the given role (idempotent).
    """
    db = SessionLocal()
    try:
        role = db.query(Role).filter(Role.name == role_name).first()
        if not role:
            return
        exists = db.query(UserRole.id).filter(and_(UserRole.user_id == user_id, UserRole.role_id == role.id)).first()
        if exists:
            return
        db.add(UserRole(user_id=user_id, role_id=role.id, team=team, region=region))
        db.commit()
    finally:
        db.close()

