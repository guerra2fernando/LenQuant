from __future__ import annotations

from manager.experiment_runner import ExperimentRequest
from reports.leaderboard import _render_html
from strategy_genome.repository import _composite_score


def test_composite_score_rewards_positive_metrics() -> None:
    positive = _composite_score(
        {
            "roi": 0.15,
            "sharpe": 1.2,
            "forecast_alignment": 0.7,
            "max_drawdown": 0.1,
        }
    )
    negative = _composite_score(
        {
            "roi": -0.2,
            "sharpe": -0.5,
            "forecast_alignment": 0.5,
            "max_drawdown": 0.4,
        }
    )
    assert positive > negative


def test_render_html_contains_strategy_rows() -> None:
    payload = {
        "date": "2025-11-10",
        "generated_at": "2025-11-10T00:00:00Z",
        "top_strategies": [
            {
                "strategy_id": "ema-cross-gen1-aaaaaa",
                "roi": 0.12,
                "sharpe": 1.1,
                "max_drawdown": 0.08,
                "forecast_alignment": 0.6,
                "composite": 1.5,
            }
        ],
    }
    html = _render_html(payload)
    assert "ema-cross-gen1-aaaaaa" in html
    assert "Evolution Lab Leaderboard" in html


def test_experiment_request_serialization_roundtrip() -> None:
    request = ExperimentRequest(
        symbol="ETH/USDT",
        interval="15m",
        horizon="1h",
        accounts=10,
        mutations_per_parent=3,
        champion_limit=2,
        queue_only=True,
        families=["ema-cross", "sma-trend"],
    )
    serialized = request.to_dict()
    restored = ExperimentRequest.from_dict(serialized)
    assert restored == request


