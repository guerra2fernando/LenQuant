"""Compute uplift metrics between ensemble strategies and baselines."""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from typing import Dict, Optional

from db.client import get_database_name, mongo_client


@dataclass
class StrategySnapshot:
    run_id: str
    pnl: float
    sharpe: float
    max_drawdown: float


def _latest_run(strategy: str, symbol: Optional[str] = None, horizon: Optional[str] = None) -> Optional[StrategySnapshot]:
    query: Dict[str, object] = {"strategy": strategy}
    if symbol:
        query["symbol"] = symbol
    if horizon:
        query["horizon"] = horizon
    with mongo_client() as client:
        db = client[get_database_name()]
        doc = db["sim_runs"].find_one(query, sort=[("created_at", -1)])
    if not doc:
        return None
    results = doc.get("results", {}) or {}
    return StrategySnapshot(
        run_id=doc.get("run_id", "unknown"),
        pnl=float(results.get("pnl", 0.0)),
        sharpe=float(results.get("sharpe", 0.0)),
        max_drawdown=float(results.get("max_drawdown", 0.0)),
    )


def compute_uplift(
    ensemble_strategy: str,
    baseline_strategy: str,
    symbol: Optional[str] = None,
    horizon: Optional[str] = None,
) -> Dict[str, float]:
    ensemble_run = _latest_run(ensemble_strategy, symbol, horizon)
    baseline_run = _latest_run(baseline_strategy, symbol, horizon)
    if not ensemble_run or not baseline_run:
        raise ValueError("Missing simulation runs to compute uplift.")

    pnl_uplift = (
        (ensemble_run.pnl / max(baseline_run.pnl, 1e-9)) - 1.0 if baseline_run.pnl else float("inf")
    )
    sharpe_delta = ensemble_run.sharpe - baseline_run.sharpe

    return {
        "ensemble_run_id": ensemble_run.run_id,
        "baseline_run_id": baseline_run.run_id,
        "pnl_uplift": pnl_uplift,
        "sharpe_delta": sharpe_delta,
        "ensemble_pnl": ensemble_run.pnl,
        "baseline_pnl": baseline_run.pnl,
        "ensemble_sharpe": ensemble_run.sharpe,
        "baseline_sharpe": baseline_run.sharpe,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute uplift between the ensemble strategy and a baseline.")
    parser.add_argument("--ensemble-strategy", default="ensemble-threshold", help="Strategy name using forecasts.")
    parser.add_argument("--baseline-strategy", default="baseline", help="Baseline strategy name.")
    parser.add_argument("--symbol", default="BTC/USD", help="Symbol filter.")
    parser.add_argument("--horizon", default="1m", help="Horizon filter.")
    args = parser.parse_args()

    metrics = compute_uplift(
        ensemble_strategy=args.ensemble_strategy,
        baseline_strategy=args.baseline_strategy,
        symbol=args.symbol,
        horizon=args.horizon,
    )
    print("Uplift analysis:")
    for key, value in metrics.items():
        print(f"  {key}: {value}")


if __name__ == "__main__":
    main()

