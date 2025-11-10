from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence

import numpy as np

from db.client import get_database_name, mongo_client
from strategy_genome.repository import list_genomes


@dataclass
class OverfitSignal:
    strategy_id: str
    decay: float
    baseline_roi: float
    recent_roi: float
    window: int
    latest_run_id: Optional[str]
    detected_at: datetime
    sharpe_delta: float
    run_history: List[Dict[str, Any]]


def _load_runs(strategy_id: str, limit: int) -> List[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        cursor = (
            db["sim_runs"]
            .find({"strategy": strategy_id})
            .sort("created_at", -1)
            .limit(limit)
        )
        runs = list(cursor)
    return list(reversed(runs))


def _decay_metrics(runs: List[Dict[str, Any]], recent_len: int) -> Optional[tuple[float, float, float, float]]:
    if len(runs) < recent_len + 1:
        return None
    rois = [float(run.get("results", {}).get("roi", 0.0)) for run in runs]
    sharpes = [float(run.get("results", {}).get("sharpe", 0.0)) for run in runs]
    baseline_roi = float(np.mean(rois[:-recent_len]))
    recent_roi = float(np.mean(rois[-recent_len:]))
    baseline_sharpe = float(np.mean(sharpes[:-recent_len]))
    recent_sharpe = float(np.mean(sharpes[-recent_len:]))
    if abs(baseline_roi) < 1e-6:
        return None
    decay = (baseline_roi - recent_roi) / abs(baseline_roi)
    sharpe_delta = recent_sharpe - baseline_sharpe
    return decay, baseline_roi, recent_roi, sharpe_delta


def detect_overfit(
    *,
    strategies: Optional[Sequence[Dict[str, Any]]] = None,
    window: int = 6,
    decay_threshold: float = 0.35,
    min_runs: int = 5,
) -> List[OverfitSignal]:
    strategies = list(strategies) if strategies is not None else list_genomes(status="champion", limit=20)
    signals: List[OverfitSignal] = []
    recent_len = max(1, window // 2)

    for doc in strategies:
        strategy_id = doc.get("strategy_id")
        if not strategy_id:
            continue
        runs = _load_runs(strategy_id, limit=max(window, min_runs))
        if len(runs) < max(window, min_runs):
            continue
        decay_metrics = _decay_metrics(runs, recent_len)
        if not decay_metrics:
            continue
        decay, baseline_roi, recent_roi, sharpe_delta = decay_metrics
        if decay <= decay_threshold:
            continue
        latest_run = runs[-1] if runs else None
        signals.append(
            OverfitSignal(
                strategy_id=strategy_id,
                decay=float(decay),
                baseline_roi=float(baseline_roi),
                recent_roi=float(recent_roi),
                window=len(runs),
                latest_run_id=latest_run.get("run_id") if latest_run else None,
                detected_at=datetime.utcnow(),
                sharpe_delta=float(sharpe_delta),
                run_history=[
                    {
                        "run_id": run.get("run_id"),
                        "created_at": run.get("created_at"),
                        "roi": run.get("results", {}).get("roi"),
                        "sharpe": run.get("results", {}).get("sharpe"),
                    }
                    for run in runs
                ],
            )
        )
    return signals

