"""
API routes for Chrome extension integration.

Provides endpoints for:
- Fast path market analysis (/context)
- AI-powered explanations (/explain)
- Event journaling (/journal)
- Binance trade sync (/sync)
- Daily reports (/report)
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from db.client import get_database_name, get_ohlcv_df, mongo_client

# Import extension modules
from extension.analyzer import ExtensionAnalyzer, FastAnalysisResult
from extension.behavior import BehaviorAnalyzer, BehaviorAlert
from extension.journal import JournalRepository
from extension.schemas import (
    ContextPayload,
    ExplainRequest,
    ExplainResponse,
    FastAnalysisResponse,
    JournalBatchRequest,
    JournalResponse,
    RegimeFeatures,
    ReportRequest,
    ReportResponse,
    SyncRequest,
    SyncResponse,
    TradePlan,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Singleton analyzer instance
_analyzer: Optional[ExtensionAnalyzer] = None


def get_analyzer() -> ExtensionAnalyzer:
    """Get or create analyzer instance."""
    global _analyzer
    if _analyzer is None:
        _analyzer = ExtensionAnalyzer()
    return _analyzer


# ============================================================================
# Fast Path Analysis
# ============================================================================


@router.get("/context", response_model=FastAnalysisResponse)
def get_context_analysis(
    symbol: str = Query(..., description="Trading pair (e.g., BTCUSDT)"),
    timeframe: str = Query(..., description="Chart interval (1m, 5m)"),
    include_setup: bool = Query(True, description="Include setup detection"),
) -> Dict[str, Any]:
    """
    Fast path analysis endpoint (target: ≤500ms).
    
    Provides:
    - Market state classification (trend, range, chop)
    - Trade allowed/not recommendation
    - Setup pattern detection
    - Risk flags
    - Leverage band recommendation
    
    Uses cached OHLCV data and deterministic calculations.
    No LLM calls in this path.
    """
    logger.info("Extension context request: %s %s", symbol, timeframe)
    
    analyzer = get_analyzer()
    result = analyzer.analyze(symbol, timeframe)
    
    response = result.to_dict()
    response["cached"] = False  # Will be True if served from cache
    
    # Convert regime features to proper format
    if response.get("regime_features"):
        features = response["regime_features"]
        response["regime_features"] = {
            "atr": features.get("atr", 0),
            "atr_pct": features.get("atr_pct", 0),
            "adx": features.get("adx", 0),
            "bb_width": features.get("bb_width"),
            "ema_alignment": features.get("ema_alignment"),
            "rsi_14": features.get("rsi_14"),
        }
    
    # Log regime multiplier for debugging
    logger.debug(
        "Extension context for %s: regime_mult=%.2f, leverage=%s",
        symbol,
        response.get("regime_multiplier", 1.0),
        response.get("suggested_leverage_band", []),
    )
    
    return response


# ============================================================================
# Phase 2: Leverage Recommendation
# ============================================================================


class LeverageRecommendation(BaseModel):
    """Leverage recommendation response."""
    symbol: str
    base_leverage_band: List[int]
    regime_adjusted_band: List[int]
    regime_multiplier: float
    regime_description: Optional[str]
    position_sizing_note: Optional[str]
    risk_flags: List[str]
    recommendation: str


@router.get("/leverage", response_model=LeverageRecommendation)
def get_leverage_recommendation(
    symbol: str = Query(..., description="Trading pair (e.g., BTCUSDT)"),
    base_position_pct: float = Query(10.0, ge=1.0, le=100.0, description="Base position as % of capital"),
) -> Dict[str, Any]:
    """
    Get regime-aware leverage recommendation.
    
    Uses RiskManager to calculate position sizing multiplier based on:
    - Current market regime (trend, volatility)
    - Risk settings configuration
    
    Returns recommended leverage band adjusted for current conditions.
    """
    from exec.risk_manager import RiskManager
    
    logger.info("Leverage recommendation request: %s", symbol)
    
    try:
        analyzer = get_analyzer()
        risk_manager = RiskManager()
        
        # Normalize symbol
        normalized = symbol
        if "/" not in symbol:
            for quote in ["USDT", "USD", "BUSD"]:
                if symbol.endswith(quote):
                    base = symbol[:-len(quote)]
                    normalized = f"{base}/{quote}"
                    break
        
        # Get regime multiplier
        multiplier, regime_desc = risk_manager.get_regime_multiplier(normalized)
        
        # Get base analysis for context
        result = analyzer.analyze(symbol, "1m", use_cache=True)
        
        # Calculate base leverage band (before regime adjustment)
        base_band = [
            max(1, result.leverage_band[0] * int(1 / max(0.1, multiplier))),
            max(1, result.leverage_band[1] * int(1 / max(0.1, multiplier))),
        ]
        
        # Build recommendation text
        if multiplier >= 1.2:
            recommendation = f"Favorable regime ({regime_desc}). Can use full leverage up to {result.leverage_band[1]}x."
        elif multiplier >= 0.9:
            recommendation = f"Neutral regime ({regime_desc}). Standard leverage {result.leverage_band[0]}x-{result.leverage_band[1]}x recommended."
        elif multiplier >= 0.6:
            recommendation = f"Reduced regime ({regime_desc}). Consider lower leverage {result.leverage_band[0]}x-{result.leverage_band[1]}x."
        else:
            recommendation = f"High-risk regime ({regime_desc}). Minimize leverage to {result.leverage_band[0]}x or wait."
        
        return {
            "symbol": symbol,
            "base_leverage_band": list(base_band),
            "regime_adjusted_band": list(result.leverage_band),
            "regime_multiplier": multiplier,
            "regime_description": regime_desc,
            "position_sizing_note": result.position_sizing_note,
            "risk_flags": result.risk_flags,
            "recommendation": recommendation,
        }
        
    except Exception as exc:
        logger.error("Leverage recommendation error: %s", exc)
        return {
            "symbol": symbol,
            "base_leverage_band": [1, 10],
            "regime_adjusted_band": [1, 10],
            "regime_multiplier": 1.0,
            "regime_description": "error",
            "position_sizing_note": f"Error calculating leverage: {str(exc)[:100]}",
            "risk_flags": ["analysis_error"],
            "recommendation": "Unable to calculate. Use conservative leverage.",
        }


# ============================================================================
# AI Explainer (Slow Path)
# ============================================================================


class ExplainRequestBody(BaseModel):
    """Request body for AI explanation."""
    context: ContextPayload
    fast_analysis: Dict[str, Any] = Field(default_factory=dict)
    screenshot_base64: Optional[str] = None
    recent_behavior: Optional[Dict[str, Any]] = None


@router.post("/explain", response_model=ExplainResponse)
def explain_trade(payload: ExplainRequestBody) -> Dict[str, Any]:
    """
    AI-powered trade explanation endpoint (slow path).
    
    Triggered when:
    - User clicks "Explain" button
    - Setup grade ≥ B
    - Order intent detected
    
    Uses LLMWorker for AI synthesis (reuses assistant module).
    """
    import time
    start = time.time()
    
    logger.info(
        "Extension explain request: %s %s",
        payload.context.symbol,
        payload.context.timeframe
    )
    
    try:
        # Import LLM components (reuse existing)
        from assistant.llm_worker import LLMWorker, LLMWorkerError
        
        worker = LLMWorker()
        
        if not worker.is_enabled():
            # Return fallback when LLM is disabled
            return _fallback_explain_response(payload, start)
        
        # Build prompt
        system_prompt = _build_explain_system_prompt()
        user_prompt = _build_explain_user_prompt(payload)
        
        # Call LLM
        result = worker.generate_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt
        )
        
        latency_ms = int((time.time() - start) * 1000)
        
        # Parse response
        json_payload = result.json_payload or {}
        
        trade_plan = {
            "bias": json_payload.get("bias", "neutral"),
            "setup_name": json_payload.get("setup_name", "unknown"),
            "trigger": json_payload.get("trigger", "No specific trigger identified"),
            "invalidation": json_payload.get("invalidation", "N/A"),
            "targets": json_payload.get("targets", []),
            "confidence_pattern": json_payload.get("confidence", 50),
            "risk_grade": json_payload.get("risk_grade", "medium"),
            "do_not_trade": json_payload.get("do_not_trade", False),
        }
        
        return {
            "trade_plan": trade_plan,
            "reasoning": json_payload.get("reasoning", result.raw_content or ""),
            "evidence_refs": json_payload.get("evidence_refs", []),
            "provider": result.provider,
            "model_id": result.model,
            "latency_ms": latency_ms,
        }
        
    except Exception as exc:
        logger.error("Explain error: %s", exc)
        return _fallback_explain_response(payload, start)


def _build_explain_system_prompt() -> str:
    """Build system prompt for trade explanation."""
    return """You are a trading coach analyzing market conditions for a Binance Futures trader.

