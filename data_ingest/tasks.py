"""Celery tasks for data ingestion."""
from __future__ import annotations

import logging
import traceback
from datetime import datetime, timedelta
from typing import Dict, Any, List

from celery_config import celery_app

from data_ingest.config import IngestConfig
from data_ingest.fetcher import fetch_symbol_interval
from db.client import mongo_client, get_database_name
from features.features import generate_for_symbol

logger = logging.getLogger(__name__)


@celery_app.task(name="data_ingest.tasks.fetch_recent_data", bind=True)
def fetch_recent_data_task(self) -> Dict[str, Any]:
    """Fetch recent data for all enabled symbols and intervals."""
    config = IngestConfig.from_env()
    total_fetched = 0
    symbols_processed = 0

    # Fetch recent data (last 2 days) for enabled symbols only
    with mongo_client() as client:
        db = client[get_database_name()]
        enabled_symbols = db["symbols"].find({"enabled": True})
        
        for symbol_doc in enabled_symbols:
            symbol = symbol_doc["symbol"]
            intervals_status = symbol_doc.get("intervals_status", {})
            
            # If no intervals_status, use config intervals
            intervals_to_fetch = list(intervals_status.keys()) if intervals_status else config.intervals
            
            for interval in intervals_to_fetch:
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
            
            symbols_processed += 1

    return {
        "task": "fetch_recent_data",
        "total_records_fetched": total_fetched,
        "symbols_processed": symbols_processed,
    }


