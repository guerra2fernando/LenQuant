from __future__ import annotations

from typing import Any, Dict, List, Optional

from celery.result import AsyncResult
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, validator

from manager.experiment_runner import ExperimentRequest, run_experiment_cycle
from manager.tasks import celery_app, run_experiment_cycle_task
from strategy_genome.repository import fetch_queue, reprioritize_queue

router = APIRouter()


class ExperimentPayload(BaseModel):
    symbol: Optional[str] = Field(None, description="Trading symbol to evaluate, e.g., BTC/USDT")
    interval: Optional[str] = Field(None, description="Base timeframe, e.g., 1m")
    horizon: Optional[str] = Field(None, description="Forecast horizon, defaults to interval")
    accounts: Optional[int] = Field(20, ge=1, le=200, description="Number of simulations to run")
    mutations_per_parent: Optional[int] = Field(5, ge=1, le=20)
    champion_limit: Optional[int] = Field(5, ge=1, le=20)
    queue_only: bool = False
    families: Optional[List[str]] = Field(default=None)

    @validator("families", pre=True)
    def sanitize_families(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return None
        return [family.strip() for family in value if family.strip()]


class ReprioritizePayload(BaseModel):
    queue_ids: List[str] = Field(..., min_items=1)


@router.get("/queue")
def get_queue(status: Optional[str] = None) -> Dict[str, Any]:
    return {"queue": fetch_queue(status=status)}


@router.post("/run")
def post_run_experiments(payload: ExperimentPayload) -> Dict[str, Any]:
    request = ExperimentRequest(
        symbol=payload.symbol,
        interval=payload.interval,
        horizon=payload.horizon,
        accounts=payload.accounts or 20,
        mutations_per_parent=payload.mutations_per_parent or 5,
        champion_limit=payload.champion_limit or 5,
        queue_only=payload.queue_only,
        families=payload.families or ["ema-cross"],
    )
    if payload.queue_only:
        summary = run_experiment_cycle(request)
        return {"summary": summary, "mode": "queue_only"}

    task = run_experiment_cycle_task.delay(request.to_dict())
    status = (task.status or "PENDING").lower()
    return {"task_id": task.id, "status": status}


@router.post("/reprioritize")
def post_reprioritize(payload: ReprioritizePayload) -> Dict[str, Any]:
    reordered = reprioritize_queue(payload.queue_ids)
    if not reordered:
        raise HTTPException(status_code=404, detail="No queue items were reprioritized.")
    return {"queue": reordered}


@router.get("/tasks/{task_id}")
def get_experiment_task(task_id: str) -> Dict[str, Any]:
    result = AsyncResult(task_id, app=celery_app)
    status = (result.status or "PENDING").lower()
    response: Dict[str, Any] = {"task_id": task_id, "status": status}
    if result.successful():
        response["result"] = result.result
    elif result.failed():
        response["error"] = str(result.result)
    return response


