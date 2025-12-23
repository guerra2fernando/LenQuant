"""Configuration helpers for data ingestion jobs."""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import List
from urllib.parse import urlparse

from dotenv import load_dotenv


# Load environment variables from the project root `.env` file once this module is imported.
# `find_dotenv` falls back to the current working directory if the file is elsewhere.
load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env", override=False)


def _parse_csv(value: str | None) -> List[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


class RateLimiter:
    """
    Token bucket rate limiter for exchange API calls.
    
    Binance allows 1200 requests per minute (weight-based).
    We use a simpler requests-per-minute limit for safety.
    """
    
    def __init__(self, requests_per_minute: int = 1000):
        """
        Initialize rate limiter.
        
        Args:
            requests_per_minute: Maximum requests allowed per minute.
                                 Default 1000 to stay under Binance's 1200 limit.
        """
        self.requests_per_minute = requests_per_minute
        self.min_interval = 60.0 / requests_per_minute  # seconds between requests
        self.last_request_time = 0.0
        self.lock = Lock()
    
    def wait_if_needed(self) -> float:
        """
        Wait if necessary to respect rate limit.
        
        Returns:
            Time waited in seconds (0 if no wait needed).
        """
        with self.lock:
            now = time.time()
            time_since_last = now - self.last_request_time
            
            if time_since_last < self.min_interval:
                wait_time = self.min_interval - time_since_last
                time.sleep(wait_time)
                self.last_request_time = time.time()
                return wait_time
            else:
                self.last_request_time = now
                return 0.0


@dataclass(frozen=True)
class IngestConfig:
    mongo_uri: str
    database: str
    symbols: List[str]
    intervals: List[str]
    source: str = "binance"
    lookback_days: int = 30
    batch_size: int = 1000
    rate_limit_per_minute: int = 1000

    @classmethod
    def from_env(cls) -> "IngestConfig":
        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/cryptotrader")
        # Parse the URI so query params (e.g. ?authSource=admin) don't become part of the DB name
        parsed = urlparse(mongo_uri)
        path = parsed.path.lstrip("/")
        db_name = path.split("/", 1)[0] if path else "cryptotrader"
        lookback_days = int(os.getenv("DEFAULT_LOOKBACK_DAYS", "30"))
        batch_size = int(os.getenv("INGEST_BATCH_SIZE", "1000"))
        rate_limit = int(os.getenv("EXCHANGE_RATE_LIMIT_PER_MINUTE", "1000"))
        source = os.getenv("EXCHANGE_SOURCE", "binance")  # Can be: binance, kraken, coinbase, etc.
        return cls(
            mongo_uri=mongo_uri,
            database=db_name,
            symbols=_parse_csv(os.getenv("DEFAULT_SYMBOLS")),
            intervals=_parse_csv(os.getenv("FEATURE_INTERVALS")) or ["1m"],
            source=source,
            lookback_days=lookback_days,
            batch_size=batch_size,
            rate_limit_per_minute=rate_limit,
        )

