"""
Fast path analyzer for Chrome extension.

Provides sub-500ms market analysis by reusing existing LenQuant components.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from db.client import get_ohlcv_df
from exec.risk_manager import RiskManager
from features.indicators import add_basic_indicators
from macro.regime import (
    RegimeDetector,
    RegimeFeatures,
    TrendRegime,
    VolatilityRegime,
)

logger = logging.getLogger(__name__)


@dataclass
class FastAnalysisResult:
    """Result from fast path analysis."""
    
    trade_allowed: bool
    market_state: str
    trend_direction: Optional[str]
    volatility_regime: str
    setup_candidates: List[str]
    risk_flags: List[str]
    leverage_band: Tuple[int, int]
    confidence: float
    reason: str
    regime_features: Optional[Dict[str, float]]
    latency_ms: int
    # Phase 2: Regime-aware sizing from RiskManager
    regime_multiplier: float = 1.0
    regime_description: Optional[str] = None
    position_sizing_note: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API response."""
        return {
            "trade_allowed": self.trade_allowed,
            "market_state": self.market_state,
            "trend_direction": self.trend_direction,
            "volatility_regime": self.volatility_regime,
            "setup_candidates": self.setup_candidates,
            "risk_flags": self.risk_flags,
            "confidence_pattern": int(self.confidence * 100),
            "suggested_leverage_band": list(self.leverage_band),
            "reason": self.reason,
            "regime_features": self.regime_features,
            "latency_ms": self.latency_ms,
            # Phase 2: Regime-aware sizing
            "regime_multiplier": self.regime_multiplier,
            "regime_description": self.regime_description,
            "position_sizing_note": self.position_sizing_note,
        }


