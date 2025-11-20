"""Detect gaps in OHLCV data to identify missing candles."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import ccxt  # type: ignore
from pymongo import MongoClient

from data_ingest.config import IngestConfig

logger = logging.getLogger(__name__)


class DataGap:
    """Represents a gap in OHLCV data."""
    
    def __init__(
        self,
        symbol: str,
        interval: str,
        start_timestamp: datetime,
        end_timestamp: datetime,
        missing_candles: int,
    ):
        self.symbol = symbol
        self.interval = interval
        self.start_timestamp = start_timestamp
        self.end_timestamp = end_timestamp
        self.missing_candles = missing_candles
    
    def to_dict(self) -> Dict:
        """Convert to dictionary representation."""
        return {
            "symbol": self.symbol,
            "interval": self.interval,
            "start_timestamp": self.start_timestamp.isoformat(),
            "end_timestamp": self.end_timestamp.isoformat(),
            "missing_candles": self.missing_candles,
            "gap_duration_hours": (self.end_timestamp - self.start_timestamp).total_seconds() / 3600,
        }
    
    def __repr__(self) -> str:
        return (
            f"DataGap(symbol={self.symbol}, interval={self.interval}, "
            f"start={self.start_timestamp}, end={self.end_timestamp}, "
            f"missing={self.missing_candles})"
        )


def _get_interval_seconds(interval: str) -> int:
    """
    Convert interval string to seconds.
    
    Args:
        interval: Interval string (e.g., '1m', '5m', '1h', '1d')
        
    Returns:
        Number of seconds in the interval
    """
    exchange = ccxt.binance()
    return int(exchange.parse_timeframe(interval))


def detect_data_gaps(
    symbol: str,
    interval: str,
    config: Optional[IngestConfig] = None,
    gap_threshold_multiplier: float = 2.5,
) -> List[DataGap]:
    """
    Detect gaps in OHLCV data for a symbol/interval combination.
    
    A gap is identified when the time between consecutive candles exceeds
    gap_threshold_multiplier times the expected interval.
    
    Args:
        symbol: Trading pair symbol (e.g., 'BTC/USD')
        interval: Interval (e.g., '1m', '5m', '1h', '1d')
        config: Configuration object
        gap_threshold_multiplier: Multiplier for gap detection threshold
                                   (default 2.5 means gaps > 2.5x interval are flagged)
    
    Returns:
        List of DataGap objects representing missing data periods
    """
    config = config or IngestConfig.from_env()
    interval_seconds = _get_interval_seconds(interval)
    threshold_seconds = interval_seconds * gap_threshold_multiplier
    
    gaps: List[DataGap] = []
    
    logger.info(
        f"Detecting gaps for {symbol} {interval} "
        f"(interval={interval_seconds}s, threshold={threshold_seconds}s)"
    )
    
    with MongoClient(config.mongo_uri) as client:
        db = client.get_database(config.database)
        collection = db["ohlcv"]
        
        # Fetch all candles for this symbol/interval, sorted by timestamp
        candles = list(collection.find(
            {"symbol": symbol, "interval": interval},
            {"timestamp": 1, "_id": 0}
        ).sort("timestamp", 1))
        
        if len(candles) < 2:
            logger.info(f"Not enough data to detect gaps for {symbol} {interval}")
            return gaps
        
        logger.info(f"Checking {len(candles)} candles for gaps")
        
        # Check time difference between consecutive candles
        prev_timestamp = candles[0]["timestamp"]
        
        for i in range(1, len(candles)):
            current_timestamp = candles[i]["timestamp"]
            time_diff = (current_timestamp - prev_timestamp).total_seconds()
            
            # If gap is larger than threshold, record it
            if time_diff > threshold_seconds:
                missing_candles = int(time_diff / interval_seconds) - 1
                
                gap = DataGap(
                    symbol=symbol,
                    interval=interval,
                    start_timestamp=prev_timestamp,
                    end_timestamp=current_timestamp,
                    missing_candles=missing_candles,
                )
                
                gaps.append(gap)
                logger.warning(
                    f"Gap detected: {symbol} {interval} from {prev_timestamp} to {current_timestamp} "
                    f"({missing_candles} missing candles)"
                )
            
            prev_timestamp = current_timestamp
    
    logger.info(f"Found {len(gaps)} gap(s) for {symbol} {interval}")
    return gaps


def detect_recent_data_gaps(
    symbol: str,
    interval: str,
    days: int = 7,
    config: Optional[IngestConfig] = None,
) -> List[DataGap]:
    """
    Detect gaps in recent data (e.g., last 7 days).
    
    This is faster than scanning all historical data.
    
    Args:
        symbol: Trading pair symbol
        interval: Interval
        days: Number of recent days to check
        config: Configuration object
        
    Returns:
        List of DataGap objects in the recent period
    """
    config = config or IngestConfig.from_env()
    interval_seconds = _get_interval_seconds(interval)
    threshold_seconds = interval_seconds * 2.5
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    gaps: List[DataGap] = []
    
    logger.info(f"Detecting gaps for {symbol} {interval} since {cutoff_date}")
    
    with MongoClient(config.mongo_uri) as client:
        db = client.get_database(config.database)
        collection = db["ohlcv"]
        
        # Fetch recent candles only
        candles = list(collection.find(
            {
                "symbol": symbol,
                "interval": interval,
                "timestamp": {"$gte": cutoff_date}
            },
            {"timestamp": 1, "_id": 0}
        ).sort("timestamp", 1))
        
        if len(candles) < 2:
            logger.info(f"Not enough recent data to detect gaps for {symbol} {interval}")
            return gaps
        
        logger.info(f"Checking {len(candles)} recent candles for gaps")
        
        prev_timestamp = candles[0]["timestamp"]
        
        for i in range(1, len(candles)):
            current_timestamp = candles[i]["timestamp"]
            time_diff = (current_timestamp - prev_timestamp).total_seconds()
            
            if time_diff > threshold_seconds:
                missing_candles = int(time_diff / interval_seconds) - 1
                
                gap = DataGap(
                    symbol=symbol,
                    interval=interval,
                    start_timestamp=prev_timestamp,
                    end_timestamp=current_timestamp,
                    missing_candles=missing_candles,
                )
                
                gaps.append(gap)
            
            prev_timestamp = current_timestamp
    
    logger.info(f"Found {len(gaps)} gap(s) in recent data for {symbol} {interval}")
    return gaps


def get_all_symbols_gaps(
    config: Optional[IngestConfig] = None,
    recent_days_only: Optional[int] = None,
) -> Dict[str, List[DataGap]]:
    """
    Detect gaps for all enabled symbols and intervals.
    
    Args:
        config: Configuration object
        recent_days_only: If specified, only check recent N days
        
    Returns:
        Dictionary mapping "symbol|interval" to list of gaps
    """
    config = config or IngestConfig.from_env()
    all_gaps: Dict[str, List[DataGap]] = {}
    
    with MongoClient(config.mongo_uri) as client:
        db = client.get_database(config.database)
        
        # Get all enabled symbols
        symbols_cursor = db["symbols"].find({"enabled": True})
        
        for symbol_doc in symbols_cursor:
            symbol = symbol_doc["symbol"]
            intervals_status = symbol_doc.get("intervals_status", {})
            
            for interval in intervals_status.keys():
                key = f"{symbol}|{interval}"
                
                try:
                    if recent_days_only:
                        gaps = detect_recent_data_gaps(symbol, interval, days=recent_days_only, config=config)
                    else:
                        gaps = detect_data_gaps(symbol, interval, config=config)
                    
                    if gaps:
                        all_gaps[key] = gaps
                        
                except Exception as e:
                    logger.error(f"Error detecting gaps for {symbol} {interval}: {e}")
    
    return all_gaps

