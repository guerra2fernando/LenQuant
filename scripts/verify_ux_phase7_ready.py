#!/usr/bin/env python3
"""
UX Phase 7 Readiness Verification Script

This script verifies that all database collections and indexes
from UX Phases 1-6 have been properly initialized.

Run this after executing: python -m db.startup
"""
from __future__ import annotations

import sys
from typing import List, Tuple

from db.client import get_database_name, mongo_client


def check_collection_exists(db, collection_name: str) -> Tuple[bool, str]:
    """Check if a collection exists in the database."""
    collections = db.list_collection_names()
    exists = collection_name in collections
    status = "✅ EXISTS" if exists else "❌ MISSING"
    return exists, status


def check_indexes(db, collection_name: str, expected_indexes: List[str]) -> Tuple[bool, List[str]]:
    """Check if expected indexes exist for a collection."""
    if collection_name not in db.list_collection_names():
        return False, []
    
    indexes = db[collection_name].list_indexes()
    index_names = [idx['name'] for idx in indexes]
    
    missing = []
    for expected in expected_indexes:
        if expected not in index_names:
            missing.append(expected)
    
    return len(missing) == 0, missing


def main():
    """Main verification function."""
    print("\n" + "="*70)
    print("UX PHASE 7 READINESS VERIFICATION")
    print("="*70 + "\n")
    
    # Define expected collections and their indexes
    ux_collections = {
        "user_setup_progress": {
            "phase": "Phase 1",
            "indexes": ["_id_", "user_id_1"]
        },
        "exchange_connections": {
            "phase": "Phase 1",
            "indexes": ["_id_", "user_id_1_exchange_1", "status_1", "last_tested_-1"]
        },
        "forecast_outcomes": {
            "phase": "Phase 3",
            "indexes": ["_id_", "forecast_id_1", "symbol_1_horizon_1_evaluated_at_-1", 
                       "was_correct_1", "evaluated_at_-1"]
        },
        "active_strategies": {
            "phase": "Phase 3",
            "indexes": ["_id_", "strategy_id_1", "mode_1_status_1", 
                       "status_1_activated_at_-1", "user_id_1_mode_1"]
        },
        "learning_jobs": {
            "phase": "Phase 6",
            "indexes": ["_id_", "job_id_1", "status_1_started_at_-1", "started_at_-1"]
        },
        "scheduled_tasks": {
            "phase": "Phase 6",
            "indexes": ["_id_", "task_type_1", "enabled_1_next_run_at_1", "next_run_at_1"]
        }
    }
    
    # Connect to database
    try:
        with mongo_client() as client:
            db = client[get_database_name()]
            
            print(f"Connected to database: {get_database_name()}\n")
            
            all_passed = True
            
            # Check each collection
            for collection_name, config in ux_collections.items():
                phase = config["phase"]
                expected_indexes = config["indexes"]
                
                print(f"{phase}: {collection_name}")
                print("-" * 70)
                
                # Check if collection exists
                exists, status = check_collection_exists(db, collection_name)
                print(f"  Collection: {status}")
                
                if not exists:
                    print(f"  ❌ Collection does not exist!")
                    all_passed = False
                    print()
                    continue
                
                # Check indexes
                indexes_ok, missing = check_indexes(db, collection_name, expected_indexes)
                
                if indexes_ok:
                    print(f"  Indexes: ✅ All {len(expected_indexes)} indexes present")
                else:
                    print(f"  Indexes: ❌ Missing {len(missing)} indexes:")
                    for idx in missing:
                        print(f"    - {idx}")
                    all_passed = False
                
                # Get document count
                doc_count = db[collection_name].count_documents({})
                print(f"  Documents: {doc_count}")
                print()
            
            # Summary
            print("="*70)
            if all_passed:
                print("✅ ALL CHECKS PASSED - READY FOR PHASE 7!")
                print("="*70)
                print("\nAll UX Phase 1-6 database collections are properly initialized.")
                print("You can now proceed with Phase 7 implementation.\n")
                return 0
            else:
                print("❌ SOME CHECKS FAILED")
                print("="*70)
                print("\nAction required:")
                print("1. Run: python -m db.startup")
                print("2. Restart your API server")
                print("3. Run this script again to verify\n")
                return 1
    
    except Exception as e:
        print(f"\n❌ ERROR: Could not connect to database")
        print(f"Details: {e}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())

