"""Shared Gemini (google-genai) helpers with lazy SDK import."""

from __future__ import annotations

import json
import logging
import random
import time
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

_SDK_IMPORT_ERROR: Optional[str] = None


def gemini_sdk_available() -> bool:
    """True when google-genai is importable in the active Python environment."""
    global _SDK_IMPORT_ERROR
    if _SDK_IMPORT_ERROR is None:
        try:
            import google.genai  # noqa: F401
        except Exception as exc:
            _SDK_IMPORT_ERROR = str(exc)
            return False
        _SDK_IMPORT_ERROR = ""
    return _SDK_IMPORT_ERROR == ""


def gemini_sdk_error() -> Optional[str]:
    gemini_sdk_available()
    if _SDK_IMPORT_ERROR:
        return _SDK_IMPORT_ERROR
    return None


def _load_genai():
    try:
        from google import genai as genai_mod
        from google.genai import types as types_mod
    except ImportError as exc:
        raise ImportError(
            "google-genai is not installed. From repo root run: "
            "pip install -r backend/requirements.txt "
            "(or use ../.venv/bin/python run.py from backend/)."
        ) from exc
    return genai_mod, types_mod


def normalize_model_name(model: str) -> str:
    m = (model or "").strip()
    if m.startswith("models/"):
        m = m[len("models/") :]
    return m or "gemini-1.5-flash"


def _candidate_models(model: str) -> list[str]:
    m = normalize_model_name(model)
    out = [m]
    if not m.endswith("-latest"):
        out.append(f"{m}-latest")
    if m == "gemini-1.5-flash":
        out.append("gemini-1.5-flash-latest")
        out.append("gemini-1.5-pro-latest")
    if m == "gemini-1.5-pro":
        out.append("gemini-1.5-pro-latest")
    if m.startswith("gemini-2.5-flash"):
        out.append("gemini-2.0-flash")
        out.append("gemini-2.5-pro")
    if m.startswith("gemini-2.5-pro"):
        out.append("gemini-2.5-flash")
        out.append("gemini-2.0-flash")
    seen: set[str] = set()
    uniq: list[str] = []
    for x in out:
        x = (x or "").strip()
        if x and x not in seen:
            uniq.append(x)
            seen.add(x)
    return uniq


def _is_unavailable_error(err: Exception) -> bool:
    s = str(err).lower()
    return "503" in s or "unavailable" in s or "high demand" in s


def _is_not_found_error(err: Exception) -> bool:
    s = str(err).lower()
    return "404" in s or "not found" in s or "is not found for api version" in s


def genai_generate_json(*, api_key: str, model: str, prompt: str, temperature: float) -> Dict[str, Any]:
    """
    Generate JSON from Gemini. Uses google-genai SDK; retries alternate model names.
    """
    genai_mod, types_mod = _load_genai()
    client = genai_mod.Client(api_key=api_key)
    last_err: Optional[Exception] = None
    for m in _candidate_models(model):
        for attempt in range(3):
            try:
                resp = client.models.generate_content(
                    model=m,
                    contents=prompt,
                    config=types_mod.GenerateContentConfig(
                        temperature=temperature,
                        response_mime_type="application/json",
                    ),
                )
                text = (getattr(resp, "text", None) or "").strip()
                if not text:
                    raise ValueError("Empty Gemini response")
                return json.loads(text)
            except Exception as e:
                last_err = e
                if _is_not_found_error(e):
                    break
                if _is_unavailable_error(e) and attempt < 2:
                    sleep_s = (2**attempt) + random.random() * 0.25
                    time.sleep(sleep_s)
                    continue
                break
    if last_err:
        raise last_err
    raise RuntimeError("Gemini request failed")
