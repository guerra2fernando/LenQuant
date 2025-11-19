"""Macro analysis API endpoints for regime detection, sentiment, and market structure."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from macro.regime import RegimeDetector, TrendRegime, VolatilityRegime

router = APIRouter()
logger = logging.getLogger(__name__)


class RegimeResponse(BaseModel):
    """Response model for regime detection endpoint."""
    symbol: str
    timestamp: str
    trend_regime: str
    volatility_regime: str
    confidence: float
    features: Dict[str, float]


@router.get("/regime")
def get_regime(
    symbol: str = Query(..., description="Trading pair symbol (e.g., 'BTC/USDT')"),
    interval: str = Query("1h", description="Timeframe for regime detection"),
    timestamp: Optional[datetime] = Query(None, description="Optional timestamp for historical regime"),
) -> RegimeResponse:
    """Get current or historical market regime for a symbol.
    
    Args:
        symbol: Trading pair symbol (e.g., 'BTC/USDT')
        interval: Timeframe (default '1h')
        timestamp: Optional timestamp for historical regime detection
        
    Returns:
        RegimeResponse with trend regime, volatility regime, and confidence
        
    Example:
        GET /api/macro/regime?symbol=BTC/USDT&interval=1h
    """
    try:
        detector = RegimeDetector()
        
        # Try to get from cache first
        if timestamp is None:
            cached_regime = detector.get_latest_regime(symbol)
            if cached_regime:
                # Check if cached regime is recent (within 1 hour)
                age_seconds = (datetime.utcnow() - cached_regime.timestamp).total_seconds()
                if age_seconds < 3600:  # 1 hour
                    return RegimeResponse(
                        symbol=cached_regime.symbol,
                        timestamp=cached_regime.timestamp.isoformat(),
                        trend_regime=cached_regime.trend_regime.value,
                        volatility_regime=cached_regime.volatility_regime.value,
                        confidence=cached_regime.confidence,
                        features={
                            "atr": cached_regime.features.atr,
                            "atr_pct": cached_regime.features.atr_pct,
                            "adx": cached_regime.features.adx,
                            "bb_width": cached_regime.features.bb_width,
                            "ma_slope_short": cached_regime.features.ma_slope_short,
                            "ma_slope_long": cached_regime.features.ma_slope_long,
                            "volatility_std": cached_regime.features.volatility_std,
                        },
                    )
        
        # Classify regime
        regime = detector.classify_market_state(symbol, interval, timestamp)
        
        # Store for future queries
        if timestamp is None:  # Only cache real-time queries
            detector.store_regime(regime)
        
        return RegimeResponse(
            symbol=regime.symbol,
            timestamp=regime.timestamp.isoformat(),
            trend_regime=regime.trend_regime.value,
            volatility_regime=regime.volatility_regime.value,
            confidence=regime.confidence,
            features={
                "atr": regime.features.atr,
                "atr_pct": regime.features.atr_pct,
                "adx": regime.features.adx,
                "bb_width": regime.features.bb_width,
                "ma_slope_short": regime.features.ma_slope_short,
                "ma_slope_long": regime.features.ma_slope_long,
                "volatility_std": regime.features.volatility_std,
            },
        )
    
    except Exception as exc:
        logger.error("Error detecting regime for %s: %s", symbol, exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to detect regime for {symbol}: {str(exc)}"
        ) from exc


@router.get("/regimes/batch")
def get_regimes_batch(
    symbols: str = Query(..., description="Comma-separated symbol list"),
    interval: str = Query("1h", description="Timeframe for regime detection"),
) -> Dict[str, Any]:
    """Get current market regimes for multiple symbols.
    
    Args:
        symbols: Comma-separated list of symbols (e.g., 'BTC/USDT,ETH/USDT')
        interval: Timeframe (default '1h')
        
    Returns:
        Dictionary with regimes list
        
    Example:
        GET /api/macro/regimes/batch?symbols=BTC/USDT,ETH/USDT&interval=1h
    """
    detector = RegimeDetector()
    results = []
    
    for raw_symbol in symbols.split(","):
        symbol = raw_symbol.strip()
        if not symbol:
            continue
        
        try:
            # Check cache first
            cached_regime = detector.get_latest_regime(symbol)
            if cached_regime:
                age_seconds = (datetime.utcnow() - cached_regime.timestamp).total_seconds()
                if age_seconds < 3600:  # Use cached if less than 1 hour old
                    results.append({
                        "symbol": cached_regime.symbol,
                        "timestamp": cached_regime.timestamp.isoformat(),
                        "trend_regime": cached_regime.trend_regime.value,
                        "volatility_regime": cached_regime.volatility_regime.value,
                        "confidence": cached_regime.confidence,
                    })
                    continue
            
            # Compute fresh regime
            regime = detector.classify_market_state(symbol, interval)
            detector.store_regime(regime)
            
            results.append({
                "symbol": regime.symbol,
                "timestamp": regime.timestamp.isoformat(),
                "trend_regime": regime.trend_regime.value,
                "volatility_regime": regime.volatility_regime.value,
                "confidence": regime.confidence,
            })
        
        except Exception as exc:
            logger.warning("Failed to get regime for %s: %s", symbol, exc)
            results.append({
                "symbol": symbol,
                "error": str(exc),
            })
    
    return {"regimes": results}


@router.get("/regimes/history/{symbol}")
def get_regime_history(
    symbol: str,
    limit: int = Query(100, description="Number of historical regimes to return"),
) -> Dict[str, Any]:
    """Get historical regime transitions for a symbol.
    
    Args:
        symbol: Trading pair symbol
        limit: Maximum number of historical records (default 100)
        
    Returns:
        Dictionary with historical regimes list
        
    Example:
        GET /api/macro/regimes/history/BTC/USDT?limit=50
    """
    from db.client import mongo_client, get_database_name
    
    try:
        with mongo_client() as client:
            db = client[get_database_name()]
            
            cursor = db["macro_regimes"].find(
                {"symbol": symbol}
            ).sort("timestamp", -1).limit(limit)
            
            regimes = []
            for doc in cursor:
                regimes.append({
                    "symbol": doc["symbol"],
                    "timestamp": doc["timestamp"].isoformat(),
                    "trend_regime": doc["trend_regime"],
                    "volatility_regime": doc["volatility_regime"],
                    "confidence": doc["confidence"],
                    "features": doc.get("features", {}),
                })
            
            return {
                "symbol": symbol,
                "count": len(regimes),
                "regimes": regimes,
            }
    
    except Exception as exc:
        logger.error("Error fetching regime history for %s: %s", symbol, exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch regime history: {str(exc)}"
        ) from exc

