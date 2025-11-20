"""API endpoints for asynchronous data ingestion management."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from db.client import get_database_name, mongo_client

router = APIRouter()


class StartIngestionRequest(BaseModel):
    """Request model for starting data ingestion."""
    symbols: List[str]
    intervals: List[str]
    lookback_days: int = 30
    batch_size: int = 1000
    job_type: str = "manual_refresh"  # or "bootstrap"


class JobStatusResponse(BaseModel):
    """Response model for single job status."""
    job_id: str
    status: str
    progress_pct: float
    current_step: Optional[str] = None
    records_fetched: int = 0
    features_generated: int = 0
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    symbol: Optional[str] = None
    interval: Optional[str] = None


@router.post("/start")
def start_ingestion(req: StartIngestionRequest) -> Dict[str, Any]:
    """
    Start asynchronous data ingestion for specified symbols and intervals.
    
    Returns immediately with job ID for status tracking.
    """
    if not req.symbols or not req.intervals:
        raise HTTPException(
            status_code=400,
            detail="Must specify at least one symbol and one interval"
        )
    
    # Import here to avoid circular imports
    from data_ingest.tasks import batch_ingest_task
    
    # Create parent job
    parent_job_id = f"batch_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    
    with mongo_client() as client:
        db = client[get_database_name()]
        
        job_doc = {
            "job_id": parent_job_id,
            "job_type": req.job_type,
            "symbols": req.symbols,
            "intervals": req.intervals,
            "lookback_days": req.lookback_days,
            "batch_size": req.batch_size,
            "status": "queued",
            "created_at": datetime.utcnow(),
            "progress_pct": 0.0,
            "child_job_ids": [],
        }
        
        db["ingestion_jobs"].insert_one(job_doc)
    
    # Enqueue batch task
    batch_ingest_task.apply_async(
        args=[parent_job_id, req.symbols, req.intervals, req.lookback_days],
        queue="data"
    )
    
    return {
        "job_id": parent_job_id,
        "message": "Ingestion started successfully",
        "total_combinations": len(req.symbols) * len(req.intervals),
    }


@router.get("/status/{job_id}")
def get_job_status(job_id: str) -> JobStatusResponse:
    """Get current status of an ingestion job."""
    with mongo_client() as client:
        db = client[get_database_name()]
        job = db["ingestion_jobs"].find_one({"job_id": job_id}, {"_id": 0})
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Ensure required fields have default values
        job.setdefault("progress_pct", 0.0)
        job.setdefault("records_fetched", 0)
        job.setdefault("features_generated", 0)
        
        return JobStatusResponse(**job)


@router.get("/status-batch/{parent_job_id}")
def get_batch_status(parent_job_id: str) -> Dict[str, Any]:
    """Get aggregated status for a batch ingestion job."""
    with mongo_client() as client:
        db = client[get_database_name()]
        
        parent_job = db["ingestion_jobs"].find_one(
            {"job_id": parent_job_id},
            {"_id": 0}
        )
        
        if not parent_job:
            raise HTTPException(status_code=404, detail="Parent job not found")
        
        child_job_ids = parent_job.get("child_job_ids", [])
        
        # Get all child job statuses
        child_jobs = list(db["ingestion_jobs"].find(
            {"job_id": {"$in": child_job_ids}},
            {"_id": 0}
        ))
        
        # Calculate aggregated stats
        total = len(child_jobs)
        completed = sum(1 for j in child_jobs if j.get("status") == "completed")
        failed = sum(1 for j in child_jobs if j.get("status") == "failed")
        in_progress = sum(1 for j in child_jobs if j.get("status") == "in_progress")
        pending = sum(1 for j in child_jobs if j.get("status") in ["pending", "queued"])
        
        overall_progress = (completed / total * 100) if total > 0 else 0
        
        # Determine parent status
        parent_status = parent_job.get("status", "unknown")
        if completed == total and total > 0:
            parent_status = "completed"
        elif failed > 0 and (completed + failed) == total:
            parent_status = "partial_failure"
        elif in_progress > 0:
            parent_status = "in_progress"
        
        return {
            "parent_job_id": parent_job_id,
            "status": parent_status,
            "overall_progress_pct": overall_progress,
            "total_jobs": total,
            "completed": completed,
            "failed": failed,
            "in_progress": in_progress,
            "pending": pending,
            "child_jobs": child_jobs,
            "created_at": parent_job["created_at"],
        }


@router.get("/symbols-status")
def get_symbols_status() -> List[Dict[str, Any]]:
    """Get data status for all symbols."""
    with mongo_client() as client:
        db = client[get_database_name()]
        
        symbols = db["symbols"].find({}, {"_id": 0})
        
        return list(symbols)


@router.get("/gaps/{symbol}/{interval}")
def get_data_gaps(symbol: str, interval: str, recent_days_only: Optional[int] = None) -> Dict[str, Any]:
    """
    Detect data gaps for a specific symbol/interval combination.
    
    Args:
        symbol: Trading pair symbol (e.g., 'BTC/USDT')
        interval: Interval (e.g., '1m', '5m', '1h', '1d')
        recent_days_only: If specified, only check recent N days
        
    Returns:
        Dictionary with gaps information
    """
    from data_ingest.gap_detector import detect_data_gaps, detect_recent_data_gaps
    
    try:
        if recent_days_only:
            gaps = detect_recent_data_gaps(symbol, interval, days=recent_days_only)
        else:
            gaps = detect_data_gaps(symbol, interval)
        
        return {
            "symbol": symbol,
            "interval": interval,
            "gaps_found": len(gaps),
            "gaps": [gap.to_dict() for gap in gaps],
            "checked_recent_days": recent_days_only,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error detecting gaps: {str(e)}")


@router.get("/gaps")
def get_all_gaps(recent_days_only: Optional[int] = 7) -> Dict[str, Any]:
    """
    Detect data gaps for all enabled symbols and intervals.
    
    Args:
        recent_days_only: Number of recent days to check (default: 7)
        
    Returns:
        Dictionary with all gaps grouped by symbol/interval
    """
    from data_ingest.gap_detector import get_all_symbols_gaps
    
    try:
        all_gaps = get_all_symbols_gaps(recent_days_only=recent_days_only)
        
        # Convert to more readable format
        result = {
            "total_symbols_with_gaps": len(all_gaps),
            "total_gaps": sum(len(gaps) for gaps in all_gaps.values()),
            "checked_recent_days": recent_days_only,
            "gaps_by_symbol": {}
        }
        
        for key, gaps in all_gaps.items():
            symbol, interval = key.split("|")
            if symbol not in result["gaps_by_symbol"]:
                result["gaps_by_symbol"][symbol] = {}
            
            result["gaps_by_symbol"][symbol][interval] = {
                "count": len(gaps),
                "gaps": [gap.to_dict() for gap in gaps]
            }
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error detecting gaps: {str(e)}")


@router.get("/health")
def get_system_health() -> Dict[str, Any]:
    """
    Check health of data ingestion system components.
    
    Returns:
        System health status including MongoDB, Redis, Celery workers, and job metrics
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "components": {},
        "metrics": {}
    }
    
    issues = []
    
    # 1. Check MongoDB connectivity
    try:
        with mongo_client() as client:
            # Ping MongoDB
            client.admin.command('ping')
            health_status["components"]["mongodb"] = {
                "status": "healthy",
                "message": "Connected"
            }
    except Exception as e:
        health_status["components"]["mongodb"] = {
            "status": "down",
            "message": f"Connection failed: {str(e)}"
        }
        issues.append("MongoDB unavailable")
    
    # 2. Check Redis connectivity (Celery broker)
    try:
        from celery_config import celery_app
        # Try to inspect workers (this requires Redis to be accessible)
        inspector = celery_app.control.inspect()
        active_workers = inspector.active()
        
        if active_workers is None:
            health_status["components"]["redis"] = {
                "status": "degraded",
                "message": "Cannot connect to broker"
            }
            issues.append("Redis broker unavailable")
        else:
            health_status["components"]["redis"] = {
                "status": "healthy",
                "message": "Connected"
            }
    except Exception as e:
        health_status["components"]["redis"] = {
            "status": "down",
            "message": f"Connection failed: {str(e)}"
        }
        issues.append("Redis unavailable")
    
    # 3. Check Celery workers
    try:
        from celery_config import celery_app
        inspector = celery_app.control.inspect()
        active_workers = inspector.active()
        
        if active_workers is None:
            health_status["components"]["celery_workers"] = {
                "status": "down",
                "message": "No workers responding",
                "active_workers": 0
            }
            issues.append("No Celery workers running")
        else:
            worker_count = len(active_workers)
            health_status["components"]["celery_workers"] = {
                "status": "healthy" if worker_count > 0 else "degraded",
                "message": f"{worker_count} worker(s) active",
                "active_workers": worker_count,
                "workers": list(active_workers.keys())
            }
            
            if worker_count == 0:
                issues.append("No active Celery workers")
    except Exception as e:
        health_status["components"]["celery_workers"] = {
            "status": "unknown",
            "message": f"Cannot inspect workers: {str(e)}",
            "active_workers": 0
        }
        issues.append("Cannot check Celery workers")
    
    # 4. Check recent job metrics (last 24 hours)
    try:
        with mongo_client() as client:
            db = client[get_database_name()]
            jobs = db["ingestion_jobs"]
            
            # Get job stats from last 24 hours
            cutoff_time = datetime.utcnow() - timedelta(hours=24)
            
            recent_jobs = list(jobs.find(
                {"created_at": {"$gte": cutoff_time}},
                {"job_id": 1, "status": 1, "duration_seconds": 1}
            ))
            
            total_jobs = len(recent_jobs)
            completed = sum(1 for j in recent_jobs if j.get("status") == "completed")
            failed = sum(1 for j in recent_jobs if j.get("status") == "failed")
            in_progress = sum(1 for j in recent_jobs if j.get("status") == "in_progress")
            
            # Calculate average duration for completed jobs
            completed_durations = [
                j.get("duration_seconds", 0) 
                for j in recent_jobs 
                if j.get("status") == "completed" and j.get("duration_seconds")
            ]
            avg_duration = sum(completed_durations) / len(completed_durations) if completed_durations else 0
            
            # Calculate failure rate
            failure_rate = (failed / total_jobs * 100) if total_jobs > 0 else 0
            
            health_status["metrics"] = {
                "last_24h_jobs_total": total_jobs,
                "last_24h_jobs_completed": completed,
                "last_24h_jobs_failed": failed,
                "last_24h_jobs_in_progress": in_progress,
                "average_job_duration_seconds": int(avg_duration),
                "failure_rate_percent": round(failure_rate, 2)
            }
            
            # Warn if failure rate is high
            if failure_rate > 10:
                issues.append(f"High failure rate: {failure_rate:.1f}%")
            
            # Warn if many jobs are stuck in progress
            if in_progress > 10:
                issues.append(f"{in_progress} jobs stuck in progress")
                
    except Exception as e:
        health_status["metrics"]["error"] = f"Cannot fetch job metrics: {str(e)}"
        issues.append("Cannot fetch job metrics")
    
    # Determine overall status
    if issues:
        if any(issue in ["MongoDB unavailable", "Redis unavailable", "No Celery workers running"] for issue in issues):
            health_status["status"] = "down"
        else:
            health_status["status"] = "degraded"
        
        health_status["issues"] = issues
    
    return health_status


