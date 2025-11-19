"""Migration to set up data retention TTL indexes and clean up existing data."""
from __future__ import annotations

import logging
from datetime import datetime

from data_ingest.retention import DataRetentionConfig, cleanup_old_data, create_ttl_indexes
from data_ingest.config import IngestConfig
from db.client import get_database_name, mongo_client

logger = logging.getLogger(__name__)


def migrate_data_retention():
    """Set up data retention for existing database."""
    logger.info("Starting data retention migration")

    # Get configurations
    retention_config = DataRetentionConfig.from_env()
    ingest_config = IngestConfig.from_env()

    logger.info(f"Data retention config: tier1={retention_config.tier1_days}d, tier2={retention_config.tier2_days}d")

    symbols = ingest_config.symbols
    if not symbols:
        logger.warning("No symbols configured - skipping data retention setup")
        return

    # Create TTL indexes
    logger.info("Creating TTL indexes for automatic data expiration")
    create_ttl_indexes(retention_config)

    # Run initial cleanup on existing data
    logger.info(f"Running initial data cleanup for {len(symbols)} symbols")
    cleanup_results = cleanup_old_data(symbols, retention_config)

    logger.info(f"Data retention migration completed: {cleanup_results}")

    return {
        "migration": "data_retention_setup",
        "timestamp": datetime.utcnow().isoformat(),
        "config": {
            "tier1_days": retention_config.tier1_days,
            "tier2_days": retention_config.tier2_days,
            "tier3_days": retention_config.tier3_days,
        },
        "cleanup_results": cleanup_results,
        "symbols_processed": len(symbols)
    }


def rollback_data_retention():
    """Rollback data retention setup by removing TTL indexes."""
    logger.info("Rolling back data retention migration")

    with mongo_client() as client:
        db = client[get_database_name()]

        # Remove TTL indexes
        try:
            db.ohlcv.drop_index("tier1_ttl")
            logger.info("Dropped tier1_ttl index from ohlcv collection")
        except Exception as e:
            logger.warning(f"Could not drop tier1_ttl index from ohlcv: {e}")

        try:
            db.ohlcv.drop_index("tier2_ttl")
            logger.info("Dropped tier2_ttl index from ohlcv collection")
        except Exception as e:
            logger.warning(f"Could not drop tier2_ttl index from ohlcv: {e}")

        try:
            db.features.drop_index("tier1_ttl")
            logger.info("Dropped tier1_ttl index from features collection")
        except Exception as e:
            logger.warning(f"Could not drop tier1_ttl index from features: {e}")

        try:
            db.features.drop_index("tier2_ttl")
            logger.info("Dropped tier2_ttl index from features collection")
        except Exception as e:
            logger.warning(f"Could not drop tier2_ttl index from features: {e}")

    logger.info("Data retention rollback completed")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        rollback_data_retention()
    else:
        result = migrate_data_retention()
        print(f"Migration completed: {result}")