Provide a JSON response with these keys:
- bias: "bullish", "bearish", or "neutral"
- setup_name: Name of the trading setup (e.g., "pullback_continuation", "range_breakout")
- trigger: Specific condition for entry (e.g., "Break above 42500 with volume")
- invalidation: Level that invalidates the setup (e.g., "Below 42000")
- targets: Array of price targets (e.g., ["42800", "43200"])
- confidence: Confidence score 0-100
- risk_grade: "low", "medium", or "high"
- do_not_trade: true if conditions are unfavorable
- reasoning: 2-3 sentence explanation

Be concise and actionable. Focus on clear entry, stop, and target levels."""


def _build_explain_user_prompt(payload: ExplainRequestBody) -> str:
    """Build user prompt from context and analysis."""
    context = payload.context
    analysis = payload.fast_analysis
    
    parts = [
        f"Symbol: {context.symbol}",
        f"Timeframe: {context.timeframe}",
        f"Market State: {analysis.get('market_state', 'unknown')}",
        f"Trend Direction: {analysis.get('trend_direction', 'unknown')}",
        f"Volatility: {analysis.get('volatility_regime', 'unknown')}",
        f"Setup Candidates: {', '.join(analysis.get('setup_candidates', []))}",
        f"Risk Flags: {', '.join(analysis.get('risk_flags', []))}",
        f"Trade Allowed: {analysis.get('trade_allowed', False)}",
    ]
    
    # Add regime features if available
    features = analysis.get("regime_features", {})
    if features:
        parts.append(f"ATR%: {features.get('atr_pct', 'N/A')}")
        parts.append(f"ADX: {features.get('adx', 'N/A')}")
        parts.append(f"RSI: {features.get('rsi_14', 'N/A')}")
    
    # Add behavior context if available
    if payload.recent_behavior:
        trades_hour = payload.recent_behavior.get("trades_last_hour", 0)
        parts.append(f"Trades last hour: {trades_hour}")
    
    return "\n".join(parts) + "\n\nProvide a trade plan or explain why not to trade."


def _fallback_explain_response(payload: ExplainRequestBody, start: float) -> Dict[str, Any]:
    """Generate fallback response when LLM is unavailable."""
    import time
    
    analysis = payload.fast_analysis
    setup_candidates = analysis.get("setup_candidates", [])
    market_state = analysis.get("market_state", "unknown")
    trade_allowed = analysis.get("trade_allowed", False)
    
    if not trade_allowed:
        bias = "neutral"
        reasoning = f"Market conditions ({market_state}) are not favorable for trading. Consider waiting."
    elif analysis.get("trend_direction") == "up":
        bias = "bullish"
        reasoning = f"Trend is up with {market_state} conditions. Look for pullback entries."
    elif analysis.get("trend_direction") == "down":
        bias = "bearish"
        reasoning = f"Trend is down with {market_state} conditions. Look for pullback entries."
    else:
        bias = "neutral"
        reasoning = f"Market is in {market_state} mode. Wait for clearer direction."
    
    return {
        "trade_plan": {
            "bias": bias,
            "setup_name": setup_candidates[0] if setup_candidates else "waiting",
            "trigger": "LLM unavailable - use technical analysis",
            "invalidation": "N/A",
            "targets": [],
            "confidence_pattern": 50,
            "risk_grade": "medium",
            "do_not_trade": not trade_allowed,
        },
        "reasoning": reasoning,
        "evidence_refs": [],
        "provider": "fallback",
        "model_id": None,
        "latency_ms": int((time.time() - start) * 1000),
    }


# ============================================================================
# Event Journaling
# ============================================================================


@router.post("/journal", response_model=JournalResponse)
def log_journal_events(payload: JournalBatchRequest) -> Dict[str, Any]:
    """
    Log events for journaling.
    
    Accepts batched events from the Chrome extension.
    Events are append-only and immutable.
    """
    logger.info(
        "Journal batch: session=%s events=%d",
        payload.session_id,
        len(payload.events)
    )
    
    journal = JournalRepository(session_id=payload.session_id)
    
    # Convert events to storage format
    events = [
        {
            "type": e.type,
            "symbol": e.symbol,
            "timeframe": e.timeframe,
            "timestamp": e.timestamp,
            "payload": e.payload,
        }
        for e in payload.events
    ]
    
    stored = journal.log_events_batch(events)
    
    return {
        "stored": stored,
        "session_id": payload.session_id,
    }


@router.get("/journal/events")
def get_journal_events(
    session_id: str = Query(..., description="Session ID"),
    limit: int = Query(100, ge=1, le=500),
    event_types: Optional[str] = Query(None, description="Comma-separated event types"),
) -> Dict[str, Any]:
    """Get events for a session."""
    journal = JournalRepository(session_id=session_id)
    
    types_filter = None
    if event_types:
        types_filter = [t.strip() for t in event_types.split(",")]
    
    events = journal.get_session_events(limit=limit, event_types=types_filter)
    
    return {
        "session_id": session_id,
        "events": events,
        "count": len(events),
    }


@router.get("/journal/trades")
def get_journal_trades(
    session_id: Optional[str] = Query(None, description="Session ID"),
    user_id: Optional[str] = Query(None, description="User ID"),
    symbol: Optional[str] = Query(None, description="Symbol filter"),
    limit: int = Query(50, ge=1, le=500),
) -> Dict[str, Any]:
    """Get trades for a session or user."""
    journal = JournalRepository(session_id=session_id, user_id=user_id)
    trades = journal.get_session_trades(limit=limit)
    
    if symbol:
        trades = [t for t in trades if symbol.upper() in t.get("symbol", "").upper()]
    
    return {
        "trades": trades,
        "count": len(trades),
    }


@router.get("/analyses")
def get_analyses(
    session_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    symbol: Optional[str] = Query(None),
    timeframe: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> Dict[str, Any]:
    """
    Get analysis history.
    
    Returns past fast-path and slow-path analyses for review.
    """
    with mongo_client() as client:
        db = client[get_database_name()]
        
        query: Dict[str, Any] = {}
        if session_id:
            query["session_id"] = session_id
        if user_id:
            query["user_id"] = user_id
        if symbol:
            query["symbol"] = {"$regex": symbol, "$options": "i"}
        if timeframe:
            query["timeframe"] = timeframe
        
        cursor = db["extension_analyses"].find(query).sort("timestamp", -1).limit(limit)
        analyses = list(cursor)
    
    # Serialize
    for a in analyses:
        a["_id"] = str(a["_id"])
        if isinstance(a.get("timestamp"), datetime):
            a["timestamp"] = a["timestamp"].isoformat()
        if isinstance(a.get("created_at"), datetime):
            a["created_at"] = a["created_at"].isoformat()
    
    return {
        "analyses": analyses,
        "count": len(analyses),
    }


@router.get("/analyses/{analysis_id}")
def get_analysis_by_id(analysis_id: str) -> Dict[str, Any]:
    """Get a specific analysis by ID."""
    journal = JournalRepository()
    analysis = journal.get_analysis_by_id(analysis_id)
    
    if not analysis:
        raise HTTPException(404, "Analysis not found")
    
    return analysis


# ============================================================================
# Behavior Analysis (Phase 6)
# ============================================================================


# In-memory cooldown tracking
_cooldown_state: Dict[str, Dict[str, Any]] = {}


@router.get("/behavior/analyze")
def analyze_behavior(
    session_id: str = Query(..., description="Session ID"),
    user_id: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    Analyze session for behavioral patterns.
    
    Detects:
    - Revenge trading (trading within 5 min after loss)
    - Overtrading (>10 trades/hour)
    - Chop market entries
    - Loss streaks (3+ consecutive losses)
    - Rapid position flipping
    """
    analyzer = BehaviorAnalyzer(session_id=session_id, user_id=user_id)
    alerts = analyzer.analyze_session()
    
    # Log alerts to database
    for alert in alerts:
        analyzer.log_behavior(alert, warning_shown=True)
    
    # Check if in cooldown
    cooldown_info = _get_cooldown_status(session_id)
    
    return {
        "session_id": session_id,
        "alerts": [a.to_dict() for a in alerts],
        "alert_count": len(alerts),
        "has_critical": any(a.severity == "critical" for a in alerts),
        "in_cooldown": cooldown_info.get("active", False),
        "cooldown_remaining_min": cooldown_info.get("remaining_min", 0),
    }


