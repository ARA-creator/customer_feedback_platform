from __future__ import annotations

import json
import logging
import random
import time
from typing import Any, Dict, Optional

from google import genai as _genai  # type: ignore[import-not-found]
from google.genai import types  # type: ignore[import-not-found]

from ..config import get_config

logger = logging.getLogger(__name__)


def _fallback_reply(*, feedback_message: str, customer_name: Optional[str], tone: str, brand_voice: str) -> Dict[str, Any]:
    greeting = f"Hi {customer_name}," if customer_name else "Hello,"
    base = (
        f"{greeting}\n\n"
        f"Thank you for sharing this with us. We understand your concern and we are reviewing it carefully. "
        f"Our team will follow up with an update as soon as possible.\n\n"
        f"Best regards,\nCustomer Experience Team"
    )
    alt = (
        f"{greeting}\n\n"
        f"Thanks for reaching out. We appreciate the feedback and have logged it for immediate review. "
        f"We will keep you updated on the next steps.\n\n"
        f"Sincerely,\nCustomer Experience Team"
    )
    return {
        "body": base,
        "alt_body": alt,
        "model_name": "fallback-template",
        "ai_generated": False,
        "meta": {"tone": tone, "brand_voice": brand_voice, "source_excerpt": (feedback_message or "")[:240]},
    }


def _normalize_model_name(model: str) -> str:
    m = (model or "").strip()
    if m.startswith("models/"):
        m = m[len("models/") :]
    return m or "gemini-1.5-flash"


def _candidate_models(model: str) -> list[str]:
    m = _normalize_model_name(model)
    out = [m]
    if not m.endswith("-latest"):
        out.append(f"{m}-latest")
    # common fallbacks
    if m == "gemini-1.5-flash":
        out.append("gemini-1.5-flash-latest")
        out.append("gemini-1.5-pro-latest")
    if m == "gemini-1.5-pro":
        out.append("gemini-1.5-pro-latest")
    # current common families
    if m.startswith("gemini-2.5-flash"):
        out.append("gemini-2.0-flash")
        out.append("gemini-2.5-pro")
    if m.startswith("gemini-2.5-pro"):
        out.append("gemini-2.5-flash")
        out.append("gemini-2.0-flash")
    # de-dupe
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


