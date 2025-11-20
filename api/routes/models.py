from __future__ import annotations

import logging
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel, Field

from db.client import get_database_name, mongo_client
from models import model_utils, registry
from models.model_utils import load_horizon_settings

router = APIRouter()
logger = logging.getLogger(__name__)

JOBS_COLLECTION = "jobs.model_training"


@router.get("/")
def list_models() -> Dict[str, List[str]]:
    artifacts = sorted(p.name for p in Path(model_utils.MODEL_DIR).glob("*.joblib"))
    return {"models": artifacts}


@router.get("/registry")
def registry_list(symbol: Optional[str] = None, horizon: Optional[str] = None, limit: int = 50) -> Dict[str, Any]:
    records = registry.list_models(symbol=symbol, horizon=horizon, limit=limit)
    for rec in records:
        if "_id" in rec:
            rec["_id"] = str(rec["_id"])
        if "trained_at" in rec and hasattr(rec["trained_at"], "isoformat"):
            rec["trained_at"] = rec["trained_at"].isoformat()
    return {"items": records}


@router.get("/registry/{model_id}")
def registry_detail(model_id: str) -> Dict[str, Any]:
    record = registry.get_model(model_id)
    if not record:
        raise HTTPException(status_code=404, detail="Model not found")
    if "_id" in record:
        record["_id"] = str(record["_id"])
    if "trained_at" in record and hasattr(record["trained_at"], "isoformat"):
        record["trained_at"] = record["trained_at"].isoformat()
    return record


class RetrainRequest(BaseModel):
    symbol: str = Field(..., example="BTC/USDT")
    horizon: str = Field(..., example="1h")
    algorithm: str = Field("rf", description="Training algorithm (rf or lgbm)")
    train_window: Optional[int] = Field(None, description="Training window in days")
    promote: bool = Field(False, description="Promote to production upon success")


class BulkRetrainRequest(BaseModel):
    symbols: Optional[List[str]] = Field(None, description="Symbols to retrain; defaults to DEFAULT_SYMBOLS env")
    algorithm: str = Field("rf", description="Training algorithm (rf or lgbm)")
    promote: bool = Field(False, description="Promote trained models to production")
    dry_run: bool = Field(False, description="Return commands without executing training")


def _default_symbols() -> List[str]:
    raw = os.getenv("DEFAULT_SYMBOLS")
    if raw:
        symbols = [item.strip() for item in raw.split(",") if item.strip()]
        if symbols:
            return symbols
    return ["BTC/USDT"]


def _run_training_job(payload: RetrainRequest) -> None:
    cmd = [
        sys.executable,
        "-m",
        "models.train_horizon",
        "--symbol",
        payload.symbol,
        "--horizon",
        payload.horizon,
        "--algorithm",
        payload.algorithm,
    ]
    if payload.train_window:
        cmd.extend(["--train-window", str(payload.train_window)])
    if payload.promote:
        cmd.append("--promote")

    logger.info("Starting training job: %s", " ".join(cmd))
    subprocess.run(cmd, check=False)


@router.post("/retrain")
def retrain(request: RetrainRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    background_tasks.add_task(_run_training_job, request)
    return {"status": "scheduled", "symbol": request.symbol, "horizon": request.horizon}


def _build_retraining_commands(symbols: List[str], algorithm: str, promote: bool) -> List[List[str]]:
    horizons = load_horizon_settings()
    commands: List[List[str]] = []
    for symbol in symbols:
        for horizon in horizons:
            horizon_name = horizon.get("name")
            if not horizon_name:
                continue
            cmd = [
                sys.executable,
                "-m",
                "models.train_horizon",
                "--symbol",
                symbol,
                "--horizon",
                horizon_name,
                "--algorithm",
                algorithm,
            ]
            train_window = horizon.get("train_window_days")
            if isinstance(train_window, int) and train_window > 0:
                cmd.extend(["--train-window", str(train_window)])
            if promote:
                cmd.append("--promote")
            commands.append(cmd)
    return commands


def _record_job(
    symbols: List[str],
    algorithm: str,
    promote: bool,
    dry_run: bool,
    commands: List[List[str]],
) -> ObjectId:
    doc = {
        "symbols": symbols,
        "algorithm": algorithm,
        "promote": promote,
        "dry_run": dry_run,
        "status": "scheduled",
        "commands": [" ".join(cmd) for cmd in commands],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    with mongo_client() as client:
        db = client[get_database_name()]
        return db[JOBS_COLLECTION].insert_one(doc).inserted_id


def _update_job(job_id: ObjectId, payload: Dict[str, Any]) -> None:
    payload["updated_at"] = datetime.utcnow()
    with mongo_client() as client:
        db = client[get_database_name()]
        db[JOBS_COLLECTION].update_one({"_id": job_id}, {"$set": payload})


def _run_bulk_retraining(job_id: ObjectId, commands: List[List[str]], dry_run: bool) -> None:
    logs: List[Dict[str, Any]] = []
    status = "succeeded"
    try:
        if not commands:
            status = "noop"
        for cmd in commands:
            command_str = " ".join(cmd)
            if dry_run:
                logs.append({"command": command_str, "status": "skipped"})
                continue
            result = subprocess.run(cmd, capture_output=True, text=True)
            logs.append(
                {
                    "command": command_str,
                    "status": "succeeded" if result.returncode == 0 else "failed",
                    "returncode": result.returncode,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                }
            )
            if result.returncode != 0:
                status = "failed"
                break
        if dry_run:
            status = "dry_run"
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception("Bulk retraining job %s failed", job_id)
        logs.append({"command": None, "status": "error", "error": str(exc)})
        status = "failed"
    finally:
        _update_job(
            job_id,
            {
                "status": status,
                "finished_at": datetime.utcnow(),
                "logs": logs,
            },
        )


@router.post("/retrain/bulk")
def retrain_bulk(request: BulkRetrainRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    algorithm = request.algorithm.lower()
    if algorithm not in {"rf", "lgbm"}:
        raise HTTPException(status_code=400, detail="algorithm must be 'rf' or 'lgbm'")
    symbols = request.symbols or _default_symbols()
    if not symbols:
        raise HTTPException(status_code=400, detail="No symbols provided for retraining.")
    commands = _build_retraining_commands(symbols, algorithm, request.promote)
    job_id = _record_job(symbols, algorithm, request.promote, request.dry_run, commands)
    background_tasks.add_task(_run_bulk_retraining, job_id, commands, request.dry_run)
    return {
        "status": "scheduled",
        "job_id": str(job_id),
        "symbol_count": len(symbols),
        "command_count": len(commands),
        "dry_run": request.dry_run,
    }


@router.get("/retrain/jobs")
def list_retrain_jobs(limit: int = Query(10, ge=1, le=100)) -> Dict[str, Any]:
    with mongo_client() as client:
        db = client[get_database_name()]
        cursor = (
            db[JOBS_COLLECTION]
            .find({})
            .sort("created_at", -1)
            .limit(limit)
        )
        jobs = []
        for item in cursor:
            item["_id"] = str(item["_id"])
            created = item.get("created_at")
            finished = item.get("finished_at")
            if hasattr(created, "isoformat"):
                item["created_at"] = created.isoformat()
            if hasattr(finished, "isoformat"):
                item["finished_at"] = finished.isoformat()
            jobs.append(item)
    return {"jobs": jobs}

