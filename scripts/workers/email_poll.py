#!/usr/bin/env python3
"""
Background worker to poll email inbox periodically.

Run this as a cron job or systemd service:
    */15 * * * * cd /path/to/project && python worker_email_poll.py

Or run continuously:
    python worker_email_poll.py --interval 900  # poll every 15 minutes
"""
import argparse
import logging
import time
from datetime import timedelta

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def poll_email_once(base_url: str = "http://127.0.0.1:5000"):
    """Call the email poll endpoint once."""
    url = f"{base_url}/integrations/email/poll"
    try:
        response = requests.post(url, json={}, timeout=60)
        if response.status_code == 200:
            data = response.json()
            logger.info(f"Email poll successful: {data.get('processed', 0)} emails processed")
        else:
            logger.warning(f"Email poll failed: {response.status_code} - {response.text}")
    except Exception as e:
        logger.exception(f"Error calling email poll endpoint: {e}")


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
        help="Base URL of the Flask app (default: http://127.0.0.1:5000)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run once and exit (for cron jobs)",
    )

    args = parser.parse_args()

    if args.once:
        logger.info("Running email poll once...")
        poll_email_once(args.url)
    else:
        logger.info(f"Starting email poll worker (interval: {args.interval}s)")
        while True:
            try:
                poll_email_once(args.url)
            except KeyboardInterrupt:
                logger.info("Stopping email poll worker")
                break
            except Exception as e:
                logger.exception(f"Unexpected error in worker: {e}")

            time.sleep(args.interval)


if __name__ == "__main__":
    main()
