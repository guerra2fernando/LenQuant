from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Query

import db.client as db_client

router = APIRouter()


@router.get("/overview")
def get_analytics_overview() -> Dict[str, Any]:
    """
    Get consolidated analytics overview.
    
    Aggregates forecasts, strategies, evolution, and learning data
    into a single endpoint for the Analytics Overview tab.
    """
    with db_client.mongo_client() as client:
        db = client[db_client.get_database_name()]
        
        # Forecasts metrics
        reports = list(db["daily_reports"].find({}).sort("created_at", -1).limit(1))
        forecasts_total = 0
        forecasts_high_conf = 0
        forecasts_avg_conf = 0
        forecasts_last_updated = None
        new_forecasts_today = 0
        
        if reports:
            report = reports[0]
            forecasts = report.get("forecasts", [])
            forecasts_total = len(forecasts)
            
            if forecasts_total > 0:
                forecasts_high_conf = sum(1 for f in forecasts if f.get("confidence", 0) > 0.8)
                total_conf = sum(f.get("confidence", 0) for f in forecasts)
                forecasts_avg_conf = total_conf / forecasts_total
            
            forecasts_last_updated = report.get("created_at")
            
            # Count today's forecasts
            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            if forecasts_last_updated and forecasts_last_updated >= today_start:
                new_forecasts_today = forecasts_total
        
        # Strategies metrics
        strategies_total = db["strategy_genome"].count_documents({})
        strategies_active = db["strategy_genome"].count_documents({"status": "active"})
        
        # Count champions (strategies with sharpe > 1.5)
        champions = list(db["strategy_genome"].find(
            {"metrics.sharpe_ratio": {"$gt": 1.5}},
            {"metrics.sharpe_ratio": 1}
        ).sort("metrics.sharpe_ratio", -1).limit(1))
        
        champions_count = db["strategy_genome"].count_documents(
            {"metrics.sharpe_ratio": {"$gt": 1.5}}
        )
        
        avg_sharpe = 0
        sharpe_docs = list(db["strategy_genome"].find(
            {"metrics.sharpe_ratio": {"$exists": True}},
            {"metrics.sharpe_ratio": 1}
        ))
        if sharpe_docs:
            sharpes = [doc.get("metrics", {}).get("sharpe_ratio", 0) for doc in sharpe_docs]
            avg_sharpe = sum(sharpes) / len(sharpes) if sharpes else 0
        
        best_performer = None
        if champions:
            best = champions[0]
            best_performer = {
                "strategy": best.get("_id"),
                "sharpe": best.get("metrics", {}).get("sharpe_ratio", 0),
            }
        
        # Evolution metrics
        evolution_status = "idle"
        evolution_queue_size = db["evolution_queue"].count_documents({"status": "pending"})
        
        running_tasks = db["evolution_queue"].count_documents({"status": "running"})
        if running_tasks > 0:
            evolution_status = "running"
        
        # Count completed today
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        completed_today = db["evolution_runs"].count_documents({
            "completed_at": {"$gte": today_start},
            "status": "completed"
        })
        
        # Success rate (last 50 runs)
        recent_runs = list(db["evolution_runs"].find({}).sort("completed_at", -1).limit(50))
        success_count = sum(1 for r in recent_runs if r.get("status") == "completed")
        success_rate = (success_count / len(recent_runs)) if recent_runs else 0
        
        last_evolution_run = None
        evolution_runs = list(db["evolution_runs"].find({}).sort("completed_at", -1).limit(1))
        if evolution_runs:
            last_evolution_run = evolution_runs[0].get("completed_at")
        
        # Learning metrics
        learning_jobs = list(db["learning_jobs"].find({}).sort("completed_at", -1).limit(1))
        last_learning_cycle = None
        improvements_count = 0
        overfit_alerts_count = 0
        
        if learning_jobs:
            job = learning_jobs[0]
            last_learning_cycle = job.get("completed_at")
            improvements = job.get("improvements", {})
            improvements_count = improvements.get("new_champions", 0) + improvements.get("allocation_changes", 0)
        
        # Count open overfit alerts
        overfit_alerts_count = db["overfit_detection"].count_documents({"status": "open"})
        
        # Meta model accuracy (if available)
        meta_model_accuracy = 0
        meta_models = list(db["meta_models"].find({}).sort("trained_at", -1).limit(1))
        if meta_models:
            meta_model_accuracy = meta_models[0].get("accuracy", 0)
        
        # System health
        overall_health = "healthy"
        issues = []
        
        # Check data freshness
        if forecasts_last_updated:
            hours_since = (datetime.utcnow() - forecasts_last_updated).total_seconds() / 3600
            if hours_since > 24:
                overall_health = "degraded"
                issues.append("Forecasts are over 24 hours old")
        
        # Check model count
        model_count = db["model_registry"].count_documents({})
        if model_count == 0:
            overall_health = "critical"
            issues.append("No trained models found")
        
        # Check evolution status
        if evolution_queue_size > 100:
            if overall_health == "healthy":
                overall_health = "degraded"
            issues.append(f"Large evolution queue ({evolution_queue_size} pending)")
        
        # Tab badges
        tab_badges = {
            "forecasts": forecasts_high_conf,
            "strategies": champions_count if completed_today > 0 else 0,
            "evolution": evolution_queue_size,
            "learning": overfit_alerts_count,
        }
        
    return {
        "forecasts": {
            "total_count": forecasts_total,
            "high_confidence_count": forecasts_high_conf,
            "avg_confidence": forecasts_avg_conf,
            "new_today": new_forecasts_today,
            "last_updated": forecasts_last_updated.isoformat() if forecasts_last_updated else None,
        },
        "strategies": {
            "total_count": strategies_total,
            "active_count": strategies_active,
            "champions_count": champions_count,
            "avg_sharpe": avg_sharpe,
            "best_performer": best_performer,
        },
        "evolution": {
            "status": evolution_status,
            "queue_size": evolution_queue_size,
            "completed_today": completed_today,
            "success_rate": success_rate,
            "last_run": last_evolution_run.isoformat() if last_evolution_run else None,
        },
        "learning": {
            "last_cycle": last_learning_cycle.isoformat() if last_learning_cycle else None,
            "improvements_count": improvements_count,
            "overfit_alerts_count": overfit_alerts_count,
            "meta_model_accuracy": meta_model_accuracy,
        },
        "system_health": {
            "overall": overall_health,
            "issues": issues,
        },
        "tab_badges": tab_badges,
        "timestamp": datetime.utcnow().isoformat(),
    }

