from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from db.client import get_database_name, mongo_client
from reports.leaderboard import (
    generate_leaderboard,
    generate_regime_leaderboard,
    get_regime_specialists,
    list_leaderboards,
    load_leaderboard,
)

router = APIRouter()


@router.get("/today")
def get_today_leaderboard(limit: int = Query(default=10, ge=1, le=50)) -> Dict[str, Any]:
    payload = generate_leaderboard(limit=limit)
    return {"leaderboard": payload}


@router.get("/history")
def get_leaderboard_history() -> Dict[str, Any]:
    return {"history": list_leaderboards()}


@router.get("/{slug}")
def get_leaderboard_slug(slug: str) -> Dict[str, Any]:
    payload = load_leaderboard(slug)
    if not payload:
        raise HTTPException(status_code=404, detail=f"Leaderboard '{slug}' not found.")
    return {"leaderboard": payload}


@router.get("/regime/current")
def get_current_regime_leaderboard(
    limit: int = Query(default=10, ge=1, le=50),
    symbol: str = Query(default="BTC/USD"),
    interval: str = Query(default="1h"),
) -> Dict[str, Any]:
    """
    Get leaderboard for strategies optimized for current market regime.
    
    Returns top strategies that perform well in the current regime.
    """
    payload = generate_regime_leaderboard(
        use_current_regime=True,
        limit=limit,
        symbol=symbol,
        interval=interval,
    )
    return {"leaderboard": payload}


@router.get("/regime/{regime}")
def get_regime_specific_leaderboard(
    regime: str,
    limit: int = Query(default=10, ge=1, le=50),
) -> Dict[str, Any]:
    """
    Get leaderboard for strategies optimized for a specific regime.
    
    Valid regimes: TRENDING_UP, TRENDING_DOWN, SIDEWAYS
    """
    valid_regimes = ["TRENDING_UP", "TRENDING_DOWN", "SIDEWAYS", "UNDEFINED"]
    
    if regime.upper() not in valid_regimes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid regime '{regime}'. Valid values: {', '.join(valid_regimes)}",
        )
    
    payload = generate_regime_leaderboard(
        regime=regime.upper(),
        limit=limit,
        use_current_regime=False,
    )
    return {"leaderboard": payload}


@router.get("/regime/specialists/all")
def get_all_regime_specialists(
    limit: int = Query(default=5, ge=1, le=20),
) -> Dict[str, Any]:
    """
    Get top specialists for each regime type.
    
    Returns a dictionary mapping regime types to their top specialist strategies.
    """
    specialists = get_regime_specialists(limit=limit, include_all_regimes=True)
    return {"specialists": specialists}


@router.get("/strategy/{strategy_id}/regime-performance")
def get_strategy_regime_performance(strategy_id: str) -> Dict[str, Any]:
    """
    Get detailed regime performance breakdown for a specific strategy.
    
    Returns performance metrics grouped by regime type.
    """
    try:
        with mongo_client() as client:
            db = client[get_database_name()]
            strategy_doc = db["strategies"].find_one({"strategy_id": strategy_id})
            
            if not strategy_doc:
                raise HTTPException(
                    status_code=404,
                    detail=f"Strategy '{strategy_id}' not found",
                )
            
            regime_performance = strategy_doc.get("regime_performance", {})
            preferred_regime = strategy_doc.get("preferred_regime")
            
            if not regime_performance:
                return {
                    "strategy_id": strategy_id,
                    "regime_performance": {},
                    "preferred_regime": None,
                    "message": "No regime performance data available for this strategy",
                }
            
            return {
                "strategy_id": strategy_id,
                "regime_performance": regime_performance,
                "preferred_regime": preferred_regime,
                "regime_analysis_updated_at": strategy_doc.get("regime_analysis_updated_at"),
            }
            
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve regime performance: {str(exc)}",
        ) from exc