@router.post("/retry/{job_id}")
def retry_job(job_id: str) -> Dict[str, Any]:
    """Retry a failed ingestion job."""
    with mongo_client() as client:
        db = client[get_database_name()]
        
        job = db["ingestion_jobs"].find_one({"job_id": job_id})
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        if job.get("status") not in ["failed", "cancelled"]:
            raise HTTPException(
                status_code=400,
                detail="Can only retry failed or cancelled jobs"
            )
        
        # Check max retries
        retry_count = job.get("retry_count", 0)
        max_retries = job.get("max_retries", 3)
        
        if retry_count >= max_retries:
            raise HTTPException(
                status_code=400,
                detail=f"Job has reached maximum retry limit ({max_retries})"
            )
        
        # Import here to avoid circular imports
        from data_ingest.tasks import ingest_symbol_interval_task
        
        # Reset job status
        db["ingestion_jobs"].update_one(
            {"job_id": job_id},
            {
                "$set": {
                    "status": "queued",
                    "retry_count": retry_count + 1,
                    "error_message": None,
                    "error_details": None,
                }
            }
        )
        
        # Re-enqueue task
        ingest_symbol_interval_task.apply_async(
            args=[
                job_id,
                job.get("symbol"),
                job.get("interval"),
                job.get("lookback_days", 30)
            ],
            queue="data"
        )
        
        return {"message": "Job requeued successfully", "job_id": job_id}


