from __future__ import annotations

import csv
import logging
import io
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Sequence

from celery.result import AsyncResult
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, validator

from db.client import get_database_name, mongo_client
from evolution.promoter import promote_intraday_candidate
from manager.experiment_runner import (
    ExperimentRequest,
    IntradayCohortRequest,
    launch_intraday_cohort,
    run_experiment_cycle,
)
from manager.tasks import celery_app, run_experiment_cycle_task
from monitor.metrics import observe_cohort_api_latency
from strategy_genome.repository import fetch_queue, reprioritize_queue

router = APIRouter()

logger = logging.getLogger(__name__)


class ExperimentPayload(BaseModel):
    symbol: Optional[str] = Field(None, description="Trading symbol to evaluate, e.g., BTC/USDT")
    interval: Optional[str] = Field(None, description="Base timeframe, e.g., 1m")
    horizon: Optional[str] = Field(None, description="Forecast horizon, defaults to interval")
    accounts: Optional[int] = Field(20, ge=1, le=200, description="Number of simulations to run")
    mutations_per_parent: Optional[int] = Field(5, ge=1, le=20)
    champion_limit: Optional[int] = Field(5, ge=1, le=20)
    queue_only: bool = False
    families: Optional[List[str]] = Field(default=None)

    @validator("families", pre=True)
    def sanitize_families(cls, value: Optional[List[str]]) -> Optional[List[str]]:  # noqa: D401 - simple sanitizer
        if value is None:
            return None
        return [family.strip() for family in value if family.strip()]


class IntradayLaunchPayload(BaseModel):
    bankroll: float = Field(..., gt=0, description="Shared bankroll for the intraday cohort")
    agent_count: int = Field(30, ge=1, le=200, description="Number of agent simulations to include in the cohort")
    allocation_policy: str = Field(
        default="equal", description="Allocation policy for bankroll split (equal or risk-weighted)"
    )
    leverage_ceiling: Optional[float] = Field(
        default=5.0,
        gt=0,
        description="Maximum leverage multiple allowed per agent. Leave null to disable leverage checks.",
    )
    exposure_limit: Optional[float] = Field(
        default=None,
        gt=0,
        description="Parent wallet aggregate exposure limit. Defaults to bankroll when omitted.",
    )
    start_time: Optional[datetime] = Field(
        default=None, description="Lower bound of the simulation window (ISO 8601). Defaults to manager settings."
    )
    end_time: Optional[datetime] = Field(
        default=None, description="Upper bound of the simulation window (ISO 8601). Defaults to manager settings."
    )
    symbol: Optional[str] = Field(default=None, description="Market symbol override, e.g., BTC/USDT")
    interval: Optional[str] = Field(default=None, description="Sampling interval override, e.g., 1m")
    horizon: Optional[str] = Field(default=None, description="Forecast horizon override")
    families: Optional[List[str]] = Field(
        default=None, description="Strategy families to seed the cohort with. Defaults to manager configuration."
    )
    mutations_per_parent: Optional[int] = Field(
        default=2, ge=1, le=10, description="How many variants to spawn per champion strategy"
    )
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Extra metadata tags to persist with the run")

    @validator("families", pre=True)
    def sanitize_families(cls, value: Optional[Sequence[str]]) -> Optional[List[str]]:  # noqa: D401 - simple sanitizer
        if value is None:
            return None
        return [str(item).strip() for item in value if str(item).strip()]

    @validator("end_time")
    def validate_window(cls, end_time: Optional[datetime], values: Dict[str, Any]) -> Optional[datetime]:
        start_time = values.get("start_time")
        if start_time and end_time and end_time <= start_time:
            raise ValueError("end_time must be greater than start_time.")
        return end_time


