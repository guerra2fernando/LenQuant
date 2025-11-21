from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from db.client import get_database_name, mongo_client
from models.ensemble import EnsembleError, ensemble_predict

router = APIRouter()


class ForecastRequest(BaseModel):
    symbol: str
    horizon: str
    timestamp: Optional[datetime] = None


def _serialize_result(result: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "symbol": result["symbol"],
        "horizon": result["horizon"],
        "timestamp": result["timestamp"].isoformat(),
        "pred_return": result["predicted_return"],
        "confidence": result["confidence"],
        "models": result["models"],
    }


@router.post("/")
def forecast(payload: ForecastRequest) -> Dict[str, Any]:
    ts = payload.timestamp or datetime.utcnow()
    try:
        result = ensemble_predict(payload.symbol, payload.horizon, ts)
    except EnsembleError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _serialize_result(result)


@router.get("/batch")
def forecast_batch(
    symbols: str = Query(..., description="Comma-separated symbol list"),
    horizon: str = Query(..., description="Horizon key, e.g., 1h"),
    timestamp: Optional[datetime] = None,
    min_confidence: Optional[float] = Query(None, ge=0.0, le=1.0, description="Minimum confidence filter"),
    max_confidence: Optional[float] = Query(None, ge=0.0, le=1.0, description="Maximum confidence filter"),
    direction: Optional[str] = Query(None, pattern="^(buy|sell)$", description="Filter by direction"),
    sort_by: Optional[str] = Query(None, pattern="^(confidence|pred_return|symbol)$", description="Sort field"),
    sort_order: Optional[str] = Query("desc", pattern="^(asc|desc)$", description="Sort order"),
    limit: Optional[int] = Query(None, ge=1, le=100, description="Limit results"),
    offset: Optional[int] = Query(0, ge=0, description="Offset for pagination"),
) -> Dict[str, List[Dict[str, Any]]]:
    ts = timestamp or datetime.utcnow()
    outputs: List[Dict[str, Any]] = []
    for raw_symbol in symbols.split(","):
        symbol = raw_symbol.strip()
        if not symbol:
            continue
        try:
            result = ensemble_predict(symbol, horizon, ts)
            serialized = _serialize_result(result)
            
            # Apply filters
            if min_confidence is not None and serialized.get("confidence", 0) < min_confidence:
                continue
            if max_confidence is not None and serialized.get("confidence", 1) > max_confidence:
                continue
            if direction is not None:
                pred_return = serialized.get("pred_return", 0)
                if direction == "buy" and pred_return <= 0:
                    continue
                if direction == "sell" and pred_return >= 0:
                    continue
            
            outputs.append(serialized)
        except EnsembleError as exc:
            outputs.append(
                {
                    "symbol": symbol,
                    "horizon": horizon,
                    "timestamp": ts.isoformat(),
                    "error": str(exc),
                }
            )
    
    # Filter out error entries for sorting
    valid_outputs = [o for o in outputs if "error" not in o]
    error_outputs = [o for o in outputs if "error" in o]
    
    # Apply sorting
    if sort_by and valid_outputs:
        reverse = (sort_order == "desc")
        if sort_by == "confidence":
            valid_outputs.sort(key=lambda x: x.get("confidence", 0), reverse=reverse)
        elif sort_by == "pred_return":
            valid_outputs.sort(key=lambda x: abs(x.get("pred_return", 0)), reverse=reverse)
        elif sort_by == "symbol":
            valid_outputs.sort(key=lambda x: x.get("symbol", ""), reverse=reverse)
    
    # Apply pagination
    total_count = len(valid_outputs)
    if offset > 0:
        valid_outputs = valid_outputs[offset:]
    if limit is not None:
        valid_outputs = valid_outputs[:limit]
    
    # Combine back with errors
    final_outputs = valid_outputs + error_outputs
    
    return {
        "forecasts": final_outputs,
        "total_count": total_count,
        "returned_count": len(valid_outputs),
    }


@router.get("/export")
def forecast_export(
    symbols: str = Query(..., description="Comma-separated symbol list"),
    horizon: str = Query(..., description="Horizon key, e.g., 1h"),
    timestamp: Optional[datetime] = None,
) -> StreamingResponse:
    ts = timestamp or datetime.utcnow()
    rows: List[Dict[str, Any]] = []
    for raw_symbol in symbols.split(","):
        symbol = raw_symbol.strip()
        if not symbol:
            continue
        try:
            result = ensemble_predict(symbol, horizon, ts)
            serialized = _serialize_result(result)
        except EnsembleError as exc:
            serialized = {
                "symbol": symbol,
                "horizon": horizon,
                "timestamp": ts.isoformat(),
                "pred_return": None,
                "confidence": None,
                "models": [],
                "error": str(exc),
            }
        rows.append(serialized)

    if not rows:
        raise HTTPException(status_code=400, detail="No symbols provided for export.")

    buffer = io.StringIO()
    fieldnames = ["symbol", "horizon", "timestamp", "pred_return", "confidence", "error"]
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow(
            {
                "symbol": row["symbol"],
                "horizon": row["horizon"],
                "timestamp": row["timestamp"],
                "pred_return": row.get("pred_return"),
                "confidence": row.get("confidence"),
                "error": row.get("error"),
            }
        )

    buffer.seek(0)
    filename = f"forecast_{horizon}_{ts.strftime('%Y%m%d%H%M%S')}.csv"
    headers = {"Content-Disposition": f"attachment; filename=\"{filename}\""}
    return StreamingResponse(buffer, media_type="text/csv", headers=headers)


