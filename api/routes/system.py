"""System health monitoring and consolidated status endpoints."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter

from db.client import get_database_name, mongo_client

router = APIRouter()


def _get_data_pipeline_status() -> Dict[str, Any]:
    """Check data pipeline health."""
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Get latest candle timestamp
        latest_candle = db["ohlcv"].find_one(
            {}, {"timestamp": 1}, sort=[("timestamp", -1)]
        )
        
        # Get symbol and interval counts
        pipeline = [
            {
                "$group": {
                    "_id": {"symbol": "$symbol", "interval": "$interval"},
                    "count": {"$sum": 1},
                }
            }
        ]
        agg_result = list(db["ohlcv"].aggregate(pipeline))
        
        symbols_count = len(set(item["_id"]["symbol"] for item in agg_result))
        intervals_count = len(set(item["_id"]["interval"] for item in agg_result))
        
        # Calculate freshness
        if latest_candle and latest_candle.get("timestamp"):
            last_updated = latest_candle["timestamp"]
            freshness_hours = (datetime.utcnow() - last_updated).total_seconds() / 3600
        else:
            last_updated = None
            freshness_hours = 999
        
        # Determine status
        if freshness_hours > 24:
            status = "inactive"
        elif freshness_hours > 2:
            status = "aging"
        else:
            status = "healthy"
        
        return {
            "status": status,
            "last_updated": last_updated.isoformat() if last_updated else None,
            "symbols_count": symbols_count,
            "intervals_count": intervals_count,
            "freshness_hours": round(freshness_hours, 1),
        }


def _get_models_status() -> Dict[str, Any]:
    """Check model training status."""
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Count trained models
        trained_models = list(db["model_registry"].find({}))
        trained_count = len(trained_models)
        
        # Get latest training timestamp
        if trained_models:
            latest_training = max(
                (m.get("trained_at") for m in trained_models if m.get("trained_at")),
                default=None
            )
        else:
            latest_training = None
        
        # Determine status
        if trained_count == 0:
            status = "pending"
        elif latest_training:
            age_hours = (datetime.utcnow() - latest_training).total_seconds() / 3600
            if age_hours > 168:  # 7 days
                status = "stale"
            else:
                status = "trained"
        else:
            status = "pending"
        
        return {
            "status": status,
            "trained_count": trained_count,
            "pending_count": 0,  # TODO: Track pending training jobs
            "last_trained": latest_training.isoformat() if latest_training else None,
        }


def _get_forecasts_status() -> Dict[str, Any]:
    """Check forecast generation status."""
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Note: Forecasts are generated on-demand via ensemble_predict
        # We can check recent forecast API usage from logs or reports
        # For now, we'll check reports as a proxy
        
        reports = list(db["daily_reports"].find({}).sort("created_at", -1).limit(1))
        
        if reports:
            latest_report = reports[0]
            last_generated = latest_report.get("created_at")
            
            # Check if report has forecast data
            total_count = len(latest_report.get("top_signals", []))
            high_confidence_count = sum(
                1 for signal in latest_report.get("top_signals", [])
                if signal.get("confidence", 0) > 0.8
            )
            
            # Determine status
            age_hours = (datetime.utcnow() - last_generated).total_seconds() / 3600
            if age_hours > 24:
                status = "stale"
            else:
                status = "healthy"
        else:
            status = "inactive"
            total_count = 0
            high_confidence_count = 0
            last_generated = None
        
        return {
            "status": status,
            "total_count": total_count,
            "high_confidence_count": high_confidence_count,
            "last_generated": last_generated.isoformat() if last_generated else None,
        }


def _get_evolution_status() -> Dict[str, Any]:
    """Check evolution system status."""
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Check evolution queue
        queue_size = db["evolution_queue"].count_documents({"status": "pending"})
        
        # Check for recent runs
        recent_runs = list(
            db["evolution_runs"].find({}).sort("created_at", -1).limit(1)
        )
        
        # Count champions
        champions_count = db["strategy_genome"].count_documents(
            {"is_champion": True}
        )
        
        if recent_runs:
            last_run = recent_runs[0].get("created_at")
            status = recent_runs[0].get("status", "idle")
        else:
            last_run = None
            status = "idle"
        
        return {
            "status": status,
            "queue_size": queue_size,
            "champions_count": champions_count,
            "last_run": last_run.isoformat() if last_run else None,
        }


@router.get("/health")
def get_system_health() -> Dict[str, Any]:
    """
    Get consolidated system health status.
    
    Aggregates data from multiple sources:
    - Data pipeline freshness
    - Model training status
    - Forecast generation
    - Evolution system
    
    Returns overall health assessment.
    """
    data_pipeline = _get_data_pipeline_status()
    models = _get_models_status()
    forecasts = _get_forecasts_status()
    evolution = _get_evolution_status()
    
    # Determine overall status
    statuses = [
        data_pipeline["status"],
        models["status"],
        forecasts["status"],
        evolution["status"],
    ]
    
    if "inactive" in statuses:
        overall = "critical"
    elif "aging" in statuses or "stale" in statuses or "pending" in statuses:
        overall = "degraded"
    else:
        overall = "healthy"
    
    return {
        "data_pipeline": data_pipeline,
        "models": models,
        "forecasts": forecasts,
        "evolution": evolution,
        "overall_status": overall,
        "timestamp": datetime.utcnow().isoformat(),
    }

