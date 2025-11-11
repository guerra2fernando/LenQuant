"""Utility functions for computing experiment metrics."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

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


def _equity_dataframe(equity_curve: Iterable[Dict[str, Any]]) -> pd.DataFrame:
    if not equity_curve:
        return pd.DataFrame()
    frame = pd.DataFrame(list(equity_curve))
    if "equity" not in frame.columns:
        return pd.DataFrame()
    if "timestamp" not in frame.columns:
        frame["timestamp"] = pd.RangeIndex(start=0, stop=len(frame))
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], errors="coerce")
    frame = frame.dropna(subset=["timestamp"])
    if frame.empty:
        return pd.DataFrame()
    frame = frame.sort_values("timestamp")
    frame.set_index("timestamp", inplace=True)
    return frame


def _hourly_roi_points(
    equity_frame: pd.DataFrame,
    initial_capital: float,
) -> List[Dict[str, Any]]:
    if equity_frame.empty or initial_capital <= 0:
        return []
    resampled = equity_frame["equity"].resample("1H").last().dropna()
    if resampled.empty:
        return []
    points: List[Dict[str, Any]] = []
    for ts, equity in resampled.items():
        roi = (equity / initial_capital) - 1
        points.append({"timestamp": ts.isoformat(), "roi": float(roi)})
    return points


def _max_drawdown_vs_parent(equity_series: pd.Series, parent_bankroll: float) -> float:
    if equity_series.empty or parent_bankroll <= 0:
        return 0.0
    running_max = equity_series.cummax()
    drawdowns = (running_max - equity_series) / parent_bankroll
    drawdowns = drawdowns.replace([np.inf, -np.inf], np.nan).dropna()
    if drawdowns.empty:
        return 0.0
    return float(drawdowns.max())


def _confidence_score(roi: float, drawdown_parent: float, variance: float) -> float:
    base = 0.5 + roi / 2
    drawdown_penalty = max(0.0, 1.0 - drawdown_parent * 5)
    variance_penalty = max(0.0, 1.0 - min(variance * 10, 0.9))
    confidence = base * drawdown_penalty * variance_penalty
    return float(max(0.0, min(1.0, confidence)))


def compute_intraday_agent_metrics(
    equity_curve: Iterable[Dict[str, Any]],
    trades: Iterable[Dict[str, Any]],
    allocation: float,
    parent_bankroll: float,
    *,
    leverage_limit: Optional[float] = None,
    max_exposure: Optional[float] = None,
) -> Dict[str, Any]:
    equity_frame = _equity_dataframe(equity_curve)
    if equity_frame.empty or allocation <= 0:
        return {
            "ending_equity": allocation,
            "realized_pnl": 0.0,
            "roi": 0.0,
            "variance": 0.0,
            "max_drawdown_parent": 0.0,
            "bankroll_utilization_pct": allocation / parent_bankroll if parent_bankroll else 0.0,
            "trade_count": len(list(trades)),
            "hourly_roi": [],
            "leverage_breach": False,
            "confidence_score": 0.0,
            "max_exposure": max_exposure,
            "timestamp_start": None,
            "timestamp_end": None,
        }

    ending_equity = float(equity_frame["equity"].iloc[-1])
    realized_pnl = ending_equity - allocation
    roi = realized_pnl / allocation if allocation else 0.0
    returns = equity_frame["equity"].pct_change().dropna()
    variance = float(returns.var()) if not returns.empty else 0.0
    max_drawdown_parent = _max_drawdown_vs_parent(equity_frame["equity"], parent_bankroll)
    hourly_roi = _hourly_roi_points(equity_frame, allocation)
    trade_count = len(list(trades))
    utilization_pct = (max_exposure or allocation) / parent_bankroll if parent_bankroll else 0.0
    leverage_breach = False
    if leverage_limit is not None and max_exposure is not None and allocation > 0:
        leverage_breach = (max_exposure / allocation) > leverage_limit + 1e-6
    confidence_score = _confidence_score(roi, max_drawdown_parent, variance)

    return {
        "ending_equity": ending_equity,
        "realized_pnl": float(realized_pnl),
        "roi": float(roi),
        "variance": variance,
        "max_drawdown_parent": max_drawdown_parent,
        "bankroll_utilization_pct": float(utilization_pct),
        "trade_count": trade_count,
        "hourly_roi": hourly_roi,
        "leverage_breach": leverage_breach,
        "confidence_score": confidence_score,
        "max_exposure": max_exposure,
        "timestamp_start": equity_frame.index.min().to_pydatetime() if not equity_frame.empty else None,
        "timestamp_end": equity_frame.index.max().to_pydatetime() if not equity_frame.empty else None,
    }


def summarise_intraday_cohort(
    agents: List[Dict[str, Any]],
    parent_snapshot: Dict[str, Any],
    *,
    window: Optional[Dict[str, Any]] = None,
    alerts: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    if not agents:
        return {
            "generated_at": datetime.utcnow(),
            "total_pnl": 0.0,
            "total_roi": 0.0,
            "bankroll_utilization_pct": 0.0,
            "best_agent": None,
            "worst_agent": None,
            "hourly_roi": [],
            "trade_count": 0,
            "confidence_score": 0.0,
            "leverage_breaches": [],
            "alerts": alerts or [],
            "window": window,
        }

    bankroll = float(parent_snapshot.get("starting_balance", 0.0) or 0.0)
    total_pnl = sum(agent.get("metrics", {}).get("realized_pnl", 0.0) for agent in agents)
    total_roi = total_pnl / bankroll if bankroll else 0.0
    trade_count = sum(agent.get("metrics", {}).get("trade_count", 0) for agent in agents)
    confidence_values = [agent.get("metrics", {}).get("confidence_score", 0.0) for agent in agents]
    avg_confidence = float(np.mean(confidence_values)) if confidence_values else 0.0

    def _agent_key(agent: Dict[str, Any]) -> float:
        return float(agent.get("metrics", {}).get("roi", 0.0))

    best_agent = max(agents, key=_agent_key)
    worst_agent = min(agents, key=_agent_key)

    hourly_points: Dict[str, List[float]] = defaultdict(list)
    for agent in agents:
        for point in agent.get("metrics", {}).get("hourly_roi", []):
            hourly_points[point["timestamp"]].append(point["roi"])
    hourly_roi = [
        {"timestamp": ts, "avg_roi": float(np.mean(values))}
        for ts, values in sorted(hourly_points.items())
    ]

    leverage_breaches = [
        {
            "strategy_id": agent.get("strategy_id"),
            "run_id": agent.get("run_id"),
            "max_exposure": agent.get("metrics", {}).get("max_exposure"),
            "allocation": agent.get("allocation"),
        }
        for agent in agents
        if agent.get("metrics", {}).get("leverage_breach")
    ]

    summary_alerts = list(alerts or [])
    for agent in agents:
        for alert in agent.get("alerts", []):
            summary_alerts.append(alert)

    return {
        "generated_at": datetime.utcnow(),
        "total_pnl": float(total_pnl),
        "total_roi": float(total_roi),
        "bankroll_utilization_pct": float(parent_snapshot.get("utilization", 0.0)),
        "best_agent": {
            "strategy_id": best_agent.get("strategy_id"),
            "run_id": best_agent.get("run_id"),
            "roi": best_agent.get("metrics", {}).get("roi"),
            "pnl": best_agent.get("metrics", {}).get("realized_pnl"),
        },
        "worst_agent": {
            "strategy_id": worst_agent.get("strategy_id"),
            "run_id": worst_agent.get("run_id"),
            "roi": worst_agent.get("metrics", {}).get("roi"),
            "pnl": worst_agent.get("metrics", {}).get("realized_pnl"),
        },
        "hourly_roi": hourly_roi,
        "trade_count": trade_count,
        "confidence_score": avg_confidence,
        "leverage_breaches": leverage_breaches,
        "alerts": summary_alerts,
        "window": window,
    }