@router.post("/retry-batch/{parent_job_id}")
def retry_batch(parent_job_id: str) -> Dict[str, Any]:
    """
    Retry all failed jobs in a batch.
    
    Enforces max_retries limit (3) to prevent infinite retry loops.
    Returns the number of jobs retried and skipped.
    """
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Find all failed jobs in this batch
        failed_jobs = list(db["ingestion_jobs"].find({
            "parent_job_id": parent_job_id,
            "status": "failed"
        }))
        
        if not failed_jobs:
            return {
                "message": "No failed jobs to retry",
                "retried": 0,
                "skipped": 0
            }
        
        # Import here to avoid circular imports
        from data_ingest.tasks import ingest_symbol_interval_task
        
        retried = []
        skipped_max_retries = []
        
        for job in failed_jobs:
            retry_count = job.get("retry_count", 0)
            max_retries = job.get("max_retries", 3)
            
            # Check if max retries exceeded
            if retry_count >= max_retries:
                skipped_max_retries.append(job["job_id"])
                continue
            
            # Reset status and increment retry count
            db["ingestion_jobs"].update_one(
                {"job_id": job["job_id"]},
                {
                    "$set": {
                        "status": "queued",
                        "retry_count": retry_count + 1,
                        "error_message": None,
                        "error_details": None,
                    }
                }
            )
            
            # Re-enqueue task
            ingest_symbol_interval_task.apply_async(
                args=[
                    job["job_id"],
                    job["symbol"],
                    job["interval"],
                    job.get("lookback_days", 30)
                ],
                queue="data"
            )
            
            retried.append(job["job_id"])
        
        return {
            "message": f"Retried {len(retried)} failed job(s), skipped {len(skipped_max_retries)}",
            "retried": len(retried),
            "skipped": len(skipped_max_retries),
            "retried_job_ids": retried,
            "skipped_job_ids": skipped_max_retries
        }