def _genai_generate_json(*, api_key: str, model: str, prompt: str, temperature: float) -> Dict[str, Any]:
    """
    Generate JSON with keys {body, alt_body}.
    Uses google-genai SDK; retries alternate model names when model isn't available.
    """
    client = _genai.Client(api_key=api_key)
    last_err: Optional[Exception] = None
    for m in _candidate_models(model):
        # Retry on transient capacity errors (free tier often sees 503 spikes).
        for attempt in range(3):
            try:
                resp = client.models.generate_content(
                    model=m,
                    contents=prompt,
                    config=types.GenerateContentConfig(
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
                # Model not found / unsupported -> try next model immediately.
                if _is_not_found_error(e):
                    break
                # Transient high-demand -> backoff + retry.
                if _is_unavailable_error(e) and attempt < 2:
                    sleep_s = (2**attempt) + random.random() * 0.25
                    time.sleep(sleep_s)
                    continue
                # Other errors -> try next model candidate.
                break
    if last_err:
        raise last_err
    raise RuntimeError("Gemini request failed")


def generate_reply_draft(*, feedback: Dict[str, Any], customer_profile: Optional[Dict[str, Any]] = None, tone: str = "empathetic", brand_voice: str = "professional, calm, reassuring", public_response: bool = False) -> Dict[str, Any]:
    cfg = get_config()
    api_key = (getattr(cfg, "GEMINI_API_KEY", "") or "").strip()
    model = (getattr(cfg, "GEMINI_MODEL", "gemini-1.5-flash") or "gemini-1.5-flash").strip()

    customer_name = None
    if customer_profile:
        customer_name = customer_profile.get("customer", {}).get("label")
    if not customer_name:
        customer_name = feedback.get("customer_label") or feedback.get("customer_id")

    prompt = f"""
You are drafting a customer support reply for Enterprise Life.

Requirements:
- Tone: {tone}
- Brand voice: {brand_voice}
- Public response: {"yes" if public_response else "no"}
- Keep the reply concise, human, and safe.
- Acknowledge the issue clearly.
- Do not promise anything unavailable.
- If public, avoid exposing private details and invite DM/private follow-up when appropriate.
- Return JSON only with keys: body, alt_body.

Customer context:
{json.dumps(customer_profile or {}, ensure_ascii=False)}

Feedback:
{json.dumps(feedback, ensure_ascii=False)}
""".strip()

    if not api_key:
        return _fallback_reply(
            feedback_message=feedback.get("message") or "",
            customer_name=customer_name,
            tone=tone,
            brand_voice=brand_voice,
        )

    try:
        parsed = _genai_generate_json(api_key=api_key, model=model, prompt=prompt, temperature=0.5)
        body = (parsed.get("body") or "").strip()
        alt_body = (parsed.get("alt_body") or "").strip() or None
        if not body:
            return _fallback_reply(
                feedback_message=feedback.get("message") or "",
                customer_name=customer_name,
                tone=tone,
                brand_voice=brand_voice,
            )
        return {
            "body": body,
            "alt_body": alt_body,
            "model_name": _normalize_model_name(model),
            "ai_generated": True,
            "meta": {"tone": tone, "brand_voice": brand_voice},
        }
    except Exception:
        logger.exception("Gemini draft generation failed")
        return _fallback_reply(
            feedback_message=feedback.get("message") or "",
            customer_name=customer_name,
            tone=tone,
            brand_voice=brand_voice,
        )


def rephrase_reply_text(*, text: str, tone: str = "empathetic", brand_voice: str = "professional, calm, reassuring", public_response: bool = False) -> Dict[str, Any]:
    original = (text or "").strip()
    if not original:
        return {
            "body": "",
            "alt_body": None,
            "model_name": "fallback-template",
            "ai_generated": False,
            "meta": {"tone": tone, "brand_voice": brand_voice, "reason": "empty_input"},
        }

    cfg = get_config()
    api_key = (getattr(cfg, "GEMINI_API_KEY", "") or "").strip()
    model = (getattr(cfg, "GEMINI_MODEL", "gemini-1.5-flash") or "gemini-1.5-flash").strip()

    if not api_key:
        return {
            "body": original,
            "alt_body": None,
            "model_name": "fallback-template",
            "ai_generated": False,
            "meta": {"tone": tone, "brand_voice": brand_voice, "reason": "missing_api_key"},
        }

    prompt = f"""
You are rewriting a customer support reply for Enterprise Life.

Requirements:
- Tone: {tone}
- Brand voice: {brand_voice}
- Public response: {"yes" if public_response else "no"}
- Preserve the original meaning.
- Improve clarity, grammar, and professionalism.
- Keep it concise and human.
- If public, avoid exposing private details.
- Return JSON only with keys: body, alt_body.

Original text:
{json.dumps(original, ensure_ascii=False)}
""".strip()

    try:
        parsed = _genai_generate_json(api_key=api_key, model=model, prompt=prompt, temperature=0.4)
        body = (parsed.get("body") or "").strip()
        alt_body = (parsed.get("alt_body") or "").strip() or None
        if not body:
            raise ValueError("Gemini returned empty rephrase body")
        return {
            "body": body,
            "alt_body": alt_body,
            "model_name": _normalize_model_name(model),
            "ai_generated": True,
            "meta": {"tone": tone, "brand_voice": brand_voice},
        }
    except Exception:
        logger.exception("Gemini rephrase failed")
        return {
            "body": original,
            "alt_body": None,
            "model_name": "fallback-template",
            "ai_generated": False,
            "meta": {"tone": tone, "brand_voice": brand_voice, "reason": "request_failed"},
        }