class ExtensionAnalyzer:
    """
    Fast path analyzer for the Chrome extension.
    
    Reuses LenQuant components for market analysis while maintaining
    strict latency requirements (≤500ms).
    
    Components reused:
    - macro.regime.RegimeDetector for market state classification
    - features.indicators for technical indicators
    - db.client for OHLCV data retrieval
    """
    
    # Market state mappings
    MARKET_STATES = {
        (TrendRegime.TRENDING_UP, VolatilityRegime.NORMAL_VOLATILITY): "trend",
        (TrendRegime.TRENDING_UP, VolatilityRegime.LOW_VOLATILITY): "trend",
        (TrendRegime.TRENDING_UP, VolatilityRegime.HIGH_VOLATILITY): "trend_volatile",
        (TrendRegime.TRENDING_DOWN, VolatilityRegime.NORMAL_VOLATILITY): "trend",
        (TrendRegime.TRENDING_DOWN, VolatilityRegime.LOW_VOLATILITY): "trend",
        (TrendRegime.TRENDING_DOWN, VolatilityRegime.HIGH_VOLATILITY): "trend_volatile",
        (TrendRegime.SIDEWAYS, VolatilityRegime.LOW_VOLATILITY): "range",
        (TrendRegime.SIDEWAYS, VolatilityRegime.NORMAL_VOLATILITY): "range",
        (TrendRegime.SIDEWAYS, VolatilityRegime.HIGH_VOLATILITY): "chop",
        (TrendRegime.UNDEFINED, VolatilityRegime.HIGH_VOLATILITY): "chop",
    }
    
    # Setup patterns to detect
    SETUP_PATTERNS = [
        "pullback_continuation",
        "range_breakout",
        "trend_reversal",
        "compression_breakout",
        "momentum_continuation",
    ]
    
    def __init__(self, max_leverage: int = 20):
        """
        Initialize analyzer.
        
        Args:
            max_leverage: Maximum leverage to recommend (default 20x)
        """
        self.regime_detector = RegimeDetector()
        self.max_leverage = max_leverage
        self._cache: Dict[str, Tuple[FastAnalysisResult, datetime]] = {}
        self._cache_ttl_seconds = 3  # Cache results for 3 seconds
        # Phase 2: Integrate RiskManager for regime-aware sizing
        self._risk_manager: Optional[RiskManager] = None
    
    def _get_risk_manager(self) -> RiskManager:
        """Lazy-load RiskManager to avoid circular imports and startup cost."""
        if self._risk_manager is None:
            self._risk_manager = RiskManager()
        return self._risk_manager
    
    def analyze(
        self,
        symbol: str,
        timeframe: str,
        use_cache: bool = True,
    ) -> FastAnalysisResult:
        """
        Perform fast path analysis.
        
        Args:
            symbol: Trading pair (e.g., "BTC/USD" or "BTCUSDT")
            timeframe: Chart interval (e.g., "1m", "5m")
            use_cache: Whether to use cached results (default True)
        
        Returns:
            FastAnalysisResult with market analysis
        
        Note:
            This method is designed to complete in ≤500ms.
            It uses cached OHLCV data and avoids LLM calls.
        """
        start_time = time.time()
        
        # Normalize symbol format
        normalized_symbol = self._normalize_symbol(symbol)
        cache_key = f"{normalized_symbol}:{timeframe}"
        
        # Check cache
        if use_cache:
            cached = self._get_cached(cache_key)
            if cached:
                cached_result = FastAnalysisResult(
                    trade_allowed=cached.trade_allowed,
                    market_state=cached.market_state,
                    trend_direction=cached.trend_direction,
                    volatility_regime=cached.volatility_regime,
                    setup_candidates=cached.setup_candidates,
                    risk_flags=cached.risk_flags,
                    leverage_band=cached.leverage_band,
                    confidence=cached.confidence,
                    reason=cached.reason,
                    regime_features=cached.regime_features,
                    latency_ms=int((time.time() - start_time) * 1000),
                )
                return cached_result
        
        try:
            # Fetch OHLCV data (reuse existing db.client)
            df = get_ohlcv_df(normalized_symbol, timeframe, limit=300)
            
            if df.empty or len(df) < 50:
                return self._insufficient_data_result(normalized_symbol, start_time)
            
            # Add indicators (reuse features.indicators)
            df = add_basic_indicators(df)
            
            # Compute regime features (reuse macro.regime)
            df = self.regime_detector.compute_features(df)
            
            # Get latest row
            latest = df.iloc[-1]
            
            # Extract regime features for analysis
            features = self._extract_regime_features(latest)
            
            # Detect trend regime
            trend_regime, trend_conf = self.regime_detector.detect_trend_regime(features)
            
            # Detect volatility regime
            historical_vol = df["volatility_std"].iloc[:-1] if "volatility_std" in df.columns else None
            vol_regime, vol_conf = self.regime_detector.detect_volatility_regime(
                features, historical_vol
            )
            
            # Classify market state
            market_state = self._classify_market_state(trend_regime, vol_regime)
            
            # Detect setup patterns
            setup_candidates = self._detect_setups(df, trend_regime, latest)
            
            # Check risk flags
            risk_flags = self._check_risk_flags(df, latest)
            
            # Calculate leverage band
            atr_pct = features.atr_pct if features.atr_pct and not np.isnan(features.atr_pct) else 2.0
            leverage_band = self._calculate_leverage_band(atr_pct, vol_regime, market_state)
            
            # Phase 2: Get regime multiplier from RiskManager
            regime_multiplier, regime_desc = self._get_regime_multiplier_safe(normalized_symbol)
            
            # Adjust leverage band based on regime multiplier
            leverage_band = self._apply_regime_to_leverage(leverage_band, regime_multiplier)
            
            # Determine if trading is allowed
            trade_allowed = self._is_trading_allowed(market_state, risk_flags)
            
            # Calculate combined confidence
            confidence = (trend_conf + vol_conf) / 2.0
            
            # Build position sizing note
            position_sizing_note = self._build_position_sizing_note(regime_multiplier, regime_desc)
            
            # Build human-readable reason
            reason = self._build_reason(market_state, risk_flags, trade_allowed, setup_candidates)
            
            # Build regime features dict for response
            regime_features_dict = {
                "atr": features.atr,
                "atr_pct": features.atr_pct,
                "adx": features.adx,
                "bb_width": features.bb_width,
                "ema_alignment": self._get_ema_alignment(latest),
                "rsi_14": float(latest.get("rsi_14", 50)) if "rsi_14" in df.columns else None,
            }
            
            latency_ms = int((time.time() - start_time) * 1000)
            
            result = FastAnalysisResult(
                trade_allowed=trade_allowed,
                market_state=market_state,
                trend_direction=self._trend_direction(trend_regime),
                volatility_regime=vol_regime.value,
                setup_candidates=setup_candidates,
                risk_flags=risk_flags,
                leverage_band=leverage_band,
                confidence=round(confidence, 2),
                reason=reason,
                regime_features=regime_features_dict,
                latency_ms=latency_ms,
                regime_multiplier=regime_multiplier,
                regime_description=regime_desc,
                position_sizing_note=position_sizing_note,
            )
            
            # Cache result
            self._set_cached(cache_key, result)
            
            return result
            
        except Exception as exc:
            logger.error("Fast path analysis error for %s %s: %s", symbol, timeframe, exc)
            return self._error_result(normalized_symbol, start_time, str(exc))
    
    def _normalize_symbol(self, symbol: str) -> str:
        """Normalize symbol format for database query."""
        # Convert BTCUSDT to BTC/USDT format if needed
        if "/" not in symbol:
            # Common Binance format
            for quote in ["USDT", "USD", "BUSD", "BTC", "ETH"]:
                if symbol.endswith(quote):
                    base = symbol[:-len(quote)]
                    return f"{base}/{quote}"
        return symbol
    
    def _get_cached(self, key: str) -> Optional[FastAnalysisResult]:
        """Get cached result if still valid."""
        if key in self._cache:
            result, cached_at = self._cache[key]
            age = (datetime.utcnow() - cached_at).total_seconds()
            if age < self._cache_ttl_seconds:
                return result
            del self._cache[key]
        return None
    
    def _set_cached(self, key: str, result: FastAnalysisResult) -> None:
        """Cache analysis result."""
        self._cache[key] = (result, datetime.utcnow())
        
        # Cleanup old entries
        if len(self._cache) > 100:
            now = datetime.utcnow()
            expired = [
                k for k, (_, cached_at) in self._cache.items()
                if (now - cached_at).total_seconds() > self._cache_ttl_seconds
            ]
            for k in expired:
                del self._cache[k]
    
    def _extract_regime_features(self, row: pd.Series) -> RegimeFeatures:
        """Extract RegimeFeatures from dataframe row."""
        return RegimeFeatures(
            atr=float(row.get("atr", 0) or 0),
            atr_pct=float(row.get("atr_pct", 0) or 0),
            adx=float(row.get("adx", 0) or 0),
            bb_width=float(row.get("bb_width", 0) or 0),
            ma_slope_short=float(row.get("ma_slope_short", 0) or 0),
            ma_slope_long=float(row.get("ma_slope_long", 0) or 0),
            volatility_std=float(row.get("volatility_std", 0) or 0),
        )
    
    def _classify_market_state(
        self, trend: TrendRegime, volatility: VolatilityRegime
    ) -> str:
        """Map regime combination to market state."""
        key = (trend, volatility)
        if key in self.MARKET_STATES:
            return self.MARKET_STATES[key]
        
        # Default fallbacks
        if trend == TrendRegime.UNDEFINED:
            return "undefined"
        if volatility == VolatilityRegime.HIGH_VOLATILITY:
            return "volatile"
        return "range"
    
    def _trend_direction(self, trend: TrendRegime) -> Optional[str]:
        """Get trend direction string."""
        if trend == TrendRegime.TRENDING_UP:
            return "up"
        elif trend == TrendRegime.TRENDING_DOWN:
            return "down"
        return None
    
    def _get_ema_alignment(self, row: pd.Series) -> Optional[str]:
        """Determine EMA alignment."""
        ema_9 = row.get("ema_9")
        ema_21 = row.get("ema_21")
        
        if ema_9 is None or ema_21 is None:
            return None
        
        if pd.isna(ema_9) or pd.isna(ema_21):
            return None
        
        if float(ema_9) > float(ema_21):
            return "bullish"
        elif float(ema_9) < float(ema_21):
            return "bearish"
        return "neutral"
    
    def _detect_setups(
        self, df: pd.DataFrame, trend_regime: TrendRegime, latest: pd.Series
    ) -> List[str]:
        """Detect active setup patterns."""
        setups = []
        
        close = float(latest.get("close", 0))
        if close <= 0:
            return setups
        
        # Pullback continuation - in trend, price pulled back to EMA zone
        if trend_regime in [TrendRegime.TRENDING_UP, TrendRegime.TRENDING_DOWN]:
            ema_9 = latest.get("ema_9")
            ema_21 = latest.get("ema_21")
            
            if ema_9 is not None and ema_21 is not None:
                ema_9 = float(ema_9)
                ema_21 = float(ema_21)
                ema_zone = (min(ema_9, ema_21), max(ema_9, ema_21))
                
                # Check if price is in or near EMA zone
                zone_width = ema_zone[1] - ema_zone[0]
                buffer = zone_width * 0.5  # Allow some buffer
                
                if (ema_zone[0] - buffer) <= close <= (ema_zone[1] + buffer):
                    setups.append("pullback_continuation")
        
        # Range breakout - sideways market, price near extremes
        if trend_regime == TrendRegime.SIDEWAYS and len(df) >= 20:
            high_20 = df["high"].tail(20).max()
            low_20 = df["low"].tail(20).min()
            range_size = high_20 - low_20
            
            if range_size > 0:
                near_high = (high_20 - close) / range_size < 0.1
                near_low = (close - low_20) / range_size < 0.1
                
                if near_high or near_low:
                    setups.append("range_breakout")
        
        # Compression breakout - BB width contracting
        if "bb_width" in df.columns and len(df) >= 20:
            current_bb = latest.get("bb_width", 0)
            avg_bb = df["bb_width"].tail(20).mean()
            
            if current_bb and avg_bb and current_bb < avg_bb * 0.7:
                setups.append("compression_breakout")
        
        # Momentum continuation - strong RSI with trend
        rsi = latest.get("rsi_14")
        if rsi is not None and not pd.isna(rsi):
            rsi = float(rsi)
            if trend_regime == TrendRegime.TRENDING_UP and 55 < rsi < 75:
                setups.append("momentum_continuation")
            elif trend_regime == TrendRegime.TRENDING_DOWN and 25 < rsi < 45:
                setups.append("momentum_continuation")
        
        return setups
    
    def _check_risk_flags(self, df: pd.DataFrame, latest: pd.Series) -> List[str]:
        """Check for risk conditions."""
        flags = []
        
        # Low volume
        if "volume" in df.columns:
            vol = latest.get("volume", 0)
            avg_vol = df["volume"].tail(20).mean()
            
            if avg_vol and vol and vol < avg_vol * 0.3:
                flags.append("low_volume")
        
        # Extreme volatility
        if "atr_pct" in df.columns:
            atr_pct = latest.get("atr_pct", 0)
            if atr_pct and atr_pct > 5.0:
                flags.append("extreme_volatility")
        
        # RSI extremes
        if "rsi_14" in df.columns:
            rsi = latest.get("rsi_14")
            if rsi is not None and not pd.isna(rsi):
                rsi = float(rsi)
                if rsi > 80:
                    flags.append("overbought")
                elif rsi < 20:
                    flags.append("oversold")
        
        # Wide spread (if MACD histogram is choppy)
        if "macd_hist" in df.columns and len(df) >= 10:
            macd_hist = df["macd_hist"].tail(10)
            sign_changes = (macd_hist.diff().dropna() != 0).sum()
            if sign_changes > 6:  # Many sign changes = choppy
                flags.append("choppy_momentum")
        
        return flags
    
    def _calculate_leverage_band(
        self,
        atr_pct: float,
        vol_regime: VolatilityRegime,
        market_state: str,
    ) -> Tuple[int, int]:
        """Calculate recommended leverage band."""
        max_lev = self.max_leverage
        
        # Reduce for volatility
        if vol_regime == VolatilityRegime.HIGH_VOLATILITY:
            max_lev = min(8, max_lev)
        elif atr_pct > 4.0:
            max_lev = min(8, max_lev)
        elif atr_pct > 3.0:
            max_lev = min(10, max_lev)
        elif atr_pct > 2.0:
            max_lev = min(15, max_lev)
        
        # Further reduce for chop
        if market_state == "chop":
            max_lev = min(5, max_lev)
        elif market_state == "volatile":
            max_lev = min(6, max_lev)
        
        # Min is roughly 1/3 of max, but at least 1
        min_lev = max(1, max_lev // 3)
        
        return (min_lev, max_lev)
    
    def _get_regime_multiplier_safe(self, symbol: str) -> Tuple[float, Optional[str]]:
        """
        Get regime multiplier from RiskManager safely.
        
        Falls back to 1.0 if RiskManager is unavailable or errors.
        """
        try:
            risk_manager = self._get_risk_manager()
            multiplier, description = risk_manager.get_regime_multiplier(symbol)
            return (multiplier, description)
        except Exception as exc:
            logger.warning("Failed to get regime multiplier for %s: %s", symbol, exc)
            return (1.0, None)
    
    def _apply_regime_to_leverage(
        self, 
        leverage_band: Tuple[int, int], 
        regime_multiplier: float
    ) -> Tuple[int, int]:
        """
        Adjust leverage band based on regime multiplier.
        
        Lower multiplier (bearish/volatile regime) = lower leverage.
        Higher multiplier (bullish trend) = can use more leverage.
        """
        min_lev, max_lev = leverage_band
        
        # Apply multiplier to max leverage
        adjusted_max = int(max_lev * regime_multiplier)
        
        # Clamp to reasonable bounds
        adjusted_max = max(1, min(adjusted_max, self.max_leverage))
        
        # Recalculate min
        adjusted_min = max(1, adjusted_max // 3)
        
        return (adjusted_min, adjusted_max)
    
    def _build_position_sizing_note(
        self, 
        regime_multiplier: float, 
        regime_description: Optional[str]
    ) -> Optional[str]:
        """Build position sizing recommendation note."""
        if regime_multiplier >= 1.2:
            return f"Favorable conditions ({regime_description}). Full position size allowed."
        elif regime_multiplier >= 0.9:
            return f"Neutral conditions ({regime_description}). Standard position size."
        elif regime_multiplier >= 0.6:
            return f"Caution ({regime_description}). Reduce position size to {int(regime_multiplier * 100)}%."
        else:
            return f"High risk ({regime_description}). Consider {int(regime_multiplier * 100)}% position or wait."
    
    def _is_trading_allowed(self, market_state: str, risk_flags: List[str]) -> bool:
        """Determine if trading is advisable."""
        # Don't trade chop
        if market_state in ["chop", "undefined"]:
            return False
        
        # Don't trade extreme conditions
        if "extreme_volatility" in risk_flags:
            return False
        
        # Caution on choppy momentum but allow
        return True
    
    def _build_reason(
        self,
        market_state: str,
        risk_flags: List[str],
        trade_allowed: bool,
        setups: List[str],
    ) -> str:
        """Build human-readable analysis summary."""
        parts = []
        
        # Market state description
        state_descriptions = {
            "trend": "Clean trending market",
            "trend_volatile": "Trending with elevated volatility",
            "range": "Ranging market",
            "chop": "Choppy/uncertain conditions",
            "volatile": "High volatility environment",
            "undefined": "Unclear market structure",
        }
        parts.append(state_descriptions.get(market_state, market_state))
        
        # Setup info
        if setups:
            parts.append(f"Setup: {setups[0]}")
        
        # Risk warnings
        if risk_flags:
            flag_descriptions = {
                "low_volume": "low volume",
                "extreme_volatility": "extreme volatility",
                "overbought": "overbought RSI",
                "oversold": "oversold RSI",
                "choppy_momentum": "choppy momentum",
            }
            warnings = [flag_descriptions.get(f, f) for f in risk_flags[:2]]
            parts.append(f"Caution: {', '.join(warnings)}")
        
        # Trading recommendation
        if not trade_allowed:
            parts.append("Wait for better conditions")
        
        return ". ".join(parts)
    
    def _insufficient_data_result(self, symbol: str, start_time: float) -> FastAnalysisResult:
        """Return result when insufficient data available."""
        return FastAnalysisResult(
            trade_allowed=False,
            market_state="undefined",
            trend_direction=None,
            volatility_regime="UNDEFINED",
            setup_candidates=[],
            risk_flags=["insufficient_data"],
            leverage_band=(1, 5),
            confidence=0.0,
            reason=f"Insufficient data for {symbol}. Need at least 50 candles.",
            regime_features=None,
            latency_ms=int((time.time() - start_time) * 1000),
            regime_multiplier=1.0,
            regime_description=None,
            position_sizing_note="Wait for sufficient data before trading.",
        )
    
    def _error_result(self, symbol: str, start_time: float, error: str) -> FastAnalysisResult:
        """Return result when analysis fails."""
        return FastAnalysisResult(
            trade_allowed=False,
            market_state="error",
            trend_direction=None,
            volatility_regime="UNDEFINED",
            setup_candidates=[],
            risk_flags=["analysis_error"],
            leverage_band=(1, 5),
            confidence=0.0,
            reason=f"Analysis error: {error[:100]}",
            regime_features=None,
            latency_ms=int((time.time() - start_time) * 1000),
            regime_multiplier=1.0,
            regime_description=None,
            position_sizing_note="Unable to calculate position sizing due to error.",
        )