@router.get("/stream-status/{job_id}")
async def stream_job_status(job_id: str):
    """
    Stream real-time job status updates using Server-Sent Events (SSE).
    
    The client should use EventSource API to connect:
    ```javascript
    const eventSource = new EventSource('/api/data-ingestion/stream-status/job_123');
    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Job progress:', data.progress_pct);
    };
    ```
    
    The stream will automatically close when the job reaches a terminal state
    (completed, failed, or cancelled).
    """
    async def event_generator():
        """Generate SSE events with job status updates."""
        try:
            with mongo_client() as client:
                db = client[get_database_name()]
                
                # Check if job exists
                job = db["ingestion_jobs"].find_one({"job_id": job_id}, {"_id": 0})
                if not job:
                    yield f"event: error\ndata: {json.dumps({'error': 'Job not found'})}\n\n"
                    return
                
                # Stream updates every 1 second
                while True:
                    job = db["ingestion_jobs"].find_one({"job_id": job_id}, {"_id": 0})
                    
                    if not job:
                        yield f"event: error\ndata: {json.dumps({'error': 'Job disappeared'})}\n\n"
                        break
                    
                    # Convert datetime objects to ISO format strings
                    job_data = {}
                    for key, value in job.items():
                        if isinstance(value, datetime):
                            job_data[key] = value.isoformat()
                        elif isinstance(value, dict):
                            # Handle nested datetime objects
                            nested = {}
                            for nested_key, nested_value in value.items():
                                if isinstance(nested_value, datetime):
                                    nested[nested_key] = nested_value.isoformat()
                                else:
                                    nested[nested_key] = nested_value
                            job_data[key] = nested
                        elif isinstance(value, list):
                            # Handle arrays (like steps)
                            arr = []
                            for item in value:
                                if isinstance(item, dict):
                                    item_dict = {}
                                    for item_key, item_value in item.items():
                                        if isinstance(item_value, datetime):
                                            item_dict[item_key] = item_value.isoformat()
                                        else:
                                            item_dict[item_key] = item_value
                                    arr.append(item_dict)
                                else:
                                    arr.append(item)
                            job_data[key] = arr
                        else:
                            job_data[key] = value
                    
                    # Send job status as SSE event
                    yield f"data: {json.dumps(job_data)}\n\n"
                    
                    # Stop streaming if job is in terminal state
                    if job.get("status") in ["completed", "failed", "cancelled"]:
                        yield f"event: done\ndata: {json.dumps({'status': job.get('status')})}\n\n"
                        break
                    
                    # Wait before next update
                    await asyncio.sleep(1)
                    
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


