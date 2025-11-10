from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple

import cvxpy as cp
import numpy as np

from db.client import get_database_name, mongo_client
from learning.meta_model import MetaModelBundle, load_latest_meta_model, predict_expected_roi
from learning.repository import (
    DEFAULT_LEARNING_SETTINGS,
    get_learning_settings,
    latest_allocator_snapshot,
    record_allocator_snapshot,
)
from strategy_genome.repository import list_genomes


class AllocationError(RuntimeError):
    """Raised when allocator optimisation fails."""


@dataclass
class AllocationResult:
    weights: List[Dict[str, Any]]
    expected_portfolio_return: float
    expected_portfolio_risk: float
    settings: Dict[str, Any]
    history: Dict[str, List[float]]


def _load_returns(strategy_id: str, limit: int = 30) -> List[float]:
    with mongo_client() as client:
        db = client[get_database_name()]
        cursor = (
            db["sim_runs"]
            .find({"strategy": strategy_id, "results.roi": {"$exists": True}})
            .sort("created_at", -1)
            .limit(limit)
        )
        runs = list(cursor)
    returns = [float(doc.get("results", {}).get("roi", 0.0)) for doc in reversed(runs)]
    return returns


def _covariance_matrix(returns_map: Dict[str, List[float]]) -> np.ndarray:
    processed: List[List[float]] = []
    max_len = max((len(values) for values in returns_map.values()), default=0)
    if max_len == 0:
        return np.eye(len(returns_map)) * 1e-4 if returns_map else np.zeros((0, 0))
    for values in returns_map.values():
        if not values:
            processed.append([0.0] * max_len)
            continue
        if len(values) < max_len:
            padded = values + [values[-1]] * (max_len - len(values))
            processed.append(padded)
        else:
            processed.append(values[-max_len:])
    data = np.array(processed)
    if data.shape[0] == 1:
        variance = float(np.var(data))
        return np.array([[variance if variance > 0 else 1e-4]])
    cov = np.cov(data, ddof=0)
    if np.ndim(cov) == 0:
        cov = np.array([[float(cov)]])
    cov = np.array(cov, dtype=float)
    cov += np.eye(cov.shape[0]) * 1e-6
    return cov


def _solve_weights(expected_returns: np.ndarray, covariance: np.ndarray, settings: Dict[str, Any]) -> np.ndarray:
    n = len(expected_returns)
    if n == 0:
        raise AllocationError("No strategies supplied for allocation.")
    w = cp.Variable(n)
    risk_penalty = float(settings.get("risk_penalty", 0.5))
    min_weight = float(settings.get("min_weight", 0.0))
    diversification_floor = float(settings.get("diversification_floor", 0.0))
    objective = cp.Maximize(expected_returns @ w - risk_penalty * cp.quad_form(w, covariance))
    constraints = [cp.sum(w) == 1, w >= min_weight]
    if diversification_floor > 0:
        constraints.append(w <= 1.0 - diversification_floor)
    max_risk = settings.get("max_risk")
    if max_risk is not None:
        constraints.append(cp.quad_form(w, covariance) <= float(max_risk))
    problem = cp.Problem(objective, constraints)
    try:
        problem.solve(solver=cp.OSQP, warm_start=True, verbose=False)
    except Exception:  # noqa: BLE001
        problem.solve(solver=cp.SCS, verbose=False)
    if w.value is None or problem.status not in (cp.OPTIMAL, cp.OPTIMAL_INACCURATE):
        raise AllocationError(f"Allocation solver failed with status: {problem.status}")
    weights = np.array(w.value).flatten()
    weights = np.maximum(weights, 0.0)
    total = weights.sum()
    if total <= 0:
        raise AllocationError("Optimisation returned zero weights.")
    return weights / total


def _fallback_weights(expected_returns: np.ndarray) -> np.ndarray:
    clipped = np.clip(expected_returns, a_min=0.0, a_max=None)
    if clipped.sum() == 0:
        return np.ones_like(clipped) / len(clipped)
    return clipped / clipped.sum()


def rebalance_allocations(
    *,
    strategies: Optional[Sequence[Dict[str, Any]]] = None,
    bundle: Optional[MetaModelBundle] = None,
    settings: Optional[Dict[str, Any]] = None,
) -> AllocationResult:
    if strategies is None:
        strategies = list_genomes(status="champion", limit=20)
    strategies = list(strategies)
    if not strategies:
        raise AllocationError("No champion strategies available for allocation.")

    settings = settings or get_learning_settings().get("allocator", DEFAULT_LEARNING_SETTINGS["allocator"])
    bundle = bundle or load_latest_meta_model()

    expected_returns: List[float] = []
    returns_history: Dict[str, List[float]] = {}
    for doc in strategies:
        strategy_id = doc.get("strategy_id")
        fitness_metrics = doc.get("fitness") or {}
        expected_roi = predict_expected_roi(doc, fitness_metrics, bundle=bundle)
        expected_returns.append(expected_roi)
        returns_history[strategy_id] = _load_returns(strategy_id)

    expected_returns_np = np.array(expected_returns, dtype=float)
    covariance = _covariance_matrix(returns_history)

    try:
        weights = _solve_weights(expected_returns_np, covariance, settings)
    except AllocationError:
        weights = _fallback_weights(expected_returns_np)

    weights_list: List[Dict[str, Any]] = []
    for doc, weight, expected_roi in zip(strategies, weights, expected_returns, strict=False):
        weights_list.append(
            {
                "strategy_id": doc.get("strategy_id"),
                "weight": float(weight),
                "expected_roi": float(expected_roi),
                "fitness": doc.get("fitness"),
            }
        )

    portfolio_return = float(np.dot(weights, expected_returns_np))
    portfolio_risk = float(np.sqrt(np.maximum(np.dot(weights, covariance @ weights), 0.0)))

    snapshot = {
        "weights": weights_list,
        "expected_portfolio_return": portfolio_return,
        "expected_portfolio_risk": portfolio_risk,
        "settings": settings,
    }
    stored = record_allocator_snapshot({**snapshot, "history": returns_history})
    return AllocationResult(
        weights=stored.get("weights", weights_list),
        expected_portfolio_return=stored.get("expected_portfolio_return", portfolio_return),
        expected_portfolio_risk=stored.get("expected_portfolio_risk", portfolio_risk),
        settings=stored.get("settings", settings),
        history=stored.get("history", returns_history),
    )


def latest_allocation() -> Optional[Dict[str, Any]]:
    return latest_allocator_snapshot()

