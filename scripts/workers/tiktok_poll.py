#!/usr/bin/env python3
"""
Background worker to poll TikTok comments/mentions periodically (where available).

This calls:
  POST /integrations/tiktok/poll

Run as a cron job:
    */15 * * * * cd /path/to/project && python worker_tiktok_poll.py --once
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


def poll_tiktok_once(base_url: str = "http://127.0.0.1:5000", query: str = "enterprise ghana", limit: int = 25):
    url = f"{base_url}/integrations/tiktok/poll"
    try:
        response = requests.post(url, json={"query": query, "limit": limit}, timeout=90)
        if response.status_code == 200:
            data = response.json()
            logger.info(
                f"TikTok poll successful: {data.get('processed', 0)} processed (found {data.get('items_found', 0)})"
            )
        else:
            logger.warning(f"TikTok poll failed: {response.status_code} - {response.text}")
    except Exception as e:
        logger.exception(f"Error calling TikTok poll endpoint: {e}")


def main():
    parser = argparse.ArgumentParser(description="TikTok polling worker")
    parser.add_argument("--interval", type=int, default=900, help="Polling interval seconds (default 900)")
    parser.add_argument("--url", default="http://127.0.0.1:5000", help="Base URL of the Flask app")
    parser.add_argument("--once", action="store_true", help="Run once and exit (for cron jobs)")
    parser.add_argument("--query", default="enterprise ghana", help="Query to pass to the TikTok poller")
    parser.add_argument("--limit", type=int, default=25, help="Max items per poll (1-100)")
    args = parser.parse_args()

    if args.once:
        logger.info("Running TikTok poll once...")
        poll_tiktok_once(args.url, query=args.query, limit=args.limit)
        return

    logger.info(f"Starting TikTok poll worker (interval: {args.interval}s)")
    while True:
        try:
            poll_tiktok_once(args.url, query=args.query, limit=args.limit)
        except KeyboardInterrupt:
            logger.info("Stopping TikTok poll worker")
            break
        except Exception as e:
            logger.exception(f"Unexpected error in worker: {e}")
        time.sleep(args.interval)


if __name__ == "__main__":
    main()

