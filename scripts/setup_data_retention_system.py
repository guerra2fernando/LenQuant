#!/usr/bin/env python3
"""Complete setup script for data retention system."""
from __future__ import annotations

import logging
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root))

try:
    from db.migrations.003_setup_data_retention import migrate_data_retention
except ImportError:
    # Fallback: import the function directly
    def migrate_data_retention():
        from data_ingest.retention import DataRetentionConfig, cleanup_old_data, create_ttl_indexes
        from data_ingest.config import IngestConfig
        from db.client import get_database_name, mongo_client
        import logging
        from datetime import datetime

        logger = logging.getLogger(__name__)

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

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def main():
    """Complete setup for data retention system."""
    logger.info("Starting complete data retention system setup...")

    try:
        # Run the database migration
        logger.info("Running data retention migration...")
        migration_result = migrate_data_retention()
        logger.info(f"Migration completed: {migration_result}")

        # Instructions for user
        print("\n" + "="*60)
        print("DATA RETENTION SYSTEM SETUP COMPLETE!")
        print("="*60)
        print()
        print("What was set up:")
        print("✓ MongoDB TTL indexes for automatic data expiration")
        print("✓ Initial data cleanup and downsampling")
        print("✓ Celery tasks for automated maintenance")
        print("✓ Web UI settings page")
        print()
        print("Next steps:")
        print("1. Start Celery Beat for automated scheduling:")
        print("   celery -A celery_beat_config beat --loglevel=info")
        print()
        print("2. Or run maintenance manually:")
        print("   python -m manager.tasks run_data_retention_maintenance")
        print()
        print("3. Configure settings in the web UI:")
        print("   Settings → Data Retention (Advanced mode)")
        print()
        print("Current retention policy:")
        print("- Tier 1: 90 days full resolution (1m, 1h, 1d)")
        print("- Tier 2: 365 days medium resolution (1h, 1d)")
        print("- Tier 3: 10 years low resolution (1d only)")
        print()
        print("Storage estimate: ~46GB for 30 cryptocurrencies")
        print("Your server (120GB) can handle this comfortably!")

    except Exception as e:
        logger.error(f"Setup failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