@celery_app.task(name="data_ingest.tasks.ingest_symbol_interval", bind=True)
def ingest_symbol_interval_task(
    self,
    job_id: str,
    symbol: str,
    interval: str,
    lookback_days: int,
    batch_size: int = 1000
) -> Dict[str, Any]:
    """
    Asynchronously ingest OHLCV data and generate features for a single symbol/interval.
    
    Updates job status in real-time via MongoDB with detailed progress tracking.
    """
    start_time = datetime.utcnow()
    
    with mongo_client() as client:
        db = client[get_database_name()]
        jobs = db["ingestion_jobs"]
        
        # Calculate expected timestamps for progress tracking
        expected_start_ts = datetime.utcnow() - timedelta(days=lookback_days)
        expected_end_ts = datetime.utcnow()
        
        # Update status to in_progress with initial progress details
        jobs.update_one(
            {"job_id": job_id},
            {
                "$set": {
                    "status": "in_progress",
                    "started_at": start_time,
                    "celery_task_id": self.request.id,
                    "current_step": "fetching_ohlcv",
                    "progress_details": {
                        "expected_start_timestamp": expected_start_ts,
                        "expected_end_timestamp": expected_end_ts,
                        "current_candle_timestamp": None,
                        "candles_per_batch": batch_size,
                        "batches_completed": 0,
                        "batches_total": 0,
                        "estimated_completion_seconds": None,
                    },
                    "steps": [
                        {
                            "step_name": "fetching_ohlcv",
                            "status": "in_progress",
                            "started_at": start_time,
                            "progress_pct": 0.0,
                        },
                        {
                            "step_name": "generating_features",
                            "status": "pending",
                        },
                    ],
                }
            }
        )
        
        try:
            # Define progress callback for real-time updates
            def progress_callback(batches_completed: int, batches_total: int, records_fetched: int, current_ts: datetime):
                """Update job progress in MongoDB."""
                elapsed_seconds = (datetime.utcnow() - start_time).total_seconds()
                
                # Calculate progress percentage (0-50% for fetching phase)
                fetch_progress = (batches_completed / batches_total * 50) if batches_total > 0 else 0
                
                # Estimate time remaining
                if batches_completed > 0:
                    avg_time_per_batch = elapsed_seconds / batches_completed
                    remaining_batches = batches_total - batches_completed
                    estimated_completion_seconds = int(remaining_batches * avg_time_per_batch)
                else:
                    estimated_completion_seconds = None
                
                # Update job document
                jobs.update_one(
                    {"job_id": job_id},
                    {
                        "$set": {
                            "progress_pct": fetch_progress,
                            "records_fetched": records_fetched,
                            "records_expected": batches_total * batch_size,
                            "progress_details.batches_completed": batches_completed,
                            "progress_details.batches_total": batches_total,
                            "progress_details.current_candle_timestamp": current_ts,
                            "progress_details.estimated_completion_seconds": estimated_completion_seconds,
                            "last_updated": datetime.utcnow(),
                            "steps.0.progress_pct": (batches_completed / batches_total * 100) if batches_total > 0 else 0,
                        }
                    }
                )
                
                logger.debug(f"Progress update: {symbol} {interval} - {batches_completed}/{batches_total} batches ({fetch_progress:.1f}%)")
            
            # Fetch OHLCV data with progress tracking
            config = IngestConfig.from_env()
            records_fetched = fetch_symbol_interval(
                symbol=symbol,
                timeframe=interval,
                lookback_days=lookback_days,
                limit=batch_size,
                config=config,
                progress_callback=progress_callback
            )
            
            # Update status to feature generation phase
            jobs.update_one(
                {"job_id": job_id},
                {
                    "$set": {
                        "records_fetched": records_fetched,
                        "progress_pct": 50.0,
                        "current_step": "generating_features",
                        "steps.0.status": "completed",
                        "steps.0.completed_at": datetime.utcnow(),
                        "steps.0.progress_pct": 100.0,
                        "steps.1.status": "in_progress",
                        "steps.1.started_at": datetime.utcnow(),
                    }
                }
            )
            
            # Generate features
            feature_start = datetime.utcnow()
            try:
                # Disable regime enrichment if causing issues
                # Set enable_regime=False to skip macro_regimes dependency
                features_generated = generate_for_symbol(symbol, interval, enable_regime=True)
                
                if features_generated == 0:
                    logger.warning(
                        f"Feature generation returned 0 for {symbol} {interval}. "
                        f"OHLCV records: {records_fetched}. Check if OHLCV data exists."
                    )
            except Exception as e:
                logger.error(f"Feature generation failed for {symbol} {interval}: {e}", exc_info=True)
                features_generated = 0
            
            # Update progress during feature generation (50-90%)
            jobs.update_one(
                {"job_id": job_id},
                {
                    "$set": {
                        "progress_pct": 90.0,
                        "features_generated": features_generated,
                        "steps.1.progress_pct": 100.0,
                    }
                }
            )
            
            # Update symbol metadata
            _update_symbol_status(db, symbol, interval, job_id)
            
            # Calculate final timing
            total_duration = (datetime.utcnow() - start_time).total_seconds()
            
            # Mark as complete
            jobs.update_one(
                {"job_id": job_id},
                {
                    "$set": {
                        "status": "completed",
                        "completed_at": datetime.utcnow(),
                        "progress_pct": 100.0,
                        "features_generated": features_generated,
                        "current_step": "completed",
                        "duration_seconds": int(total_duration),
                        "steps.1.status": "completed",
                        "steps.1.completed_at": datetime.utcnow(),
                    }
                }
            )
            
            logger.info(f"Completed ingestion for {symbol} {interval}: {records_fetched} records, {features_generated} features in {total_duration:.1f}s")
            
            # Send notification
            try:
                from monitor.notification_service import notify_ingestion_complete
                notify_ingestion_complete(job_id, symbol, interval)
            except Exception as e:
                logger.warning(f"Failed to send completion notification: {e}")
            
            return {
                "job_id": job_id,
                "status": "completed",
                "records_fetched": records_fetched,
                "features_generated": features_generated,
                "duration_seconds": int(total_duration),
            }
            
        except Exception as e:
            # Mark as failed
            error_msg = str(e)
            error_details = traceback.format_exc()
            
            jobs.update_one(
                {"job_id": job_id},
                {
                    "$set": {
                        "status": "failed",
                        "completed_at": datetime.utcnow(),
                        "error_message": error_msg,
                        "error_details": error_details,
                        "duration_seconds": int((datetime.utcnow() - start_time).total_seconds()),
                    }
                }
            )
            
            logger.error(f"Failed to ingest {symbol} {interval}: {e}")
            logger.debug(error_details)
            
            # Send failure notification
            try:
                from monitor.notification_service import notify_ingestion_failed
                notify_ingestion_failed(job_id, symbol, interval, error_msg)
            except Exception as notif_err:
                logger.warning(f"Failed to send failure notification: {notif_err}")
            
            raise