@router.get("/stream-batch-status/{parent_job_id}")
async def stream_batch_status(parent_job_id: str):
    """
    Stream real-time batch job status updates using Server-Sent Events (SSE).
    
    Similar to stream_job_status but for batch/parent jobs, providing aggregated
    status of all child jobs.
    """
    async def event_generator():
        """Generate SSE events with batch job status updates."""
        try:
            with mongo_client() as client:
                db = client[get_database_name()]
                
                # Check if parent job exists
                parent_job = db["ingestion_jobs"].find_one(
                    {"job_id": parent_job_id},
                    {"_id": 0}
                )
                
                if not parent_job:
                    yield f"event: error\ndata: {json.dumps({'error': 'Parent job not found'})}\n\n"
                    return
                
                # Stream updates every 2 seconds
                while True:
                    parent_job = db["ingestion_jobs"].find_one(
                        {"job_id": parent_job_id},
                        {"_id": 0}
                    )
                    
                    if not parent_job:
                        yield f"event: error\ndata: {json.dumps({'error': 'Parent job disappeared'})}\n\n"
                        break
                    
                    child_job_ids = parent_job.get("child_job_ids", [])
                    
                    # Get all child job statuses
                    child_jobs = list(db["ingestion_jobs"].find(
                        {"job_id": {"$in": child_job_ids}},
                        {"_id": 0}
                    ))
                    
                    # Calculate aggregated stats
                    total = len(child_jobs)
                    completed = sum(1 for j in child_jobs if j.get("status") == "completed")
                    failed = sum(1 for j in child_jobs if j.get("status") == "failed")
                    in_progress = sum(1 for j in child_jobs if j.get("status") == "in_progress")
                    pending = sum(1 for j in child_jobs if j.get("status") in ["pending", "queued"])
                    
                    overall_progress = (completed / total * 100) if total > 0 else 0
                    
                    # Determine parent status
                    parent_status = parent_job.get("status", "unknown")
                    if completed == total and total > 0:
                        parent_status = "completed"
                    elif failed > 0 and (completed + failed) == total:
                        parent_status = "partial_failure"
                    elif in_progress > 0:
                        parent_status = "in_progress"
                    
                    # Convert datetime objects
                    def convert_dates(obj):
                        if isinstance(obj, dict):
                            return {k: convert_dates(v) for k, v in obj.items()}
                        elif isinstance(obj, list):
                            return [convert_dates(item) for item in obj]
                        elif isinstance(obj, datetime):
                            return obj.isoformat()
                        else:
                            return obj
                    
                    child_jobs_converted = [convert_dates(job) for job in child_jobs]
                    
                    batch_status = {
                        "parent_job_id": parent_job_id,
                        "status": parent_status,
                        "overall_progress_pct": overall_progress,
                        "total_jobs": total,
                        "completed": completed,
                        "failed": failed,
                        "in_progress": in_progress,
                        "pending": pending,
                        "child_jobs": child_jobs_converted,
                        "created_at": parent_job["created_at"].isoformat() if isinstance(parent_job["created_at"], datetime) else parent_job["created_at"],
                    }
                    
                    # Send batch status as SSE event
                    yield f"data: {json.dumps(batch_status)}\n\n"
                    
                    # Stop streaming if all jobs are in terminal state
                    if parent_status in ["completed", "partial_failure"] and (completed + failed) == total:
                        yield f"event: done\ndata: {json.dumps({'status': parent_status})}\n\n"
                        break
                    
                    # Wait before next update
                    await asyncio.sleep(2)
                    
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