@router.post("/behavior/cooldown")
def start_cooldown(
    session_id: str = Query(...),
    minutes: int = Query(15, ge=5, le=60, description="Cooldown duration in minutes"),
    reason: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    Start a trading cooldown period.
    
    Used when behavioral alerts suggest taking a break.
    """
    cooldown_end = datetime.utcnow() + timedelta(minutes=minutes)
    
    _cooldown_state[session_id] = {
        "active": True,
        "started_at": datetime.utcnow().isoformat(),
        "ends_at": cooldown_end.isoformat(),
        "duration_min": minutes,
        "reason": reason,
    }
    
    logger.info("Cooldown started for session %s: %d minutes", session_id, minutes)
    
    return {
        "session_id": session_id,
        "cooldown_started": True,
        "ends_at": cooldown_end.isoformat(),
        "duration_min": minutes,
    }


@router.delete("/behavior/cooldown")
def end_cooldown(
    session_id: str = Query(...),
) -> Dict[str, Any]:
    """
    End a cooldown period early.
    """
    if session_id in _cooldown_state:
        del _cooldown_state[session_id]
    
    return {
        "session_id": session_id,
        "cooldown_ended": True,
    }


@router.get("/behavior/cooldown")
def get_cooldown_status(
    session_id: str = Query(...),
) -> Dict[str, Any]:
    """
    Check current cooldown status.
    """
    return _get_cooldown_status(session_id)


def _get_cooldown_status(session_id: str) -> Dict[str, Any]:
    """Internal helper to get cooldown status."""
    if session_id not in _cooldown_state:
        return {"active": False, "remaining_min": 0}
    
    state = _cooldown_state[session_id]
    ends_at = datetime.fromisoformat(state["ends_at"])
    
    if datetime.utcnow() >= ends_at:
        # Cooldown expired
        del _cooldown_state[session_id]
        return {"active": False, "remaining_min": 0}
    
    remaining = (ends_at - datetime.utcnow()).total_seconds() / 60
    
    return {
        "active": True,
        "remaining_min": round(remaining, 1),
        "ends_at": state["ends_at"],
        "reason": state.get("reason"),
    }


@router.get("/behavior/summary")
def get_behavior_summary(
    session_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    days: int = Query(7, ge=1, le=30),
) -> Dict[str, Any]:
    """
    Get behavior summary over a period.
    
    Shows patterns and trends in trading behavior.
    """
    from extension.reports import ReportGenerator
    
    generator = ReportGenerator(user_id=user_id, session_id=session_id)
    analytics = generator.get_performance_analytics(days=days)
    
    behavior = analytics.get("behavior", {})
    
    # Calculate improvement trend
    # Compare first half vs second half of period
    half_days = days // 2
    first_half = ReportGenerator(user_id=user_id).get_performance_analytics(days=half_days)
    
    first_violations = first_half.get("behavior", {}).get("total_violations", 0)
    total_violations = behavior.get("total_violations", 0)
    second_violations = total_violations - first_violations
    
    if first_violations > 0:
        improvement = (first_violations - second_violations) / first_violations
    else:
        improvement = 0
    
    return {
        "period_days": days,
        "behavior": behavior,
        "improvement_trend": round(improvement, 2),
        "recommendations": _generate_behavior_recommendations(behavior),
    }


def _generate_behavior_recommendations(behavior: Dict[str, Any]) -> List[str]:
    """Generate behavior improvement recommendations."""
    recommendations = []
    
    if behavior.get("revenge_trades", 0) > 0:
        recommendations.append(
            "You've had revenge trades. Consider waiting at least 15 minutes after a loss before trading again."
        )
    
    if behavior.get("overtrading_score", 0) > 0.5:
        recommendations.append(
            "Overtrading detected. Focus on quality setups over quantity. Set a daily trade limit."
        )
    
    if behavior.get("chop_entries", 0) > 2:
        recommendations.append(
            "Multiple entries in choppy markets. Wait for clearer trends before entering."
        )
    
    if behavior.get("loss_streaks", 0) > 0:
        recommendations.append(
            "Loss streaks indicate possible tilt. Take breaks after 3 consecutive losses."
        )
    
    if not recommendations:
        recommendations.append("Good discipline! Keep following your trading plan.")
    
    return recommendations


# ============================================================================
# Binance Sync (Phase 5)
# ============================================================================


@router.get("/sync")
def sync_binance_trades(
    mode: str = Query("testnet", pattern="^(live|testnet)$"),
    since: Optional[int] = Query(None, description="Unix timestamp (ms)"),
    symbol: Optional[str] = Query(None, description="Symbol filter"),
    session_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    Sync trades from Binance Futures.
    
    Fetches recent trades from Binance and matches them to extension analyses.
    Requires BINANCE_TESTNET_API_KEY and BINANCE_TESTNET_SECRET environment variables.
    """
    from extension.sync import create_sync_service, SyncError
    
    logger.info("Sync request: mode=%s since=%s symbol=%s", mode, since, symbol)
    
    try:
        sync_service = create_sync_service(mode)
        
        result = sync_service.sync_trades(
            since_ms=since,
            symbol=symbol,
            session_id=session_id,
            user_id=user_id,
        )
        
        return result
        
    except SyncError as exc:
        logger.error("Sync error: %s", exc)
        raise HTTPException(400, str(exc))
    except Exception as exc:
        logger.error("Sync error: %s", exc, exc_info=True)
        raise HTTPException(500, f"Sync failed: {str(exc)}")


@router.get("/positions")
def get_open_positions(
    mode: str = Query("testnet", pattern="^(live|testnet)$"),
) -> Dict[str, Any]:
    """
    Get current open positions from Binance.
    """
    from extension.sync import create_sync_service, SyncError
    
    try:
        sync_service = create_sync_service(mode)
        positions = sync_service.get_open_positions()
        
        return {
            "positions": positions,
            "count": len(positions),
            "mode": mode,
        }
        
    except SyncError as exc:
        logger.error("Positions error: %s", exc)
        raise HTTPException(400, str(exc))
    except Exception as exc:
        logger.error("Positions error: %s", exc)
        raise HTTPException(500, f"Failed to fetch positions: {str(exc)}")


@router.post("/trades/{trade_id}/close")
def close_trade(
    trade_id: str,
    exit_price: float = Query(..., gt=0),
    pnl: float = Query(...),
    fees: float = Query(0.0, ge=0),
    mode: str = Query("testnet", pattern="^(live|testnet)$"),
) -> Dict[str, Any]:
    """
    Mark a trade as closed with exit information.
    """
    from extension.sync import create_sync_service
    
    try:
        sync_service = create_sync_service(mode)
        success = sync_service.close_trade(
            trade_id=trade_id,
            exit_price=exit_price,
            pnl=pnl,
            fees=fees,
        )
        
        return {
            "success": success,
            "trade_id": trade_id,
        }
        
    except Exception as exc:
        logger.error("Close trade error: %s", exc)
        raise HTTPException(500, f"Failed to close trade: {str(exc)}")


# ============================================================================
# Reports (Phase 7)
# ============================================================================


@router.get("/report")
def get_daily_report(
    date: Optional[str] = Query(None, description="Date YYYY-MM-DD"),
    session_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    Generate daily trading report.
    
    Includes:
    - Trade summary (wins, losses, PnL)
    - Setup performance by pattern
    - Behavior analysis (revenge trades, overtrading)
    - Best/worst trade highlights
    - Win/loss streaks
    """
    from extension.reports import ReportGenerator
    
    report_date = None
    if date:
        try:
            report_date = datetime.fromisoformat(date)
        except ValueError:
            raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")
    
    generator = ReportGenerator(user_id=user_id, session_id=session_id)
    report = generator.generate_daily_report(date=report_date, save_to_db=True)
    
    return report


@router.get("/report/weekly")
def get_weekly_report(
    week_start: Optional[str] = Query(None, description="Week start date YYYY-MM-DD"),
    user_id: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    Generate weekly trading report with daily breakdown.
    """
    from extension.reports import ReportGenerator
    
    start_date = None
    if week_start:
        try:
            start_date = datetime.fromisoformat(week_start)
        except ValueError:
            raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")
    
    generator = ReportGenerator(user_id=user_id)
    report = generator.generate_weekly_report(week_start=start_date)
    
    return report


@router.get("/report/monthly")
def get_monthly_report(
    year: Optional[int] = Query(None, ge=2020, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    user_id: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    Generate monthly trading report with weekly breakdown.
    """
    from extension.reports import ReportGenerator
    
    generator = ReportGenerator(user_id=user_id)
    report = generator.generate_monthly_report(year=year, month=month)
    
    return report


@router.get("/analytics")
def get_performance_analytics(
    days: int = Query(30, ge=1, le=365, description="Days to analyze"),
    user_id: Optional[str] = Query(None),
    session_id: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    Get comprehensive performance analytics.
    
    Includes:
    - Performance by setup, timeframe, symbol
    - Performance by day of week and hour
    - Equity curve data
    - Drawdown analysis
    - Advanced metrics (Sharpe, expectancy)
    """
    from extension.reports import ReportGenerator
    
    generator = ReportGenerator(user_id=user_id, session_id=session_id)
    analytics = generator.get_performance_analytics(days=days)
    
    return analytics


# ============================================================================
# WebSocket Streaming
# ============================================================================


class ExtensionConnectionManager:
    """Manage WebSocket connections for extension."""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.subscriptions: Dict[str, List[str]] = {}  # session_id -> [symbols]
    
    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        self.subscriptions[session_id] = []
        logger.info("Extension WS connected: %s", session_id)
    
    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
        if session_id in self.subscriptions:
            del self.subscriptions[session_id]
        logger.info("Extension WS disconnected: %s", session_id)
    
    def subscribe(self, session_id: str, symbol: str):
        if session_id in self.subscriptions:
            if symbol not in self.subscriptions[session_id]:
                self.subscriptions[session_id].append(symbol)
    
    def unsubscribe(self, session_id: str, symbol: str):
        if session_id in self.subscriptions:
            self.subscriptions[session_id] = [
                s for s in self.subscriptions[session_id] if s != symbol
            ]
    
    async def send_to_session(self, session_id: str, message: Dict[str, Any]):
        if session_id in self.active_connections:
            try:
                await self.active_connections[session_id].send_json(message)
            except Exception as exc:
                logger.warning("Failed to send to %s: %s", session_id, exc)
                self.disconnect(session_id)


extension_ws_manager = ExtensionConnectionManager()


async def websocket_extension_stream(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time extension streaming.
    
    Streams:
    - OHLCV candle updates
    - Market state change signals
    - Behavior alerts
    """
    await extension_ws_manager.connect(session_id, websocket)
    
    try:
        while True:
            # Receive subscription messages
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=1.0)
                
                action = data.get("action")
                symbol = data.get("symbol")
                
                if action == "subscribe" and symbol:
                    extension_ws_manager.subscribe(session_id, symbol)
                    await websocket.send_json({
                        "type": "subscribed",
                        "symbol": symbol,
                    })
                
                elif action == "unsubscribe" and symbol:
                    extension_ws_manager.unsubscribe(session_id, symbol)
                    await websocket.send_json({
                        "type": "unsubscribed",
                        "symbol": symbol,
                    })
                
            except asyncio.TimeoutError:
                pass  # No message received, continue
            
            # Check for behavior alerts periodically
            # (In production, this would be event-driven)
            
            await asyncio.sleep(0.5)
            
    except WebSocketDisconnect:
        extension_ws_manager.disconnect(session_id)
    except Exception as exc:
        logger.error("Extension WS error: %s", exc)
        extension_ws_manager.disconnect(session_id)

