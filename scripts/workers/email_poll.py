#!/usr/bin/env python3
"""
Background worker to poll email inbox periodically.

Local Flask (no /api prefix on the integration routes):
    python scripts/workers/email_poll.py --once

Vercel production (Cron uses GET + CRON_SECRET; you can mimic that here):
    CRON_SECRET=... python scripts/workers/email_poll.py --once \\
      --url https://YOUR_PROJECT.vercel.app --vercel

Run as cron on a server:
    */15 * * * * cd /path/to/repo && ../.venv/bin/python scripts/workers/email_poll.py --once

Or run continuously:
    python scripts/workers/email_poll.py --interval 900  # poll every 15 minutes
"""
import argparse
import logging
import os
import time

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def poll_email_once(
    base_url: str = "http://127.0.0.1:5000",
    *,
    vercel: bool = False,
    cron_secret: str | None = None,
):
    """Call the email poll endpoint once.

    Local: POST …/integrations/email/poll with JSON {}.
    Vercel (--vercel): GET …/api/integrations/email/poll with Authorization: Bearer <CRON_SECRET>.
    """
    base = base_url.rstrip("/")
    path = "/api/integrations/email/poll" if vercel else "/integrations/email/poll"
    url = f"{base}{path}"

    try:
        if vercel:
            secret = (cron_secret or os.getenv("CRON_SECRET") or "").strip()
            if not secret:
                logger.warning(
                    "Vercel mode requires CRON_SECRET (env or argument). Same as Vercel Cron."
                )
            headers = {"Authorization": f"Bearer {secret}"} if secret else {}
            response = requests.get(url, headers=headers, timeout=120)
        else:
            headers = {}
            response = requests.post(url, json={}, headers=headers, timeout=120)

        if response.status_code == 200:
            data = response.json()
            logger.info(
                "Email poll successful: %s emails processed",
                data.get("processed", 0),
            )
        else:
            logger.warning("Email poll failed: %s - %s", response.status_code, response.text)
    except Exception as e:
        logger.exception("Error calling email poll endpoint: %s", e)


def main():
    parser = argparse.ArgumentParser(description="Email polling worker")
    parser.add_argument(
        "--interval",
        type=int,
        default=900,
        help="Polling interval in seconds (default: 900 = 15 minutes)",
    )
    parser.add_argument(
        "--url",
        default="http://127.0.0.1:5000",
        help="Origin only, e.g. http://127.0.0.1:5000 or https://your-app.vercel.app",
    )
    parser.add_argument(
        "--vercel",
        action="store_true",
        help="Use GET /api/integrations/email/poll + CRON_SECRET (matches Vercel Cron)",
    )
    parser.add_argument(
        "--cron-secret",
        default=None,
        help="Bearer token for Vercel mode (defaults to CRON_SECRET env var)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run once and exit (for cron jobs)",
    )

    args = parser.parse_args()
    cron_secret = args.cron_secret
    if cron_secret is None and args.vercel:
        cron_secret = os.getenv("CRON_SECRET")

    if args.once:
        logger.info("Running email poll once...")
        poll_email_once(args.url, vercel=args.vercel, cron_secret=cron_secret)
    else:
        logger.info("Starting email poll worker (interval: %ss)", args.interval)
        while True:
            try:
                poll_email_once(args.url, vercel=args.vercel, cron_secret=cron_secret)
            except KeyboardInterrupt:
                logger.info("Stopping email poll worker")
                break
            except Exception as e:
                logger.exception("Unexpected error in worker: %s", e)

            time.sleep(args.interval)


if __name__ == "__main__":
    main()
