"""Fix existing symbols to set enabled=True."""
from __future__ import annotations

import logging

from db.client import get_database_name, mongo_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def fix_symbols_enabled() -> int:
    """Set enabled=True for all symbols in database."""
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Find all symbols without enabled field or with enabled=False
        result = db["symbols"].update_many(
            {},
            {"$set": {"enabled": True}}
        )
        
        logger.info(f"Updated {result.modified_count} symbols to enabled=True")
        return result.modified_count


if __name__ == "__main__":
    count = fix_symbols_enabled()
    print(f"✓ Fixed {count} symbols - all are now enabled")

