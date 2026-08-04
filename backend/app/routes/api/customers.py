"""
Customer 360 routes for the /api blueprint.

Moved from legacy `backend/app/routes/api.py`.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict
from urllib.parse import unquote

from flask import jsonify, request
from sqlalchemy import desc, func

from ...database import SessionLocal
from ...models import (
    CustomerDemographics,
    CustomerIdentifier,
    CustomerProfile,
    CustomerPurchase,
    CustomerSupportTicket,
    Feedback,
    FeedbackPolicyMatch,
)
from ...security import decrypt_text, encrypt_text, hash_email
from ...services.metadata_normalization import (
    format_phone_display,
    normalize_phone_identity,
    phone_identity_variants,
    safe_json_loads,
)
from ...services.policy_detection import canonicalize_policy_number, is_policy_number_match
from ...services.prioritization import normalize_source_group
from . import api_bp
from ._helpers import (
    _find_customer_profile,
    _normalize_metadata,
    _purchase_summary_for_customer,
    _require_user,
    _scope_feedback_query,
    _serialize_feedback_batch,
    _ticket_summary_for_customer,
    _upsert_customer_entities,
    _user_permission_keys,
)


@api_bp.route("/customers/<path:customer_key>", methods=["GET"])
def customer_profile(customer_key: str):
    db = SessionLocal()
    try:
        # Allow any authenticated agent/admin to access Customer 360, but only for feedback
        # rows they are scoped to see. (Customer lookups are derived from feedback visibility.)
        try:
            user = _require_user(db)
            perms = _user_permission_keys(db, user.id)
        except PermissionError as e:
            return jsonify({"error": str(e)}), 401

        # Path may arrive with literal %3A (no ':') or double-encoded %253A after some
        # clients/proxies; normalize so "email_hash:<hex>" always parses.
        ck = (customer_key or "").strip()
        while True:
            decoded = unquote(ck)
            if decoded == ck:
                break
            ck = decoded
        customer_key = ck.strip()

        if ":" not in customer_key:
            return jsonify({"error": "Invalid customer key"}), 400
        prefix, raw_value = customer_key.split(":", 1)
        prefix = prefix.strip().lower()
        raw_value = raw_value.strip()
        if not raw_value:
            return jsonify({"error": "Invalid customer key"}), 400

        q = db.query(Feedback).filter(Feedback.deleted_at.is_(None))
        q = _scope_feedback_query(db, q, user=user, perms=perms)
        if prefix == "customer":
            q = q.filter(Feedback.customer_id == raw_value)
        elif prefix == "email_hash":
            q = q.filter(Feedback.email_hash == raw_value)
        elif prefix == "policy_hash":
            # Prefer primary policy matches, but allow fallback to any match.
            q_primary = (
                q.join(FeedbackPolicyMatch, FeedbackPolicyMatch.feedback_id == Feedback.id)
                .filter(FeedbackPolicyMatch.policy_hash == raw_value)
                .filter(FeedbackPolicyMatch.is_primary.is_(True))
            )
            rows = q_primary.order_by(desc(Feedback.created_at), desc(Feedback.id)).limit(100).all()
            if not rows:
                q_any = q.join(FeedbackPolicyMatch, FeedbackPolicyMatch.feedback_id == Feedback.id).filter(
                    FeedbackPolicyMatch.policy_hash == raw_value
                )
                rows = q_any.order_by(desc(Feedback.created_at), desc(Feedback.id)).limit(100).all()
        else:
            q = q.filter(func.lower(Feedback.channel_metadata).like(f"%{raw_value.lower()}%"))
            rows = q.order_by(desc(Feedback.created_at), desc(Feedback.id)).limit(100).all()

        if prefix in ("customer", "email_hash"):
            rows = q.order_by(desc(Feedback.created_at), desc(Feedback.id)).limit(100).all()
        if not rows:
            return jsonify({"error": "Customer not found"}), 404

        profile = _find_customer_profile(db, customer_key=customer_key)

        # Expand history across linked identifiers (especially shared policy_hash),
        # so email + WhatsApp with the same policy appear as one Customer 360.
        if profile:
            try:
                linked = (
                    db.query(CustomerIdentifier)
                    .filter(CustomerIdentifier.customer_profile_id == profile.id)
                    .all()
                )
                seen_ids = {int(r.id) for r in rows if getattr(r, "id", None) is not None}
                policy_hashes = []
                email_hashes = []
                meta_needles = []
                for ident in linked or []:
                    itype = str(getattr(ident, "identifier_type", "") or "").lower()
                    ival = str(getattr(ident, "identifier_value", "") or "")
                    raw = ival.split(":", 1)[1].strip() if ":" in ival else ival.strip()
                    if not raw:
                        continue
                    if itype == "policy_hash":
                        policy_hashes.append(raw)
                    elif itype in {"email_hash", "email"}:
                        email_hashes.append(raw)
                    elif itype in {"phone", "wa", "handle", "author", "sender", "thread"}:
                        meta_needles.append(raw)
                        # Digit-only + Ghana local/intl variants so +233 / 233 / 0… all hit metadata.
                        digits = "".join(ch for ch in raw if ch.isdigit())
                        if itype in {"phone", "wa"} and len(digits) >= 7:
                            meta_needles.append(digits)
                            for variant in phone_identity_variants(raw):
                                form = variant.split(":", 1)[1] if ":" in variant else variant
                                if form:
                                    meta_needles.append(form)

                base_q = db.query(Feedback).filter(Feedback.deleted_at.is_(None))
                base_q = _scope_feedback_query(db, base_q, user=user, perms=perms)
                extras = []
                if policy_hashes:
                    extras.extend(
                        base_q.join(FeedbackPolicyMatch, FeedbackPolicyMatch.feedback_id == Feedback.id)
                        .filter(FeedbackPolicyMatch.policy_hash.in_(list(dict.fromkeys(policy_hashes))))
                        .order_by(desc(Feedback.created_at), desc(Feedback.id))
                        .limit(100)
                        .all()
                    )
                if email_hashes:
                    extras.extend(
                        base_q.filter(Feedback.email_hash.in_(list(dict.fromkeys(email_hashes))))
                        .order_by(desc(Feedback.created_at), desc(Feedback.id))
                        .limit(100)
                        .all()
                    )
                for needle in list(dict.fromkeys(meta_needles))[:24]:
                    extras.extend(
                        base_q.filter(func.lower(Feedback.channel_metadata).like(f"%{needle.lower()}%"))
                        .order_by(desc(Feedback.created_at), desc(Feedback.id))
                        .limit(40)
                        .all()
                    )
                for row in extras:
                    rid = getattr(row, "id", None)
                    if rid is None or int(rid) in seen_ids:
                        continue
                    rows.append(row)
                    seen_ids.add(int(rid))
                rows.sort(
                    key=lambda r: (
                        r.created_at or datetime.min.replace(tzinfo=timezone.utc),
                        r.id or 0,
                    ),
                    reverse=True,
                )
                rows = rows[:100]
            except Exception:
                pass

        # Expand further via policies already present on history rows, so one email
        # that shares a policy with WhatsApp/other emails pulls the full person in.
        try:
            base_q = db.query(Feedback).filter(Feedback.deleted_at.is_(None))
            base_q = _scope_feedback_query(db, base_q, user=user, perms=perms)
            seen_ids = {int(r.id) for r in rows if getattr(r, "id", None) is not None}
            for _ in range(2):
                row_ids = [int(r.id) for r in rows if getattr(r, "id", None) is not None]
                if not row_ids:
                    break
                policy_hashes = [
                    h
                    for (h,) in (
                        db.query(FeedbackPolicyMatch.policy_hash)
                        .filter(FeedbackPolicyMatch.feedback_id.in_(row_ids))
                        .filter(FeedbackPolicyMatch.policy_hash.isnot(None))
                        .distinct()
                        .all()
                    )
                    if h
                ]
                if not policy_hashes:
                    break
                extras = (
                    base_q.join(FeedbackPolicyMatch, FeedbackPolicyMatch.feedback_id == Feedback.id)
                    .filter(FeedbackPolicyMatch.policy_hash.in_(list(dict.fromkeys(policy_hashes))))
                    .order_by(desc(Feedback.created_at), desc(Feedback.id))
                    .limit(100)
                    .all()
                )
                added = 0
                for row in extras:
                    rid = getattr(row, "id", None)
                    if rid is None or int(rid) in seen_ids:
                        continue
                    rows.append(row)
                    seen_ids.add(int(rid))
                    added += 1
                if not added:
                    break
            rows.sort(
                key=lambda r: (
                    r.created_at or datetime.min.replace(tzinfo=timezone.utc),
                    r.id or 0,
                ),
                reverse=True,
            )
            rows = rows[:100]
        except Exception:
            pass

        # Self-heal: link identities from history onto the profile (merges email/phone/
        # social/policy profiles that belong to the same person).
        if profile and rows:
            try:
                from ...security import decrypt_text as _dec

                for row in rows[:40]:
                    try:
                        msg = _dec(row.message_encrypted) if getattr(row, "message_encrypted", None) else ""
                    except Exception:
                        msg = ""
                    updated = _upsert_customer_entities(db, feedback=row, message_plaintext=msg or "")
                    if updated is not None:
                        profile = updated
                db.flush()
                # Re-resolve profile in case merges moved identifiers.
                profile = _find_customer_profile(db, customer_key=customer_key) or profile
            except Exception:
                db.rollback()
                profile = _find_customer_profile(db, customer_key=customer_key) or profile

        # After merges, pull any remaining history via the unified profile's policy/email ids.
        if profile:
            try:
                linked = (
                    db.query(CustomerIdentifier)
                    .filter(CustomerIdentifier.customer_profile_id == profile.id)
                    .all()
                )
                seen_ids = {int(r.id) for r in rows if getattr(r, "id", None) is not None}
                policy_hashes = []
                email_hashes = []
                for ident in linked or []:
                    itype = str(getattr(ident, "identifier_type", "") or "").lower()
                    ival = str(getattr(ident, "identifier_value", "") or "")
                    raw = ival.split(":", 1)[1].strip() if ":" in ival else ival.strip()
                    if not raw:
                        continue
                    if itype == "policy_hash":
                        policy_hashes.append(raw)
                    elif itype in {"email_hash", "email"}:
                        email_hashes.append(raw)
                base_q = db.query(Feedback).filter(Feedback.deleted_at.is_(None))
                base_q = _scope_feedback_query(db, base_q, user=user, perms=perms)
                extras = []
                if policy_hashes:
                    extras.extend(
                        base_q.join(FeedbackPolicyMatch, FeedbackPolicyMatch.feedback_id == Feedback.id)
                        .filter(FeedbackPolicyMatch.policy_hash.in_(list(dict.fromkeys(policy_hashes))))
                        .order_by(desc(Feedback.created_at), desc(Feedback.id))
                        .limit(100)
                        .all()
                    )
                if email_hashes:
                    extras.extend(
                        base_q.filter(Feedback.email_hash.in_(list(dict.fromkeys(email_hashes))))
                        .order_by(desc(Feedback.created_at), desc(Feedback.id))
                        .limit(100)
                        .all()
                    )
                for row in extras:
                    rid = getattr(row, "id", None)
                    if rid is None or int(rid) in seen_ids:
                        continue
                    rows.append(row)
                    seen_ids.add(int(rid))
                rows.sort(
                    key=lambda r: (
                        r.created_at or datetime.min.replace(tzinfo=timezone.utc),
                        r.id or 0,
                    ),
                    reverse=True,
                )
                rows = rows[:100]
            except Exception:
                pass

        purchase_summary = (
            _purchase_summary_for_customer(
                db, getattr(profile, "id", None), getattr(profile, "customer_tier", None)
            )
            if profile
            else {}
        )
        ticket_summary = _ticket_summary_for_customer(db, getattr(profile, "id", None)) if profile else {}

        source_counts: Dict[str, int] = {}
        sentiment_counts: Dict[str, int] = {}
        customer_label = None
        for row in rows:
            meta = _normalize_metadata(row)
            src = normalize_source_group(row.source) or "unknown"
            source_counts[src] = source_counts.get(src, 0) + 1
            sent = (row.sentiment_label or "unknown").lower()
            sentiment_counts[sent] = sentiment_counts.get(sent, 0) + 1
            if not customer_label:
                customer_label = meta.get("customer_label") or row.customer_id

        history_rows = rows[:25]
        serialized = _serialize_feedback_batch(
            db,
            history_rows,
            purchase_summary=purchase_summary,
            ticket_summary=ticket_summary,
            profile_id=getattr(profile, "id", None),
        )
        # Persist policy self-heal (new prefix detections) before responding.
        try:
            db.commit()
        except Exception:
            db.rollback()
            serialized = _serialize_feedback_batch(
                db,
                history_rows,
                purchase_summary=purchase_summary,
                ticket_summary=ticket_summary,
                profile_id=getattr(profile, "id", None),
            )

        identifiers = []
        purchases_payload = []
        tickets_payload = []
        demographics_payload = None
        if profile:
            identifiers = (
                db.query(CustomerIdentifier)
                .filter(CustomerIdentifier.customer_profile_id == profile.id)
                .order_by(CustomerIdentifier.created_at.desc(), CustomerIdentifier.id.desc())
                .all()
            )
            purchases = (
                db.query(CustomerPurchase)
                .filter(CustomerPurchase.customer_profile_id == profile.id)
                .order_by(desc(CustomerPurchase.purchased_at), desc(CustomerPurchase.id))
                .all()
            )
            tickets = (
                db.query(CustomerSupportTicket)
                .filter(CustomerSupportTicket.customer_profile_id == profile.id)
                .order_by(desc(CustomerSupportTicket.opened_at), desc(CustomerSupportTicket.id))
                .all()
            )
            demographics = db.query(CustomerDemographics).filter(CustomerDemographics.customer_profile_id == profile.id).first()
            purchases_payload = [
                {
                    "id": p.id,
                    "purchase_ref": p.purchase_ref,
                    "product_name": p.product_name,
                    "product_line": p.product_line,
                    "amount": p.amount,
                    "currency": p.currency,
                    "status": p.status,
                    "purchased_at": p.purchased_at.isoformat() if p.purchased_at else None,
                    "renewal_at": p.renewal_at.isoformat() if p.renewal_at else None,
                }
                for p in purchases
            ]
            tickets_payload = [
                {
                    "id": t.id,
                    "ticket_ref": t.ticket_ref,
                    "subject": t.subject,
                    "status": t.status,
                    "priority": t.priority,
                    "opened_at": t.opened_at.isoformat() if t.opened_at else None,
                    "closed_at": t.closed_at.isoformat() if t.closed_at else None,
                    "channel": t.channel,
                    "summary": t.summary,
                }
                for t in tickets
            ]
            if demographics:
                demographics_payload = {
                    "age_range": demographics.age_range,
                    "gender": demographics.gender,
                    "location": demographics.location,
                    "language": demographics.language,
                    "segment": demographics.segment,
                    "occupation": demographics.occupation,
                    "metadata": safe_json_loads(demographics.demographics_metadata),
                }

        # Distinct policies only (not mention/row count). Canonicalize so
        # EB2V000024 and EB2V0000024 count as one.
        linked_keys = set()
        verified_keys = set()

        def _policy_key(raw: str, fallback_hash: str | None = None) -> str | None:
            text = str(raw or "").strip()
            policy_part = text.split(" · ")[-1].strip() if " · " in text else text
            canon = canonicalize_policy_number(policy_part) or canonicalize_policy_number(text)
            if canon:
                return f"num:{canon}"
            if policy_part and is_policy_number_match(policy_part):
                return f"raw:{policy_part.upper()}"
            if fallback_hash:
                return f"hash:{fallback_hash}"
            return None

        for ident in identifiers:
            if str(getattr(ident, "identifier_type", "") or "").lower() != "policy_hash":
                continue
            ival = str(getattr(ident, "identifier_value", "") or "")
            phash = ival.split(":", 1)[1].strip() if ":" in ival else ival.strip()
            key = _policy_key(getattr(ident, "label", None) or "", phash or None)
            if not key:
                continue
            linked_keys.add(key)
            label = str(getattr(ident, "label", "") or "")
            policy_part = label.split(" · ")[-1].strip() if " · " in label else label
            if is_policy_number_match(policy_part) or is_policy_number_match(label):
                verified_keys.add(key)

        # Also include distinct policies from expanded history matches.
        try:
            row_ids = [int(r.id) for r in rows if getattr(r, "id", None) is not None]
            if row_ids:
                for m in (
                    db.query(FeedbackPolicyMatch)
                    .filter(FeedbackPolicyMatch.feedback_id.in_(row_ids))
                    .all()
                ):
                    key = _policy_key(getattr(m, "policy_masked", None) or "", getattr(m, "policy_hash", None))
                    if not key:
                        continue
                    linked_keys.add(key)
                    if is_policy_number_match(getattr(m, "policy_masked", None) or ""):
                        verified_keys.add(key)
        except Exception:
            pass

        linked_policy_count = len(linked_keys)
        verified_policy_count = len(verified_keys)
        if verified_policy_count:
            policy_holder_status = "verified"
        elif linked_policy_count:
            policy_holder_status = "estimated"
        else:
            policy_holder_status = None

        # Map email_hash -> plaintext from profile + full history (all linked emails).
        email_by_hash: Dict[str, str] = {}
        if profile and getattr(profile, "primary_email_hash", None) and getattr(profile, "primary_email_encrypted", None):
            plain = decrypt_text(profile.primary_email_encrypted)
            if plain and "@" in plain:
                email_by_hash[str(profile.primary_email_hash).strip()] = plain.strip()
        for row in rows:
            plain = None
            if getattr(row, "email_encrypted", None):
                plain = decrypt_text(row.email_encrypted)
            meta = _normalize_metadata(row)
            if not (plain and "@" in str(plain)):
                for key in ("sender_email", "email", "from_email"):
                    cand = meta.get(key)
                    if cand and "@" in str(cand):
                        plain = str(cand).strip()
                        break
            if plain and "@" in str(plain):
                plain = str(plain).strip().strip('"')
                h = str(getattr(row, "email_hash", None) or hash_email(plain) or "").strip()
                if h:
                    email_by_hash[h] = plain

        email_plain = next(iter(email_by_hash.values()), None)
        if profile and getattr(profile, "primary_email_encrypted", None):
            primary = decrypt_text(profile.primary_email_encrypted)
            if primary and "@" in primary:
                email_plain = primary.strip()

        identifiers_payload = []
        seen_display = set()
        seen_phone_canons = set()
        seen_emails = set()

        def _is_person_name_label(value: str) -> bool:
            s = str(value or "").strip().strip('"')
            if not s or "@" in s:
                return False
            # "Michael Mensah" / quoted display names — not a channel handle.
            if " " in s and not any(ch.isdigit() for ch in s):
                return True
            return False

        def _add_ident(*, ident_id, display_type: str, stored_value, label, source=None) -> None:
            dtype = str(display_type or "").lower().strip()
            label_s = str(label or "").strip().strip('"')
            if not label_s:
                return

            # Never show name-as-handle / name-as-thread / message-id threads.
            if dtype in {"handle", "thread", "author", "sender", "msg", "message_sid"}:
                if _is_person_name_label(label_s):
                    return
                if dtype == "thread" and ("@" in label_s or label_s.startswith("<")):
                    return
                # Only keep real social-style handles (@user or single token).
                if dtype in {"handle", "author", "sender"} and (" " in label_s or not label_s.startswith("@")):
                    if " " in label_s or _is_person_name_label(label_s):
                        return

            if dtype in {"email", "email_hash"}:
                dtype = "email"
                email = label_s.lower()
                if "@" not in email or email in seen_emails:
                    return
                seen_emails.add(email)
                label_s = label_s  # keep original casing for display
                key = f"email:{email}"
            elif dtype in {"phone", "wa", "whatsapp"}:
                dtype = "phone"
                canon = normalize_phone_identity(label_s) or normalize_phone_identity(stored_value)
                if not canon or canon in seen_phone_canons:
                    return
                seen_phone_canons.add(canon)
                label_s = format_phone_display(canon) or canon
                stored_value = f"phone:{canon}"
                key = f"phone:{canon}"
            else:
                key = f"{dtype}:{label_s.lower()}"

            if key in seen_display:
                return
            seen_display.add(key)
            identifiers_payload.append(
                {
                    "id": ident_id,
                    "identifier_type": dtype,
                    "identifier_value": stored_value,
                    "label": label_s,
                    "source": source,
                }
            )

        for ident in identifiers:
            itype = str(ident.identifier_type or "").lower()
            # Policy numbers belong under Products & policies, not Customer Identity.
            if itype in {"policy_hash", "policy", "msg", "message_sid"}:
                continue
            # Drop name/thread noise at the source.
            if itype in {"handle", "thread"}:
                if _is_person_name_label(ident.label) or _is_person_name_label(
                    str(ident.identifier_value or "").split(":", 1)[-1]
                ):
                    continue
                if itype == "thread":
                    continue  # email Message-IDs / names are not customer contacts
            label = ident.label
            display_type = itype.replace("_", " ")
            stored_value = ident.identifier_value
            if itype in {"email_hash", "email"}:
                display_type = "email"
                raw = str(ident.identifier_value or "")
                h = raw.split(":", 1)[1].strip() if ":" in raw else raw.strip()
                resolved = email_by_hash.get(h)
                if resolved:
                    label = resolved
                elif label and "@" in str(label):
                    label = str(label).strip().strip('"')
                else:
                    continue
            elif itype in {"phone", "wa"}:
                display_type = "phone"
                raw = str(ident.identifier_value or "")
                phone_val = raw.split(":", 1)[1].strip() if ":" in raw else raw
                if phone_val.lower().startswith("whatsapp:"):
                    phone_val = phone_val.split(":", 1)[1].strip()
                if phone_val.startswith("*"):
                    continue
                canon = normalize_phone_identity(phone_val) or normalize_phone_identity(label)
                if not canon:
                    continue
                label = format_phone_display(canon) or canon
                stored_value = f"phone:{canon}"
            _add_ident(
                ident_id=ident.id,
                display_type=display_type,
                stored_value=stored_value,
                label=label,
                source=ident.source,
            )

        # Harvest every distinct email / phone / social handle from linked history.
        SOCIAL_SOURCES = {
            "instagram": "instagram",
            "facebook": "facebook",
            "tiktok": "tiktok",
            "x": "x",
            "twitter": "x",
        }
        for row in rows:
            meta = _normalize_metadata(row)
            src_group = (normalize_source_group(getattr(row, "source", None)) or "").lower()

            plain = None
            if getattr(row, "email_encrypted", None):
                plain = decrypt_text(row.email_encrypted)
            if not (plain and "@" in str(plain)):
                for key in ("sender_email", "email", "from_email"):
                    cand = meta.get(key)
                    if cand and "@" in str(cand):
                        plain = str(cand).strip().strip('"')
                        break
            if plain and "@" in str(plain):
                plain = str(plain).strip().strip('"')
                h = str(getattr(row, "email_hash", None) or hash_email(plain) or "").strip()
                _add_ident(
                    ident_id=None,
                    display_type="email",
                    stored_value=f"email_hash:{h}" if h else plain,
                    label=plain,
                    source=getattr(row, "source", None) or "feedback",
                )

            for key in ("phone", "from_number", "wa_id"):
                cand = str(meta.get(key) or "").strip()
                if not cand:
                    continue
                if cand.lower().startswith("whatsapp:"):
                    cand = cand.split(":", 1)[1].strip()
                if cand.startswith("*") or "@" in cand:
                    continue
                canon = normalize_phone_identity(cand)
                if not canon:
                    continue
                _add_ident(
                    ident_id=None,
                    display_type="phone",
                    stored_value=f"phone:{canon}",
                    label=format_phone_display(canon) or canon,
                    source=getattr(row, "source", None) or "feedback",
                )
                break

            # Social / channel handles only (never person names).
            social_type = SOCIAL_SOURCES.get(src_group)
            if social_type:
                handle = None
                for key in ("author_username", "from_username", "author_handle", "author_id", "sender_id", "psid", "ig_user_id"):
                    cand = str(meta.get(key) or "").strip().strip('"')
                    if not cand or cand.startswith("*"):
                        continue
                    if normalize_phone_identity(cand):
                        continue
                    if _is_person_name_label(cand):
                        continue
                    handle = cand if cand.startswith("@") else f"@{cand}"
                    break
                if handle:
                    _add_ident(
                        ident_id=None,
                        display_type=social_type,
                        stored_value=f"{social_type}:{handle.lstrip('@').lower()}",
                        label=handle,
                        source=getattr(row, "source", None) or social_type,
                    )

        # Stable order: emails, phones, then socials.
        _order = {"email": 0, "phone": 1}
        identifiers_payload.sort(
            key=lambda it: (
                _order.get(str(it.get("identifier_type") or "").lower(), 9),
                str(it.get("label") or "").lower(),
            )
        )

        return jsonify(
            {
                "customer": {
                    "customer_key": customer_key,
                    "label": customer_label or raw_value,
                    "email": email_plain,
                    "profile_id": getattr(profile, "id", None),
                    "external_customer_id": getattr(profile, "external_customer_id", None),
                    "customer_tier": getattr(profile, "customer_tier", None),
                    "lifecycle_stage": getattr(profile, "lifecycle_stage", None),
                    "company": getattr(profile, "company", None),
                    "total_feedback": len(rows),
                    "first_seen_at": rows[-1].created_at.isoformat() if rows[-1].created_at else None,
                    "last_seen_at": rows[0].created_at.isoformat() if rows[0].created_at else None,
                    "source_counts": source_counts,
                    "sentiment_counts": sentiment_counts,
                    "policy_holder_status": policy_holder_status,
                    "linked_policy_count": linked_policy_count,
                    "verified_policy_count": verified_policy_count,
                },
                "identifiers": identifiers_payload,
                "purchases": purchases_payload,
                "tickets": tickets_payload,
                "demographics": demographics_payload,
                "history": serialized,
            }
        )
    except Exception:
        return jsonify({"error": "Failed to fetch customer profile"}), 500
    finally:
        db.close()


@api_bp.route("/customers", methods=["POST"])
def create_customer_profile():
    db = SessionLocal()
    try:
        payload = request.get_json(silent=True) or {}
        profile = CustomerProfile(
            external_customer_id=(payload.get("external_customer_id") or "").strip() or None,
            display_name=(payload.get("display_name") or "").strip() or None,
            primary_email_hash=hash_email((payload.get("email") or "").strip() or None),
            primary_email_encrypted=encrypt_text((payload.get("email") or "").strip() or None),
            customer_tier=(payload.get("customer_tier") or "").strip() or None,
            lifecycle_stage=(payload.get("lifecycle_stage") or "").strip() or None,
            company=(payload.get("company") or "").strip() or None,
            notes=(payload.get("notes") or "").strip() or None,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return jsonify({"id": profile.id}), 201
    finally:
        db.close()


@api_bp.route("/customers/<int:customer_id>/purchases", methods=["POST"])
def create_customer_purchase(customer_id: int):
    db = SessionLocal()
    try:
        payload = request.get_json(silent=True) or {}
        row = CustomerPurchase(
            customer_profile_id=customer_id,
            purchase_ref=(payload.get("purchase_ref") or "").strip() or None,
            product_name=(payload.get("product_name") or "").strip() or "Unknown product",
            product_line=(payload.get("product_line") or "").strip() or None,
            amount=float(payload.get("amount")) if payload.get("amount") is not None else None,
            currency=(payload.get("currency") or "GHS").strip(),
            status=(payload.get("status") or "").strip() or "active",
            purchased_at=_parse_dt(payload.get("purchased_at")),
            renewal_at=_parse_dt(payload.get("renewal_at")),
            purchase_metadata=_safe_json_dumps(payload.get("metadata")),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return jsonify({"id": row.id}), 201
    finally:
        db.close()


@api_bp.route("/customers/<int:customer_id>/tickets", methods=["POST"])
def create_customer_ticket(customer_id: int):
    db = SessionLocal()
    try:
        payload = request.get_json(silent=True) or {}
        row = CustomerSupportTicket(
            customer_profile_id=customer_id,
            ticket_ref=(payload.get("ticket_ref") or "").strip() or None,
            subject=(payload.get("subject") or "").strip() or "Customer support ticket",
            status=(payload.get("status") or "").strip() or "open",
            priority=(payload.get("priority") or "").strip() or "medium",
            opened_at=_parse_dt(payload.get("opened_at")),
            closed_at=_parse_dt(payload.get("closed_at")),
            channel=(payload.get("channel") or "").strip() or None,
            summary=(payload.get("summary") or "").strip() or None,
            ticket_metadata=_safe_json_dumps(payload.get("metadata")),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return jsonify({"id": row.id}), 201
    finally:
        db.close()


@api_bp.route("/customers/<int:customer_id>/demographics", methods=["POST"])
def upsert_customer_demographics(customer_id: int):
    db = SessionLocal()
    try:
        payload = request.get_json(silent=True) or {}
        row = db.query(CustomerDemographics).filter(CustomerDemographics.customer_profile_id == customer_id).first()
        if not row:
            row = CustomerDemographics(customer_profile_id=customer_id)
            db.add(row)
        row.age_range = (payload.get("age_range") or "").strip() or row.age_range
        row.gender = (payload.get("gender") or "").strip() or row.gender
        row.location = (payload.get("location") or "").strip() or row.location
        row.language = (payload.get("language") or "").strip() or row.language
        row.segment = (payload.get("segment") or "").strip() or row.segment
        row.occupation = (payload.get("occupation") or "").strip() or row.occupation
        row.demographics_metadata = _safe_json_dumps(payload.get("metadata")) or row.demographics_metadata
        row.updated_at = datetime.now(tz=timezone.utc)
        db.commit()
        db.refresh(row)
        return jsonify({"id": row.id}), 200
    finally:
        db.close()

