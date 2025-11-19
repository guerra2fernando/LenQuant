"""Market regime detection module for classifying market states.

This module provides functionality to detect trend and volatility regimes
using technical indicators like ATR, ADX, Bollinger Bands, and moving averages.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional

import numpy as np
import pandas as pd
from pymongo import MongoClient

from db.client import get_database_name, get_ohlcv_df, mongo_client

logger = logging.getLogger(__name__)


class TrendRegime(str, Enum):
    """Trend regime classifications."""
    TRENDING_UP = "TRENDING_UP"
    TRENDING_DOWN = "TRENDING_DOWN"
    SIDEWAYS = "SIDEWAYS"
    UNDEFINED = "UNDEFINED"


class VolatilityRegime(str, Enum):
    """Volatility regime classifications."""
    HIGH_VOLATILITY = "HIGH_VOLATILITY"
    LOW_VOLATILITY = "LOW_VOLATILITY"
    NORMAL_VOLATILITY = "NORMAL_VOLATILITY"
    UNDEFINED = "UNDEFINED"


@dataclass
class RegimeFeatures:
    """Technical features used for regime detection."""
    atr: float
    atr_pct: float
    adx: float
    bb_width: float
    ma_slope_short: float
    ma_slope_long: float
    volatility_std: float


@dataclass
class MarketRegime:
    """Complete market regime classification."""
    symbol: str
    timestamp: datetime
    trend_regime: TrendRegime
    volatility_regime: VolatilityRegime
    confidence: float
    features: RegimeFeatures


class RegimeDetector:
    """Market regime detector using technical indicators.
    
    Detects trend direction (up/down/sideways) and volatility level (high/low/normal)
    using a combination of technical indicators with hysteresis to avoid regime oscillation.
    """
    
    def __init__(
        self,
        adx_threshold: float = 25.0,
        adx_strong_threshold: float = 40.0,
        ma_slope_threshold: float = 0.001,
        volatility_high_threshold: float = 2.0,
        volatility_low_threshold: float = 0.5,
        hysteresis_bars: int = 3,
        lookback_period: int = 100,
    ):
        """Initialize regime detector with configurable thresholds.
        
        Args:
            adx_threshold: Minimum ADX for trending market (default 25)
            adx_strong_threshold: ADX level for strong trend confidence (default 40)
            ma_slope_threshold: Minimum MA slope for directional bias (default 0.001)
            volatility_high_threshold: Z-score threshold for high volatility (default 2.0)
            volatility_low_threshold: Z-score threshold for low volatility (default 0.5)
            hysteresis_bars: Bars required to confirm regime transition (default 3)
            lookback_period: Historical bars for volatility normalization (default 100)
        """
        self.adx_threshold = adx_threshold
        self.adx_strong_threshold = adx_strong_threshold
        self.ma_slope_threshold = ma_slope_threshold
        self.volatility_high_threshold = volatility_high_threshold
        self.volatility_low_threshold = volatility_low_threshold
        self.hysteresis_bars = hysteresis_bars
        self.lookback_period = lookback_period
    
    def _calculate_atr(self, df: pd.DataFrame, period: int = 14) -> pd.Series:
        """Calculate Average True Range."""
        high_low = df["high"] - df["low"]
        high_close = abs(df["high"] - df["close"].shift())
        low_close = abs(df["low"] - df["close"].shift())
        true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        return true_range.rolling(window=period).mean()
    
    def _calculate_adx(self, df: pd.DataFrame, period: int = 14) -> pd.Series:
        """Calculate Average Directional Index."""
        high_diff = df["high"].diff()
        low_diff = -df["low"].diff()
        
        plus_dm = np.where((high_diff > low_diff) & (high_diff > 0), high_diff, 0)
        minus_dm = np.where((low_diff > high_diff) & (low_diff > 0), low_diff, 0)
        
        atr = self._calculate_atr(df, period)
        
        plus_di = 100 * pd.Series(plus_dm, index=df.index).rolling(window=period).mean() / atr
        minus_di = 100 * pd.Series(minus_dm, index=df.index).rolling(window=period).mean() / atr
        
        dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di)
        adx = dx.rolling(window=period).mean()
        
        return adx
    
    def _calculate_bb_width(self, df: pd.DataFrame, period: int = 20, num_std: float = 2.0) -> pd.Series:
        """Calculate Bollinger Band width as percentage of middle band."""
        ma = df["close"].rolling(window=period).mean()
        std = df["close"].rolling(window=period).std()
        upper_band = ma + (std * num_std)
        lower_band = ma - (std * num_std)
        bb_width = ((upper_band - lower_band) / ma) * 100
        return bb_width
    
    def _calculate_ma_slope(self, df: pd.DataFrame, period: int) -> pd.Series:
        """Calculate moving average slope (normalized by price)."""
        ma = df["close"].rolling(window=period).mean()
        slope = ma.diff() / ma  # Normalized by price for comparability
        return slope
    
    def compute_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute all technical features needed for regime detection.
        
        Args:
            df: OHLCV DataFrame with columns: open, high, low, close, volume
            
        Returns:
            DataFrame with added feature columns
        """
        df = df.copy()
        
        # ATR and normalized ATR
        df["atr"] = self._calculate_atr(df)
        df["atr_pct"] = (df["atr"] / df["close"]) * 100
        
        # ADX for trend strength
        df["adx"] = self._calculate_adx(df)
        
        # Bollinger Band width
        df["bb_width"] = self._calculate_bb_width(df)
        
        # Moving average slopes
        df["ma_slope_short"] = self._calculate_ma_slope(df, period=20)
        df["ma_slope_long"] = self._calculate_ma_slope(df, period=50)
        
        # Volatility (rolling standard deviation of returns)
        df["returns"] = df["close"].pct_change()
        df["volatility_std"] = df["returns"].rolling(window=20).std()
        
        return df
    
    def detect_trend_regime(self, features: RegimeFeatures) -> tuple[TrendRegime, float]:
        """Detect trend regime from computed features.
        
        Args:
            features: RegimeFeatures dataclass with computed indicators
            
        Returns:
            Tuple of (TrendRegime, confidence_score)
        """
        adx = features.adx
        ma_slope_short = features.ma_slope_short
        ma_slope_long = features.ma_slope_long
        
        # Handle NaN or invalid values
        if np.isnan(adx) or np.isnan(ma_slope_short) or np.isnan(ma_slope_long):
            return TrendRegime.UNDEFINED, 0.0
        
        # Strong trending market
        if adx > self.adx_threshold:
            # Both slopes agree on direction
            if ma_slope_short > self.ma_slope_threshold and ma_slope_long > self.ma_slope_threshold:
                confidence = min(1.0, adx / self.adx_strong_threshold)
                return TrendRegime.TRENDING_UP, confidence
            elif ma_slope_short < -self.ma_slope_threshold and ma_slope_long < -self.ma_slope_threshold:
                confidence = min(1.0, adx / self.adx_strong_threshold)
                return TrendRegime.TRENDING_DOWN, confidence
        
        # Weak trend or ranging market
        if adx < self.adx_threshold:
            confidence = 1.0 - (adx / self.adx_threshold)
            return TrendRegime.SIDEWAYS, confidence
        
        # ADX high but slopes disagree - unclear regime
        return TrendRegime.UNDEFINED, 0.3
    
    def detect_volatility_regime(self, features: RegimeFeatures, historical_vol: Optional[pd.Series] = None) -> tuple[VolatilityRegime, float]:
        """Detect volatility regime from computed features.
        
        Args:
            features: RegimeFeatures dataclass with computed indicators
            historical_vol: Optional historical volatility series for z-score calculation
            
        Returns:
            Tuple of (VolatilityRegime, confidence_score)
        """
        current_vol = features.volatility_std
        atr_pct = features.atr_pct
        
        # Handle NaN or invalid values
        if np.isnan(current_vol) or np.isnan(atr_pct):
            return VolatilityRegime.UNDEFINED, 0.0
        
        # If we have historical context, use z-score
        if historical_vol is not None and len(historical_vol) > 0:
            vol_mean = historical_vol.mean()
            vol_std = historical_vol.std()
            
            if vol_std > 0:
                z_score = (current_vol - vol_mean) / vol_std
                
                if z_score > self.volatility_high_threshold:
                    confidence = min(1.0, z_score / (self.volatility_high_threshold * 2))
                    return VolatilityRegime.HIGH_VOLATILITY, confidence
                elif abs(z_score) < self.volatility_low_threshold:
                    confidence = 1.0 - abs(z_score) / self.volatility_low_threshold
                    return VolatilityRegime.LOW_VOLATILITY, confidence
                else:
                    return VolatilityRegime.NORMAL_VOLATILITY, 0.7
        
        # Fallback to simple ATR percentile-based classification
        if atr_pct > 3.0:  # High ATR relative to price
            return VolatilityRegime.HIGH_VOLATILITY, 0.6
        elif atr_pct < 1.0:  # Low ATR relative to price
            return VolatilityRegime.LOW_VOLATILITY, 0.6
        else:
            return VolatilityRegime.NORMAL_VOLATILITY, 0.5
    
    def classify_market_state(
        self,
        symbol: str,
        interval: str = "1h",
        timestamp: Optional[datetime] = None,
    ) -> MarketRegime:
        """Classify current market regime for a symbol.
        
        Args:
            symbol: Trading pair symbol (e.g., 'BTC/USDT')
            interval: Timeframe (default '1h')
            timestamp: Optional timestamp for historical regime detection
            
        Returns:
            MarketRegime dataclass with full classification
        """
        # Fetch OHLCV data
        df = get_ohlcv_df(symbol, interval, limit=self.lookback_period + 50)
        
        if df.empty or len(df) < 50:
            logger.warning("Insufficient data for regime detection: %s %s", symbol, interval)
            return MarketRegime(
                symbol=symbol,
                timestamp=timestamp or datetime.utcnow(),
                trend_regime=TrendRegime.UNDEFINED,
                volatility_regime=VolatilityRegime.UNDEFINED,
                confidence=0.0,
                features=RegimeFeatures(
                    atr=0.0, atr_pct=0.0, adx=0.0, bb_width=0.0,
                    ma_slope_short=0.0, ma_slope_long=0.0, volatility_std=0.0
                ),
            )
        
        # Compute features
        df = self.compute_features(df)
        
        # Get latest timestamp if not specified
        if timestamp is None:
            timestamp = df.index[-1]
        
        # Get the row closest to the requested timestamp
        idx = df.index.get_indexer([timestamp], method="nearest")[0]
        row = df.iloc[idx]
        
        # Extract features
        features = RegimeFeatures(
            atr=float(row["atr"]),
            atr_pct=float(row["atr_pct"]),
            adx=float(row["adx"]),
            bb_width=float(row["bb_width"]),
            ma_slope_short=float(row["ma_slope_short"]),
            ma_slope_long=float(row["ma_slope_long"]),
            volatility_std=float(row["volatility_std"]),
        )
        
        # Detect regimes
        trend_regime, trend_confidence = self.detect_trend_regime(features)
        
        # Pass historical volatility for better volatility regime detection
        historical_vol = df["volatility_std"].iloc[:-1] if len(df) > 1 else None
        volatility_regime, vol_confidence = self.detect_volatility_regime(features, historical_vol)
        
        # Overall confidence is the average of both confidences
        overall_confidence = (trend_confidence + vol_confidence) / 2.0
        
        return MarketRegime(
            symbol=symbol,
            timestamp=timestamp,
            trend_regime=trend_regime,
            volatility_regime=volatility_regime,
            confidence=overall_confidence,
            features=features,
        )
    
    def store_regime(self, regime: MarketRegime) -> None:
        """Store regime classification in MongoDB.
        
        Args:
            regime: MarketRegime dataclass to store
        """
        with mongo_client() as client:
            db = client[get_database_name()]
            
            doc = {
                "symbol": regime.symbol,
                "timestamp": regime.timestamp,
                "trend_regime": regime.trend_regime.value,
                "volatility_regime": regime.volatility_regime.value,
                "confidence": regime.confidence,
                "features": {
                    "atr": regime.features.atr,
                    "atr_pct": regime.features.atr_pct,
                    "adx": regime.features.adx,
                    "bb_width": regime.features.bb_width,
                    "ma_slope_short": regime.features.ma_slope_short,
                    "ma_slope_long": regime.features.ma_slope_long,
                    "volatility_std": regime.features.volatility_std,
                },
            }
            
            db["macro_regimes"].update_one(
                {"symbol": regime.symbol, "timestamp": regime.timestamp},
                {"$set": doc},
                upsert=True,
            )
            
            logger.info(
                "Stored regime for %s at %s: %s / %s (confidence: %.2f)",
                regime.symbol,
                regime.timestamp,
                regime.trend_regime.value,
                regime.volatility_regime.value,
                regime.confidence,
            )
    
    def get_latest_regime(self, symbol: str) -> Optional[MarketRegime]:
        """Retrieve the latest regime classification from MongoDB.
        
        Args:
            symbol: Trading pair symbol
            
        Returns:
            MarketRegime or None if not found
        """
        with mongo_client() as client:
            db = client[get_database_name()]
            
            doc = db["macro_regimes"].find_one(
                {"symbol": symbol},
                sort=[("timestamp", -1)],
            )
            
            if not doc:
                return None
            
            features = doc.get("features", {})
            
            return MarketRegime(
                symbol=doc["symbol"],
                timestamp=doc["timestamp"],
                trend_regime=TrendRegime(doc["trend_regime"]),
                volatility_regime=VolatilityRegime(doc["volatility_regime"]),
                confidence=doc["confidence"],
                features=RegimeFeatures(
                    atr=features.get("atr", 0.0),
                    atr_pct=features.get("atr_pct", 0.0),
                    adx=features.get("adx", 0.0),
                    bb_width=features.get("bb_width", 0.0),
                    ma_slope_short=features.get("ma_slope_short", 0.0),
                    ma_slope_long=features.get("ma_slope_long", 0.0),
                    volatility_std=features.get("volatility_std", 0.0),
                ),
            )