class PromotionRequestPayload(BaseModel):
    bankroll_slice_pct: float = Field(
        default=0.05,
        gt=0,
        le=1,
        description="Fraction of cohort bankroll to allocate to the promoted strategy.",
    )
    min_allocation_usd: float = Field(
        default=50.0, gt=0, description="Minimum live allocation regardless of bankroll percentage."
    )
    min_trade_count: int = Field(
        default=6,
        ge=1,
        le=500,
        description="Minimum trades executed by the candidate during the cohort window.",
    )
    max_slippage_pct: float = Field(
        default=0.01,
        gt=0,
        le=0.2,
        description="Maximum tolerated average slippage percentage for the candidate.",
    )
    max_parent_drawdown: float = Field(
        default=0.12,
        ge=0,
        le=1,
        description="Maximum tolerated drawdown versus parent bankroll during the cohort window.",
    )
    approval_notes: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Operator approval notes to append to the promotion audit log.",
    )
    acknowledge_risks: bool = Field(
        default=False,
        description="Operators must acknowledge the guard rails before requesting promotion.",
    )

class ReprioritizePayload(BaseModel):
    queue_ids: List[str] = Field(..., min_items=1)


@router.get("/queue")
def get_queue(status: Optional[str] = None) -> Dict[str, Any]:
    return {"queue": fetch_queue(status=status)}


@router.post("/run")
def post_run_experiments(payload: ExperimentPayload) -> Dict[str, Any]:
    request = ExperimentRequest(
        symbol=payload.symbol,
        interval=payload.interval,
        horizon=payload.horizon,
        accounts=payload.accounts or 20,
        mutations_per_parent=payload.mutations_per_parent or 5,
        champion_limit=payload.champion_limit or 5,
        queue_only=payload.queue_only,
        families=payload.families or ["ema-cross"],
    )
    if payload.queue_only:
        summary = run_experiment_cycle(request)
        return {"summary": summary, "mode": "queue_only"}

    task = run_experiment_cycle_task.delay(request.to_dict())
    status = (task.status or "PENDING").lower()
    return {"task_id": task.id, "status": status}


@router.post("/reprioritize")
def post_reprioritize(payload: ReprioritizePayload) -> Dict[str, Any]:
    reordered = reprioritize_queue(payload.queue_ids)
    if not reordered:
        raise HTTPException(status_code=404, detail="No queue items were reprioritized.")
    return {"queue": reordered}


@router.get("/tasks/{task_id}")
def get_experiment_task(task_id: str) -> Dict[str, Any]:
    result = AsyncResult(task_id, app=celery_app)
    status = (result.status or "PENDING").lower()
    response: Dict[str, Any] = {"task_id": task_id, "status": status}
    if result.successful():
        response["result"] = result.result
    elif result.failed():
        response["error"] = str(result.result)
    return response


def _cohort_filters(date: Optional[str], bankroll: Optional[float]) -> Dict[str, Any]:
    filters: Dict[str, Any] = {}
    if date:
        try:
            parsed = datetime.fromisoformat(date)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid date format. Use ISO 8601 (YYYY-MM-DD).") from exc
        day_start = parsed.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        filters["created_at"] = {"$gte": day_start, "$lt": day_end}
    if bankroll is not None:
        filters["bankroll"] = bankroll
    return filters


def _serialise_cohort(doc: Dict[str, Any]) -> Dict[str, Any]:
    created_at = doc.get("created_at")
    created_iso = created_at.isoformat() if isinstance(created_at, datetime) else created_at
    agents = []
    for agent in doc.get("agents", []):
        metrics = agent.get("metrics", {}) or {}
        agents.append(
            {
                "strategy_id": agent.get("strategy_id"),
                "run_id": agent.get("run_id"),
                "allocation": agent.get("allocation"),
                "roi": metrics.get("roi"),
                "realized_pnl": metrics.get("realized_pnl"),
                "confidence_score": metrics.get("confidence_score"),
            }
        )
    return {
        "cohort_id": doc.get("cohort_id"),
        "created_at": created_iso,
        "bankroll": doc.get("bankroll"),
        "agent_count": doc.get("agent_count"),
        "allocation_policy": doc.get("allocation_policy"),
        "summary": doc.get("summary", {}),
        "alerts": doc.get("alerts", []),
        "agents": agents,
        "csv_url": f"/api/experiments/cohorts/{doc.get('cohort_id')}/export.csv",
    }


