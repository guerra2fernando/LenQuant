from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from exec.risk_manager import RiskManager

from .trade import get_risk_manager

router = APIRouter()


class AcknowledgePayload(BaseModel):
    breach_id: str = Field(..., min_length=3)
    actor: Optional[str] = None


@router.get("/summary", response_model=Dict[str, Any])
def risk_summary() -> Dict[str, Any]:
    manager: RiskManager = get_risk_manager()
    return manager.get_summary()


@router.get("/breaches", response_model=List[Dict[str, Any]])
def risk_breaches(
    include_acknowledged: bool = Query(False),
    limit: int = Query(100, ge=1, le=500),
) -> List[Dict[str, Any]]:
    manager: RiskManager = get_risk_manager()
    return manager.get_breaches(include_acknowledged=include_acknowledged, limit=limit)


@router.post("/acknowledge")
def acknowledge_breach(payload: AcknowledgePayload) -> Dict[str, str]:
    manager: RiskManager = get_risk_manager()
    if not manager.acknowledge_breach(payload.breach_id, actor=payload.actor):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Breach not found.")
    return {"status": "ok"}


