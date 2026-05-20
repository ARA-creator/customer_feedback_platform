import sys
from pathlib import Path

from app import create_app

app = create_app()

if __name__ == "__main__":
    # Prefer repo-root .venv (has google-genai); backend/.venv is easy to run by mistake.
    root_venv = Path(__file__).resolve().parents[1] / ".venv" / "bin" / "python"
    if root_venv.is_file() and Path(sys.executable).resolve() != root_venv.resolve():
        print(
            f"Tip: use {root_venv} run.py so Gemini and other deps match production.",
            file=sys.stderr,
        )
    # for development only
    # Some restricted environments (e.g., WSL/containers) can block /dev/shm usage
    # used by the Werkzeug interactive debugger. Keep hot reload, disable debugger.
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=True, use_debugger=False)