"""Indicator utilities built on top of pandas operations."""
from __future__ import annotations

import logging

import pandas as pd

logger = logging.getLogger(__name__)


def add_basic_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["return_1"] = df["close"].pct_change()
    df["ema_9"] = df["close"].ewm(span=9, adjust=False).mean()
    df["ema_21"] = df["close"].ewm(span=21, adjust=False).mean()

    delta = df["close"].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / 14, adjust=False, min_periods=14).mean()
    avg_loss = loss.ewm(alpha=1 / 14, adjust=False, min_periods=14).mean()
    rs = avg_gain / avg_loss
    df["rsi_14"] = 100 - (100 / (1 + rs))

    ema12 = df["close"].ewm(span=12, adjust=False).mean()
    ema26 = df["close"].ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    df["macd"] = macd_line
    df["macd_signal"] = signal_line
    df["macd_hist"] = macd_line - signal_line

    df["volatility_1h"] = df["close"].pct_change().rolling(60).std()
    return df


def add_regime_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add regime-specific indicators to the dataframe.
    
    Adds:
    - regime_stability: Measures how stable the regime has been (0-1)
    - regime_change_flag: Binary flag indicating recent regime change
    
    Args:
        df: Dataframe with regime columns (regime_trend, regime_volatility, regime_duration_bars)
    
    Returns:
        Dataframe with added regime indicators
    """
    if df.empty:
        return df
    
    df = df.copy()
    
    # Check if regime columns exist
    if "regime_duration_bars" not in df.columns:
        logger.warning("Missing regime_duration_bars column, skipping regime indicators")
        return df
    
    # regime_stability: Based on regime duration and confidence
    # Ranges from 0 (unstable, frequent changes) to 1 (stable, long duration)
    # Uses sigmoid-like function: stability = 1 - exp(-duration/scale)
    stability_scale = 20.0  # Bars needed to reach ~63% stability
    df["regime_stability"] = 1.0 - pd.np.exp(-df["regime_duration_bars"] / stability_scale)
    
    # Boost stability by confidence if available
    if "regime_confidence" in df.columns:
        df["regime_stability"] = df["regime_stability"] * df["regime_confidence"]
    
    # regime_change_flag: 1 if regime changed in last N bars, 0 otherwise
    lookback_bars = 5  # Flag recent regime changes in last 5 bars
    df["regime_change_flag"] = (df["regime_duration_bars"] < lookback_bars).astype(int)
    
    return df


def clean_feature_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Clean and select feature columns for model training.
    
    Drops NaN values and selects relevant feature columns including:
    - Technical indicators
    - Regime features (if present)
    
    Args:
        df: Raw feature dataframe
    
    Returns:
        Cleaned dataframe with selected features
    """
    df = df.dropna()
    
    # Base technical features
    feature_cols = [
        "return_1",
        "ema_9",
        "ema_21",
        "rsi_14",
        "macd",
        "macd_signal",
        "macd_hist",
        "volatility_1h",
    ]
    
    # Add regime features if present
    regime_cols = [
        "regime_trend",
        "regime_volatility",
        "regime_confidence",
        "regime_duration_bars",
        "regime_stability",
        "regime_change_flag",
    ]
    
    # Only include regime columns that exist in dataframe
    for col in regime_cols:
        if col in df.columns:
            feature_cols.append(col)
    
    # Filter to available columns
    available_cols = [col for col in feature_cols if col in df.columns]
    
    return df[available_cols]

