from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from db.client import get_database_name, mongo_client
from strategy_genome.repository import (
    archive_strategy,
    get_genome,
    list_genomes,
    promote_strategy,
)

router = APIRouter()


def _serialize_datetime(value: Any) -> Any:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def _serialize_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    converted = {**doc}
    converted["_id"] = str(converted.get("_id", converted.get("strategy_id", "")))
    converted["created_at"] = _serialize_datetime(converted.get("created_at"))
    converted["updated_at"] = _serialize_datetime(converted.get("updated_at"))
    fitness = converted.get("fitness")
    if fitness:
        converted["fitness"] = {k: float(v) if isinstance(v, (int, float)) else v for k, v in fitness.items()}
    return converted


@router.get("/genomes")
def get_genomes(
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> Dict[str, Any]:
    docs = list_genomes(status=status, limit=limit)
    return {"genomes": [_serialize_doc(doc) for doc in docs]}


def _recent_runs(strategy_id: str, limit: int = 5) -> List[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        cursor = (
            db["sim_runs"]
            .find({"strategy": strategy_id})
            .sort("created_at", -1)
            .limit(limit)
        )
        runs = list(cursor)
    for run in runs:
        run["_id"] = str(run.get("_id", ""))
        run["created_at"] = _serialize_datetime(run.get("created_at"))
    return runs


@router.get("/{strategy_id}")
def get_strategy(strategy_id: str) -> Dict[str, Any]:
    doc = get_genome(strategy_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Strategy '{strategy_id}' not found.")
    return {
        "strategy": _serialize_doc(doc),
        "runs": _recent_runs(strategy_id),
    }


class StrategyActionPayload(BaseModel):
    strategy_id: str


@router.post("/promote")
def post_promote_strategy(payload: StrategyActionPayload) -> Dict[str, Any]:
    updated = promote_strategy(payload.strategy_id)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Strategy '{payload.strategy_id}' not found.")
    return {"strategy": _serialize_doc(updated)}


@router.post("/archive")
def post_archive_strategy(payload: StrategyActionPayload) -> Dict[str, Any]:
    updated = archive_strategy(payload.strategy_id)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Strategy '{payload.strategy_id}' not found.")
    return {"strategy": _serialize_doc(updated)}


@router.get("/lineage")
def get_lineage(limit: int = Query(default=100, ge=1, le=500)) -> Dict[str, Any]:
    docs = list_genomes(limit=limit)
    nodes = []
    links = []
    for doc in docs:
        parent = doc.get("mutation_parent")
        nodes.append(
            {
                "strategy_id": doc.get("strategy_id"),
                "generation": doc.get("generation"),
                "status": doc.get("status"),
                "composite": doc.get("fitness", {}).get("composite"),
                "parent": parent,
            }
        )
        if parent:
            links.append({"source": parent, "target": doc.get("strategy_id")})
    return {"nodes": nodes, "links": links}


class RiskLimits(BaseModel):
    max_position_size: float
    max_daily_loss: float
    stop_loss_pct: float


class ActivateStrategyRequest(BaseModel):
    strategy_id: str
    mode: str  # "paper" | "testnet" | "live"
    allocation_pct: float
    risk_limits: RiskLimits


@router.post("/activate")
def activate_strategy(payload: ActivateStrategyRequest) -> Dict[str, Any]:
    """
    Activate a strategy for autonomous trading.
    """
    # Validate strategy exists
    strategy = get_genome(payload.strategy_id)
    if not strategy:
        raise HTTPException(status_code=404, detail=f"Strategy '{payload.strategy_id}' not found.")
    
    # Validate mode
    if payload.mode not in ["paper", "testnet", "live"]:
        raise HTTPException(status_code=400, detail="Mode must be 'paper', 'testnet', or 'live'.")
    
    # Validate allocation
    if payload.allocation_pct <= 0 or payload.allocation_pct > 100:
        raise HTTPException(status_code=400, detail="Allocation must be between 0 and 100%.")
    
    # Get portfolio to calculate allocated capital
    with mongo_client() as client:
        db = client[get_database_name()]
        active_col = db["active_strategies"]
        
        # Check if already activated
        existing = active_col.find_one({
            "strategy_id": payload.strategy_id,
            "mode": payload.mode,
            "status": "active",
        })
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Strategy is already active in {payload.mode} mode.",
            )
        
        # Calculate allocated capital (simplified - in production, fetch from portfolio)
        # For now, use a placeholder based on mode
        base_capital = {
            "paper": 100000,
            "testnet": 10000,
            "live": 1000,
        }
        allocated_capital = base_capital.get(payload.mode, 100000) * (payload.allocation_pct / 100)
        
        # Create activation record
        activation = {
            "strategy_id": payload.strategy_id,
            "strategy_name": strategy.get("strategy_id", "Unknown"),
            "mode": payload.mode,
            "status": "active",
            "allocation_pct": payload.allocation_pct,
            "allocated_capital": allocated_capital,
            "risk_limits": {
                "max_position_size": payload.risk_limits.max_position_size,
                "max_daily_loss": payload.risk_limits.max_daily_loss,
                "stop_loss_pct": payload.risk_limits.stop_loss_pct,
            },
            "activated_at": datetime.utcnow(),
            "deactivated_at": None,
            "trades_executed": 0,
            "realized_pnl": 0.0,
            "unrealized_pnl": 0.0,
        }
        
        result = active_col.insert_one(activation)
        activation["_id"] = str(result.inserted_id)
    
    return {
        "strategy_id": payload.strategy_id,
        "status": "active",
        "activated_at": activation["activated_at"].isoformat(),
        "allocation_pct": payload.allocation_pct,
        "estimated_capital": allocated_capital,
    }


@router.get("/active")
def get_active_strategies(mode: Optional[str] = Query(None)) -> Dict[str, Any]:
    """
    Get all active strategies.
    """
    with mongo_client() as client:
        db = client[get_database_name()]
        active_col = db["active_strategies"]
        
        query = {"status": "active"}
        if mode:
            query["mode"] = mode
        
        strategies = list(active_col.find(query).sort("activated_at", -1))
        
        serialized = []
        for strat in strategies:
            serialized.append({
                "activation_id": str(strat.get("_id", "")),
                "strategy_id": strat.get("strategy_id"),
                "strategy_name": strat.get("strategy_name"),
                "mode": strat.get("mode"),
                "status": strat.get("status"),
                "allocation_pct": strat.get("allocation_pct"),
                "allocated_capital": strat.get("allocated_capital"),
                "trades_count": strat.get("trades_executed", 0),
                "pnl": strat.get("realized_pnl", 0) + strat.get("unrealized_pnl", 0),
                "activated_at": strat.get("activated_at").isoformat() if strat.get("activated_at") else None,
                "last_trade_at": strat.get("last_trade_at").isoformat() if strat.get("last_trade_at") else None,
            })
    
    return {"strategies": serialized}


@router.post("/{strategy_id}/deactivate")
def deactivate_strategy(
    strategy_id: str,
    mode: Optional[str] = Query(None, description="Specific mode to deactivate"),
) -> Dict[str, Any]:
    """
    Deactivate a strategy for autonomous trading.
    """
    with mongo_client() as client:
        db = client[get_database_name()]
        active_col = db["active_strategies"]
        
        query = {
            "strategy_id": strategy_id,
            "status": "active",
        }
        if mode:
            query["mode"] = mode
        
        result = active_col.update_many(
            query,
            {
                "$set": {
                    "status": "stopped",
                    "deactivated_at": datetime.utcnow(),
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(
                status_code=404,
                detail=f"No active strategy found for '{strategy_id}'{' in ' + mode + ' mode' if mode else ''}.",
            )
    
    return {
        "strategy_id": strategy_id,
        "status": "stopped",
        "deactivated_count": result.modified_count,
        "deactivated_at": datetime.utcnow().isoformat(),
    }


