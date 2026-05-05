#!/usr/bin/env python3
"""
Background worker to poll X (Twitter) mentions/search periodically.

Run as a cron job or systemd service:
    */15 * * * * cd /path/to/project && python worker_x_poll.py --once

Or run continuously:
    python worker_x_poll.py --interval 900
"""
import argparse
import logging
import time

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def poll_x_once(base_url: str = "http://127.0.0.1:5000", max_results: int = 25):
    url = f"{base_url}/integrations/x/poll"
    try:
        response = requests.post(url, json={"max_results": max_results}, timeout=90)
        if response.status_code == 200:
            data = response.json()
            logger.info(
                f"X poll successful: {data.get('processed', 0)} processed (found {data.get('items_found', 0)})"
            )
        else:
            logger.warning(f"X poll failed: {response.status_code} - {response.text}")
    except Exception as e:
        logger.exception(f"Error calling X poll endpoint: {e}")


def main():
    parser = argparse.ArgumentParser(description="X polling worker")
    parser.add_argument("--interval", type=int, default=900, help="Polling interval seconds (default 900)")
    parser.add_argument("--url", default="http://127.0.0.1:5000", help="Base URL of the Flask app")
    parser.add_argument("--once", action="store_true", help="Run once and exit (for cron jobs)")
    parser.add_argument("--max-results", type=int, default=25, help="Max X items per poll (10-100)")
    args = parser.parse_args()

    if args.once:
        logger.info("Running X poll once...")
        poll_x_once(args.url, max_results=args.max_results)
        return

    logger.info(f"Starting X poll worker (interval: {args.interval}s)")
    while True:
        try:
            poll_x_once(args.url, max_results=args.max_results)
        except KeyboardInterrupt:
            logger.info("Stopping X poll worker")
            break
        except Exception as e:
            logger.exception(f"Unexpected error in worker: {e}")
        time.sleep(args.interval)


if __name__ == "__main__":
    main()

