#!/usr/bin/env python3
"""
Build Tailwind CSS for production.
Downloads Tailwind CLI if needed and compiles CSS.
"""
import os
import platform
import subprocess
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
TAILWIND_BIN = BASE_DIR / "scripts" / "frontend" / "tailwindcss"
INPUT_CSS = BASE_DIR / "backend" / "app" / "static" / "src" / "input.css"
OUTPUT_CSS = BASE_DIR / "backend" / "app" / "static" / "css" / "output.css"
TAILWIND_CONFIG = BASE_DIR / "config" / "frontend" / "tailwind.backend-static.config.js"


def download_tailwind_cli():
    """Download Tailwind CLI standalone binary."""
    system = platform.system().lower()
    machine = platform.machine().lower()

    if system == "linux":
        if "x86_64" in machine or "amd64" in machine:
            url = "https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-x64"
        elif "aarch64" in machine or "arm64" in machine:
            url = "https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-arm64"
        else:
            raise RuntimeError(f"Unsupported Linux architecture: {machine}")
    elif system == "darwin":
        if "arm64" in machine or "aarch64" in machine:
            url = "https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-macos-arm64"
        else:
            url = "https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-macos-x64"
    else:
        raise RuntimeError(f"Unsupported OS: {system}")

    print(f"Downloading Tailwind CLI from {url}...")
    urllib.request.urlretrieve(url, TAILWIND_BIN)
    os.chmod(TAILWIND_BIN, 0o755)
    print("Download complete.")


def build_css():
    """Build Tailwind CSS."""
    if not TAILWIND_BIN.exists():
        download_tailwind_cli()

    OUTPUT_CSS.parent.mkdir(parents=True, exist_ok=True)

    print("Building CSS...")
    result = subprocess.run(
        [
            str(TAILWIND_BIN),
            "-c", str(TAILWIND_CONFIG),
            "-i", str(INPUT_CSS),
            "-o", str(OUTPUT_CSS),
            "--minify",
        ],
        check=True,
    )

    print(f"CSS built successfully to {OUTPUT_CSS}")


if __name__ == "__main__":
    build_css()
