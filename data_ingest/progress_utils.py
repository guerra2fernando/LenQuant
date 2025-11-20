"""Utilities for calculating and formatting ingestion progress."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, Any, Optional


def calculate_expected_batches(
    lookback_days: int,
    interval: str,
    batch_size: int = 1000
) -> int:
    """
    Calculate expected number of batches for a given lookback period.
    
    Args:
        lookback_days: Number of days to fetch
        interval: Timeframe (e.g., '1m', '5m', '1h', '1d')
        batch_size: Number of candles per batch
        
    Returns:
        Estimated number of batches
    """
    # Parse interval to minutes
    interval_minutes = _parse_interval_to_minutes(interval)
    
    # Calculate total candles needed
    total_minutes = lookback_days * 24 * 60
    total_candles = total_minutes // interval_minutes
    
    # Calculate batches
    batches = max(1, int(total_candles / batch_size))
    
    return batches


def calculate_expected_records(
    lookback_days: int,
    interval: str
) -> int:
    """
    Calculate expected number of records for a given lookback period.
    
    Args:
        lookback_days: Number of days to fetch
        interval: Timeframe (e.g., '1m', '5m', '1h', '1d')
        
    Returns:
        Estimated number of records
    """
    interval_minutes = _parse_interval_to_minutes(interval)
    total_minutes = lookback_days * 24 * 60
    return total_minutes // interval_minutes


def calculate_progress_percentage(
    batches_completed: int,
    batches_total: int,
    current_phase: str = "fetching"
) -> float:
    """
    Calculate overall progress percentage based on current phase.
    
    Args:
        batches_completed: Number of batches completed
        batches_total: Total number of batches
        current_phase: Current phase ('fetching' or 'features')
        
    Returns:
        Progress percentage (0-100)
    """
    if batches_total <= 0:
        return 0.0
    
    batch_progress = batches_completed / batches_total
    
    if current_phase == "fetching":
        # Fetching is 0-50% of total progress
        return batch_progress * 50
    elif current_phase == "features":
        # Features generation is 50-90% of total progress
        return 50 + (batch_progress * 40)
    elif current_phase == "metadata":
        # Metadata update is 90-100%
        return 90 + (batch_progress * 10)
    else:
        return batch_progress * 100


def estimate_time_remaining(
    elapsed_seconds: float,
    batches_completed: int,
    batches_total: int
) -> Optional[int]:
    """
    Estimate time remaining for ingestion.
    
    Args:
        elapsed_seconds: Time elapsed since start
        batches_completed: Number of batches completed
        batches_total: Total number of batches
        
    Returns:
        Estimated seconds remaining, or None if cannot estimate
    """
    if batches_completed <= 0:
        return None
    
    if batches_completed >= batches_total:
        return 0
    
    avg_time_per_batch = elapsed_seconds / batches_completed
    remaining_batches = batches_total - batches_completed
    
    return int(remaining_batches * avg_time_per_batch)


def format_time_remaining(seconds: Optional[int]) -> str:
    """
    Format time remaining as human-readable string.
    
    Args:
        seconds: Seconds remaining
        
    Returns:
        Formatted string (e.g., "2m 30s", "1h 15m", "< 1m")
    """
    if seconds is None:
        return "calculating..."
    
    if seconds < 60:
        return "< 1m"
    
    if seconds < 3600:
        minutes = seconds // 60
        secs = seconds % 60
        if secs > 0:
            return f"{minutes}m {secs}s"
        return f"{minutes}m"
    
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    if minutes > 0:
        return f"{hours}h {minutes}m"
    return f"{hours}h"


def calculate_data_quality_score(
    records_fetched: int,
    records_expected: int
) -> float:
    """
    Calculate data quality score based on expected vs actual records.
    
    Args:
        records_fetched: Actual number of records fetched
        records_expected: Expected number of records
        
    Returns:
        Quality score (0.0 to 1.0)
    """
    if records_expected <= 0:
        return 0.0
    
    # Allow up to 5% more records (due to timestamp overlap)
    if records_fetched >= records_expected:
        return 1.0
    
    # Calculate ratio
    ratio = records_fetched / records_expected
    
    # If we got at least 95% of expected data, consider it good quality
    if ratio >= 0.95:
        return 1.0
    
    return ratio


def get_progress_summary(job: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate a human-readable progress summary from a job document.
    
    Args:
        job: Job document from MongoDB
        
    Returns:
        Dictionary with formatted progress information
    """
    progress_pct = job.get("progress_pct", 0.0)
    status = job.get("status", "unknown")
    current_step = job.get("current_step", "unknown")
    
    # Get progress details
    details = job.get("progress_details", {})
    batches_completed = details.get("batches_completed", 0)
    batches_total = details.get("batches_total", 0)
    estimated_seconds = details.get("estimated_completion_seconds")
    
    records_fetched = job.get("records_fetched", 0)
    records_expected = job.get("records_expected", 0)
    
    # Format time remaining
    time_remaining_str = format_time_remaining(estimated_seconds)
    
    # Calculate quality
    quality_score = calculate_data_quality_score(records_fetched, records_expected)
    
    # Build summary
    summary = {
        "progress_pct": round(progress_pct, 1),
        "status": status,
        "current_step": current_step,
        "batches": {
            "completed": batches_completed,
            "total": batches_total,
            "percentage": round((batches_completed / batches_total * 100) if batches_total > 0 else 0, 1)
        },
        "records": {
            "fetched": records_fetched,
            "expected": records_expected,
            "percentage": round((records_fetched / records_expected * 100) if records_expected > 0 else 0, 1)
        },
        "time_remaining": time_remaining_str,
        "quality_score": round(quality_score, 2),
    }
    
    # Add timing info if available
    started_at = job.get("started_at")
    completed_at = job.get("completed_at")
    
    if started_at:
        if completed_at:
            duration = (completed_at - started_at).total_seconds()
            summary["duration"] = format_time_remaining(int(duration))
        else:
            elapsed = (datetime.utcnow() - started_at).total_seconds()
            summary["elapsed"] = format_time_remaining(int(elapsed))
    
    return summary


def _parse_interval_to_minutes(interval: str) -> int:
    """
    Convert interval string to minutes.
    
    Args:
        interval: Interval string (e.g., '1m', '5m', '1h', '1d')
        
    Returns:
        Number of minutes in the interval
    """
    mapping = {
        "1m": 1,
        "3m": 3,
        "5m": 5,
        "15m": 15,
        "30m": 30,
        "1h": 60,
        "2h": 120,
        "4h": 240,
        "6h": 360,
        "8h": 480,
        "12h": 720,
        "1d": 1440,
        "3d": 4320,
        "1w": 10080,
    }
    return mapping.get(interval, 1)


def _parse_interval_to_seconds(interval: str) -> int:
    """
    Convert interval string to seconds.
    
    Args:
        interval: Interval string (e.g., '1m', '5m', '1h', '1d')
        
    Returns:
        Number of seconds in the interval
    """
    return _parse_interval_to_minutes(interval) * 60

