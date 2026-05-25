"""Session debug logging (NDJSON). Remove after debug session."""

from __future__ import annotations

import json
import time

_LOG_PATH = "/home/araba/.cursor/debug-f06d8e.log"
_SESSION = "f06d8e"


def agent_debug_log(location: str, message: str, data: dict, hypothesis_id: str) -> None:
    try:
        payload = {
            "sessionId": _SESSION,
            "location": location,
            "message": message,
            "data": data,
            "hypothesisId": hypothesis_id,
            "timestamp": int(time.time() * 1000),
        }
        with open(_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload) + "\n")
    except Exception:
        pass
