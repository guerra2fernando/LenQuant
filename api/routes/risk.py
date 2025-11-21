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
    summary = manager.get_summary()
    
    # Add pre-breach warnings
    warnings = {}
    
    # Daily loss warning (alert at 80% and 90% of limit)
    daily_loss = abs(summary.get("daily_loss_usd", 0))
    max_daily_loss = manager.settings.max_daily_loss_usd
    if max_daily_loss > 0:
        loss_pct = daily_loss / max_daily_loss
        is_warning_80 = loss_pct >= 0.80 and loss_pct < 1.0
        is_warning_90 = loss_pct >= 0.90 and loss_pct < 1.0
        
        warnings["daily_loss"] = {
            "threshold_pct": loss_pct,
            "is_warning": is_warning_80 or is_warning_90,
            "severity": "critical" if is_warning_90 else "warning" if is_warning_80 else "normal",
            "message": (
                f"Daily loss at {loss_pct*100:.1f}% of limit. Critical threshold approaching!"
                if is_warning_90
                else f"Daily loss at {loss_pct*100:.1f}% of limit. Monitor carefully."
                if is_warning_80
                else ""
            ),
        }
    
    # Open exposure warnings
    for mode, exposure in summary.get("open_exposure", {}).items():
        mode_settings = manager.settings.modes.get(mode)
        if mode_settings and mode_settings.max_notional_usd > 0:
            exposure_pct = exposure / mode_settings.max_notional_usd
            is_warning_80 = exposure_pct >= 0.80 and exposure_pct < 1.0
            is_warning_90 = exposure_pct >= 0.90 and exposure_pct < 1.0
            
            warnings[f"open_exposure_{mode}"] = {
                "threshold_pct": exposure_pct,
                "is_warning": is_warning_80 or is_warning_90,
                "severity": "critical" if is_warning_90 else "warning" if is_warning_80 else "normal",
                "message": (
                    f"{mode.capitalize()} exposure at {exposure_pct*100:.1f}% of limit!"
                    if is_warning_90 or is_warning_80
                    else ""
                ),
            }
    
    # Auto-mode trade cap warning
    auto_settings = manager.settings.auto_mode
    if auto_settings.enabled and auto_settings.max_trades_per_day > 0:
        # Count today's trades (would need trade tracking)
        # For now, placeholder
        trades_today = 0  # TODO: Implement trade counting
        trades_pct = trades_today / auto_settings.max_trades_per_day
        
        warnings["auto_mode_cap"] = {
            "threshold_pct": trades_pct,
            "is_warning": trades_pct >= 0.80,
            "severity": "warning" if trades_pct >= 0.80 else "normal",
            "message": (
                f"Auto-mode trades at {trades_pct*100:.1f}% of daily limit"
                if trades_pct >= 0.80
                else ""
            ),
        }
    
    summary["warnings"] = warnings
    return summary


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


