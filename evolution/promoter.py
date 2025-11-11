from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, Optional, Tuple, List

from db.client import get_database_name, mongo_client
from exec.risk_manager import (
    ModeSettings,
    TradingSettings,
    get_trading_settings,
    save_trading_settings,
)
from strategy_genome.repository import archive_strategy, get_genome, promote_strategy

from .repository import load_experiment, update_experiment
from .schemas import PromotionDecision, PromotionPolicy

logger = logging.getLogger(__name__)

PROMOTION_LOG_COLLECTION = "promotion_log"
PROMOTION_AUDIT_COLLECTION = "promotion_audit_events"
INTRADAY_COLLECTION = "sim_runs_intraday"
INTRADAY_SUMMARY_COLLECTION = "cohort_summaries"


def _candidate_metrics(experiment: Dict[str, Any]) -> Dict[str, Any]:
    metrics = experiment.get("metrics") or {}
    if metrics:
        return metrics
    candidate = experiment.get("candidate") or {}
    genome = candidate.get("genome") or {}
    return genome.get("fitness", {})


def _parent_metrics(parent_id: Optional[str]) -> Dict[str, Any]:
    if not parent_id:
        return {}
    parent_doc = get_genome(parent_id)
    if not parent_doc:
        return {}
    return parent_doc.get("fitness", {})


def decide_promotion(experiment_id: str, policy: PromotionPolicy) -> Optional[PromotionDecision]:
    experiment = load_experiment(experiment_id)
    if not experiment:
        return None
    candidate = experiment.get("candidate") or {}
    genome = (candidate.get("genome") or {}).copy()
    strategy_id = genome.get("strategy_id") or experiment.get("strategy_id")
    parent_id = candidate.get("parent_id")
    metrics = _candidate_metrics(experiment)
    parent_metrics = _parent_metrics(parent_id)

    if not strategy_id:
        logger.warning("Experiment %s missing strategy identifier", experiment_id)
        return PromotionDecision(
            strategy_id="unknown",
            parent_id=parent_id,
            approved=False,
            reason="missing_strategy_id",
        )

    if experiment.get("status") != "completed":
        return PromotionDecision(
            strategy_id=strategy_id,
            parent_id=parent_id,
            approved=False,
            reason="experiment_not_completed",
        )

    passed = policy.passes(metrics, parent_metrics if parent_metrics else None)
    reason = "threshold_met" if passed else "threshold_not_met"
    return PromotionDecision(
        strategy_id=strategy_id,
        parent_id=parent_id,
        approved=passed,
        reason=reason,
        metadata={
            "metrics": metrics,
            "parent_metrics": parent_metrics,
            "experiment_id": experiment_id,
            "score": experiment.get("score", 0.0),
        },
    )


def apply_decision(decision: PromotionDecision) -> Dict[str, Any]:
    experiment_id = decision.metadata.get("experiment_id") if decision.metadata else None
    updates = {
        "updated_at": datetime.utcnow(),
        "promotion": {
            "approved": decision.approved,
            "reason": decision.reason,
            "decision_at": decision.effective_at,
            "metadata": decision.metadata,
        },
    }
    if decision.approved:
        promoted = promote_strategy(decision.strategy_id)
        if decision.parent_id:
            archive_strategy(decision.parent_id)
        updates["status"] = "promoted"
        updates["candidate.genome"] = promoted
    else:
        updates["status"] = "rejected"
    if experiment_id:
        update_experiment(experiment_id, updates)
    return updates


def _load_cohort_documents(cohort_id: str) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        cohort = db[INTRADAY_COLLECTION].find_one({"cohort_id": cohort_id})
        summary = db[INTRADAY_SUMMARY_COLLECTION].find_one({"cohort_id": cohort_id})
    return cohort, summary


def _log_promotion(entry: Dict[str, Any]) -> None:
    payload = {**entry, "created_at": datetime.utcnow()}
    with mongo_client() as client:
        db = client[get_database_name()]
        db[PROMOTION_LOG_COLLECTION].insert_one(payload)


def _log_audit_event(event: Dict[str, Any]) -> None:
    record = {**event, "created_at": datetime.utcnow()}
    with mongo_client() as client:
        db = client[get_database_name()]
        db[PROMOTION_AUDIT_COLLECTION].insert_one(record)


