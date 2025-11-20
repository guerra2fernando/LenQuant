#!/usr/bin/env python3
"""
Diagnose why OHLCV data is stale.

This script checks:
1. What's the newest candle in the database for each symbol/interval
2. What's the current time (UTC)
3. How many days gap there is
4. What the exchange currently returns
"""
from __future__ import annotations

import logging
import sys
from datetime import datetime, timedelta

try:
    import ccxt
except ImportError:
    print("ERROR: ccxt module not found. Please install dependencies:")
    print("  pip install -r requirements.txt")
    print("\nOr if using a virtual environment:")
    print("  .venv\\Scripts\\activate  (Windows)")
    print("  source .venv/bin/activate  (Linux/Mac)")
    print("  pip install -r requirements.txt")
    sys.exit(1)

try:
    from db.client import mongo_client, get_database_name
except ImportError:
    print("ERROR: Could not import db.client. Make sure you're running from the LenQuant directory.")
    print("  cd LenQuant")
    print("  python scripts/diagnose_stale_data.py")
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def main():
    # Check database
    with mongo_client() as client:
        db = client[get_database_name()]
        
        print("\n" + "="*80)
        print("DATABASE CANDLE FRESHNESS CHECK")
        print("="*80)
        print(f"Current UTC time: {datetime.utcnow()}")
        print()
        
        # Get all symbols
        symbols = db["symbols"].find({})
        
        for symbol_doc in symbols:
            symbol = symbol_doc["symbol"]
            intervals_status = symbol_doc.get("intervals_status", {})
            
            print(f"\n{symbol}:")
            print("-" * 60)
            
            for interval, status in intervals_status.items():
                # Get actual newest candle from OHLCV collection
                newest_candle = db["ohlcv"].find_one(
                    {"symbol": symbol, "interval": interval},
                    sort=[("timestamp", -1)]
                )
                
                if newest_candle:
                    newest_ts = newest_candle["timestamp"]
                    age_hours = (datetime.utcnow() - newest_ts).total_seconds() / 3600
                    age_days = age_hours / 24
                    
                    print(f"  {interval:6s}: Newest candle = {newest_ts} ({age_days:.1f} days old, {age_hours:.1f}h)")
                    
                    # Get record count
                    count = db["ohlcv"].count_documents({"symbol": symbol, "interval": interval})
                    print(f"          Record count = {count:,}")
                    
                    # Check if status matches reality
                    status_updated = status.get("last_updated")
                    if status_updated:
                        print(f"          Status last_updated = {status_updated}")
                        if isinstance(status_updated, datetime):
                            status_age = (datetime.utcnow() - status_updated).total_seconds() / 3600
                            print(f"          Status age = {status_age:.1f}h")
                    
                    # Warn if very stale
                    if age_days > 1:
                        print(f"          ⚠️  WARNING: Data is {age_days:.1f} days old!")
                else:
                    print(f"  {interval:6s}: No candles found in database")
        
        print("\n" + "="*80)
        print("EXCHANGE API CHECK")
        print("="*80)
        
        # Try fetching from exchange
        try:
            exchange = ccxt.binance({"enableRateLimit": True})
            test_symbols = ["BTC/USD", "BTC/USDT"]
            test_intervals = ["1m", "1h", "1d"]
            
            for symbol in test_symbols:
                print(f"\n{symbol}:")
                print("-" * 60)
                
                for interval in test_intervals:
                    try:
                        # Fetch last 5 candles
                        candles = exchange.fetch_ohlcv(symbol, timeframe=interval, limit=5)
                        
                        if candles:
                            # Last candle timestamp
                            last_candle_ms = candles[-1][0]
                            last_candle_ts = datetime.utcfromtimestamp(last_candle_ms / 1000)
                            age_minutes = (datetime.utcnow() - last_candle_ts).total_seconds() / 60
                            
                            print(f"  {interval:6s}: Latest from exchange = {last_candle_ts} ({age_minutes:.1f}m ago)")
                            print(f"          Fetched {len(candles)} candles successfully")
                        else:
                            print(f"  {interval:6s}: No candles returned from exchange")
                    except Exception as e:
                        print(f"  {interval:6s}: ❌ Error fetching: {e}")
                        
        except Exception as e:
            logger.error(f"Failed to connect to exchange: {e}")
            print(f"\n❌ Could not connect to Binance: {e}")
        
        print("\n" + "="*80)
        print("RECOMMENDATIONS")
        print("="*80)
        print()
        
        # Check for stale data and provide recommendations
        stale_found = False
        with mongo_client() as client:
            db = client[get_database_name()]
            for symbol_doc in db["symbols"].find({}):
                symbol = symbol_doc["symbol"]
                for interval in symbol_doc.get("intervals_status", {}).keys():
                    newest = db["ohlcv"].find_one(
                        {"symbol": symbol, "interval": interval},
                        sort=[("timestamp", -1)]
                    )
                    if newest:
                        age_days = (datetime.utcnow() - newest["timestamp"]).total_seconds() / 86400
                        if age_days > 1:
                            stale_found = True
                            print(f"⚠️  {symbol} {interval} is {age_days:.1f} days old")
        
        if stale_found:
            print("\n📋 TO FIX STALE DATA:")
            print("   1. Go to Settings > Data Management")
            print("   2. Click 'Refresh All' to fetch recent data")
            print("   3. Or use CLI: python -m data_ingest.fetcher --symbol BTC/USD --interval 1m --lookback-days 30")
            print()
            print("⚠️  If scheduled tasks aren't running:")
            print("   - Check Celery worker is running: celery -A celery_config worker -Q data")
            print("   - Check Celery beat is running: celery -A celery_config beat")
            print("   - Check Redis is running: redis-cli ping")
        else:
            print("✅ All data is fresh (< 24 hours old)")


if __name__ == "__main__":
    main()