def _update_symbol_status(db, symbol: str, interval: str, job_id: str) -> None:
    """Update symbol collection with latest data status."""
    try:
        # Get OHLCV stats
        ohlcv_stats = list(db["ohlcv"].aggregate([
            {"$match": {"symbol": symbol, "interval": interval}},
            {
                "$group": {
                    "_id": None,
                    "count": {"$sum": 1},
                    "oldest": {"$min": "$timestamp"},
                    "newest": {"$max": "$timestamp"},
                }
            }
        ]))
        
        ohlcv_data = ohlcv_stats[0] if ohlcv_stats else {}
        
        # Get feature count
        feature_count = db["features"].count_documents({
            "symbol": symbol,
            "interval": interval
        })
        
        # Use the newest candle timestamp as last_updated instead of current time
        # This shows true data freshness rather than when we last ran ingestion
        newest_timestamp = ohlcv_data.get("newest", datetime.utcnow())
        
        # Update or create symbol document
        db["symbols"].update_one(
            {"symbol": symbol},
            {
                "$set": {
                    f"intervals_status.{interval}": {
                        "last_updated": newest_timestamp,  # Use newest candle time
                        "last_ingestion_at": datetime.utcnow(),  # Track when job ran
                        "record_count": ohlcv_data.get("count", 0),
                        "feature_count": feature_count,
                        "oldest_record": ohlcv_data.get("oldest"),
                        "newest_record": ohlcv_data.get("newest"),
                        "last_ingestion_job_id": job_id,
                        "has_gaps": False,
                        "data_quality_score": 1.0 if ohlcv_data.get("count", 0) > 0 else 0.0,
                    },
                    "updated_at": datetime.utcnow(),
                }
            },
            upsert=True
        )
        
        logger.info(f"Updated symbol status for {symbol} {interval} (newest candle: {newest_timestamp})")
        
    except Exception as e:
        logger.error(f"Failed to update symbol status for {symbol} {interval}: {e}")


@celery_app.task(name="data_ingest.tasks.batch_ingest", bind=True)
def batch_ingest_task(
    self,
    parent_job_id: str,
    symbols: List[str],
    intervals: List[str],
    lookback_days: int
) -> Dict[str, Any]:
    """
    Orchestrate multiple ingestion tasks for bootstrap/bulk operations.
    
    Creates individual jobs for each symbol/interval and tracks overall progress.
    """
    with mongo_client() as client:
        db = client[get_database_name()]
        jobs = db["ingestion_jobs"]
        
        # Create child jobs for each symbol/interval
        child_job_ids = []
        for symbol in symbols:
            for interval in intervals:
                # Create unique job ID
                timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')
                job_id = f"ing_{timestamp}_{symbol.replace('/', '_')}_{interval}"
                
                job_doc = {
                    "job_id": job_id,
                    "parent_job_id": parent_job_id,
                    "job_type": "batch_child",
                    "symbol": symbol,
                    "interval": interval,
                    "lookback_days": lookback_days,
                    "status": "queued",
                    "created_at": datetime.utcnow(),
                    "progress_pct": 0.0,
                    "records_fetched": 0,
                    "features_generated": 0,
                }
                
                jobs.insert_one(job_doc)
                child_job_ids.append(job_id)
                
                # Enqueue task
                ingest_symbol_interval_task.apply_async(
                    args=[job_id, symbol, interval, lookback_days],
                    queue="data"
                )
        
        # Update parent job with child references
        jobs.update_one(
            {"job_id": parent_job_id},
            {
                "$set": {
                    "child_job_ids": child_job_ids,
                    "total_jobs": len(child_job_ids),
                    "status": "in_progress",
                    "started_at": datetime.utcnow(),
                }
            }
        )
        
        logger.info(f"Created {len(child_job_ids)} child jobs for batch {parent_job_id}")
        
        return {
            "parent_job_id": parent_job_id,
            "child_job_ids": child_job_ids,
            "total_jobs": len(child_job_ids),
        }


