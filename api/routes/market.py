from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union
import asyncio
import json

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect

from db.client import get_database_name, mongo_client

router = APIRouter()


@router.get("/ohlcv")
def get_ohlcv(
    symbol: str = Query(..., description="Trading pair, e.g., BTC/USDT"),
    interval: str = Query(..., description="Timeframe: 1m, 5m, 15m, 1h, 4h, 1d"),
    limit: int = Query(500, ge=1, le=2000, description="Number of candles"),
    start_time: Optional[datetime] = Query(None, description="Start timestamp"),
    end_time: Optional[datetime] = Query(None, description="End timestamp"),
) -> Dict[str, Any]:
    """
    Fetch OHLCV candlestick data for charting.
    
    Returns data in lightweight-charts compatible format.
    """
    print(f"[Market API] OHLCV request - Symbol: {symbol}, Interval: {interval}, Limit: {limit}")
    
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Build query
        query: Dict[str, Any] = {"symbol": symbol, "interval": interval}
        if start_time or end_time:
            query["timestamp"] = {}
            if start_time:
                query["timestamp"]["$gte"] = start_time
            if end_time:
                query["timestamp"]["$lte"] = end_time
        
        print(f"[Market API] MongoDB query: {query}")
        
        # Fetch candles
        cursor = (
            db["ohlcv"]
            .find(query)
            .sort("timestamp", 1)
            .limit(limit)
        )
        
        candles = []
        for doc in cursor:
            candles.append({
                "time": int(doc["timestamp"].timestamp()),
                "open": float(doc["open"]),
                "high": float(doc["high"]),
                "low": float(doc["low"]),
                "close": float(doc["close"]),
                "volume": float(doc["volume"]),
            })
        
        print(f"[Market API] Found {len(candles)} candles for {symbol} {interval}")
        
        if not candles:
            print(f"[Market API] ERROR: No data found for {symbol} {interval}")
            raise HTTPException(
                status_code=404,
                detail=f"No OHLCV data found for {symbol} {interval}"
            )
        
        return {
            "symbol": symbol,
            "interval": interval,
            "candles": candles,
            "count": len(candles),
            "latest": candles[-1]["time"] if candles else None,
        }


@router.get("/latest-price")
def get_latest_price(symbol: str) -> Dict[str, Any]:
    """
    Get the most recent price for a symbol across all intervals.
    Used for real-time price display.
    """
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Get latest 1m candle (most recent data)
        doc = db["ohlcv"].find_one(
            {"symbol": symbol, "interval": "1m"},
            sort=[("timestamp", -1)]
        )
        
        if not doc:
            raise HTTPException(
                status_code=404,
                detail=f"No price data found for {symbol}"
            )
        
        return {
            "symbol": symbol,
            "price": float(doc["close"]),
            "timestamp": doc["timestamp"].isoformat(),
            "open": float(doc["open"]),
            "high": float(doc["high"]),
            "low": float(doc["low"]),
            "volume": float(doc["volume"]),
        }


@router.get("/symbols")
def get_available_symbols() -> Dict[str, Any]:
    """
    Get list of all symbols with available OHLCV data.
    Reuses inventory logic from admin.py.
    """
    print("[Market API] Fetching available symbols...")
    
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Get unique symbols from ohlcv collection
        symbols = db["ohlcv"].distinct("symbol")
        print(f"[Market API] Found {len(symbols)} unique symbols: {symbols}")
        
        # Get intervals available per symbol
        symbol_intervals = {}
        for symbol in symbols:
            intervals = db["ohlcv"].find({"symbol": symbol}).distinct("interval")
            symbol_intervals[symbol] = sorted(intervals)
        
        print(f"[Market API] Symbol intervals: {symbol_intervals}")
        
        return {
            "symbols": sorted(symbols),
            "symbol_intervals": symbol_intervals,
        }


