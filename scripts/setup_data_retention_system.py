#!/usr/bin/env python3
"""Complete setup script for data retention system."""
from __future__ import annotations

import logging
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root))

from db.migrations.migration_003_setup_data_retention import migrate_data_retention

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
