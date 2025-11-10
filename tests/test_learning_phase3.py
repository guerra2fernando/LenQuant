from __future__ import annotations

from typing import Any, Dict, List

import pytest

from learning.meta_model import build_feature_vector
from monitor.overfit_detector import OverfitSignal, detect_overfit


def test_build_feature_vector_includes_genome_and_metrics() -> None:
    genome = {
        "params": {"ema_short": 12, "ema_long": 50, "risk_pct": 0.1},
        "generation": 3,
        "uses_forecast": False,
        "forecast_weight": 0.25,
        "fitness": {"roi": 0.12},
    }
    metrics = {"roi": 0.08, "sharpe": 0.9, "max_drawdown": 0.2, "trade_count": 14}

    features = build_feature_vector(genome, metrics)

    assert pytest.approx(features["param_ema_short"], rel=1e-6) == 12.0
    assert pytest.approx(features["param_risk_pct"], rel=1e-6) == 0.1
    assert features["uses_forecast"] == 0.0
    assert pytest.approx(features["prev_roi"], rel=1e-6) == 0.08
    assert pytest.approx(features["prev_trade_count"], rel=1e-6) == 14.0
    assert pytest.approx(features["generation"], rel=1e-6) == 3.0


def test_detect_overfit_flags_decay(monkeypatch: pytest.MonkeyPatch) -> None:
    from monitor import overfit_detector

    sample_runs: List[Dict[str, Any]] = [
        {"run_id": "run-1", "results": {"roi": 0.05, "sharpe": 1.1}},
        {"run_id": "run-2", "results": {"roi": 0.02, "sharpe": 0.6}},
        {"run_id": "run-3", "results": {"roi": -0.01, "sharpe": 0.2}},
    ]

    monkeypatch.setattr(overfit_detector, "list_genomes", lambda **_: [{"strategy_id": "ema-cross-gen3"}])
    monkeypatch.setattr(overfit_detector, "_load_runs", lambda strategy_id, limit: sample_runs)

    signals: List[OverfitSignal] = detect_overfit(window=3, decay_threshold=0.2, min_runs=3)

    assert len(signals) == 1
    signal = signals[0]
    assert signal.strategy_id == "ema-cross-gen3"
    assert signal.decay > 0.2
    assert signal.latest_run_id == "run-3"

