"""Celery tasks for data ingestion."""
from __future__ import annotations

from typing import Dict, Any

from celery_config import celery_app

from data_ingest.config import IngestConfig
from data_ingest.fetcher import fetch_symbol_interval


@celery_app.task(name="data_ingest.tasks.fetch_recent_data", bind=True)
def fetch_recent_data_task(self) -> Dict[str, Any]:
    """Fetch recent data for all configured symbols and intervals."""
    config = IngestConfig.from_env()
    total_fetched = 0

    # Fetch recent data (last 2 days) for all symbols and intervals
    for symbol in config.symbols:
        for interval in config.intervals:
            try:
                count = fetch_symbol_interval(
                    symbol=symbol,
                    timeframe=interval,
                    since=None,  # Will use lookback_days
                    limit=config.batch_size,
                    config=config,
                    lookback_days=2  # Only fetch last 2 days
                )
                total_fetched += count
            except Exception as e:
                self.logger.error(f"Failed to fetch {symbol} {interval}: {e}")

    return {
        "task": "fetch_recent_data",
        "total_records_fetched": total_fetched,
        "symbols_processed": len(config.symbols),
        "intervals_processed": len(config.intervals)
    }
