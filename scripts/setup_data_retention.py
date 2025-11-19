#!/usr/bin/env python3
"""Setup data retention system for automatic data cleanup."""
from __future__ import annotations

import logging
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root))

from db.migrations.migration_003_setup_data_retention import migrate_data_retention, rollback_data_retention

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def main():
    """Run data retention setup."""
    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        logger.info("Rolling back data retention setup")
        rollback_data_retention()
        logger.info("Rollback completed")
    else:
        logger.info("Setting up data retention system")
        result = migrate_data_retention()
        logger.info(f"Data retention setup completed: {result}")


if __name__ == "__main__":
    main()
