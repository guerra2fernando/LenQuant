"""Feature generation routines."""
from __future__ import annotations

import logging
from typing import Optional

import pandas as pd

from db.client import get_ohlcv_df, write_features, mongo_client, get_database_name
from features.indicators import add_basic_indicators, add_regime_indicators, clean_feature_frame

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def _enrich_with_regime(df: pd.DataFrame, symbol: str, interval: str) -> pd.DataFrame:
    """Enrich feature dataframe with regime data from macro.regimes collection.
    
    Adds regime columns: regime_trend, regime_volatility, regime_confidence, regime_duration_bars.
    Handles missing regime data gracefully by filling with default values.
    
    Args:
        df: Feature dataframe with timestamp index
        symbol: Trading pair symbol
        interval: Time interval
    
    Returns:
        Dataframe with added regime columns
    """
    if df.empty:
        return df
    
    df = df.copy()
    
    try:
        with mongo_client() as client:
            db = client[get_database_name()]
            
            # Query regime data for this symbol and interval
            regime_docs = list(
                db["macro_regimes"]
                .find({"symbol": symbol, "interval": interval})
                .sort("timestamp", 1)
            )
            
            if not regime_docs:
                logger.debug("No regime data found for %s %s, using default values", symbol, interval)
                df["regime_trend"] = "UNDEFINED"
                df["regime_volatility"] = "UNDEFINED"
                df["regime_confidence"] = 0.0
                df["regime_duration_bars"] = 0
                return df
            
            # Build regime dataframe
            regime_data = []
            for doc in regime_docs:
                regime_data.append({
                    "timestamp": doc["timestamp"],
                    "regime_trend": doc.get("trend_regime", "UNDEFINED"),
                    "regime_volatility": doc.get("volatility_regime", "UNDEFINED"),
                    "regime_confidence": doc.get("confidence", 0.0),
                })
            
            regime_df = pd.DataFrame(regime_data)
            regime_df.set_index("timestamp", inplace=True)
            
            # Merge with forward fill to propagate regime labels to all bars
            df = df.join(regime_df, how="left")
            df["regime_trend"] = df["regime_trend"].fillna("UNDEFINED")
            df["regime_volatility"] = df["regime_volatility"].fillna("UNDEFINED")
            df["regime_confidence"] = df["regime_confidence"].fillna(0.0)
            
            # Calculate regime duration (how many bars in current regime)
            # Duration resets when regime changes
            df["regime_duration_bars"] = 0
            regime_change = (df["regime_trend"].shift(1) != df["regime_trend"]) | \
                          (df["regime_volatility"].shift(1) != df["regime_volatility"])
            
            # Create groups based on regime changes
            regime_groups = regime_change.cumsum()
            df["regime_duration_bars"] = df.groupby(regime_groups).cumcount()
            
            logger.debug("Enriched %d rows with regime data for %s %s", len(df), symbol, interval)
            
    except Exception as exc:
        logger.warning("Failed to enrich with regime data for %s %s: %s", symbol, interval, exc)
        # Add default columns on error
        df["regime_trend"] = "UNDEFINED"
        df["regime_volatility"] = "UNDEFINED"
        df["regime_confidence"] = 0.0
        df["regime_duration_bars"] = 0
    
    return df


def generate_for_symbol(symbol: str, interval: str, limit: Optional[int] = None, *, enable_regime: bool = True) -> int:
    """Generate features for a symbol including technical indicators and optional regime data.
    
    Args:
        symbol: Trading pair symbol
        interval: Time interval
        limit: Maximum number of candles to process
        enable_regime: Whether to enrich features with regime data (default: True)
    
    Returns:
        Number of feature rows written
    """
    df = get_ohlcv_df(symbol, interval, limit=limit)
    if df.empty:
        logger.warning("No OHLCV data for %s %s. Skipping.", symbol, interval)
        return 0

    # Add technical indicators
    df = add_basic_indicators(df)
    
    # Enrich with regime data if enabled
    if enable_regime:
        df = _enrich_with_regime(df, symbol, interval)
        df = add_regime_indicators(df)
    
    clean_df = clean_feature_frame(df)
    count = 0
    for ts, row in clean_df.iterrows():
        write_features(symbol, interval, ts, row.to_dict())
        count += 1
    logger.info("Wrote %s feature rows for %s %s", count, symbol, interval)
    return count


def generate_bulk(symbols: list[str], intervals: list[str]) -> int:
    total = 0
    for symbol in symbols:
        for interval in intervals:
            total += generate_for_symbol(symbol, interval)
    return total


if __name__ == "__main__":
    import os

    symbols = os.getenv("DEFAULT_SYMBOLS", "BTC/USD").split(",")
    intervals = os.getenv("FEATURE_INTERVALS", "1m").split(",")
    count = generate_bulk([s.strip() for s in symbols if s.strip()], [i.strip() for i in intervals if i.strip()])
    logger.info("Generated %s feature rows total", count)

