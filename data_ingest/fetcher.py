"""Fetch historical OHLCV data and store it in MongoDB."""
from __future__ import annotations

import logging
import time
from argparse import ArgumentParser
from datetime import datetime, timedelta
from typing import Callable, Iterable, Optional

import ccxt  # type: ignore
from pymongo import MongoClient, UpdateOne

from data_ingest.config import IngestConfig, RateLimiter

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# Type alias for progress callback
ProgressCallback = Optional[Callable[[int, int, int, datetime], None]]

# Global rate limiter instance (shared across all fetches)
_rate_limiter: Optional[RateLimiter] = None


def get_rate_limiter(config: Optional[IngestConfig] = None) -> RateLimiter:
    """Get or create global rate limiter instance."""
    global _rate_limiter
    if _rate_limiter is None:
        cfg = config or IngestConfig.from_env()
        _rate_limiter = RateLimiter(requests_per_minute=cfg.rate_limit_per_minute)
    return _rate_limiter


def _exchange(name: str) -> ccxt.Exchange:
    exchange_class = getattr(ccxt, name)
    return exchange_class({"enableRateLimit": True})


def _build_ops(symbol: str, timeframe: str, rows: Iterable[list], source: str) -> list[UpdateOne]:
    operations: list[UpdateOne] = []
    for open_time, open_, high, low, close, volume in rows:
        ts = datetime.utcfromtimestamp(open_time / 1000)
        doc = {
            "symbol": symbol,
            "interval": timeframe,
            "timestamp": ts,
            "open": float(open_),
            "high": float(high),
            "low": float(low),
            "close": float(close),
            "volume": float(volume),
            "source": source,
        }
        operations.append(
            UpdateOne(
                {"symbol": symbol, "interval": timeframe, "timestamp": ts},
                {"$set": doc},
                upsert=True,
            )
        )
    return operations


def _fetch_with_retry(
    exchange: ccxt.Exchange,
    symbol: str,
    timeframe: str,
    since: Optional[int] = None,
    limit: int = 1000,
    max_retries: int = 3,
) -> list:
    """
    Fetch OHLCV with exponential backoff on rate limit errors.
    
    Args:
        exchange: CCXT exchange instance
        symbol: Trading pair
        timeframe: Candle interval
        since: Start timestamp in ms
        limit: Max candles per call
        max_retries: Maximum number of retry attempts
        
    Returns:
        List of OHLCV candles
        
    Raises:
        Exception: If all retries fail
    """
    rate_limiter = get_rate_limiter()
    
    for attempt in range(max_retries):
        try:
            # Apply rate limiting before each request
            wait_time = rate_limiter.wait_if_needed()
            if wait_time > 0:
                logger.debug(f"Rate limited: waited {wait_time:.2f}s")
            
            # Make the API call
            candles = exchange.fetch_ohlcv(symbol, timeframe=timeframe, since=since, limit=limit)
            return candles
            
        except ccxt.RateLimitExceeded as e:
            # Handle 429 rate limit errors with exponential backoff
            if attempt < max_retries - 1:
                backoff_time = 2 ** attempt  # 1s, 2s, 4s
                logger.warning(
                    f"Rate limit exceeded for {symbol} {timeframe}. "
                    f"Retrying in {backoff_time}s (attempt {attempt + 1}/{max_retries})"
                )
                time.sleep(backoff_time)
            else:
                logger.error(f"Rate limit exceeded after {max_retries} attempts for {symbol} {timeframe}")
                raise
                
        except ccxt.NetworkError as e:
            # Handle network errors with retry
            if attempt < max_retries - 1:
                backoff_time = 2 ** attempt
                logger.warning(
                    f"Network error for {symbol} {timeframe}: {e}. "
                    f"Retrying in {backoff_time}s (attempt {attempt + 1}/{max_retries})"
                )
                time.sleep(backoff_time)
            else:
                logger.error(f"Network error after {max_retries} attempts for {symbol} {timeframe}")
                raise
                
        except Exception as e:
            # Don't retry on other errors (e.g., invalid symbol)
            logger.error(f"Error fetching {symbol} {timeframe}: {e}")
            raise
    
    return []


