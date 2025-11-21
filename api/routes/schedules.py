from __future__ import annotations

from typing import Any, Dict, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db.client import get_database_name, mongo_client
from pymongo import ReturnDocument

router = APIRouter()

SCHEDULED_TASKS_COLLECTION = "scheduled_tasks"

SUPPORTED_TASK_TYPES = ["evolution", "learning", "model_retraining", "data_refresh", "reports"]


def _db():
    client_context = mongo_client()
    client = client_context.__enter__()
    db = client[get_database_name()]
    return db, client_context


def _with_iso_dates(document: Dict[str, Any]) -> Dict[str, Any]:
    payload = document.copy()
    for key, value in list(payload.items()):
        if isinstance(value, datetime):
            payload[key] = value.isoformat()
    if "_id" in payload:
        payload["_id"] = str(payload["_id"])
    return payload


def _calculate_next_run(schedule: str, from_time: datetime = None) -> Optional[datetime]:
    """Calculate next run time from schedule string."""
    if not from_time:
        from_time = datetime.utcnow()
    
    # Simple interval parsing (e.g., "4h", "30m", "1d")
    if schedule.endswith('h'):
        hours = int(schedule[:-1])
        return from_time + timedelta(hours=hours)
    elif schedule.endswith('m'):
        minutes = int(schedule[:-1])
        return from_time + timedelta(minutes=minutes)
    elif schedule.endswith('d'):
        days = int(schedule[:-1])
        return from_time + timedelta(days=days)
    
    # TODO: Add cron expression parsing for more complex schedules
    # For now, default to 4 hours
    return from_time + timedelta(hours=4)


class ScheduleConfigRequest(BaseModel):
    enabled: bool
    schedule: str = Field(..., description="Cron expression or interval (e.g., '4h', '30m', '1d')")
    config: Optional[Dict[str, Any]] = None


@router.get("/status")
def get_schedules_status() -> Dict[str, Any]:
    """Get status of all scheduled tasks."""
    db, ctx = _db()
    try:
        tasks = list(db[SCHEDULED_TASKS_COLLECTION].find({}))
    finally:
        ctx.__exit__(None, None, None)
    
    response = {}
    for task in tasks:
        task_type = task.get("task_type")
        if task_type:
            response[task_type] = {
                "enabled": task.get("enabled", False),
                "schedule": task.get("schedule", ""),
                "last_run": task.get("last_run_at").isoformat() if task.get("last_run_at") else None,
                "next_run": task.get("next_run_at").isoformat() if task.get("next_run_at") else None,
                "status": task.get("last_status", "idle"),
                "runs_today": task.get("run_count", 0),
                "avg_duration_minutes": round(task.get("last_duration_ms", 0) / 60000, 2) if task.get("last_duration_ms") else 0
            }
    
    # Ensure all supported types are in response
    for task_type in SUPPORTED_TASK_TYPES:
        if task_type not in response:
            response[task_type] = {
                "enabled": False,
                "schedule": "",
                "last_run": None,
                "next_run": None,
                "status": "not_configured"
            }
    
    return response


@router.post("/{task_type}")
def configure_schedule(task_type: str, request: ScheduleConfigRequest) -> Dict[str, Any]:
    """Configure a scheduled task."""
    if task_type not in SUPPORTED_TASK_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported task type. Must be one of: {', '.join(SUPPORTED_TASK_TYPES)}"
        )
    
    next_run = None
    if request.enabled:
        next_run = _calculate_next_run(request.schedule)
    
    task_data = {
        "task_type": task_type,
        "enabled": request.enabled,
        "schedule": request.schedule,
        "config": request.config or {},
        "next_run_at": next_run,
        "updated_at": datetime.utcnow()
    }
    
    db, ctx = _db()
    try:
        updated = db[SCHEDULED_TASKS_COLLECTION].find_one_and_update(
            {"task_type": task_type},
            {"$set": task_data},
            upsert=True,
            return_document=ReturnDocument.AFTER
        )
    finally:
        ctx.__exit__(None, None, None)
    
    return {
        "status": "ok",
        "task_type": task_type,
        "enabled": updated.get("enabled"),
        "schedule": updated.get("schedule"),
        "next_run": updated.get("next_run_at").isoformat() if updated.get("next_run_at") else None
    }


@router.get("/{task_type}")
def get_schedule(task_type: str) -> Dict[str, Any]:
    """Get specific schedule configuration."""
    if task_type not in SUPPORTED_TASK_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported task type. Must be one of: {', '.join(SUPPORTED_TASK_TYPES)}"
        )
    
    db, ctx = _db()
    try:
        task = db[SCHEDULED_TASKS_COLLECTION].find_one({"task_type": task_type})
    finally:
        ctx.__exit__(None, None, None)
    
    if not task:
        return {
            "task_type": task_type,
            "enabled": False,
            "schedule": "",
            "config": {},
            "status": "not_configured"
        }
    
    return _with_iso_dates(task)


@router.delete("/{task_type}")
def disable_schedule(task_type: str) -> Dict[str, Any]:
    """Disable a scheduled task."""
    if task_type not in SUPPORTED_TASK_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported task type. Must be one of: {', '.join(SUPPORTED_TASK_TYPES)}"
        )
    
    db, ctx = _db()
    try:
        updated = db[SCHEDULED_TASKS_COLLECTION].find_one_and_update(
            {"task_type": task_type},
            {"$set": {"enabled": False, "updated_at": datetime.utcnow()}},
            return_document=ReturnDocument.AFTER
        )
    finally:
        ctx.__exit__(None, None, None)
    
    if not updated:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    return {"status": "ok", "task_type": task_type, "enabled": False}

