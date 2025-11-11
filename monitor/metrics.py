from __future__ import annotations

from typing import Any, Dict, List

try:
    from prometheus_client import Gauge, Histogram
except ImportError:  # pragma: no cover - optional dependency
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
