from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, List, Literal, Optional, Tuple

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator

from api.routes.trade import get_order_manager
from data_ingest.config import IngestConfig
from data_ingest.fetcher import fetch_symbol_interval
from db.client import get_database_name, mongo_client
from features.features import generate_for_symbol
from reports.generator import generate_daily_report
from scripts.seed_symbols import seed
from simulator.runner import run_simulation

router = APIRouter()


def _serialize_dt(value: Any) -> Optional[str]:
    if isinstance(value, datetime):
        return value.isoformat()
    return None


def _aggregate_symbol_interval(collection) -> Dict[Tuple[str, str], Dict[str, Any]]:
    pipeline = [
        {
            "$group": {
                "_id": {"symbol": "$symbol", "interval": "$interval"},
                "count": {"$sum": 1},
                "latest": {"$max": "$timestamp"},
            }
        },
        {
            "$project": {
                "_id": 0,
                "symbol": "$_id.symbol",
                "interval": "$_id.interval",
                "count": 1,
                "latest": 1,
            }
        },
    ]
    summary: Dict[Tuple[str, str], Dict[str, Any]] = {}
    try:
        for item in collection.aggregate(pipeline):
            summary[(item["symbol"], item["interval"])] = {
                "count": item.get("count", 0),
                "latest": item.get("latest"),
            }
    except Exception:
        return summary
    return summary


def _merge_inventory(
    ohlcv_map: Dict[Tuple[str, str], Dict[str, Any]],
    features_map: Dict[Tuple[str, str], Dict[str, Any]],
    symbols: Iterable[str],
    intervals: Iterable[str],
) -> List[Dict[str, Any]]:
    keys = set(ohlcv_map.keys()) | set(features_map.keys())
    interval_list = list(intervals)
    if not interval_list:
        interval_list = ["1m"]
    for symbol in symbols:
        for interval in interval_list:
            keys.add((symbol, interval))

    inventory: List[Dict[str, Any]] = []
    for symbol, interval in sorted(keys):
        o_entry = ohlcv_map.get((symbol, interval), {})
        f_entry = features_map.get((symbol, interval), {})
        inventory.append(
            {
                "symbol": symbol,
                "interval": interval,
                "ohlcv_count": o_entry.get("count", 0),
                "features_count": f_entry.get("count", 0),
                "latest_candle": _serialize_dt(o_entry.get("latest")),
                "latest_feature": _serialize_dt(f_entry.get("latest")),
            }
        )
    return inventory


def _inventory_snapshot(
    config: IngestConfig,
    expected_symbols: Optional[List[str]] = None,
    expected_intervals: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        ohlcv_map = _aggregate_symbol_interval(db["ohlcv"])
        features_map = _aggregate_symbol_interval(db["features"])

    symbols = expected_symbols or config.symbols or []
    intervals = expected_intervals or config.intervals or []
    return _merge_inventory(ohlcv_map, features_map, symbols, intervals)


class BootstrapRequest(BaseModel):
    symbols: Optional[List[str]] = None
    intervals: Optional[List[str]] = None
    limit: Optional[int] = None
    lookback_days: Optional[int] = None


class KillSwitchPayload(BaseModel):
    action: Literal["arm", "release"] = "arm"
    reason: Optional[str] = None
    actor: Optional[str] = None
    mode: Optional[str] = None

    @validator("reason")
    def validate_reason(cls, value: Optional[str], values: Dict[str, Any]) -> Optional[str]:
        action = values.get("action")
        if action == "arm" and not value:
            raise ValueError("Reason is required when arming the kill switch.")
        return value


@router.post("/bootstrap")
def bootstrap_data(payload: BootstrapRequest) -> Dict[str, Any]:
    config = IngestConfig.from_env()

    symbols = payload.symbols or config.symbols or ["BTC/USDT"]
    intervals = payload.intervals or config.intervals or ["1m"]
    limit = payload.limit or config.batch_size
    lookback_days = payload.lookback_days or config.lookback_days

    if not symbols or not intervals:
        raise HTTPException(status_code=400, detail="No symbols or intervals available for bootstrap.")

    results: Dict[str, Any] = {
        "seeded_symbols": 0,
        "ingested": [],
        "features": [],
        "simulation_run_id": None,
        "report_path": None,
        "inventory": [],
        "batch_size": limit,
        "lookback_days": lookback_days,
        "requested_symbols": symbols,
        "requested_intervals": intervals,
        "timestamp": datetime.utcnow().isoformat(),
    }

    results["seeded_symbols"] = seed(symbols)

    for symbol in symbols:
        for interval in intervals:
            ingested = fetch_symbol_interval(
                symbol,
                interval,
                limit=limit,
                config=config,
                lookback_days=lookback_days,
            )
            results["ingested"].append({"symbol": symbol, "interval": interval, "rows": ingested})

            feature_rows = generate_for_symbol(symbol, interval)
            results["features"].append({"symbol": symbol, "interval": interval, "rows": feature_rows})

    primary_symbol = symbols[0]
    primary_interval = intervals[0]
    run_id = run_simulation(primary_symbol, primary_interval, "bootstrap-baseline")
    results["simulation_run_id"] = run_id

    report_path = generate_daily_report()
    results["report_path"] = str(report_path)
    results["inventory"] = _inventory_snapshot(config, symbols, intervals)

    return results


@router.post("/kill-switch")
def kill_switch(payload: KillSwitchPayload) -> Dict[str, Any]:
    manager = get_order_manager()
    risk_manager = manager.risk_manager
    if payload.action == "arm":
        risk_manager.trigger_kill_switch(reason=payload.reason or "manual trigger", actor=payload.actor)
        cancelled = manager.cancel_all_orders(mode=payload.mode, actor=payload.actor)
        summary = risk_manager.get_summary()
        return {
            "status": "armed",
            "cancelled_orders": cancelled,
            "kill_switch": summary.get("kill_switch"),
        }
    risk_manager.release_kill_switch(actor=payload.actor)
    summary = risk_manager.get_summary()
    return {
        "status": "released",
        "kill_switch": summary.get("kill_switch"),
    }


@router.get("/overview")
def bootstrap_overview() -> Dict[str, Any]:
    config = IngestConfig.from_env()

    with mongo_client() as client:
        db = client[get_database_name()]
        ohlcv_map = _aggregate_symbol_interval(db["ohlcv"])
        features_map = _aggregate_symbol_interval(db["features"])
        symbol_docs = db["symbols"].find({}, {"_id": 0, "symbol": 1})
        available_symbols = sorted(
            {doc["symbol"] for doc in symbol_docs} | set(config.symbols or [])
        )

    intervals_from_data = {
        interval for _, interval in ohlcv_map.keys() | features_map.keys()
    }
    candidate_intervals = config.intervals or sorted(intervals_from_data)
    if intervals_from_data:
        candidate_intervals = sorted(set(candidate_intervals) | intervals_from_data)

    inventory = _merge_inventory(ohlcv_map, features_map, available_symbols, candidate_intervals)

    return {
        "available_symbols": available_symbols,
        "default_symbols": config.symbols or available_symbols,
        "default_intervals": candidate_intervals,
        "default_lookback_days": config.lookback_days,
        "inventory": inventory,
    }

