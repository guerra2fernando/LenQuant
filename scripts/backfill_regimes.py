#!/usr/bin/env python3
"""Backfill historical regime classifications for all symbols.

This script processes historical OHLCV data and generates regime classifications
for each candle, storing them in the macro_regimes collection.

Usage:
    python scripts/backfill_regimes.py --symbols BTC/USDT,ETH/USDT --interval 1h --limit 1000
    python scripts/backfill_regimes.py --all-symbols --interval 1h  # Process all symbols in DB
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import datetime
from typing import List, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.client import get_database_name, get_ohlcv_df, mongo_client
from macro.regime import RegimeDetector

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def get_all_symbols() -> List[str]:
    """Get all unique symbols from the ohlcv collection."""
    with mongo_client() as client:
        db = client[get_database_name()]
        symbols = db["ohlcv"].distinct("symbol")
    return sorted(symbols)


def backfill_symbol(
    symbol: str,
    interval: str,
    limit: Optional[int] = None,
    force: bool = False,
) -> int:
    """Backfill regime classifications for a single symbol.
    
    Args:
        symbol: Trading pair symbol (e.g., 'BTC/USDT')
        interval: Timeframe (e.g., '1h', '1d')
        limit: Maximum number of candles to process (None = all)
        force: If True, overwrite existing regime classifications
        
    Returns:
        Number of regimes stored
    """
    logger.info("Starting backfill for %s %s (limit=%s, force=%s)", symbol, interval, limit, force)
    
    # Fetch OHLCV data
    df = get_ohlcv_df(symbol, interval, limit=limit)
    
    if df.empty:
        logger.warning("No OHLCV data found for %s %s", symbol, interval)
        return 0
    
    logger.info("Found %d candles for %s %s", len(df), symbol, interval)
    
    # Initialize detector
    detector = RegimeDetector()
    
    # Compute features for all candles
    logger.info("Computing regime features...")
    df = detector.compute_features(df)
    
    # Check which timestamps already have regimes (unless force=True)
    existing_timestamps = set()
    if not force:
        with mongo_client() as client:
            db = client[get_database_name()]
            existing_docs = db["macro_regimes"].find(
                {"symbol": symbol},
                {"timestamp": 1}
            )
            existing_timestamps = {doc["timestamp"] for doc in existing_docs}
        
        if existing_timestamps:
            logger.info("Found %d existing regime records (will skip unless --force)", len(existing_timestamps))
    
    # Process each candle
    count = 0
    skipped = 0
    errors = 0
    
    for idx, (timestamp, row) in enumerate(df.iterrows()):
        # Skip if already processed (unless force=True)
        if not force and timestamp in existing_timestamps:
            skipped += 1
            continue
        
        try:
            # Check for NaN values in critical features
            if any(pd.isna(row[col]) for col in ["atr", "adx", "volatility_std"]):
                # Skip rows with insufficient data (usually at the beginning)
                continue
            
            # Extract features
            from macro.regime import RegimeFeatures
            
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
            trend_regime, trend_confidence = detector.detect_trend_regime(features)
            
            # Get historical volatility for better classification
            historical_vol = df["volatility_std"].iloc[:idx] if idx > 0 else None
            volatility_regime, vol_confidence = detector.detect_volatility_regime(features, historical_vol)
            
            # Overall confidence
            overall_confidence = (trend_confidence + vol_confidence) / 2.0
            
            # Create regime object
            from macro.regime import MarketRegime
            
            regime = MarketRegime(
                symbol=symbol,
                timestamp=timestamp,
                trend_regime=trend_regime,
                volatility_regime=volatility_regime,
                confidence=overall_confidence,
                features=features,
            )
            
            # Store in database
            detector.store_regime(regime)
            count += 1
            
            # Progress logging
            if count % 100 == 0:
                logger.info("Processed %d/%d candles...", idx + 1, len(df))
        
        except Exception as exc:
            errors += 1
            logger.error("Error processing candle at %s: %s", timestamp, exc)
            if errors > 10:
                logger.error("Too many errors, aborting backfill for %s", symbol)
                break
    
    logger.info(
        "Backfill complete for %s %s: stored=%d, skipped=%d, errors=%d",
        symbol, interval, count, skipped, errors
    )
    
    return count


def main():
    """Main entry point for backfill script."""
    parser = argparse.ArgumentParser(
        description="Backfill historical regime classifications",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    
    parser.add_argument(
        "--symbols",
        type=str,
        help="Comma-separated list of symbols (e.g., 'BTC/USDT,ETH/USDT')",
    )
    
    parser.add_argument(
        "--all-symbols",
        action="store_true",
        help="Process all symbols found in the database",
    )
    
    parser.add_argument(
        "--interval",
        type=str,
        default="1h",
        help="Timeframe for regime detection (default: 1h)",
    )
    
    parser.add_argument(
        "--limit",
        type=int,
        help="Maximum number of candles to process per symbol (default: all)",
    )
    
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing regime classifications",
    )
    
    args = parser.parse_args()
    
    # Determine which symbols to process
    if args.all_symbols:
        symbols = get_all_symbols()
        logger.info("Processing all symbols from database: %s", symbols)
    elif args.symbols:
        symbols = [s.strip() for s in args.symbols.split(",") if s.strip()]
    else:
        logger.error("Must specify either --symbols or --all-symbols")
        sys.exit(1)
    
    if not symbols:
        logger.error("No symbols to process")
        sys.exit(1)
    
    # Process each symbol
    total_stored = 0
    start_time = datetime.utcnow()
    
    for idx, symbol in enumerate(symbols, 1):
        logger.info("Processing symbol %d/%d: %s", idx, len(symbols), symbol)
        
        try:
            count = backfill_symbol(
                symbol=symbol,
                interval=args.interval,
                limit=args.limit,
                force=args.force,
            )
            total_stored += count
        
        except Exception as exc:
            logger.error("Failed to backfill %s: %s", symbol, exc, exc_info=True)
    
    # Summary
    elapsed = (datetime.utcnow() - start_time).total_seconds()
    logger.info(
        "Backfill complete! Processed %d symbols, stored %d regimes in %.1f seconds",
        len(symbols),
        total_stored,
        elapsed,
    )


if __name__ == "__main__":
    import pandas as pd  # Import here to avoid issues in module scope
    main()