@celery_app.task(name="data_ingest.tasks.backfill_gaps", bind=True)
def backfill_gaps_task(self, recent_days_only: int = 7) -> Dict[str, Any]:
    """
    Scheduled task to detect and backfill data gaps.
    
    Runs daily to ensure data completeness across all symbols/intervals.
    
    Args:
        recent_days_only: Number of recent days to check for gaps (default: 7)
        
    Returns:
        Summary of gaps detected and backfill jobs created
    """
    from data_ingest.gap_detector import get_all_symbols_gaps
    
    start_time = datetime.utcnow()
    logger.info(f"Starting gap detection and backfilling (checking last {recent_days_only} days)")
    
    # Detect all gaps
    all_gaps = get_all_symbols_gaps(recent_days_only=recent_days_only)
    
    if not all_gaps:
        logger.info("No gaps detected - data is complete!")
        return {
            "task": "backfill_gaps",
            "status": "completed",
            "gaps_detected": 0,
            "backfill_jobs_created": 0,
            "message": "No gaps detected"
        }
    
    # Create backfill jobs for each gap
    backfill_jobs_created = 0
    
    with mongo_client() as client:
        db = client[get_database_name()]
        jobs = db["ingestion_jobs"]
        
        for key, gaps in all_gaps.items():
            symbol, interval = key.split("|")
            
            for gap in gaps:
                # Calculate lookback from gap
                gap_start = gap.start_timestamp
                gap_end = gap.end_timestamp
                gap_days = (gap_end - gap_start).days + 1
                
                # Create backfill job
                timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')
                job_id = f"backfill_{timestamp}_{symbol.replace('/', '_')}_{interval}"
                
                job_doc = {
                    "job_id": job_id,
                    "parent_job_id": None,
                    "job_type": "backfill",
                    "symbol": symbol,
                    "interval": interval,
                    "lookback_days": gap_days,
                    "status": "queued",
                    "created_at": datetime.utcnow(),
                    "progress_pct": 0.0,
                    "records_fetched": 0,
                    "features_generated": 0,
                    "backfill_metadata": {
                        "gap_start": gap_start,
                        "gap_end": gap_end,
                        "missing_candles": gap.missing_candles,
                        "backfill_reason": "scheduled_gap_check"
                    }
                }
                
                jobs.insert_one(job_doc)
                
                # Enqueue backfill task
                ingest_symbol_interval_task.apply_async(
                    args=[job_id, symbol, interval, gap_days],
                    queue="data"
                )
                
                backfill_jobs_created += 1
                logger.info(f"Created backfill job for {symbol} {interval} gap: {gap_start} to {gap_end}")
    
    duration = (datetime.utcnow() - start_time).total_seconds()
    
    logger.info(
        f"Gap detection and backfilling complete: "
        f"{len(all_gaps)} symbols with gaps, {backfill_jobs_created} backfill jobs created in {duration:.1f}s"
    )
    
    return {
        "task": "backfill_gaps",
        "status": "completed",
        "gaps_detected": sum(len(gaps) for gaps in all_gaps.values()),
        "symbols_with_gaps": len(all_gaps),
        "backfill_jobs_created": backfill_jobs_created,
        "duration_seconds": int(duration),
        "checked_recent_days": recent_days_only,
    }