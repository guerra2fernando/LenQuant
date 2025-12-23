"""Pydantic schemas for Chrome extension API."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Tuple

from pydantic import BaseModel, Field


# ============================================================================
# Request Schemas
# ============================================================================


class ContextPayload(BaseModel):
    """Context information from the Chrome extension."""
    
    exchange: str = Field(default="binance", description="Exchange name")
    market: str = Field(default="futures", description="Market type")
    symbol: str = Field(..., description="Trading pair (e.g., BTCUSDT)")
    contract: str = Field(default="PERP", description="Contract type")
    timeframe: str = Field(..., description="Chart timeframe (1m, 5m, etc.)")
    timestamp: int = Field(..., description="Unix timestamp in milliseconds")


class ExplainRequest(BaseModel):
    """Request for AI-powered trade explanation."""
    
    context: ContextPayload
    fast_analysis: Dict[str, Any] = Field(
        default_factory=dict,
        description="Results from fast path analysis"
    )
    screenshot_base64: Optional[str] = Field(
        default=None,
        description="Optional base64-encoded chart screenshot"
    )
    recent_behavior: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Recent trading behavior context"
    )


class JournalEvent(BaseModel):
    """Single event for journaling."""
    
    type: str = Field(..., description="Event type")
    symbol: str = Field(..., description="Trading pair")
    timeframe: str = Field(..., description="Chart timeframe")
    timestamp: int = Field(..., description="Unix timestamp in milliseconds")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Event-specific data")


class JournalBatchRequest(BaseModel):
    """Batch of events for journaling."""
    
    session_id: str = Field(..., description="Browser session identifier")
    events: List[JournalEvent] = Field(..., min_items=1, description="Events to log")


class SyncRequest(BaseModel):
    """Request for Binance trade synchronization."""
    
    mode: Literal["live", "testnet"] = Field(default="testnet")
    since: Optional[int] = Field(
        default=None,
        description="Unix timestamp (ms) to sync from"
    )


class ReportRequest(BaseModel):
    """Request for generating reports."""
    
    date: Optional[str] = Field(
        default=None,
        description="Date in YYYY-MM-DD format"
    )
    report_type: Literal["daily", "weekly", "monthly"] = Field(default="daily")


# ============================================================================
# Response Schemas
# ============================================================================


class RegimeFeatures(BaseModel):
    """Technical features from regime analysis."""
    
    atr: float = Field(description="Average True Range")
    atr_pct: float = Field(description="ATR as percentage of price")
    adx: float = Field(description="Average Directional Index")
    bb_width: Optional[float] = Field(default=None, description="Bollinger Band width")
    ema_alignment: Optional[str] = Field(default=None, description="EMA alignment (bullish/bearish)")
    rsi_14: Optional[float] = Field(default=None, description="RSI 14 period")


class FastAnalysisResponse(BaseModel):
    """Response from fast path analysis."""
    
    trade_allowed: bool = Field(description="Whether trading is advisable")
    market_state: str = Field(description="Market state (trend, range, chop, etc.)")
    trend_direction: Optional[str] = Field(default=None, description="Trend direction (up, down)")
    volatility_regime: str = Field(description="Volatility classification")
    setup_candidates: List[str] = Field(default_factory=list, description="Detected setup patterns")
    risk_flags: List[str] = Field(default_factory=list, description="Active risk warnings")
    confidence_pattern: float = Field(description="Pattern confidence 0-100")
    suggested_leverage_band: List[int] = Field(description="[min, max] leverage recommendation")
    reason: str = Field(description="Human-readable analysis summary")
    regime_features: Optional[RegimeFeatures] = Field(default=None)
    cached: bool = Field(default=False, description="Whether result was from cache")
    latency_ms: int = Field(description="Analysis latency in milliseconds")
    # Phase 2: Regime-aware sizing
    regime_multiplier: float = Field(default=1.0, description="Position size multiplier from regime analysis")
    regime_description: Optional[str] = Field(default=None, description="Current regime description")
    position_sizing_note: Optional[str] = Field(default=None, description="Position sizing recommendation")


class TradePlan(BaseModel):
    """AI-generated trade plan."""
    
    bias: Literal["bullish", "bearish", "neutral"] = Field(description="Directional bias")
    setup_name: str = Field(description="Identified setup pattern")
    trigger: str = Field(description="Entry trigger condition")
    invalidation: str = Field(description="Invalidation level")
    targets: List[str] = Field(description="Price targets")
    confidence_pattern: float = Field(description="Confidence 0-100")
    risk_grade: Literal["low", "medium", "high"] = Field(description="Risk assessment")
    do_not_trade: bool = Field(default=False, description="AI recommends not trading")


class ExplainResponse(BaseModel):
    """Response from AI trade explanation."""
    
    trade_plan: TradePlan
    reasoning: str = Field(description="Detailed reasoning from AI")
    evidence_refs: List[str] = Field(default_factory=list, description="Referenced evidence IDs")
    provider: str = Field(description="LLM provider used")
    model_id: Optional[str] = Field(default=None, description="Model identifier")
    latency_ms: int = Field(description="AI response latency in milliseconds")


class JournalResponse(BaseModel):
    """Response from journaling events."""
    
    stored: int = Field(description="Number of events stored")
    session_id: str = Field(description="Session identifier")


class TradePerformance(BaseModel):
    """Trade performance metrics."""
    
    total_pnl: float = Field(description="Total PnL in USD")
    win_rate: float = Field(description="Win rate 0-1")
    plan_adherence: float = Field(description="Plan adherence score 0-1")


class SyncResponse(BaseModel):
    """Response from Binance sync."""
    
    trades_imported: int = Field(description="Number of trades imported")
    trades_matched: int = Field(description="Trades matched to analyses")
    trades_unmatched: int = Field(description="Unmatched trades")
    last_sync: str = Field(description="ISO timestamp of sync")
    performance: TradePerformance


class BehaviorMetrics(BaseModel):
    """Behavioral trading metrics."""
    
    revenge_trades: int = Field(default=0)
    overtrading_count: int = Field(default=0)
    chop_entries: int = Field(default=0)
    overtrading_score: float = Field(default=0.0, description="0-1 overtrading severity")


class SetupStats(BaseModel):
    """Stats for a trading setup."""
    
    trades: int = Field(description="Number of trades")
    win_rate: float = Field(description="Win rate 0-1")
    total_pnl: Optional[float] = Field(default=None)


class TradeHighlight(BaseModel):
    """Highlighted trade (best or worst)."""
    
    trade_id: str
    setup: Optional[str] = None
    type: Optional[str] = None
    profit: Optional[float] = None
    loss: Optional[float] = None
    r_multiple: Optional[float] = None


class ReportSummary(BaseModel):
    """Summary section of report."""
    
    total_trades: int = Field(default=0)
    winners: int = Field(default=0)
    losers: int = Field(default=0)
    total_pnl: float = Field(default=0.0)
    fees_paid: float = Field(default=0.0)
    funding_paid: float = Field(default=0.0)


class ReportResponse(BaseModel):
    """Response from report generation."""
    
    date: str = Field(description="Report date")
    summary: ReportSummary
    by_setup: Dict[str, SetupStats] = Field(default_factory=dict)
    by_timeframe: Dict[str, SetupStats] = Field(default_factory=dict)
    behavior: BehaviorMetrics = Field(default_factory=BehaviorMetrics)
    biggest_mistake: Optional[TradeHighlight] = None
    best_trade: Optional[TradeHighlight] = None


# ============================================================================
# WebSocket Message Schemas
# ============================================================================


class WSSubscribeMessage(BaseModel):
    """WebSocket subscription message."""
    
    action: Literal["subscribe", "unsubscribe"] = Field(default="subscribe")
    symbol: str = Field(..., description="Trading pair")
    timeframes: List[str] = Field(default_factory=lambda: ["1m", "5m"])


class WSCandleMessage(BaseModel):
    """WebSocket candle update message."""
    
    type: Literal["candle"] = Field(default="candle")
    symbol: str
    timeframe: str
    candle: Dict[str, Any]


class WSSignalMessage(BaseModel):
    """WebSocket signal message."""
    
    type: Literal["signal"] = Field(default="signal")
    symbol: str
    signal: Dict[str, Any]