@router.get("/accuracy")
def forecast_accuracy(
    lookback_days: int = Query(7, ge=1, le=90, description="Days to look back"),
) -> Dict[str, Any]:
    """
    Get forecast accuracy metrics by comparing predictions against actual outcomes.
    This endpoint aggregates data from the forecast_outcomes collection.
    """
    with mongo_client() as client:
        db = client[get_database_name()]
        outcomes_col = db["forecast_outcomes"]
        
        # Get all outcomes from lookback period
        since = datetime.utcnow() - timedelta(days=lookback_days)
        outcomes = list(outcomes_col.find({"evaluated_at": {"$gte": since}}))
        
        if not outcomes:
            return {
                "overall": {
                    "accuracy_pct": 0,
                    "direction_accuracy_pct": 0,
                    "mae": 0,
                    "rmse": 0,
                    "total_forecasts": 0,
                    "evaluated_forecasts": 0,
                },
                "by_symbol": {},
                "by_horizon": {},
                "recent_forecasts": [],
                "timestamp": datetime.utcnow().isoformat(),
            }
        
        # Calculate overall metrics
        total = len(outcomes)
        correct_direction = sum(1 for o in outcomes if o.get("was_correct", False))
        total_mae = sum(o.get("mae", 0) for o in outcomes)
        total_squared_error = sum(o.get("squared_error", 0) for o in outcomes)
        
        # Group by symbol
        by_symbol = {}
        for outcome in outcomes:
            symbol = outcome.get("symbol")
            if symbol not in by_symbol:
                by_symbol[symbol] = []
            by_symbol[symbol].append(outcome)
        
        # Group by horizon
        by_horizon = {}
        for outcome in outcomes:
            horizon = outcome.get("horizon")
            if horizon not in by_horizon:
                by_horizon[horizon] = []
            by_horizon[horizon].append(outcome)
        
        # Calculate metrics per symbol
        symbol_metrics = {}
        for symbol, symbol_outcomes in by_symbol.items():
            sym_total = len(symbol_outcomes)
            sym_correct = sum(1 for o in symbol_outcomes if o.get("was_correct", False))
            sym_mae = sum(o.get("mae", 0) for o in symbol_outcomes) / sym_total
            sym_squared = sum(o.get("squared_error", 0) for o in symbol_outcomes)
            symbol_metrics[symbol] = {
                "accuracy_pct": round((sym_correct / sym_total) * 100, 2) if sym_total > 0 else 0,
                "direction_accuracy_pct": round((sym_correct / sym_total) * 100, 2) if sym_total > 0 else 0,
                "mae": round(sym_mae, 4),
                "rmse": round((sym_squared / sym_total) ** 0.5, 4) if sym_total > 0 else 0,
                "forecast_count": sym_total,
            }
        
        # Calculate metrics per horizon
        horizon_metrics = {}
        for horizon, horizon_outcomes in by_horizon.items():
            hor_total = len(horizon_outcomes)
            hor_correct = sum(1 for o in horizon_outcomes if o.get("was_correct", False))
            hor_mae = sum(o.get("mae", 0) for o in horizon_outcomes) / hor_total
            hor_squared = sum(o.get("squared_error", 0) for o in horizon_outcomes)
            horizon_metrics[horizon] = {
                "accuracy_pct": round((hor_correct / hor_total) * 100, 2) if hor_total > 0 else 0,
                "direction_accuracy_pct": round((hor_correct / hor_total) * 100, 2) if hor_total > 0 else 0,
                "mae": round(hor_mae, 4),
                "rmse": round((hor_squared / hor_total) ** 0.5, 4) if hor_total > 0 else 0,
                "forecast_count": hor_total,
            }
        
        # Get recent forecasts (last 10)
        recent = sorted(outcomes, key=lambda x: x.get("evaluated_at", datetime.min), reverse=True)[:10]
        recent_forecasts = []
        for outcome in recent:
            recent_forecasts.append({
                "forecast_id": str(outcome.get("forecast_id", "")),
                "symbol": outcome.get("symbol"),
                "horizon": outcome.get("horizon"),
                "predicted_return": round(outcome.get("predicted_return", 0), 4),
                "actual_return": round(outcome.get("actual_return", 0), 4),
                "confidence": round(outcome.get("confidence", 0), 4),
                "was_correct": outcome.get("was_correct", False),
                "forecasted_at": outcome.get("forecasted_at").isoformat() if outcome.get("forecasted_at") else None,
                "evaluated_at": outcome.get("evaluated_at").isoformat() if outcome.get("evaluated_at") else None,
            })
        
        return {
            "overall": {
                "accuracy_pct": round((correct_direction / total) * 100, 2) if total > 0 else 0,
                "direction_accuracy_pct": round((correct_direction / total) * 100, 2) if total > 0 else 0,
                "mae": round(total_mae / total, 4) if total > 0 else 0,
                "rmse": round((total_squared_error / total) ** 0.5, 4) if total > 0 else 0,
                "total_forecasts": total,
                "evaluated_forecasts": total,
            },
            "by_symbol": symbol_metrics,
            "by_horizon": horizon_metrics,
            "recent_forecasts": recent_forecasts,
            "timestamp": datetime.utcnow().isoformat(),
        }