def fetch_symbol_interval(
    symbol: str,
    timeframe: str,
    since: Optional[int] = None,
    limit: int = 1000,
    config: Optional[IngestConfig] = None,
    lookback_days: Optional[int] = None,
    progress_callback: ProgressCallback = None,
) -> int:
    """
    Fetch data for a single symbol/timeframe combination.
    
    Args:
        symbol: Trading pair symbol (e.g., 'BTC/USD')
        timeframe: Interval (e.g., '1m', '1h', '1d')
        since: UNIX timestamp in milliseconds to start from
        limit: Max candles per API call
        config: Configuration object
        lookback_days: Number of days to fetch if since is None
        progress_callback: Optional callback(batches_completed, batches_total, records_fetched, current_timestamp)
    
    Returns:
        Total number of records fetched
    """
    config = config or IngestConfig.from_env()
    limit = limit or config.batch_size
    lookback_days = lookback_days if lookback_days is not None else config.lookback_days
    exchange = _exchange(config.source)
    timeframe_ms = int(exchange.parse_timeframe(timeframe) * 1000)

    start_since = since
    if start_since is None and lookback_days and lookback_days > 0:
        start_since = int((datetime.utcnow() - timedelta(days=lookback_days)).timestamp() * 1000)

    total = 0
    now_ms = exchange.milliseconds()

    # Calculate expected batches for progress tracking
    expected_batches = 0
    if start_since is not None:
        time_range_ms = now_ms - start_since
        candles_needed = time_range_ms // timeframe_ms
        expected_batches = max(1, int(candles_needed / limit))
    else:
        expected_batches = 1
    
    batches_completed = 0

    logger.info(
        "Fetching %s %s candles (batch=%s, lookback_days=%s, estimated_batches=%s)",
        symbol,
        timeframe,
        limit,
        lookback_days,
        expected_batches,
    )

    with MongoClient(config.mongo_uri) as client:
        db = client.get_database(config.database)
        collection = db["ohlcv"]

        if start_since is not None:
            next_since = start_since
            while True:
                # Use the retry wrapper for API calls
                candles = _fetch_with_retry(exchange, symbol, timeframe, next_since, limit)
                if not candles:
                    logger.info("No more candles returned for %s %s at since=%s", symbol, timeframe, next_since)
                    break

                ops = _build_ops(symbol, timeframe, candles, config.source)
                if ops:
                    collection.bulk_write(ops, ordered=False)
                    total += len(ops)

                batches_completed += 1
                
                # Call progress callback if provided
                if progress_callback:
                    current_ts = datetime.utcfromtimestamp(candles[-1][0] / 1000)
                    try:
                        progress_callback(batches_completed, expected_batches, total, current_ts)
                    except Exception as e:
                        logger.warning(f"Progress callback error: {e}")

                last_open = candles[-1][0]
                next_since = last_open + timeframe_ms
                if len(candles) < limit or next_since >= now_ms:
                    break
        else:
            # Use the retry wrapper for single fetch
            candles = _fetch_with_retry(exchange, symbol, timeframe, None, limit)
            if not candles:
                logger.warning("No candles returned for %s %s", symbol, timeframe)
                return 0
            ops = _build_ops(symbol, timeframe, candles, config.source)
            if ops:
                collection.bulk_write(ops, ordered=False)
                total += len(ops)
            
            batches_completed = 1
            
            # Call progress callback for single batch
            if progress_callback and candles:
                current_ts = datetime.utcfromtimestamp(candles[-1][0] / 1000)
                try:
                    progress_callback(batches_completed, expected_batches, total, current_ts)
                except Exception as e:
                    logger.warning(f"Progress callback error: {e}")

    logger.info("Stored %s candles for %s %s", total, symbol, timeframe)
    return total


def _parse_args() -> tuple[Optional[str], Optional[str], Optional[int], int, Optional[int]]:
    parser = ArgumentParser(description="Fetch OHLCV data into MongoDB.")
    parser.add_argument("--symbol", help="Trading pair symbol, e.g., BTC/USD")
    parser.add_argument("--interval", help="Timeframe, e.g., 1m, 1h, 1d")
    parser.add_argument("--since", type=int, help="UNIX ms timestamp to start from")
    parser.add_argument("--limit", type=int, default=1000, help="Max candles per call")
    parser.add_argument("--lookback-days", type=int, help="Number of days to backfill if --since not provided")
    args = parser.parse_args()
    return args.symbol, args.interval, args.since, args.limit, args.lookback_days


def main() -> None:
    config = IngestConfig.from_env()
    symbol, interval, since, limit, lookback_days = _parse_args()
    total = 0

    symbols = [symbol] if symbol else config.symbols
    intervals = [interval] if interval else config.intervals

    if not symbols:
        raise ValueError("No symbols defined. Set DEFAULT_SYMBOLS or pass --symbol.")
    if not intervals:
        raise ValueError("No intervals defined. Set FEATURE_INTERVALS or pass --interval.")

    for sym in symbols:
        for intv in intervals:
            total += fetch_symbol_interval(
                sym,
                intv,
                since=since,
                limit=limit,
                config=config,
                lookback_days=lookback_days,
            )

    logger.info("Completed ingestion: %s total candles upserted", total)


if __name__ == "__main__":
    main()

