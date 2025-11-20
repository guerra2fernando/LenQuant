"""Clean database for fresh start with new data ingestion system.

IMPORTANT: This will delete all OHLCV, features, symbols, and ingestion_jobs data.
           Only users collection will be preserved.
           
Usage:
    python scripts/clean_database_for_fresh_start.py
"""
from __future__ import annotations

import logging
import sys

from db.client import get_database_name, mongo_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def confirm_deletion() -> bool:
    """Ask user to confirm deletion."""
    print("\n" + "="*70)
    print("⚠️  WARNING: DATABASE CLEANUP")
    print("="*70)
    print("\nThis will DELETE the following collections:")
    print("  ❌ ohlcv (all market data)")
    print("  ❌ features (all technical indicators)")
    print("  ❌ symbols (all symbol configurations)")
    print("  ❌ ingestion_jobs (all job history)")
    print("\n✅ Will PRESERVE:")
    print("  ✓ users (your login credentials)")
    print("  ✓ Other collections (trades, strategies, etc.)")
    print("\n" + "="*70)
    
    response = input("\nType 'DELETE' to proceed (anything else to cancel): ")
    return response.strip() == "DELETE"


def clean_database() -> None:
    """Clean database by dropping specific collections."""
    if not confirm_deletion():
        print("\n❌ Cancelled. No data was deleted.\n")
        sys.exit(0)
    
    print("\n🗑️  Starting cleanup...\n")
    
    with mongo_client() as client:
        db = client[get_database_name()]
        
        collections_to_drop = ["ohlcv", "features", "symbols", "ingestion_jobs"]
        
        for collection_name in collections_to_drop:
            try:
                # Check if collection exists
                if collection_name in db.list_collection_names():
                    count_before = db[collection_name].count_documents({})
                    db[collection_name].drop()
                    print(f"  ✓ Dropped {collection_name} ({count_before:,} documents)")
                else:
                    print(f"  ⊘ Skipped {collection_name} (doesn't exist)")
            except Exception as e:
                print(f"  ❌ Failed to drop {collection_name}: {e}")
                logger.error(f"Error dropping {collection_name}", exc_info=True)
        
        # Verify users collection still exists
        users_count = db["users"].count_documents({})
        print(f"\n✅ Users collection preserved ({users_count} user(s))")
    
    print("\n" + "="*70)
    print("✅ DATABASE CLEANUP COMPLETE")
    print("="*70)
    print("\nNext steps:")
    print("  1. Restart your API server")
    print("  2. Go to Get Started page")
    print("  3. Select symbols and intervals")
    print("  4. Click 'Start Setup'")
    print("  5. You'll be redirected to Settings to watch progress")
    print("\nAll symbols will be created with 'enabled: true' automatically.")
    print("="*70 + "\n")


if __name__ == "__main__":
    try:
        clean_database()
    except KeyboardInterrupt:
        print("\n\n❌ Cancelled by user. No data was deleted.\n")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Cleanup failed: {e}", exc_info=True)
        print(f"\n❌ Error during cleanup: {e}\n")
        sys.exit(1)

