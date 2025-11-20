"""Database initialization and index creation on startup."""
from __future__ import annotations

import logging
from typing import List

from db.client import mongo_client, get_database_name

logger = logging.getLogger(__name__)


def create_indexes() -> None:
    """Create all necessary indexes for the application."""
    with mongo_client() as client:
        db = client[get_database_name()]
        
        logger.info("Creating database indexes...")
        
        # Symbols collection indexes
        try:
            db["symbols"].create_index([("symbol", 1)], unique=True)
            db["symbols"].create_index([("enabled", 1)])
            logger.info("✓ Created symbols indexes")
        except Exception as e:
            logger.warning(f"Symbols indexes may already exist: {e}")
        
        # Ingestion jobs collection indexes
        try:
            db["ingestion_jobs"].create_index([("job_id", 1)], unique=True)
            db["ingestion_jobs"].create_index([("parent_job_id", 1)])
            db["ingestion_jobs"].create_index([("status", 1)])
            db["ingestion_jobs"].create_index([("symbol", 1), ("interval", 1)])
            db["ingestion_jobs"].create_index([("created_at", -1)])
            db["ingestion_jobs"].create_index([("job_type", 1), ("status", 1)])
            logger.info("✓ Created ingestion_jobs indexes")
        except Exception as e:
            logger.warning(f"Ingestion jobs indexes may already exist: {e}")
        
        # OHLCV collection indexes (if not already created)
        try:
            db["ohlcv"].create_index([("symbol", 1), ("interval", 1), ("timestamp", -1)])
            logger.info("✓ Created ohlcv indexes")
        except Exception as e:
            logger.warning(f"OHLCV indexes may already exist: {e}")
        
        # Features collection indexes
        try:
            db["features"].create_index([("symbol", 1), ("interval", 1), ("timestamp", -1)])
            logger.info("✓ Created features indexes")
        except Exception as e:
            logger.warning(f"Features indexes may already exist: {e}")
        
        # Portfolio page performance indexes (Phase 1)
        try:
            db["trading_positions"].create_index(
                [("mode", 1), ("updated_at", -1)],
                name="portfolio_positions_by_mode"
            )
            logger.info("✓ Created trading_positions indexes for portfolio")
        except Exception as e:
            logger.warning(f"Trading positions indexes may already exist: {e}")
        
        try:
            db["trading_ledgers"].create_index(
                [("mode", 1), ("timestamp", -1)],
                name="portfolio_equity_history"
            )
            logger.info("✓ Created trading_ledgers indexes for portfolio")
        except Exception as e:
            logger.warning(f"Trading ledgers indexes may already exist: {e}")
        
        try:
            db["trading_fills"].create_index(
                [("mode", 1), ("symbol", 1), ("executed_at", -1)],
                name="portfolio_fills_lookup"
            )
            logger.info("✓ Created trading_fills indexes for portfolio")
        except Exception as e:
            logger.warning(f"Trading fills indexes may already exist: {e}")
        
        # Optional: Parent wallet snapshots (if we store them)
        try:
            db["parent_wallet_snapshots"].create_index(
                [("mode", 1), ("timestamp", -1)],
                name="parent_wallet_latest"
            )
            logger.info("✓ Created parent_wallet_snapshots indexes")
        except Exception as e:
            logger.warning(f"Parent wallet indexes may already exist: {e}")
        
        # Portfolio cache collection indexes (Phase 4)
        try:
            db["portfolio_snapshots"].create_index(
                [("mode", 1)],
                name="portfolio_cache_by_mode",
                unique=True
            )
            logger.info("✓ Created portfolio_snapshots mode index")
        except Exception as e:
            logger.warning(f"Portfolio cache mode index may already exist: {e}")
        
        try:
            db["portfolio_snapshots"].create_index(
                [("cached_at", -1)],
                name="portfolio_cache_freshness"
            )
            logger.info("✓ Created portfolio_snapshots freshness index")
        except Exception as e:
            logger.warning(f"Portfolio cache freshness index may already exist: {e}")
        
        logger.info("Database indexes initialized")


def initialize_database() -> None:
    """Initialize database on application startup."""
    logger.info("Initializing database...")
    create_indexes()
    logger.info("Database initialization complete")


if __name__ == "__main__":
    initialize_database()

