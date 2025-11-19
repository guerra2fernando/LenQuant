"""Celery tasks for feature generation."""
from __future__ import annotations

from typing import Dict, Any

from celery_config import celery_app

from data_ingest.config import IngestConfig
from features.features import generate_bulk


@celery_app.task(name="features.tasks.generate_features", bind=True)
def generate_features_task(self) -> Dict[str, Any]:
    """Generate features for all configured symbols and intervals."""
    config = IngestConfig.from_env()

    try:
        total_features = generate_bulk(
            symbols=config.symbols,
            intervals=config.intervals
        )

        return {
            "task": "generate_features",
            "total_features_generated": total_features,
            "symbols_processed": len(config.symbols),
            "intervals_processed": len(config.intervals)
        }
    except Exception as e:
        self.logger.error(f"Failed to generate features: {e}")
        return {
            "task": "generate_features",
            "error": str(e),
            "total_features_generated": 0
        }
