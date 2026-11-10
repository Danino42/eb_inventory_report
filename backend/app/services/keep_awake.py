"""Render's free plan stops the server after 15 minutes without requests; the next request then
waits about a minute while it starts again (cold start). On Render the server therefore calls its
own public address every 10 minutes, so it never counts as idle. A GitHub Actions job pings it
from outside as well (.github/workflows/keep-awake.yml)."""

import asyncio
import logging
import urllib.request

logger = logging.getLogger(__name__)

INTERVAL_SECONDS = 10 * 60


def _ping(url: str) -> None:
    with urllib.request.urlopen(url, timeout=60) as response:
        response.read()


async def keep_awake(url: str, interval: float = INTERVAL_SECONDS) -> None:
    """Pings url until cancelled (at shutdown). A failed ping is only logged."""
    while True:
        await asyncio.sleep(interval)
        try:
            await asyncio.to_thread(_ping, url)
        except Exception as exc:  # keep going whatever happened (network, timeout, 5xx)
            logger.warning("Keep-awake ping to %s failed: %s", url, exc)
