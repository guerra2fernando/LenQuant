"""Database initialization and index creation on startup."""
from __future__ import annotations

import logging
import os
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
        
        # OHLCV collection indexes
        try:
            db["ohlcv"].create_index([("symbol", 1), ("interval", 1), ("timestamp", 1)], unique=True)
            logger.info("✓ Created ohlcv indexes")
        except Exception as e:
            logger.warning(f"OHLCV indexes may already exist: {e}")
        
        # Features collection indexes
        try:
            db["features"].create_index([("symbol", 1), ("interval", 1), ("timestamp", 1)], unique=True)
            logger.info("✓ Created features indexes")
        except Exception as e:
            logger.warning(f"Features indexes may already exist: {e}")
        
        # Sim runs collection indexes
        try:
            db["sim_runs"].create_index([("run_id", 1)], unique=True)
            logger.info("✓ Created sim_runs indexes")
        except Exception as e:
            logger.warning(f"Sim runs indexes may already exist: {e}")
        
        # Daily reports collection indexes
        try:
            db["daily_reports"].create_index([("date", 1)], unique=True)
            logger.info("✓ Created daily_reports indexes")
        except Exception as e:
            logger.warning(f"Daily reports indexes may already exist: {e}")
        
        # Macro regimes collection indexes
        try:
            db["macro_regimes"].create_index([("symbol", 1), ("timestamp", -1)])
            db["macro_regimes"].create_index([("trend_regime", 1), ("timestamp", -1)])
            db["macro_regimes"].create_index([("volatility_regime", 1), ("timestamp", -1)])
            db["macro_regimes"].create_index([("symbol", 1), ("timestamp", 1)], unique=True)
            logger.info("✓ Created macro_regimes indexes")
        except Exception as e:
            logger.warning(f"Macro regimes indexes may already exist: {e}")
        
        # Intraday cohort indexes
        try:
            db["sim_runs_intraday"].create_index([("cohort_id", 1)], unique=True)
            db["sim_runs_intraday"].create_index([("created_at", 1)])
            db["sim_runs_intraday"].create_index([("bankroll", 1), ("allocation_policy", 1)])
            logger.info("✓ Created sim_runs_intraday indexes")
        except Exception as e:
            logger.warning(f"Sim runs intraday indexes may already exist: {e}")
        
        try:
            db["cohort_summaries"].create_index([("cohort_id", 1)], unique=True)
            db["cohort_summaries"].create_index([("generated_at", 1)])
            logger.info("✓ Created cohort_summaries indexes")
        except Exception as e:
            logger.warning(f"Cohort summaries indexes may already exist: {e}")
        
        # Users collection indexes
        try:
            db["users"].create_index([("id", 1)], unique=True)
            db["users"].create_index([("email", 1)], unique=True)
            logger.info("✓ Created users indexes")
        except Exception as e:
            logger.warning(f"Users indexes may already exist: {e}")
        
        # Notifications collection indexes
        try:
            db["notifications"].create_index([("user_id", 1), ("created_at", -1)])
            db["notifications"].create_index([("user_id", 1), ("read", 1), ("created_at", -1)])
            db["notifications"].create_index([("expires_at", 1)], expireAfterSeconds=0)
            db["notifications"].create_index([("type", 1), ("created_at", -1)])
            logger.info("✓ Created notifications indexes")
        except Exception as e:
            logger.warning(f"Notifications indexes may already exist: {e}")
        
        # Notification preferences collection indexes
        try:
            db["notification_preferences"].create_index([("user_id", 1)], unique=True)
            logger.info("✓ Created notification_preferences indexes")
        except Exception as e:
            logger.warning(f"Notification preferences indexes may already exist: {e}")
        
        # Notification analytics collection indexes
        try:
            db["notification_analytics"].create_index([("user_id", 1), ("opened_at", -1)])
            db["notification_analytics"].create_index([("notification_id", 1)])
            db["notification_analytics"].create_index([("user_id", 1), ("clicked_at", -1)])
            logger.info("✓ Created notification_analytics indexes")
        except Exception as e:
            logger.warning(f"Notification analytics indexes may already exist: {e}")
        
        # Portfolio page performance indexes 
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
        
        # Portfolio cache collection indexes 
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
        
        # UX: User Setup Progress 
        try:
            db["user_setup_progress"].create_index([("user_id", 1)], unique=True)
            logger.info("✓ Created user_setup_progress indexes")
        except Exception as e:
            logger.warning(f"User setup progress indexes may already exist: {e}")
        
        # UX: Exchange Connections 
        try:
            db["exchange_connections"].create_index(
                [("user_id", 1), ("exchange", 1)], 
                unique=True
            )
            db["exchange_connections"].create_index([("status", 1)])
            db["exchange_connections"].create_index([("last_tested", -1)])
            logger.info("✓ Created exchange_connections indexes")
        except Exception as e:
            logger.warning(f"Exchange connections indexes may already exist: {e}")
        
        # UX: Forecast Outcomes 
        try:
            db["forecast_outcomes"].create_index([("forecast_id", 1)])
            db["forecast_outcomes"].create_index(
                [("symbol", 1), ("horizon", 1), ("evaluated_at", -1)]
            )
            db["forecast_outcomes"].create_index([("was_correct", 1)])
            db["forecast_outcomes"].create_index([("evaluated_at", -1)])
            logger.info("✓ Created forecast_outcomes indexes")
        except Exception as e:
            logger.warning(f"Forecast outcomes indexes may already exist: {e}")
        
        # UX: Active Strategies 
        try:
            db["active_strategies"].create_index([("strategy_id", 1)])
            db["active_strategies"].create_index([("mode", 1), ("status", 1)])
            db["active_strategies"].create_index([("status", 1), ("activated_at", -1)])
            db["active_strategies"].create_index([("user_id", 1), ("mode", 1)])
            logger.info("✓ Created active_strategies indexes")
        except Exception as e:
            logger.warning(f"Active strategies indexes may already exist: {e}")
        
        # UX: Learning Jobs
        try:
            db["learning_jobs"].create_index([("job_id", 1)], unique=True)
            db["learning_jobs"].create_index([("status", 1), ("started_at", -1)])
            db["learning_jobs"].create_index([("started_at", -1)])
            logger.info("✓ Created learning_jobs indexes")
        except Exception as e:
            logger.warning(f"Learning jobs indexes may already exist: {e}")
        
        # UX: Scheduled Tasks
        try:
            db["scheduled_tasks"].create_index([("task_type", 1)], unique=True)
            db["scheduled_tasks"].create_index([("enabled", 1), ("next_run_at", 1)])
            db["scheduled_tasks"].create_index([("next_run_at", 1)])
            logger.info("✓ Created scheduled_tasks indexes")
        except Exception as e:
            logger.warning(f"Scheduled tasks indexes may already exist: {e}")
        
        logger.info("Database indexes initialized")


