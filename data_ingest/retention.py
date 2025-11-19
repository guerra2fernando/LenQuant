"""Data retention and cleanup utilities for automatic data management."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import pandas as pd
from pymongo import MongoClient, UpdateOne

from data_ingest.config import IngestConfig
from db.client import get_database_name, mongo_client

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


@dataclass(frozen=True)
class DataRetentionConfig:
    """Configuration for data retention tiers."""

    # Tier 1: Full resolution (keep all intervals)
    tier1_days: int = 90

    # Tier 2: Medium resolution (keep 1h, 1d only)
    tier2_days: int = 365

    # Tier 3: Low resolution (keep 1d only) - keep indefinitely
    tier3_days: int = 365 * 10  # 10 years

    # Intervals to keep at each tier
    tier1_intervals: List[str] = ("1m", "1h", "1d")
    tier2_intervals: List[str] = ("1h", "1d")
    tier3_intervals: List[str] = ("1d",)

    # Cleanup configuration
    cleanup_interval_hours: int = 24  # Run cleanup daily
    batch_size: int = 10000  # Process in batches to avoid memory issues

    @classmethod
    def from_env(cls) -> "DataRetentionConfig":
        """Create config from environment variables."""
        import os

        return cls(
            tier1_days=int(os.getenv("DATA_RETENTION_TIER1_DAYS", "90")),
            tier2_days=int(os.getenv("DATA_RETENTION_TIER2_DAYS", "365")),
            tier3_days=int(os.getenv("DATA_RETENTION_TIER3_DAYS", str(365 * 10))),
            cleanup_interval_hours=int(os.getenv("DATA_RETENTION_CLEANUP_INTERVAL_HOURS", "24")),
            batch_size=int(os.getenv("DATA_RETENTION_BATCH_SIZE", "10000")),
        )

    def get_cutoff_dates(self) -> Dict[str, datetime]:
        """Get cutoff dates for each tier."""
        now = datetime.utcnow()
        return {
            "tier1": now - timedelta(days=self.tier1_days),
            "tier2": now - timedelta(days=self.tier2_days),
            "tier3": now - timedelta(days=self.tier3_days),
        }


def create_ttl_indexes(config: DataRetentionConfig) -> None:
    """Create TTL indexes for automatic data expiration."""
    with mongo_client() as client:
        db = client[get_database_name()]

        # Drop existing TTL indexes if they exist
        try:
            db.ohlcv.drop_index("tier1_ttl")
        except:
            pass
        try:
            db.ohlcv.drop_index("tier2_ttl")
        except:
            pass
        try:
            db.features.drop_index("tier1_ttl")
        except:
            pass
        try:
            db.features.drop_index("tier2_ttl")
        except:
            pass

        # Create new TTL indexes
        cutoffs = config.get_cutoff_dates()

        # OHLCV collection - Tier 1: expire minute data older than tier1_days
        db.ohlcv.create_index(
            [("timestamp", 1)],
            name="tier1_ttl",
            expireAfterSeconds=config.tier1_days * 24 * 60 * 60,
            partialFilterExpression={
                "interval": {"$in": ["1m"]},  # Only minute data
                "timestamp": {"$lt": cutoffs["tier1"]}
            }
        )

        # OHLCV collection - Tier 2: expire hourly data older than tier2_days
        db.ohlcv.create_index(
            [("timestamp", 1)],
            name="tier2_ttl",
            expireAfterSeconds=config.tier2_days * 24 * 60 * 60,
            partialFilterExpression={
                "interval": {"$in": ["1h"]},  # Only hourly data
                "timestamp": {"$lt": cutoffs["tier2"]}
            }
        )

        # Features collection - same TTL rules
        db.features.create_index(
            [("timestamp", 1)],
            name="tier1_ttl",
            expireAfterSeconds=config.tier1_days * 24 * 60 * 60,
            partialFilterExpression={
                "interval": {"$in": ["1m"]},
                "timestamp": {"$lt": cutoffs["tier1"]}
            }
        )

        db.features.create_index(
            [("timestamp", 1)],
            name="tier2_ttl",
            expireAfterSeconds=config.tier2_days * 24 * 60 * 60,
            partialFilterExpression={
                "interval": {"$in": ["1h"]},
                "timestamp": {"$lt": cutoffs["tier2"]}
            }
        )

        logger.info(f"Created TTL indexes for data retention (tier1: {config.tier1_days}d, tier2: {config.tier2_days}d)")


def downsample_minute_to_hourly(symbol: str, cutoff_date: datetime, config: DataRetentionConfig) -> int:
    """Downsample old minute data to hourly aggregates."""
    with mongo_client() as client:
        db = client[get_database_name()]

        # Get minute data older than cutoff
        pipeline = [
            {
                "$match": {
                    "symbol": symbol,
                    "interval": "1m",
                    "timestamp": {"$lt": cutoff_date}
                }
            },
            {
                "$group": {
                    "_id": {
                        "symbol": "$symbol",
                        "year": {"$year": "$timestamp"},
                        "month": {"$month": "$timestamp"},
                        "day": {"$dayOfMonth": "$timestamp"},
                        "hour": {"$hour": "$timestamp"}
                    },
                    "timestamp": {"$first": "$timestamp"},  # Use first timestamp of hour
                    "open": {"$first": "$open"},
                    "high": {"$max": "$high"},
                    "low": {"$min": "$low"},
                    "close": {"$last": "$close"},
                    "volume": {"$sum": "$volume"},
                    "source": {"$first": "$source"},
                    "count": {"$sum": 1}
                }
            },
            {
                "$match": {"count": {"$gte": 50}}  # Only create hourly bars with sufficient minute data
            },
            {
                "$project": {
                    "_id": 0,
                    "symbol": "$_id.symbol",
                    "interval": "1h",
                    "timestamp": "$timestamp",
                    "open": "$open",
                    "high": "$high",
                    "low": "$low",
                    "close": "$close",
                    "volume": "$volume",
                    "source": "$source"
                }
            }
        ]

        # Get aggregated hourly data
        hourly_data = list(db.ohlcv.aggregate(pipeline))

        if not hourly_data:
            return 0

        # Insert or update hourly data
        operations = []
        for doc in hourly_data:
            operations.append(
                UpdateOne(
                    {"symbol": doc["symbol"], "interval": "1h", "timestamp": doc["timestamp"]},
                    {"$set": doc},
                    upsert=True
                )
            )

        if operations:
            result = db.ohlcv.bulk_write(operations, ordered=False)
            count = result.upserted_count + result.modified_count
            logger.info(f"Created {count} hourly bars from minute data for {symbol}")
            return count

    return 0


def downsample_hourly_to_daily(symbol: str, cutoff_date: datetime, config: DataRetentionConfig) -> int:
    """Downsample old hourly data to daily aggregates."""
    with mongo_client() as client:
        db = client[get_database_name()]

        # Get hourly data older than cutoff
        pipeline = [
            {
                "$match": {
                    "symbol": symbol,
                    "interval": "1h",
                    "timestamp": {"$lt": cutoff_date}
                }
            },
            {
                "$group": {
                    "_id": {
                        "symbol": "$symbol",
                        "year": {"$year": "$timestamp"},
                        "month": {"$month": "$timestamp"},
                        "day": {"$dayOfMonth": "$timestamp"}
                    },
                    "timestamp": {"$first": "$timestamp"},  # Use first timestamp of day
                    "open": {"$first": "$open"},
                    "high": {"$max": "$high"},
                    "low": {"$min": "$low"},
                    "close": {"$last": "$close"},
                    "volume": {"$sum": "$volume"},
                    "source": {"$first": "$source"},
                    "count": {"$sum": 1}
                }
            },
            {
                "$match": {"count": {"$gte": 20}}  # Only create daily bars with sufficient hourly data
            },
            {
                "$project": {
                    "_id": 0,
                    "symbol": "$_id.symbol",
                    "interval": "1d",
                    "timestamp": "$timestamp",
                    "open": "$open",
                    "high": "$high",
                    "low": "$low",
                    "close": "$close",
                    "volume": "$volume",
                    "source": "$source"
                }
            }
        ]

        # Get aggregated daily data
        daily_data = list(db.ohlcv.aggregate(pipeline))

        if not daily_data:
            return 0

        # Insert or update daily data
        operations = []
        for doc in daily_data:
            operations.append(
                UpdateOne(
                    {"symbol": doc["symbol"], "interval": "1d", "timestamp": doc["timestamp"]},
                    {"$set": doc},
                    upsert=True
                )
            )

        if operations:
            result = db.ohlcv.bulk_write(operations, ordered=False)
            count = result.upserted_count + result.modified_count
            logger.info(f"Created {count} daily bars from hourly data for {symbol}")
            return count

    return 0


def cleanup_old_data(symbols: List[str], config: DataRetentionConfig) -> Dict[str, int]:
    """Run complete data cleanup and downsampling for all symbols."""
    results = {
        "ttl_indexes_created": 0,
        "minute_to_hourly_bars": 0,
        "hourly_to_daily_bars": 0,
        "collections_cleaned": 0
    }

    # Create/update TTL indexes
    try:
        create_ttl_indexes(config)
        results["ttl_indexes_created"] = 1
    except Exception as e:
        logger.error(f"Failed to create TTL indexes: {e}")

    cutoffs = config.get_cutoff_dates()

    for symbol in symbols:
        try:
            # Downsample minute data to hourly before it expires
            minute_cutoff = cutoffs["tier1"] - timedelta(days=7)  # Downsample 7 days before expiration
            results["minute_to_hourly_bars"] += downsample_minute_to_hourly(symbol, minute_cutoff, config)

            # Downsample hourly data to daily before it expires
            hourly_cutoff = cutoffs["tier2"] - timedelta(days=7)  # Downsample 7 days before expiration
            results["hourly_to_daily_bars"] += downsample_hourly_to_daily(symbol, hourly_cutoff, config)

        except Exception as e:
            logger.error(f"Failed to cleanup data for {symbol}: {e}")

    results["collections_cleaned"] = len(symbols)
    return results


def get_data_stats(symbols: List[str]) -> Dict[str, Dict[str, int]]:
    """Get current data statistics for monitoring."""
    stats = {}

    with mongo_client() as client:
        db = client[get_database_name()]

        for symbol in symbols:
            symbol_stats = {}

            # Count records by interval
            for interval in ["1m", "1h", "1d"]:
                count = db.ohlcv.count_documents({"symbol": symbol, "interval": interval})
                symbol_stats[f"ohlcv_{interval}"] = count

                features_count = db.features.count_documents({"symbol": symbol, "interval": interval})
                symbol_stats[f"features_{interval}"] = features_count

            stats[symbol] = symbol_stats

    return stats


def run_data_retention_maintenance() -> Dict[str, any]:
    """Main entry point for automated data retention maintenance."""
    logger.info("Starting automated data retention maintenance")

    # Get configuration
    retention_config = DataRetentionConfig.from_env()
    ingest_config = IngestConfig.from_env()

    symbols = ingest_config.symbols
    if not symbols:
        logger.warning("No symbols configured for data retention")
        return {"error": "No symbols configured"}

    # Run cleanup
    cleanup_results = cleanup_old_data(symbols, retention_config)

    # Get updated statistics
    stats = get_data_stats(symbols)

    result = {
        "timestamp": datetime.utcnow().isoformat(),
        "config": {
            "tier1_days": retention_config.tier1_days,
            "tier2_days": retention_config.tier2_days,
            "tier3_days": retention_config.tier3_days,
        },
        "cleanup_results": cleanup_results,
        "data_stats": stats
    }

    logger.info(f"Data retention maintenance completed: {cleanup_results}")
    return result


if __name__ == "__main__":
    run_data_retention_maintenance()