def _serialise_datetime(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _serialise_window(window: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not window:
        return None
    return {key: _serialise_datetime(val) for key, val in window.items()}


def _serialise_alert(alert: Dict[str, Any]) -> Dict[str, Any]:
    metadata = alert.get("metadata")
    if isinstance(metadata, dict):
        metadata = {key: _serialise_datetime(val) for key, val in metadata.items()}
    return {
        "type": alert.get("type"),
        "message": alert.get("message"),
        "severity": alert.get("severity"),
        "created_at": _serialise_datetime(alert.get("created_at")),
        "metadata": metadata,
    }


def _serialise_metrics(metrics: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not metrics:
        return {}
    return {key: _serialise_datetime(value) for key, value in metrics.items()}


def _serialise_agent_detail(agent: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "strategy_id": agent.get("strategy_id"),
        "run_id": agent.get("run_id"),
        "allocation": agent.get("allocation"),
        "metrics": _serialise_metrics(agent.get("metrics")),
        "alerts": [_serialise_alert(alert) for alert in agent.get("alerts", [])],
    }


def _serialise_parent_snapshot(parent: Dict[str, Any]) -> Dict[str, Any]:
    starting_balance = float(parent.get("starting_balance") or 0.0)
    balance = float(parent.get("balance") or 0.0)
    equity = float(parent.get("equity") or 0.0)
    utilization = float(parent.get("utilization") or 0.0)
    aggregate_exposure = float(parent.get("aggregate_exposure") or 0.0)
    realized_pnl = float(parent.get("realized_pnl") or 0.0)
    drawdown_pct = 0.0
    if starting_balance > 0 and realized_pnl < 0:
        drawdown_pct = abs(realized_pnl) / starting_balance
    ledger = parent.get("ledger") or []
    recent_ledger = [
        {
            "timestamp": _serialise_datetime(entry.get("timestamp")),
            "account": entry.get("account"),
            "entry_type": entry.get("entry_type"),
            "amount": entry.get("amount"),
            "parent_balance_after": entry.get("parent_balance_after"),
            "metadata": entry.get("metadata"),
        }
        for entry in ledger[-12:]
    ]
    return {
        "name": parent.get("name"),
        "starting_balance": starting_balance,
        "balance": balance,
        "equity": equity,
        "utilization": utilization,
        "aggregate_exposure": aggregate_exposure,
        "exposure_limit": parent.get("exposure_limit"),
        "leverage_ceiling": parent.get("leverage_ceiling"),
        "realized_pnl": realized_pnl,
        "drawdown_pct": drawdown_pct,
        "capital_assigned": parent.get("capital_assigned") or {},
        "capital_outstanding": parent.get("capital_outstanding") or {},
        "current_exposures": parent.get("current_exposures") or {},
        "metadata": parent.get("metadata") or {},
        "ledger_recent": recent_ledger,
    }


def _serialise_summary(summary: Dict[str, Any]) -> Dict[str, Any]:
    payload = dict(summary)
    generated_at = payload.get("generated_at")
    if generated_at:
        payload["generated_at"] = _serialise_datetime(generated_at)
    payload["window"] = _serialise_window(payload.get("window"))
    payload["alerts"] = [_serialise_alert(alert) for alert in payload.get("alerts", [])]
    return payload


def _serialise_cohort_detail_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "cohort_id": doc.get("cohort_id"),
        "created_at": _serialise_datetime(doc.get("created_at")),
        "symbol": doc.get("symbol"),
        "interval": doc.get("interval"),
        "horizon": doc.get("horizon"),
        "bankroll": doc.get("bankroll"),
        "allocation_policy": doc.get("allocation_policy"),
        "agent_count": doc.get("agent_count"),
        "failed_agents": doc.get("failed_agents"),
        "runtime_seconds": doc.get("runtime_seconds"),
        "window": _serialise_window(doc.get("window")),
        "alerts": [_serialise_alert(alert) for alert in doc.get("alerts", [])],
        "metadata": doc.get("metadata") or {},
        "agents": [_serialise_agent_detail(agent) for agent in doc.get("agents", [])],
    }


def _serialise_launch_result(result: Dict[str, Any]) -> Dict[str, Any]:
    payload = _serialise_cohort_detail_doc(result)
    payload["summary"] = _serialise_summary(result.get("summary") or {})
    payload["parent_wallet"] = _serialise_parent_snapshot(result.get("parent_wallet") or {})
    payload["alerts"] = [_serialise_alert(alert) for alert in result.get("alerts", [])]
    return payload


DEFAULT_GUARD_RAILS = {
    "min_trade_count": 6,
    "max_slippage_pct": 0.01,
    "max_candidate_drawdown": 0.12,
    "max_parent_drawdown": 0.12,
    "max_utilization_pct": 0.95,
}
DEFAULT_PROMOTION_SLICE = 0.05
DEFAULT_MIN_PROMOTION_USD = 50.0


def _find_best_agent_doc(
    agents: Sequence[Dict[str, Any]], strategy_id: Optional[str]
) -> Optional[Dict[str, Any]]:
    if not strategy_id:
        return None
    for agent in agents:
        if agent.get("strategy_id") == strategy_id:
            return agent
    return None


def _build_promotion_preview(
    cohort_doc: Dict[str, Any],
    summary_doc: Dict[str, Any],
    parent_snapshot: Dict[str, Any],
) -> Dict[str, Any]:
    bankroll = float(cohort_doc.get("bankroll") or 0.0)
    utilization_pct = float(summary_doc.get("bankroll_utilization_pct") or 0.0)
    best_agent_summary = summary_doc.get("best_agent") or {}
    agents = cohort_doc.get("agents") or []
    best_agent_doc = _find_best_agent_doc(agents, best_agent_summary.get("strategy_id"))
    best_metrics = _serialise_metrics(best_agent_doc.get("metrics") if best_agent_doc else {}) if best_agent_doc else {}
    trade_count = int(best_metrics.get("trade_count") or 0)
    slippage_pct = abs(
        float(
            best_metrics.get("avg_slippage_pct")
            or best_metrics.get("slippage_pct")
            or best_metrics.get("avg_slippage")
            or 0.0
        )
    )
    candidate_drawdown = float(best_metrics.get("max_drawdown_parent") or 0.0)
    parent_drawdown = float(parent_snapshot.get("drawdown_pct") or 0.0)
    leverage_breaches = summary_doc.get("leverage_breaches") or []
    alerts = summary_doc.get("alerts") or []
    high_severity_alerts = [
        alert for alert in alerts if (alert.get("severity") or "warning").lower() in {"warning", "error", "critical"}
    ]

    checks = [
        {
            "id": "min_trade_count",
            "label": f"Best agent executed at least {DEFAULT_GUARD_RAILS['min_trade_count']} trades",
            "status": trade_count >= DEFAULT_GUARD_RAILS["min_trade_count"],
            "value": trade_count,
            "threshold": DEFAULT_GUARD_RAILS["min_trade_count"],
        },
        {
            "id": "max_slippage_pct",
            "label": "Average slippage within tolerance (≤ 1%)",
            "status": slippage_pct <= DEFAULT_GUARD_RAILS["max_slippage_pct"],
            "value": slippage_pct,
            "threshold": DEFAULT_GUARD_RAILS["max_slippage_pct"],
        },
        {
            "id": "candidate_parent_drawdown",
            "label": "Candidate drawdown within parent limit (≤ 12%)",
            "status": candidate_drawdown <= DEFAULT_GUARD_RAILS["max_candidate_drawdown"],
            "value": candidate_drawdown,
            "threshold": DEFAULT_GUARD_RAILS["max_candidate_drawdown"],
        },
        {
            "id": "parent_drawdown",
            "label": "Parent bankroll drawdown ≤ 12%",
            "status": parent_drawdown <= DEFAULT_GUARD_RAILS["max_parent_drawdown"],
            "value": parent_drawdown,
            "threshold": DEFAULT_GUARD_RAILS["max_parent_drawdown"],
        },
        {
            "id": "utilization",
            "label": "Bankroll utilization below 95%",
            "status": utilization_pct <= DEFAULT_GUARD_RAILS["max_utilization_pct"],
            "value": utilization_pct,
            "threshold": DEFAULT_GUARD_RAILS["max_utilization_pct"],
        },
        {
            "id": "leverage_breaches",
            "label": "No leverage breaches recorded",
            "status": len(leverage_breaches) == 0,
            "value": len(leverage_breaches),
            "threshold": 0,
        },
        {
            "id": "alerts",
            "label": "No high-severity cohort alerts",
            "status": len(high_severity_alerts) == 0,
            "value": len(high_severity_alerts),
            "threshold": 0,
        },
    ]
    promotion_ready = all(check["status"] for check in checks)
    recommended_allocation = bankroll * DEFAULT_PROMOTION_SLICE
    if recommended_allocation < DEFAULT_MIN_PROMOTION_USD:
        recommended_allocation = DEFAULT_MIN_PROMOTION_USD
    if recommended_allocation > bankroll > 0:
        recommended_allocation = bankroll

    return {
        "ready": promotion_ready,
        "checks": checks,
        "recommended_allocation": recommended_allocation,
        "recommended_bankroll_slice_pct": DEFAULT_PROMOTION_SLICE,
        "best_candidate": {
            "strategy_id": best_agent_summary.get("strategy_id"),
            "run_id": best_agent_summary.get("run_id"),
            "allocation": best_agent_doc.get("allocation") if best_agent_doc else None,
            "metrics": best_metrics,
            "summary": best_agent_summary,
        },
        "leverage_breaches": leverage_breaches,
        "high_severity_alerts": [_serialise_alert(alert) for alert in high_severity_alerts],
        "utilization_pct": utilization_pct,
        "parent_drawdown_pct": parent_drawdown,
        "candidate_drawdown_pct": candidate_drawdown,
        "trade_count": trade_count,
        "slippage_pct": slippage_pct,
    }


def _append_promotion_note(cohort_id: str, note: Optional[str]) -> None:
    if not note:
        return
    log_entry = {
        "cohort_id": cohort_id,
        "note": note,
        "status": "operator_note",
        "created_at": datetime.utcnow(),
        "source": "api",
    }
    with mongo_client() as client:
        db = client[get_database_name()]
        db["promotion_audit_events"].insert_one(log_entry)


@router.post("/cohorts/launch")
def post_launch_intraday_cohort(payload: IntradayLaunchPayload) -> Dict[str, Any]:
    try:
        request = IntradayCohortRequest(
            bankroll=payload.bankroll,
            agent_count=payload.agent_count,
            symbol=payload.symbol,
            interval=payload.interval,
            horizon=payload.horizon,
            allocation_policy=payload.allocation_policy,
            leverage_ceiling=payload.leverage_ceiling,
            exposure_limit=payload.exposure_limit,
            start_time=payload.start_time,
            end_time=payload.end_time,
            families=list(payload.families) if payload.families else None,
            mutations_per_parent=payload.mutations_per_parent or 2,
            metadata=dict(payload.metadata or {}),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        result = launch_intraday_cohort(request)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to launch intraday cohort: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to launch intraday cohort.") from exc

    return {
        "status": "launched",
        "cohort": _serialise_launch_result(result),
    }


@router.get("/cohorts/{cohort_id}")
def get_intraday_cohort_detail(cohort_id: str) -> Dict[str, Any]:
    with mongo_client() as client:
        db = client[get_database_name()]
        cohort_doc = db["sim_runs_intraday"].find_one({"cohort_id": cohort_id})
        summary_doc = db["cohort_summaries"].find_one({"cohort_id": cohort_id})
    if not cohort_doc or not summary_doc:
        raise HTTPException(status_code=404, detail="Cohort not found.")

    parent_snapshot = _serialise_parent_snapshot(cohort_doc.get("parent_wallet") or {})
    cohort_payload = _serialise_cohort_detail_doc(cohort_doc)
    cohort_payload["csv_url"] = f"/api/experiments/cohorts/{cohort_id}/export.csv"
    summary_payload = _serialise_summary(summary_doc)
    promotion_preview = _build_promotion_preview(cohort_doc, summary_doc, parent_snapshot)

    return {
        "cohort": cohort_payload,
        "summary": summary_payload,
        "parent": parent_snapshot,
        "promotion": promotion_preview,
    }


@router.post("/cohorts/{cohort_id}/promote")
def post_promote_intraday_cohort(cohort_id: str, payload: PromotionRequestPayload) -> Dict[str, Any]:
    if not payload.acknowledge_risks:
        raise HTTPException(status_code=400, detail="Risk acknowledgement is required before promotion.")

    result = promote_intraday_candidate(
        cohort_id,
        bankroll_slice_pct=payload.bankroll_slice_pct,
        min_allocation_usd=payload.min_allocation_usd,
        min_trade_count=payload.min_trade_count,
        max_slippage_pct=payload.max_slippage_pct,
        max_parent_drawdown=payload.max_parent_drawdown,
    )

    serialised_result = dict(result)
    if isinstance(serialised_result.get("metrics"), dict):
        serialised_result["metrics"] = _serialise_metrics(serialised_result["metrics"])

    if payload.approval_notes:
        _append_promotion_note(cohort_id, payload.approval_notes)

    status = serialised_result.get("status", "unknown")
    response: Dict[str, Any] = {"status": status, "result": serialised_result}

    if status == "candidate_selected":
        response["message"] = "Promotion candidate selected and recorded."
    else:
        response["message"] = "Promotion guard rails rejected the cohort."

    return response

@router.get("/cohorts")
def list_intraday_cohorts(
    date: Optional[str] = Query(None, description="Filter by cohort creation date (YYYY-MM-DD or ISO-8601)"),
    bankroll: Optional[float] = Query(None, ge=0, description="Exact bankroll filter"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
) -> Dict[str, Any]:
    filters = _cohort_filters(date, bankroll)
    skip = (page - 1) * page_size
    start = time.perf_counter()
    with mongo_client() as client:
        db = client[get_database_name()]
        collection = db["sim_runs_intraday"]
        total = collection.count_documents(filters)
        cursor = (
            collection.find(filters)
            .sort("created_at", -1)
            .skip(skip)
            .limit(page_size)
        )
        docs = list(cursor)

    cohorts = [_serialise_cohort(doc) for doc in docs]
    latency = time.perf_counter() - start
    observe_cohort_api_latency(route="GET /experiments/cohorts", latency_seconds=latency)
    total_pages = (total + page_size - 1) // page_size if page_size else 1
    return {
        "cohorts": cohorts,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
        },
    }


@router.get("/cohorts/{cohort_id}/export.csv")
def export_cohort_csv(cohort_id: str) -> StreamingResponse:
    start = time.perf_counter()
    with mongo_client() as client:
        db = client[get_database_name()]
        doc = db["sim_runs_intraday"].find_one({"cohort_id": cohort_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Cohort not found.")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["strategy_id", "run_id", "allocation", "roi", "realized_pnl", "confidence_score"])
    for agent in doc.get("agents", []):
        metrics = agent.get("metrics", {}) or {}
        writer.writerow(
            [
                agent.get("strategy_id"),
                agent.get("run_id"),
                agent.get("allocation"),
                metrics.get("roi"),
                metrics.get("realized_pnl"),
                metrics.get("confidence_score"),
            ]
        )
    output.seek(0)

    headers = {"Content-Disposition": f"attachment; filename={cohort_id}.csv"}
    latency = time.perf_counter() - start
    observe_cohort_api_latency(route="GET /experiments/cohorts/{cohort_id}/export.csv", latency_seconds=latency)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers=headers)
