"""Utility functions for computing experiment metrics."""
from __future__ import annotations

from typing import Any, Dict, Iterable, List

import numpy as np
import pandas as pd


def compute_forecast_alignment(trades: Iterable[Any]) -> float:
    total = 0
    aligned = 0
    for trade in trades:
        if trade.predicted_return is None or trade.realized_return is None:
            continue
        total += 1
        predicted_direction = 1 if trade.predicted_return >= 0 else -1
        realized_direction = 1 if trade.realized_return >= 0 else -1
        if predicted_direction == realized_direction:
            aligned += 1
    if total == 0:
        return 0.0
    return aligned / total


def _stability(returns: pd.Series) -> float:
    if returns.empty:
        return 0.0
    variance = returns.var()
    if variance == 0 or np.isnan(variance):
        return 0.0
    sharpe = returns.mean() / returns.std() if returns.std() else 0.0
    return sharpe / variance if variance else 0.0


def compute_experiment_metrics(
    equity_series: pd.Series,
    trades: List[Any],
    initial_capital: float,
    risk_free_rate: float = 0.0,
) -> Dict[str, float]:
    if equity_series.empty or initial_capital <= 0:
        return {
            "pnl": 0.0,
            "roi": 0.0,
            "max_drawdown": 0.0,
            "sharpe": 0.0,
            "forecast_alignment": 0.0,
            "stability": 0.0,
        }

    returns = equity_series.pct_change().dropna()
    ending_value = equity_series.iloc[-1]
    pnl = ending_value - initial_capital
    roi = (ending_value / initial_capital) - 1 if initial_capital else 0.0
    running_max = equity_series.cummax()
    drawdowns = (running_max - equity_series) / running_max.replace(0, np.nan)
    max_drawdown = float(drawdowns.max()) if not drawdowns.isna().all() else 0.0
    sharpe = 0.0
    if not returns.empty:
        excess_returns = returns - risk_free_rate / max(len(returns), 1)
        std_dev = excess_returns.std()
        sharpe = excess_returns.mean() / std_dev * (252 ** 0.5) if std_dev else 0.0

    forecast_alignment = compute_forecast_alignment(trades)
    stability = _stability(returns)

    return {
        "pnl": float(pnl),
        "roi": float(roi),
        "max_drawdown": float(max_drawdown),
        "sharpe": float(sharpe),
        "forecast_alignment": float(forecast_alignment),
        "stability": float(stability),
    }

