#!/usr/bin/env python3
"""
Quick check of database candle freshness.
Simple version that only checks MongoDB, doesn't test exchange API.
"""
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from db.client import mongo_client, get_database_name
except ImportError:
    print("ERROR: Could not import db.client")
    print("Make sure you're in the LenQuant directory and MongoDB is configured")
    sys.exit(1)


def main():
    print("\n" + "="*80)
    print("DATABASE CANDLE FRESHNESS CHECK")
    print("="*80)
    print(f"Current UTC time: {datetime.utcnow()}")
    print()
    
    try:
        with mongo_client() as client:
            db = client[get_database_name()]
            
            # Get all symbols
            symbols = list(db["symbols"].find({}))
            
            if not symbols:
                print("[ERROR] No symbols found in database!")
                print("\nTo fix:")
                print("  1. Go to UI: http://localhost:3000/get-started")
                print("  2. Or run: python -m data_ingest.fetcher --symbol BTC/USDT --interval 1m --lookback-days 30")
                return
            
            stale_found = False
            total_intervals = 0
            fresh_intervals = 0
            aging_intervals = 0
            stale_intervals = 0
            
            for symbol_doc in symbols:
                symbol = symbol_doc["symbol"]
                enabled = symbol_doc.get("enabled", True)
                intervals_status = symbol_doc.get("intervals_status", {})
                
                if not intervals_status:
                    continue
                
                print(f"\n{symbol} {'(enabled)' if enabled else '(disabled)'}:")
                print("-" * 60)
                
                for interval in intervals_status.keys():
                    total_intervals += 1
                    
                    # Get actual newest candle from OHLCV collection
                    newest_candle = db["ohlcv"].find_one(
                        {"symbol": symbol, "interval": interval},
                        sort=[("timestamp", -1)]
                    )
                    
                    if newest_candle:
                        newest_ts = newest_candle["timestamp"]
                        age_seconds = (datetime.utcnow() - newest_ts).total_seconds()
                        age_hours = age_seconds / 3600
                        age_days = age_hours / 24
                        
                        # Categorize freshness
                        if age_hours <= 2:
                            status = "[OK] Fresh"
                            fresh_intervals += 1
                        elif age_hours <= 24:
                            status = "[WARN] Aging"
                            aging_intervals += 1
                        else:
                            status = "[ERROR] Stale"
                            stale_intervals += 1
                            stale_found = True
                        
                        # Get record count
                        count = db["ohlcv"].count_documents({"symbol": symbol, "interval": interval})
                        
                        print(f"  {interval:6s}: {status:12s} | Latest: {newest_ts} ({age_days:.1f}d old, {age_hours:.1f}h) | {count:,} records")
                    else:
                        print(f"  {interval:6s}: ❌ No data   | No candles in database")
                        stale_intervals += 1
                        total_intervals += 1
            
            print("\n" + "="*80)
            print("SUMMARY")
            print("="*80)
            print(f"Total intervals checked: {total_intervals}")
            print(f"  [OK] Fresh (< 2h):     {fresh_intervals}")
            print(f"  [WARN] Aging (2-24h):  {aging_intervals}")
            print(f"  [ERROR] Stale (> 24h): {stale_intervals}")
            print()
            
            if stale_found or stale_intervals > 0:
                print("="*80)
                print("⚠️  STALE DATA FOUND - RECOMMENDED ACTIONS")
                print("="*80)
                print()
                print("Option 1: Use the UI (Easiest)")
                print("  1. Go to: http://localhost:3000/settings")
                print("  2. Click 'Data Management' tab")
                print("  3. Click 'Refresh All' button")
                print()
                print("Option 2: Use Command Line")
                print("  # Activate virtual environment first:")
                print("  .venv\\Scripts\\activate  # Windows")
                print("  source .venv/bin/activate  # Linux/Mac")
                print()
                print("  # Then fetch data:")
                print("  python -m data_ingest.fetcher --symbol BTC/USDT --interval 1m --lookback-days 30")
                print("  python -m data_ingest.fetcher --symbol BTC/USDT --interval 1h --lookback-days 90")
                print()
                print("Option 3: Check if Celery workers are running")
                print("  # Celery should auto-refresh data hourly")
                print("  celery -A celery_config inspect active")
                print()
                print("  # If not running, start them:")
                print("  celery -A celery_config worker -Q data,features,default -l info")
                print("  celery -A celery_config beat -l info")
                print()
            else:
                print("✅ All data is fresh! No action needed.")
            
    except Exception as e:
        print(f"\n❌ Error connecting to database: {e}")
        print("\nPossible issues:")
        print("  1. MongoDB not running")
        print("  2. Wrong MONGO_URI in .env")
        print("  3. Database not initialized")
        print("\nTo fix:")
        print("  # Check MongoDB is running:")
        print("  mongosh  # Should connect successfully")
        print()
        print("  # Check .env has correct MONGO_URI:")
        print("  cat .env | grep MONGO_URI")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()