@router.get("/{forecast_id}/outcome")
def forecast_outcome(forecast_id: str) -> Dict[str, Any]:
    """
    Get the outcome of a specific forecast (predicted vs actual).
    """
    with mongo_client() as client:
        db = client[get_database_name()]
        outcomes_col = db["forecast_outcomes"]
        
        # Try to find by forecast_id
        try:
            outcome = outcomes_col.find_one({"forecast_id": ObjectId(forecast_id)})
        except Exception:
            outcome = None
        
        if not outcome:
            raise HTTPException(
                status_code=404,
                detail=f"Outcome for forecast '{forecast_id}' not found. The forecast may not have been evaluated yet.",
            )
        
        return {
            "forecast_id": str(outcome.get("forecast_id", "")),
            "symbol": outcome.get("symbol"),
            "horizon": outcome.get("horizon"),
            "predicted_return": round(outcome.get("predicted_return", 0), 4),
            "actual_return": round(outcome.get("actual_return", 0), 4),
            "difference": round(outcome.get("actual_return", 0) - outcome.get("predicted_return", 0), 4),
            "direction_correct": outcome.get("was_correct", False),
            "confidence": round(outcome.get("confidence", 0), 4),
            "forecasted_at": outcome.get("forecasted_at").isoformat() if outcome.get("forecasted_at") else None,
            "evaluated_at": outcome.get("evaluated_at").isoformat() if outcome.get("evaluated_at") else None,
            "price_at_forecast": outcome.get("price_at_forecast"),
            "price_at_horizon": outcome.get("price_at_horizon"),
        }


class ExplainRequest(BaseModel):
    symbol: str
    horizon: str
    forecast_id: Optional[str] = None


@router.post("/explain")
def forecast_explain(payload: ExplainRequest) -> Dict[str, Any]:
    """
    Generate an AI-powered explanation for a forecast.
    Uses model metadata and historical patterns to explain the prediction.
    """
    # Generate forecast if not provided
    ts = datetime.utcnow()
    try:
        result = ensemble_predict(payload.symbol, payload.horizon, ts)
    except EnsembleError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    
    # Extract key information
    pred_return = result.get("predicted_return", 0)
    confidence = result.get("confidence", 0)
    models = result.get("models", [])
    
    # Determine direction
    direction = "upward" if pred_return > 0 else "downward"
    
    # Count model agreement
    positive_models = sum(1 for m in models if m.get("pred_return", 0) > 0)
    negative_models = len(models) - positive_models
    
    # Generate explanation (simplified - in production, use LLM)
    summary = f"{payload.symbol} shows {direction} momentum with {confidence*100:.1f}% confidence. "
    if abs(pred_return) > 0.02:
        summary += f"Expected {abs(pred_return)*100:.1f}% {'gain' if pred_return > 0 else 'decline'} over {payload.horizon}."
    else:
        summary += f"Relatively stable movement expected over {payload.horizon}."
    
    # Key factors (simplified)
    key_factors = []
    if confidence > 0.8:
        key_factors.append("High confidence across multiple models")
    if abs(pred_return) > 0.03:
        key_factors.append("Strong directional signal detected")
    if len(models) >= 3:
        key_factors.append(f"Consensus from {len(models)} independent models")
    
    # Model agreement details
    agreement_text = f"{positive_models} models predict upward movement, {negative_models} predict downward. "
    if positive_models > negative_models * 2 or negative_models > positive_models * 2:
        agreement_text += "Strong consensus detected."
    else:
        agreement_text += "Mixed signals suggest caution."
    
    # Risks
    risks = []
    if confidence < 0.7:
        risks.append("Lower confidence suggests higher uncertainty")
    if abs(pred_return) > 0.05:
        risks.append("Large predicted movement carries execution risk")
    if len(models) < 2:
        risks.append("Limited model diversity in this prediction")
    
    return {
        "forecast_id": payload.forecast_id or "generated",
        "symbol": payload.symbol,
        "horizon": payload.horizon,
        "predicted_return": round(pred_return, 4),
        "confidence": round(confidence, 4),
        "explanation": {
            "summary": summary,
            "key_factors": key_factors if key_factors else ["Standard market analysis applied"],
            "models_agreement": {
                "agree": max(positive_models, negative_models),
                "disagree": min(positive_models, negative_models),
                "details": agreement_text,
            },
            "historical_context": "Based on similar market conditions and trained model patterns",
            "risks": risks if risks else ["Normal market volatility applies"],
        },
        "generated_at": datetime.utcnow().isoformat(),
    }

