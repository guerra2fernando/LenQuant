"""Risk management logic and trading settings for Phase 5."""
from __future__ import annotations

import logging
import math
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union, cast

from bson import ObjectId
from pydantic import BaseModel, Field, validator

from db import client as db_client

from .settlement import FILLS_COLLECTION, POSITIONS_COLLECTION, WALLETS_COLLECTION

LOGGER = logging.getLogger(__name__)

SETTINGS_COLLECTION = "settings"
SETTINGS_DOCUMENT_ID = "trading_settings"
MACRO_SETTINGS_DOCUMENT_ID = "macro_settings"
ORDERS_COLLECTION = "trading_orders"
BREACHES_COLLECTION = "trading_risk_breaches"
METRICS_COLLECTION = "trading_metrics"


def _utcnow() -> datetime:
    return datetime.utcnow().replace(tzinfo=timezone.utc)


class ModeCredentials(BaseModel):
    api_key_env: Optional[str] = Field(default=None)
    secret_env: Optional[str] = Field(default=None)
    password_env: Optional[str] = Field(default=None)
    subaccount_env: Optional[str] = Field(default=None)


class ModeSettings(BaseModel):
    enabled: bool = Field(default=True)
    exchange: str = Field(default="binance")
    description: Optional[str] = None
    testnet: bool = Field(default=False)
    max_notional_usd: float = Field(default=2_500.0, ge=0.0)
    max_position_usd: float = Field(default=5_000.0, ge=0.0)
    max_open_orders: int = Field(default=10, ge=0)
    allow_margin: bool = Field(default=False)
    default_leverage: Optional[float] = Field(default=None, ge=0.0)
    credentials: ModeCredentials = Field(default_factory=ModeCredentials)


class PaperSettings(BaseModel):
    starting_balance: float = Field(default=100_000.0, ge=0.0)
    slippage_bps: float = Field(default=5.0, ge=0.0)
    fill_on_create: bool = Field(default=True)
    latency_ms: int = Field(default=250, ge=0)


class AlertSettings(BaseModel):
    channels: List[str] = Field(default_factory=lambda: ["log"])
    slack_webhook_env: Optional[str] = None
    telegram_bot_token_env: Optional[str] = None
    telegram_chat_id_env: Optional[str] = None
    email_smtp_env: Optional[str] = None
    email_username_env: Optional[str] = None
    email_password_env: Optional[str] = None
    email_from: Optional[str] = None
    email_recipients: List[str] = Field(default_factory=list)


class AutoModeSettings(BaseModel):
    enabled: bool = Field(default=False)
    confidence_threshold: float = Field(default=0.65, ge=0.0, le=1.0)
    max_trade_usd: float = Field(default=500.0, ge=0.0)
    max_trades_per_day: int = Field(default=10, ge=0)
    allow_live: bool = Field(default=False)
    default_mode: str = Field(default="paper")


class RegimeMultipliers(BaseModel):
    """Position size multipliers for different market regimes."""
    TRENDING_UP: float = Field(default=1.3, ge=0.3, le=2.0)
    TRENDING_DOWN: float = Field(default=0.6, ge=0.3, le=2.0)
    SIDEWAYS: float = Field(default=0.8, ge=0.3, le=2.0)
    HIGH_VOLATILITY: float = Field(default=0.5, ge=0.3, le=2.0)
    LOW_VOLATILITY: float = Field(default=1.2, ge=0.3, le=2.0)
    NORMAL_VOLATILITY: float = Field(default=1.0, ge=0.3, le=2.0)
    UNDEFINED: float = Field(default=1.0, ge=0.3, le=2.0)


class MacroSettings(BaseModel):
    """Macro analysis risk management settings."""
    regime_risk_enabled: bool = Field(default=False)
    regime_multipliers: RegimeMultipliers = Field(default_factory=RegimeMultipliers)
    regime_cache_ttl_seconds: int = Field(default=3600, ge=60)
    alert_on_significant_reduction: bool = Field(default=True)
    significant_reduction_threshold: float = Field(default=0.3, ge=0.0, le=1.0)
    updated_at: Optional[datetime] = Field(default=None)

    class Config:
        arbitrary_types_allowed = True


