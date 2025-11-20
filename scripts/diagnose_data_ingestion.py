"""Diagnostic script to check data ingestion system health."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db.client import get_database_name, mongo_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def diagnose():
    """Run comprehensive diagnostics on data ingestion system."""
    print("\n" + "="*60)
    print("🔍 DATA INGESTION SYSTEM DIAGNOSTICS")
    print("="*60 + "\n")
    
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # 1. Check Symbols
        print("📊 SYMBOLS CHECK")
        print("-" * 40)
        total_symbols = db["symbols"].count_documents({})
        enabled_symbols = db["symbols"].count_documents({"enabled": True})
        disabled_symbols = total_symbols - enabled_symbols
        
        print(f"  Total symbols: {total_symbols}")
        print(f"  ✅ Enabled: {enabled_symbols}")
        print(f"  ❌ Disabled: {disabled_symbols}")
        
        if disabled_symbols > 0:
            print(f"  ⚠️  WARNING: {disabled_symbols} symbols are disabled!")
            print(f"     Run: python scripts/fix_symbols_enabled.py")
        
        # Show symbol list
        symbols = list(db["symbols"].find({}, {"symbol": 1, "enabled": 1, "_id": 0}))
        for sym in symbols[:10]:  # Show first 10
            status = "✅" if sym.get("enabled") else "❌"
            print(f"    {status} {sym['symbol']}")
        if len(symbols) > 10:
            print(f"    ... and {len(symbols) - 10} more")
        
        print()
        
        # 2. Check OHLCV Data
        print("💹 OHLCV DATA CHECK")
        print("-" * 40)
        ohlcv_count = db["ohlcv"].count_documents({})
        print(f"  Total OHLCV records: {ohlcv_count:,}")
        
        # Group by symbol
        ohlcv_by_symbol = list(db["ohlcv"].aggregate([
            {"$group": {
                "_id": "$symbol",
                "count": {"$sum": 1},
                "intervals": {"$addToSet": "$interval"}
            }},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]))
        
        for item in ohlcv_by_symbol:
            print(f"    {item['_id']}: {item['count']:,} records across {len(item['intervals'])} intervals")
        
        print()
        
        # 3. Check Features
        print("🧮 FEATURES CHECK")
        print("-" * 40)
        features_count = db["features"].count_documents({})
        print(f"  Total feature records: {features_count:,}")
        
        # Group by symbol
        features_by_symbol = list(db["features"].aggregate([
            {"$group": {
                "_id": "$symbol",
                "count": {"$sum": 1},
                "intervals": {"$addToSet": "$interval"}
            }},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]))
        
        for item in features_by_symbol:
            print(f"    {item['_id']}: {item['count']:,} records across {len(item['intervals'])} intervals")
        
        # Check for missing features
        print("\n  🔍 Checking for OHLCV without features...")
        missing_features = []
        for ohlcv_item in ohlcv_by_symbol[:5]:  # Check top 5
            symbol = ohlcv_item['_id']
            for interval in ohlcv_item['intervals']:
                ohlcv_cnt = db["ohlcv"].count_documents({"symbol": symbol, "interval": interval})
                features_cnt = db["features"].count_documents({"symbol": symbol, "interval": interval})
                if ohlcv_cnt > 0 and features_cnt == 0:
                    missing_features.append(f"{symbol} {interval}")
        
        if missing_features:
            print(f"  ⚠️  WARNING: {len(missing_features)} symbol/intervals have OHLCV but NO features:")
            for mf in missing_features[:5]:
                print(f"      ❌ {mf}")
            if len(missing_features) > 5:
                print(f"      ... and {len(missing_features) - 5} more")
        else:
            print(f"  ✅ All symbol/intervals with OHLCV have features")
        
        print()
        
        # 4. Check Ingestion Jobs
        print("📋 INGESTION JOBS CHECK")
        print("-" * 40)
        total_jobs = db["ingestion_jobs"].count_documents({})
        print(f"  Total jobs: {total_jobs}")
        
        # Count by status
        for status in ["pending", "queued", "in_progress", "completed", "failed"]:
            count = db["ingestion_jobs"].count_documents({"status": status})
            if count > 0:
                emoji = "✅" if status == "completed" else "❌" if status == "failed" else "⟳"
                print(f"    {emoji} {status}: {count}")
        
        # Check recent jobs (last 24 hours)
        yesterday = datetime.utcnow() - timedelta(hours=24)
        recent_jobs = db["ingestion_jobs"].count_documents({
            "created_at": {"$gte": yesterday}
        })
        print(f"\n  Last 24 hours: {recent_jobs} jobs")
        
        # Check failed jobs
        failed_jobs = list(db["ingestion_jobs"].find(
            {"status": "failed"},
            {"job_id": 1, "symbol": 1, "interval": 1, "error_message": 1, "_id": 0}
        ).limit(5))
        
        if failed_jobs:
            print(f"\n  ⚠️  Recent failures:")
            for job in failed_jobs:
                error = job.get("error_message", "Unknown error")[:60]
                print(f"      ❌ {job['symbol']} {job['interval']}: {error}...")
        
        print()
        
        # 5. Check Regime Data
        print("🌐 MACRO REGIME DATA CHECK")
        print("-" * 40)
        regime_count = db.get_collection("macro_regimes").count_documents({})
        print(f"  Total regime records: {regime_count:,}")
        
        if regime_count == 0:
            print(f"  ⚠️  WARNING: No regime data found!")
            print(f"     This may cause feature generation to fail.")
            print(f"     Consider disabling regime enrichment in tasks.py:")
            print(f"     generate_for_symbol(symbol, interval, enable_regime=False)")
        else:
            print(f"  ✅ Regime data available")
        
        print()
        
        # 6. Summary
        print("="*60)
        print("📊 SUMMARY")
        print("="*60)
        
        issues = []
        
        if disabled_symbols > 0:
            issues.append(f"❌ {disabled_symbols} disabled symbols (run fix script)")
        
        if ohlcv_count == 0:
            issues.append("❌ No OHLCV data (run ingestion)")
        
        if features_count == 0 and ohlcv_count > 0:
            issues.append("❌ OHLCV exists but no features (check logs)")
        
        if missing_features:
            issues.append(f"⚠️  {len(missing_features)} symbol/intervals missing features")
        
        if regime_count == 0:
            issues.append("⚠️  No regime data (may affect features)")
        
        failed_count = db["ingestion_jobs"].count_documents({"status": "failed"})
        if failed_count > 0:
            issues.append(f"❌ {failed_count} failed jobs (check logs)")
        
        if not issues:
            print("\n✅ All checks passed! System looks healthy.\n")
        else:
            print(f"\n⚠️  Found {len(issues)} issue(s):\n")
            for issue in issues:
                print(f"  {issue}")
            print()
        
        print("="*60 + "\n")


if __name__ == "__main__":
    try:
        diagnose()
    except Exception as e:
        logger.error(f"Diagnostic failed: {e}", exc_info=True)
        print(f"\n❌ Error running diagnostics: {e}\n")

