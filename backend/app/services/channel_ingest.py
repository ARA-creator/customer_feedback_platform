"""Per-channel ingest enable/disable flags (stored in AppSetting, admin UI)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict

from ..models import AppSetting

SETTING_KEY = "integrations.channel_ingest"

CHANNEL_IDS = (
    "email",
    "whatsapp_twilio",
    "whatsapp_meta",
    "instagram",
    "facebook",
    "jotform",
    "web",
    "x",
    "tiktok",
)

_DEFAULTS: Dict[str, bool] = {k: True for k in CHANNEL_IDS}


def _read_setting_json(db, key: str, default: Any) -> Any:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not row or not row.value:
        return default
    try:
        return json.loads(row.value)
    except Exception:
        return default


def _write_setting_json(db, key: str, value: Any) -> None:
    payload = json.dumps(value)
    ts = datetime.now(tz=timezone.utc)
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not row:
        db.add(AppSetting(key=key, value=payload, updated_at=ts))
    else:
        row.value = payload
        row.updated_at = ts
    db.commit()


def _normalize_map(raw: Any) -> Dict[str, bool]:
    out = dict(_DEFAULTS)
    if not isinstance(raw, dict):
        return out
    # Migrate legacy google_forms toggle to jotform.
    if "google_forms" in raw and "jotform" not in raw:
        raw = {**raw, "jotform": raw["google_forms"]}
    for key in CHANNEL_IDS:
        if key in raw:
            out[key] = bool(raw[key])
    return out


def get_channel_ingest_map(db) -> Dict[str, bool]:
    stored = _read_setting_json(db, SETTING_KEY, None)
    return _normalize_map(stored)


def is_channel_ingest_enabled(db, channel_id: str) -> bool:
    cid = str(channel_id or "").strip()
    if cid not in _DEFAULTS:
        return True
    return bool(get_channel_ingest_map(db).get(cid, True))


def set_channel_ingest(db, updates: Dict[str, bool]) -> Dict[str, bool]:
    current = get_channel_ingest_map(db)
    for key, val in (updates or {}).items():
        k = str(key or "").strip()
        if k in _DEFAULTS:
            current[k] = bool(val)
    _write_setting_json(db, SETTING_KEY, current)
    return dict(current)


def channel_ingest_public_view(db) -> Dict[str, bool]:
    return get_channel_ingest_map(db)