class RiskSettings(BaseModel):
    max_trade_usd: float = Field(default=2_500.0, ge=0.0)
    max_daily_loss_usd: float = Field(default=3_000.0, ge=0.0)
    max_open_exposure_usd: float = Field(default=10_000.0, ge=0.0)
    max_position_usd_per_symbol: float = Field(default=5_000.0, ge=0.0)
    max_orders_per_symbol: int = Field(default=5, ge=0)
    max_slippage_pct: float = Field(default=0.02, ge=0.0)
    sensitive_threshold_usd: float = Field(default=5_000.0, ge=0.0)
    allowed_symbols: Optional[List[str]] = Field(default=None)
    kill_switch_slippage_pct: float = Field(default=0.05, ge=0.0)
    kill_switch_error_burst: int = Field(default=5, ge=0)

    @validator("allowed_symbols")
    def _normalise_symbols(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return None
        return sorted({symbol.upper() for symbol in value if symbol})


class KillSwitchState(BaseModel):
    armed: bool = Field(default=False)
    reason: Optional[str] = Field(default=None)
    actor: Optional[str] = Field(default=None)
    armed_at: Optional[datetime] = Field(default=None)


class TradingSettings(BaseModel):
    modes: Dict[str, ModeSettings] = Field(
        default_factory=lambda: {
            "paper": ModeSettings(enabled=True, exchange="paper", testnet=False),
            "testnet": ModeSettings(enabled=True, exchange="binance", testnet=True),
            "live": ModeSettings(enabled=False, exchange="binance", testnet=False),
        }
    )
    paper: PaperSettings = Field(default_factory=PaperSettings)
    alerts: AlertSettings = Field(default_factory=AlertSettings)
    auto_mode: AutoModeSettings = Field(default_factory=AutoModeSettings)
    risk: RiskSettings = Field(default_factory=RiskSettings)
    kill_switch: KillSwitchState = Field(default_factory=KillSwitchState)
    updated_at: Optional[datetime] = Field(default=None)

    class Config:
        arbitrary_types_allowed = True

    def dict(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:  # type: ignore[override]
        kwargs.setdefault("by_alias", True)
        kwargs.setdefault("exclude_none", True)
        data = super().dict(*args, **kwargs)
        return data


def _serialise_datetime(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def get_trading_settings() -> TradingSettings:
    with db_client.mongo_client() as client:
        db = client[db_client.get_database_name()]
        doc = db[SETTINGS_COLLECTION].find_one({"_id": SETTINGS_DOCUMENT_ID})
    if not doc:
        return TradingSettings()
    payload = {key: value for key, value in doc.items() if key != "_id"}
    baseline = TradingSettings().dict()
    merged = {**baseline, **payload}
    return TradingSettings.parse_obj(merged)


def save_trading_settings(payload: Union[TradingSettings, Dict[str, Any]]) -> TradingSettings:
    document = payload.dict() if isinstance(payload, TradingSettings) else payload
    document["updated_at"] = _utcnow()
    with db_client.mongo_client() as client:
        db = client[db_client.get_database_name()]
        db[SETTINGS_COLLECTION].update_one(
            {"_id": SETTINGS_DOCUMENT_ID},
            {"$set": document},
            upsert=True,
        )
    return TradingSettings.parse_obj(document)


def get_macro_settings() -> MacroSettings:
    """Get macro analysis risk management settings."""
    with db_client.mongo_client() as client:
        db = client[db_client.get_database_name()]
        doc = db[SETTINGS_COLLECTION].find_one({"_id": MACRO_SETTINGS_DOCUMENT_ID})
    if not doc:
        return MacroSettings()
    payload = {key: value for key, value in doc.items() if key != "_id"}
    baseline = MacroSettings().dict()
    merged = {**baseline, **payload}
    return MacroSettings.parse_obj(merged)


def save_macro_settings(payload: Union[MacroSettings, Dict[str, Any]]) -> MacroSettings:
    """Save macro analysis risk management settings."""
    document = payload.dict() if isinstance(payload, MacroSettings) else payload
    document["updated_at"] = _utcnow()
    with db_client.mongo_client() as client:
        db = client[db_client.get_database_name()]
        db[SETTINGS_COLLECTION].update_one(
            {"_id": MACRO_SETTINGS_DOCUMENT_ID},
            {"$set": document},
            upsert=True,
        )
    return MacroSettings.parse_obj(document)


class RiskViolation(Exception):
    def __init__(self, message: str, *, code: str = "risk_violation", details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}


class RiskManager:
    """Applies guard rails and raises when trades violate policy."""

    def __init__(
        self,
        settings: Optional[TradingSettings] = None,
        macro_settings: Optional[MacroSettings] = None,
    ) -> None:
        self.logger = LOGGER
        self.settings = settings or get_trading_settings()
        self.macro_settings = macro_settings or get_macro_settings()
        self._regime_cache: Dict[str, Tuple[float, datetime]] = {}  # symbol -> (multiplier, cached_at)
        self._regime_adjustments_count = 0  # Track number of regime risk adjustments

    # ------------------------------------------------------------------ #
    # Settings management
    # ------------------------------------------------------------------ #
    def refresh(self) -> TradingSettings:
        self.settings = get_trading_settings()
        return self.settings

    def update_settings(self, payload: Union[TradingSettings, Dict[str, Any]]) -> TradingSettings:
        updated = save_trading_settings(payload)
        self.settings = updated
        return updated

    def refresh_macro_settings(self) -> MacroSettings:
        """Refresh macro settings from database."""
        self.macro_settings = get_macro_settings()
        return self.macro_settings

    def update_macro_settings(self, payload: Union[MacroSettings, Dict[str, Any]]) -> MacroSettings:
        """Update and refresh macro settings."""
        updated = save_macro_settings(payload)
        self.macro_settings = updated
        return updated

    # ------------------------------------------------------------------ #
    # Regime-based risk management
    # ------------------------------------------------------------------ #
    def get_regime_multiplier(self, symbol: str) -> Tuple[float, Optional[str]]:
        """Get position size multiplier based on current market regime.
        
        Args:
            symbol: Trading pair symbol (e.g., 'BTC/USDT')
            
        Returns:
            Tuple of (multiplier, regime_description)
            - multiplier: Float between 0.3 and 2.0
            - regime_description: String description of regime (or None if regime risk disabled)
            
        The method:
        1. Returns (1.0, None) if regime risk management is disabled
        2. Checks cache for recent regime multiplier (TTL configured in settings)
        3. Queries current regime from macro.regimes collection
        4. Applies configured multipliers based on trend and volatility regime
        5. Logs alerts when significant position reduction occurs
        """
        # Return neutral multiplier if regime risk disabled
        if not self.macro_settings.regime_risk_enabled:
            return (1.0, None)
        
        # Check cache
        now = _utcnow()
        if symbol in self._regime_cache:
            cached_multiplier, cached_at = self._regime_cache[symbol]
            age_seconds = (now - cached_at).total_seconds()
            if age_seconds < self.macro_settings.regime_cache_ttl_seconds:
                return (cached_multiplier, "cached")
        
        # Query current regime
        try:
            from macro.regime import RegimeDetector
            
            detector = RegimeDetector()
            regime = detector.get_latest_regime(symbol)
            
            if regime is None:
                self.logger.warning("No regime data found for %s, using neutral multiplier", symbol)
                multiplier = 1.0
                regime_desc = "UNDEFINED"
            else:
                # Get multipliers from settings
                multipliers = self.macro_settings.regime_multipliers
                
                # Trend-based multiplier (primary)
                trend_multiplier = getattr(multipliers, regime.trend_regime.value, 1.0)
                
                # Volatility-based multiplier (secondary)
                volatility_multiplier = getattr(multipliers, regime.volatility_regime.value, 1.0)
                
                # Combined multiplier: take minimum of trend and volatility (more conservative)
                multiplier = min(trend_multiplier, volatility_multiplier)
                
                # Ensure multiplier is within bounds [0.3, 2.0]
                multiplier = max(0.3, min(2.0, multiplier))
                
                regime_desc = f"{regime.trend_regime.value}/{regime.volatility_regime.value}"
                
                # Check if this is a significant reduction
                is_significant = multiplier < (1.0 - self.macro_settings.significant_reduction_threshold)
                
                # Log significant reductions
                if self.macro_settings.alert_on_significant_reduction and is_significant:
                    self.logger.warning(
                        "Regime-based risk reduction for %s: multiplier=%.2f, regime=%s, confidence=%.2f",
                        symbol,
                        multiplier,
                        regime_desc,
                        regime.confidence,
                    )
                    self.log_breach(
                        code="regime_risk_reduction",
                        message=f"Position size reduced to {multiplier:.1%} due to {regime_desc} regime",
                        context={
                            "symbol": symbol,
                            "multiplier": multiplier,
                            "trend_regime": regime.trend_regime.value,
                            "volatility_regime": regime.volatility_regime.value,
                            "confidence": regime.confidence,
                        },
                        severity="info",
                    )
                
                # Record metrics
                try:
                    from monitor.metrics import record_regime_risk_adjustment, record_regime_cache_size
                    
                    record_regime_risk_adjustment(
                        symbol=symbol,
                        regime_trend=regime.trend_regime.value,
                        regime_volatility=regime.volatility_regime.value,
                        multiplier=multiplier,
                        is_significant_reduction=is_significant,
                    )
                except ImportError:
                    pass  # Metrics not available
                
                self._regime_adjustments_count += 1
            
            # Cache the result
            self._regime_cache[symbol] = (multiplier, now)
            
            return (multiplier, regime_desc)
            
        except Exception as exc:
            self.logger.error(
                "Error getting regime multiplier for %s: %s. Using neutral multiplier.",
                symbol,
                exc,
                exc_info=True,
            )
            return (1.0, "error")

    def calculate_position_size(
        self,
        *,
        symbol: str,
        base_size_usd: float,
        apply_regime_multiplier: bool = True,
    ) -> Dict[str, Any]:
        """Calculate final position size with regime adjustments.
        
        Args:
            symbol: Trading pair symbol
            base_size_usd: Base position size in USD before adjustments
            apply_regime_multiplier: Whether to apply regime-based multiplier (default True)
            
        Returns:
            Dictionary with:
                - final_size_usd: Adjusted position size
                - base_size_usd: Original base size
                - regime_multiplier: Applied multiplier
                - regime_description: Regime state description
                - regime_adjusted: Whether regime adjustment was applied
        """
        result = {
            "symbol": symbol,
            "base_size_usd": base_size_usd,
            "regime_multiplier": 1.0,
            "regime_description": None,
            "regime_adjusted": False,
            "final_size_usd": base_size_usd,
        }
        
        if not apply_regime_multiplier:
            return result
        
        multiplier, regime_desc = self.get_regime_multiplier(symbol)
        
        final_size = base_size_usd * multiplier
        
        result.update({
            "regime_multiplier": multiplier,
            "regime_description": regime_desc,
            "regime_adjusted": multiplier != 1.0,
            "final_size_usd": final_size,
        })
        
        return result

    # ------------------------------------------------------------------ #
    # Risk calculations
    # ------------------------------------------------------------------ #
    def pre_trade_check(
        self,
        *,
        request: Any,
        notional_usd: float,
        actor: Optional[str] = None,
        source: Optional[str] = None,
    ) -> Dict[str, Any]:
        mode = _get_attr(request, "mode", default="paper")
        symbol = _get_attr(request, "symbol")
        side = _get_attr(request, "side", default="buy").lower()
        quantity = float(_get_attr(request, "quantity", default=0.0))
        if quantity <= 0:
            raise RiskViolation("Order quantity must be positive.", code="invalid_quantity")

        if self.settings.kill_switch.armed:
            raise RiskViolation(
                "Kill switch is armed. Trading is halted.",
                code="kill_switch_armed",
                details={"reason": self.settings.kill_switch.reason},
            )

        mode_settings = self.settings.modes.get(mode)
        if not mode_settings or not mode_settings.enabled:
            raise RiskViolation(f"Mode '{mode}' is disabled.", code="mode_disabled")

        if self.settings.risk.allowed_symbols and symbol.upper() not in self.settings.risk.allowed_symbols:
            raise RiskViolation(
                f"Symbol '{symbol}' is not permitted",
                code="symbol_not_allowed",
            )

        if notional_usd > self.settings.risk.max_trade_usd:
            raise RiskViolation(
                f"Order notional ${notional_usd:,.2f} exceeds global max trade ${self.settings.risk.max_trade_usd:,.2f}.",
                code="max_trade_exceeded",
            )

        if notional_usd > mode_settings.max_notional_usd:
            raise RiskViolation(
                f"Order notional ${notional_usd:,.2f} exceeds mode limit ${mode_settings.max_notional_usd:,.2f}.",
                code="mode_trade_limit",
            )

        if notional_usd > self.settings.risk.sensitive_threshold_usd and source != "manual":
            raise RiskViolation(
                "Trade exceeds sensitive threshold and requires manual approval.",
                code="manual_required",
                details={"threshold": self.settings.risk.sensitive_threshold_usd},
            )

        open_exposure = self._current_open_exposure(mode=mode)
        if open_exposure + notional_usd > self.settings.risk.max_open_exposure_usd:
            raise RiskViolation(
                "Open exposure limit reached.",
                code="exposure_limit",
                details={
                    "open_exposure": open_exposure,
                    "max_open_exposure": self.settings.risk.max_open_exposure_usd,
                },
            )

        symbol_exposure = self._symbol_exposure(symbol=symbol, mode=mode)
        if symbol_exposure + notional_usd > self.settings.risk.max_position_usd_per_symbol:
            raise RiskViolation(
                f"Symbol exposure for {symbol} exceeds limit.",
                code="symbol_exposure_limit",
                details={
                    "symbol_exposure": symbol_exposure,
                    "max": self.settings.risk.max_position_usd_per_symbol,
                },
            )

        outstanding_orders = self._open_orders_count(symbol=symbol, mode=mode)
        if outstanding_orders >= self.settings.risk.max_orders_per_symbol:
            raise RiskViolation(
                f"Too many open orders for {symbol} ({outstanding_orders}).",
                code="max_orders_symbol",
            )

        daily_loss = self._daily_realized_loss()
        if daily_loss < -self.settings.risk.max_daily_loss_usd:
            raise RiskViolation(
                "Daily loss limit exceeded.",
                code="daily_loss_limit",
                details={"daily_loss": daily_loss},
            )

        auto_mode = source == "auto"
        if auto_mode:
            if not self.settings.auto_mode.enabled:
                raise RiskViolation("Auto mode disabled.", code="auto_disabled")
            if not self.settings.auto_mode.allow_live and mode == "live":
                raise RiskViolation("Auto mode cannot trade live accounts.", code="auto_live_disabled")
            if notional_usd > self.settings.auto_mode.max_trade_usd:
                raise RiskViolation(
                    "Auto mode notional exceeds configured cap.",
                    code="auto_notional_limit",
                )
            trades_today = self._auto_trades_today()
            if trades_today >= self.settings.auto_mode.max_trades_per_day:
                raise RiskViolation(
                    "Auto mode trade allotment exhausted for today.",
                    code="auto_daily_limit",
                )

        return {
            "status": "approved",
            "mode": mode,
            "symbol": symbol,
            "side": side,
            "quantity": quantity,
            "notional_usd": notional_usd,
            "open_exposure_usd": open_exposure,
            "symbol_exposure_usd": symbol_exposure,
            "daily_loss_usd": daily_loss,
            "auto_mode": auto_mode,
        }

    def record_fill(self, *, mode: str, symbol: str, pnl: float, executed_at: datetime) -> None:
        date_key = executed_at.astimezone(timezone.utc).date().isoformat()
        with db_client.mongo_client() as client:
            db = client[db_client.get_database_name()]
            db[METRICS_COLLECTION].update_one(
                {"_id": date_key},
                {
                    "$inc": {"realized_pnl": float(pnl), "fills": 1},
                    "$set": {"updated_at": executed_at},
                },
                upsert=True,
            )

    def log_breach(
        self,
        *,
        code: str,
        message: str,
        context: Optional[Dict[str, Any]] = None,
        severity: str = "warning",
    ) -> Dict[str, Any]:
        document = {
            "_id": ObjectId(),
            "code": code,
            "message": message,
            "context": context or {},
            "severity": severity,
            "created_at": _utcnow(),
            "acknowledged": False,
        }
        with db_client.mongo_client() as client:
            db = client[db_client.get_database_name()]
            db[BREACHES_COLLECTION].insert_one(document)
        return self._serialise(document)

    def get_breaches(self, *, include_acknowledged: bool = False, limit: int = 100) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {}
        if not include_acknowledged:
            query["acknowledged"] = {"$ne": True}
        with db_client.mongo_client() as client:
            db = client[db_client.get_database_name()]
            cursor = (
                db[BREACHES_COLLECTION]
                .find(query)
                .sort("created_at", -1)
                .limit(max(1, limit))
            )
            docs = list(cursor)
        return [self._serialise(doc) for doc in docs]

    def acknowledge_breach(self, breach_id: str, *, actor: Optional[str] = None) -> bool:
        with db_client.mongo_client() as client:
            db = client[db_client.get_database_name()]
            result = db[BREACHES_COLLECTION].update_one(
                {"_id": ObjectId(breach_id)},
                {
                    "$set": {
                        "acknowledged": True,
                        "acknowledged_at": _utcnow(),
                        "acknowledged_by": actor,
                    }
                },
            )
        return bool(result.modified_count)

    def trigger_kill_switch(self, *, reason: str, actor: Optional[str] = None) -> TradingSettings:
        self.settings.kill_switch = KillSwitchState(
            armed=True,
            reason=reason,
            actor=actor,
            armed_at=_utcnow(),
        )
        return self.update_settings(self.settings)

    def release_kill_switch(self, *, actor: Optional[str] = None) -> TradingSettings:
        self.settings.kill_switch = KillSwitchState(
            armed=False,
            reason=f"Released by {actor or 'system'}",
            actor=actor,
            armed_at=_utcnow(),
        )
        return self.update_settings(self.settings)

    def get_summary(self) -> Dict[str, Any]:
        open_exposure = {
            mode: self._current_open_exposure(mode=mode)
            for mode, config in self.settings.modes.items()
            if config.enabled
        }
        positions_count = self._positions_count()
        daily_loss = self._daily_realized_loss()
        breaches = self.get_breaches(include_acknowledged=False, limit=20)
        
        # Record cache size metric
        cache_size = len(self._regime_cache)
        try:
            from monitor.metrics import record_regime_cache_size
            record_regime_cache_size(cache_size=cache_size)
        except ImportError:
            pass  # Metrics not available
        
        summary = {
            "generated_at": _utcnow().isoformat(),
            "settings": self._serialise_settings(self.settings),
            "open_exposure": open_exposure,
            "positions": positions_count,
            "daily_loss_usd": daily_loss,
            "kill_switch": {
                "armed": self.settings.kill_switch.armed,
                "armed_at": _serialise_datetime(self.settings.kill_switch.armed_at),
                "reason": self.settings.kill_switch.reason,
                "actor": self.settings.kill_switch.actor,
            },
            "breaches_open": len(breaches),
            "macro": {
                "regime_risk_enabled": self.macro_settings.regime_risk_enabled,
                "regime_adjustments_count": self._regime_adjustments_count,
                "cached_regimes": cache_size,
            },
        }
        return summary

    # ------------------------------------------------------------------ #
    # Internal calculations
    # ------------------------------------------------------------------ #
    def _current_open_exposure(self, *, mode: str) -> float:
        total = 0.0
        with db_client.mongo_client() as client:
            db = client[db_client.get_database_name()]

            positions = db[POSITIONS_COLLECTION].find({"mode": mode})
            for position in positions:
                qty = float(position.get("quantity", 0.0))
                price = float(position.get("avg_entry_price", 0.0))
                total += abs(qty * price)

            open_orders = db[ORDERS_COLLECTION].find(
                {"mode": mode, "status": {"$in": ["new", "submitted", "partially_filled"]}}
            )
            for order in open_orders:
                remaining_qty = float(order.get("quantity", 0.0)) - float(order.get("filled_quantity", 0.0))
                price = float(order.get("price") or order.get("avg_fill_price") or 0.0)
                total += abs(remaining_qty * price)
        return float(total)

    def _symbol_exposure(self, *, symbol: str, mode: str) -> float:
        exposure = 0.0
        with db_client.mongo_client() as client:
            db = client[db_client.get_database_name()]
            pos = db[POSITIONS_COLLECTION].find_one({"symbol": symbol, "mode": mode})
            if pos:
                exposure += abs(float(pos.get("quantity", 0.0)) * float(pos.get("avg_entry_price", 0.0)))

            open_orders = db[ORDERS_COLLECTION].find(
                {"symbol": symbol, "mode": mode, "status": {"$in": ["new", "submitted", "partially_filled"]}}
            )
            for order in open_orders:
                remaining_qty = float(order.get("quantity", 0.0)) - float(order.get("filled_quantity", 0.0))
                price = float(order.get("price") or order.get("avg_fill_price") or 0.0)
                exposure += abs(remaining_qty * price)
        return float(exposure)

    def _open_orders_count(self, *, symbol: str, mode: str) -> int:
        with db_client.mongo_client() as client:
            db = client[db_client.get_database_name()]
            count = db[ORDERS_COLLECTION].count_documents(
                {"symbol": symbol, "mode": mode, "status": {"$in": ["new", "submitted", "partially_filled"]}}
            )
        return int(count)

    def _daily_realized_loss(self) -> float:
        start = _utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        with db_client.mongo_client() as client:
            db = client[db_client.get_database_name()]
            pipeline = [
                {"$match": {"executed_at": {"$gte": start}}},
                {"$group": {"_id": None, "pnl": {"$sum": "$pnl"}}},
            ]
            result = list(db[FILLS_COLLECTION].aggregate(pipeline))
        if not result:
            return 0.0
        pnl = float(result[0].get("pnl", 0.0))
        return pnl

    def _auto_trades_today(self) -> int:
        start = _utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        with db_client.mongo_client() as client:
            db = client[db_client.get_database_name()]
            count = db[ORDERS_COLLECTION].count_documents(
                {
                    "created_at": {"$gte": start},
                    "metadata.source": "auto",
                }
            )
        return int(count)

    def _positions_count(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        with db_client.mongo_client() as client:
            db = client[db_client.get_database_name()]
            pipeline = [
                {"$group": {"_id": "$mode", "count": {"$sum": 1}}},
            ]
            for row in db[POSITIONS_COLLECTION].aggregate(pipeline):
                counts[row["_id"]] = int(row["count"])
        return counts

    @staticmethod
    def _serialise(document: Dict[str, Any]) -> Dict[str, Any]:
        payload = {**document}
        if "_id" in payload:
            payload["_id"] = str(payload["_id"])
        for key, value in list(payload.items()):
            if isinstance(value, datetime):
                payload[key] = value.isoformat()
        return payload

    @staticmethod
    def _serialise_settings(settings: TradingSettings) -> Dict[str, Any]:
        payload = settings.dict()
        payload["updated_at"] = _serialise_datetime(settings.updated_at)
        for mode, config in list(payload.get("modes", {}).items()):
            payload["modes"][mode] = config
        return payload


def _get_attr(obj: Any, key: str, default: Optional[Any] = None) -> Any:
    if hasattr(obj, key):
        return getattr(obj, key)
    if isinstance(obj, dict):
        return obj.get(key, default)
    return default

