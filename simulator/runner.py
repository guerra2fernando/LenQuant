"""Simulation runner that stitches together features, forecasts, and backtesting."""
from __future__ import annotations

import logging
from datetime import datetime
from uuid import uuid4

import pandas as pd

from backtester.engine import Backtester
from db.client import get_database_name, get_feature_df, get_ohlcv_df, mongo_client
from features.features import generate_for_symbol
from models.ensemble import EnsembleError, ensemble_predict

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

MIN_RET_THRESHOLDS = {"1m": 0.0005, "1h": 0.005, "1d": 0.01}
MIN_CONF_THRESHOLDS = {"1m": 0.55, "1h": 0.6, "1d": 0.65}


def _load_feature_frame(symbol: str, interval: str) -> pd.DataFrame:
    feature_df = get_feature_df(symbol, interval)
    price_df = get_ohlcv_df(symbol, interval)
    if feature_df.empty or price_df.empty:
        return pd.DataFrame()
    merged = feature_df.join(price_df["close"], how="inner")
    merged.rename(columns={"close": "price"}, inplace=True)
    return merged


def _strategy_param(strategy_config: dict[str, float], key: str, default: float) -> float:
    value = strategy_config.get(key, default)
    return float(value)


def _decide_signal(
    predicted_return: float | None,
    confidence: float | None,
    horizon: str,
    strategy_config: dict[str, float],
) -> str:
    uses_forecast = bool(strategy_config.get("uses_forecast", True))
    if not uses_forecast or predicted_return is None or confidence is None:
        return "hold"

    weight = float(strategy_config.get("forecast_weight", 1.0))
    adjusted_return = predicted_return * weight
    min_ret = float(strategy_config.get("min_return_threshold", MIN_RET_THRESHOLDS.get(horizon, 0.001)))
    min_conf = float(strategy_config.get("min_confidence", MIN_CONF_THRESHOLDS.get(horizon, 0.55)))

    if adjusted_return > min_ret and confidence >= min_conf:
        return "buy"
    if adjusted_return < -min_ret and confidence >= min_conf:
        return "sell"
    return "hold"


def run_simulation(
    symbol: str,
    interval: str,
    strategy_name: str,
    horizon: str | None = None,
    strategy_config: dict[str, float] | None = None,
    genome: dict | None = None,
) -> str:
    horizon = horizon or interval
    strategy_config = strategy_config or {}
    feature_count = generate_for_symbol(symbol, interval)
    if feature_count == 0:
        logger.warning("No features generated. Aborting simulation.")
        return ""

    features = _load_feature_frame(symbol, interval)
    if features.empty:
        logger.warning("No features available for %s %s", symbol, interval)
        return ""

    backtester = Backtester(
        initial_capital=strategy_config.get("initial_capital", 10_000.0),
        position_size_pct=min(max(strategy_config.get("risk_pct", 0.1), 0.01), 0.99),
        take_profit_pct=strategy_config.get("take_profit_pct"),
        stop_loss_pct=strategy_config.get("stop_loss_pct"),
    )

    for ts, row in features.iterrows():
        price = float(row["price"])
        try:
            forecast = ensemble_predict(symbol, horizon, ts.to_pydatetime())
            predicted_return = forecast["predicted_return"]
            confidence = forecast["confidence"]
        except EnsembleError as exc:
            logger.debug("Forecast unavailable for %s %s: %s", symbol, ts, exc)
            predicted_return = None
            confidence = None

        signal = _decide_signal(predicted_return, confidence, horizon, strategy_config)
        backtester.on_signal(ts, price, signal, predicted_return, confidence)

    result = backtester.finalize()
    run_id = f"run-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}-{uuid4().hex[:6]}"
    with mongo_client() as client:
        db = client[get_database_name()]
        db["sim_runs"].insert_one(
            {
                "run_id": run_id,
                "strategy": strategy_name,
                "symbol": symbol,
                "interval": interval,
                "horizon": horizon,
                "results": result.metrics,
                "trades": [trade.__dict__ for trade in result.trades],
                "equity_curve": result.equity_curve,
                "created_at": datetime.utcnow(),
                "strategy_config": strategy_config,
                "genome": genome,
            }
        )
    logger.info("Completed simulation %s", run_id)
    return run_id


def main() -> None:
    symbol = "BTC/USDT"
    interval = "1m"
    strategy = "ensemble-threshold"
    run_simulation(symbol, interval, strategy)


if __name__ == "__main__":
    main()