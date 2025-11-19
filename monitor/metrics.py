from __future__ import annotations

from typing import Any, Dict, List

try:
    from prometheus_client import Counter, Gauge, Histogram
except ImportError:  # pragma: no cover - optional dependency
    Counter = None
    Gauge = None
    Histogram = None


if Histogram:
    INTRADAY_COHORT_RUNTIME = Histogram(
        "intraday_cohort_runtime_seconds",
        "Runtime of intraday cohort orchestration runs",
        ["cohort_id"],
    )
    COHORT_API_LATENCY = Histogram(
        "intraday_cohort_api_latency_seconds",
        "Latency of intraday cohort API responses",
        ["route"],
    )
else:  # pragma: no cover - fallback
    INTRADAY_COHORT_RUNTIME = None
    COHORT_API_LATENCY = None

if Gauge:
    INTRADAY_FAILED_AGENTS = Gauge(
        "intraday_cohort_failed_agents",
        "Number of agents that registered alerts during a cohort run",
        ["cohort_id"],
    )
    INTRADAY_BANKROLL_UTIL = Gauge(
        "intraday_cohort_bankroll_utilisation",
        "Parent bankroll utilisation percentage",
        ["cohort_id"],
    )
    INTRADAY_ALERT_COUNT = Gauge(
        "intraday_cohort_alert_count",
        "Total alerts emitted during cohort orchestration",
        ["cohort_id"],
    )
else:  # pragma: no cover - fallback
    INTRADAY_FAILED_AGENTS = None
    INTRADAY_BANKROLL_UTIL = None
    INTRADAY_ALERT_COUNT = None

# Macro regime risk metrics
if Counter:
    REGIME_RISK_ADJUSTMENTS = Counter(
        "regime_risk_adjustments_total",
        "Total number of regime-based risk adjustments applied",
        ["symbol", "regime_trend", "regime_volatility"],
    )
    REGIME_SIGNIFICANT_REDUCTIONS = Counter(
        "regime_significant_reductions_total",
        "Total number of significant position reductions due to regime",
        ["symbol", "regime_trend", "regime_volatility"],
    )
else:  # pragma: no cover - fallback
    REGIME_RISK_ADJUSTMENTS = None
    REGIME_SIGNIFICANT_REDUCTIONS = None

if Gauge:
    REGIME_RISK_MULTIPLIER = Gauge(
        "regime_risk_multiplier",
        "Current regime-based risk multiplier for a symbol",
        ["symbol"],
    )
    REGIME_CACHE_SIZE = Gauge(
        "regime_cache_size",
        "Number of cached regime multipliers",
    )
else:  # pragma: no cover - fallback
    REGIME_RISK_MULTIPLIER = None
    REGIME_CACHE_SIZE = None


def _record_histogram(metric: Histogram | None, *, labels: Dict[str, str], value: float) -> None:
    if metric is None:
        return
    metric.labels(**labels).observe(value)


def _record_gauge(metric: Gauge | None, *, labels: Dict[str, str], value: float) -> None:
    if metric is None:
        return
    metric.labels(**labels).set(value)


def record_intraday_cohort_metrics(
    *,
    cohort_id: str,
    runtime_seconds: float,
    parent_snapshot: Dict[str, Any],
    agents: List[Dict[str, Any]],
    alerts: List[Dict[str, Any]],
) -> None:
    failed_agents = len([agent for agent in agents if agent.get("alerts")])
    utilisation = float(parent_snapshot.get("utilization", 0.0))
    _record_histogram(INTRADAY_COHORT_RUNTIME, labels={"cohort_id": cohort_id}, value=max(runtime_seconds, 0.0))
    _record_gauge(INTRADAY_FAILED_AGENTS, labels={"cohort_id": cohort_id}, value=failed_agents)
    _record_gauge(INTRADAY_BANKROLL_UTIL, labels={"cohort_id": cohort_id}, value=utilisation)
    _record_gauge(INTRADAY_ALERT_COUNT, labels={"cohort_id": cohort_id}, value=len(alerts))


def observe_cohort_api_latency(*, route: str, latency_seconds: float) -> None:
    _record_histogram(COHORT_API_LATENCY, labels={"route": route}, value=max(latency_seconds, 0.0))


def _record_counter(metric: Counter | None, *, labels: Dict[str, str], value: float = 1.0) -> None:
    """Record a counter metric."""
    if metric is None:
        return
    metric.labels(**labels).inc(value)


def record_regime_risk_adjustment(
    *,
    symbol: str,
    regime_trend: str,
    regime_volatility: str,
    multiplier: float,
    is_significant_reduction: bool = False,
) -> None:
    """Record a regime-based risk adjustment.
    
    Args:
        symbol: Trading pair symbol
        regime_trend: Trend regime (e.g., 'TRENDING_UP', 'SIDEWAYS')
        regime_volatility: Volatility regime (e.g., 'HIGH_VOLATILITY', 'LOW_VOLATILITY')
        multiplier: Applied risk multiplier
        is_significant_reduction: Whether this was a significant reduction (>30% default)
    """
    labels = {
        "symbol": symbol,
        "regime_trend": regime_trend,
        "regime_volatility": regime_volatility,
    }
    
    _record_counter(REGIME_RISK_ADJUSTMENTS, labels=labels)
    
    if is_significant_reduction:
        _record_counter(REGIME_SIGNIFICANT_REDUCTIONS, labels=labels)
    
    _record_gauge(REGIME_RISK_MULTIPLIER, labels={"symbol": symbol}, value=multiplier)


def record_regime_cache_size(*, cache_size: int) -> None:
    """Record the current regime cache size.
    
    Args:
        cache_size: Number of cached regime multipliers
    """
    _record_gauge(REGIME_CACHE_SIZE, labels={}, value=float(cache_size))