def promote_intraday_candidate(
    cohort_id: str,
    *,
    bankroll_slice_pct: float = 0.05,
    min_allocation_usd: float = 50.0,
    min_trade_count: int = 6,
    max_slippage_pct: float = 0.01,
    max_parent_drawdown: float = 0.12,
) -> Dict[str, Any]:
    cohort_doc, summary_doc = _load_cohort_documents(cohort_id)
    if not cohort_doc or not summary_doc:
        logger.warning("Cohort %s not found for promotion", cohort_id)
        return {"status": "cohort_not_found", "cohort_id": cohort_id}

    bankroll = float(cohort_doc.get("bankroll") or summary_doc.get("bankroll") or 0.0)
    if bankroll <= 0:
        return {"status": "invalid_bankroll", "cohort_id": cohort_id}

    agents: List[Dict[str, Any]] = cohort_doc.get("agents") or []
    if not agents:
        return {"status": "no_agents", "cohort_id": cohort_id}

    def _aggregate_score(agent: Dict[str, Any]) -> Tuple[float, Dict[str, Any]]:
        metrics = dict(agent.get("metrics") or {})
        roi = float(metrics.get("roi", 0.0))
        sharpe = float(metrics.get("sharpe", 0.0))
        trade_count = int(metrics.get("trade_count") or 0)
        slippage = abs(float(metrics.get("avg_slippage_pct") or metrics.get("slippage_pct") or 0.0))
        drawdown = float(metrics.get("max_drawdown_parent") or metrics.get("max_drawdown") or 0.0)
        liquidity = float(metrics.get("max_exposure") or 0.0)
        return (
            roi + (0.5 * sharpe),
            {
                "metrics": metrics,
                "trade_count": trade_count,
                "slippage": slippage,
                "drawdown": drawdown,
                "liquidity": liquidity,
            },
        )

    eligible: List[Tuple[float, Dict[str, Any], Dict[str, Any]]] = []
    for agent in agents:
        score, meta = _aggregate_score(agent)
        if meta["trade_count"] < min_trade_count:
            continue
        if meta["slippage"] > max_slippage_pct:
            continue
        if meta["drawdown"] > max_parent_drawdown:
            continue
        eligible.append((score, agent, meta))

    if not eligible:
        return {"status": "no_eligible_candidate", "cohort_id": cohort_id}

    eligible.sort(key=lambda item: item[0], reverse=True)
    _, best_agent, meta = eligible[0]

    allocation = bankroll * bankroll_slice_pct
    allocation = max(min_allocation_usd, allocation)
    allocation = min(allocation, bankroll)

    settings = get_trading_settings()
    live_mode = settings.modes.get("live") or ModeSettings()
    live_mode = live_mode.copy(
        update={
            "enabled": True,
            "allow_margin": True,
            "max_notional_usd": max(float(live_mode.max_notional_usd), allocation),
        }
    )
    modes = dict(settings.modes)
    modes["live"] = live_mode
    updated_settings = TradingSettings.parse_obj(
        {
            **settings.dict(exclude={"modes"}),
            "modes": {name: mode.dict() for name, mode in modes.items()},
        }
    )
    save_trading_settings(updated_settings)

    promotion_record = {
        "cohort_id": cohort_id,
        "strategy_id": best_agent.get("strategy_id"),
        "run_id": best_agent.get("run_id"),
        "allocation": allocation,
        "bankroll": bankroll,
        "metrics": meta["metrics"],
        "trade_count": meta["trade_count"],
        "slippage_pct": meta["slippage"],
        "drawdown": meta["drawdown"],
        "liquidity": meta["liquidity"],
        "summary_confidence": summary_doc.get("confidence_score"),
    }
    _log_promotion(promotion_record)

    audit_payload = {
        "cohort_id": cohort_id,
        "strategy_id": best_agent.get("strategy_id"),
        "allocation": allocation,
        "status": "pending_manual_review",
        "notes": summary_doc.get("alerts", []),
    }
    _log_audit_event(audit_payload)

    return {
        "status": "candidate_selected",
        "cohort_id": cohort_id,
        "strategy_id": best_agent.get("strategy_id"),
        "allocation": allocation,
        "metrics": meta["metrics"],
    }