def seed_default_symbols() -> None:
    """Seed the database with default symbols from environment."""
    try:
        raw_symbols = os.getenv("DEFAULT_SYMBOLS", "BTC/USD,ETH/USDT")
        symbols = [s.strip() for s in raw_symbols.split(",") if s.strip()]
        
        if not symbols:
            logger.info("No default symbols to seed")
            return
        
        with mongo_client() as client:
            db = client[get_database_name()]
            
            for symbol in symbols:
                db["symbols"].update_one(
                    {"symbol": symbol},
                    {
                        "$setOnInsert": {
                            "symbol": symbol,
                            "base_increment": 0.0001,
                            "quote_increment": 0.01,
                        },
                        "$set": {"enabled": True}
                    },
                    upsert=True,
                )
        
        logger.info(f"✓ Seeded {len(symbols)} default symbols")
    except Exception as e:
        logger.warning(f"Could not seed default symbols: {e}")


def setup_data_retention() -> None:
    """Set up data retention TTL indexes and initial cleanup."""
    try:
        # Only run if data retention is enabled
        if os.getenv("ENABLE_DATA_RETENTION", "false").lower() != "true":
            logger.info("Data retention not enabled, skipping setup")
            return
        
        from db.migrations.migration_003_setup_data_retention import migrate_data_retention
        
        logger.info("Setting up data retention system...")
        result = migrate_data_retention()
        logger.info(f"✓ Data retention setup completed: {result}")
    except Exception as e:
        logger.warning(f"Could not set up data retention (non-critical): {e}")


def initialize_database() -> None:
    """Initialize database on application startup."""
    logger.info("Initializing database...")
    create_indexes()
    seed_default_symbols()
    setup_data_retention()
    logger.info("Database initialization complete")


if __name__ == "__main__":
    initialize_database()