@router.get("/exchange-markets")
def get_exchange_markets(
    quote_currencies: Optional[str] = Query(None, description="Comma-separated quote currencies (e.g., 'USDT,USD,BUSD')")
) -> Dict[str, Any]:
    """
    Get available trading pairs from the configured exchange with logos.
    
    This endpoint fetches real-time market data from the exchange (e.g., Binance)
    and enriches it with logo URLs from CoinGecko.
    
    Returns:
        - symbols: List of available trading pairs
        - markets: Market details (base, quote, active status)
        - logos: Logo URLs for each base currency
        - exchange: Exchange name
    """
    from data_ingest.exchange_utils import get_exchange_markets_with_logos
    
    print("[Market API] Fetching exchange markets...")
    
    try:
        # Parse quote currencies
        quote_list = None
        if quote_currencies:
            quote_list = [q.strip().upper() for q in quote_currencies.split(',') if q.strip()]
        
        # Fetch markets with logos
        result = get_exchange_markets_with_logos(quote_currencies=quote_list)
        
        print(f"[Market API] Found {result['active_markets']} active markets from {result['exchange']}")
        print(f"[Market API] Fetched {len(result.get('logos', {}))} logo URLs")
        
        return result
    
    except Exception as e:
        print(f"[Market API] Error fetching exchange markets: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch exchange markets: {str(e)}"
        )


@router.get("/forecast-chart")
def get_forecast_chart(
    symbol: str = Query(...),
    horizon: str = Query(...),
    forecast_periods: int = Query(20, ge=1, le=100),
) -> Dict[str, Any]:
    """
    Get forecast data formatted for chart overlay.
    Returns predicted prices as time series.
    """
    from models.ensemble import ensemble_predict, EnsembleError
    
    try:
        # Get current prediction
        result = ensemble_predict(symbol, horizon, datetime.utcnow())
        
        # Get latest price from OHLCV
        with mongo_client() as client:
            db = client[get_database_name()]
            latest_doc = db["ohlcv"].find_one(
                {"symbol": symbol, "interval": horizon},
                sort=[("timestamp", -1)]
            )
            
            if not latest_doc:
                raise HTTPException(404, f"No data for {symbol} {horizon}")
            
            current_price = float(latest_doc["close"])
            current_time = int(latest_doc["timestamp"].timestamp())
            
            # Calculate predicted price
            predicted_return = result["predicted_return"]
            predicted_price = current_price * (1 + predicted_return)
            
            # Generate forecast line
            # Parse interval to get time delta
            interval_map = {
                "1m": timedelta(minutes=1),
                "5m": timedelta(minutes=5),
                "15m": timedelta(minutes=15),
                "1h": timedelta(hours=1),
                "4h": timedelta(hours=4),
                "1d": timedelta(days=1),
            }
            delta = interval_map.get(horizon, timedelta(hours=1))
            
            # Create forecast points (linear interpolation for now)
            forecast_points = []
            for i in range(forecast_periods):
                t = current_time + int((delta * (i + 1)).total_seconds())
                # Linear interpolation from current to predicted
                progress = (i + 1) / forecast_periods
                price = current_price + (predicted_price - current_price) * progress
                forecast_points.append({
                    "time": t,
                    "value": price,
                })
            
            return {
                "symbol": symbol,
                "horizon": horizon,
                "current_price": current_price,
                "predicted_price": predicted_price,
                "predicted_return": predicted_return,
                "confidence": result["confidence"],
                "forecast_points": forecast_points,
                "models": result["models"],
            }
    
    except EnsembleError as exc:
        raise HTTPException(404, str(exc))


async def websocket_prices(websocket: WebSocket, symbol: str):
    """
    WebSocket endpoint for real-time price updates.
    Streams latest candle data for a symbol.
    """
    await websocket.accept()
    
    try:
        while True:
            # Fetch latest price
            with mongo_client() as client:
                db = client[get_database_name()]
                doc = db["ohlcv"].find_one(
                    {"symbol": symbol, "interval": "1m"},
                    sort=[("timestamp", -1)]
                )
                
                if doc:
                    data = {
                        "symbol": symbol,
                        "price": float(doc["close"]),
                        "timestamp": doc["timestamp"].isoformat(),
                        "open": float(doc["open"]),
                        "high": float(doc["high"]),
                        "low": float(doc["low"]),
                        "volume": float(doc["volume"]),
                    }
                    await websocket.send_json(data)
            
            # Wait before next update
            await asyncio.sleep(5)  # Update every 5 seconds
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
