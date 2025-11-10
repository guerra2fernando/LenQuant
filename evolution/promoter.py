from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, Optional

from strategy_genome.repository import archive_strategy, get_genome, promote_strategy

from .repository import load_experiment, update_experiment
from .schemas import PromotionDecision, PromotionPolicy

logger = logging.getLogger(__name__)


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


