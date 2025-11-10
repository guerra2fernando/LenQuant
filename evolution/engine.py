from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from strategy_genome.encoding import create_genome_from_dict
from strategy_genome.repository import list_genomes

from . import repository
from .evaluator import evaluate_batch
from .mutator import MutationConfig, generate_mutations
from .promoter import apply_decision, decide_promotion
from .schemas import (
    EvaluationConfig,
    EvaluationResult,
    MutationGeneration,
    PromotionDecision,
    PromotionPolicy,
)

logger = logging.getLogger(__name__)


@dataclass
class EvolutionSchedulerState:
    scheduler_id: str = "daily_evolution"
    enabled: bool = True
    cron: str = "0 3 * * *"
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    notes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "scheduler_id": self.scheduler_id,
            "enabled": self.enabled,
            "cron": self.cron,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "next_run": self.next_run.isoformat() if self.next_run else None,
            "notes": list(self.notes),
        }
        return payload


class EvolutionEngine:
    """Coordinates mutation, evaluation, promotion, and knowledge recording."""

    def __init__(
        self,
        *,
        mutation_config: Optional[MutationConfig] = None,
        evaluation_config: Optional[EvaluationConfig] = None,
        promotion_policy: Optional[PromotionPolicy] = None,
        knowledge_service: Any = None,
    ) -> None:
        self.mutation_config = mutation_config or MutationConfig()
        self.evaluation_config = evaluation_config or EvaluationConfig()
        self.promotion_policy = promotion_policy or PromotionPolicy()
        self.knowledge_service = knowledge_service

    def _select_parents(self, limit: int = 5) -> List[Any]:
        parents_docs = list_genomes(status="champion", limit=limit)
        parents = [create_genome_from_dict(doc) for doc in parents_docs]
        return parents

    def _generate_candidates(self, parents: List[Any]) -> List[MutationGeneration]:
        if not parents:
            logger.warning("No champion genomes available for mutation.")
            return []
        generations = generate_mutations(parents, self.mutation_config)
        return generations

    def _enqueue_candidates(self, generations: List[MutationGeneration]) -> List[Dict[str, Any]]:
        candidates = [candidate for generation in generations for candidate in generation.produced]
        if not candidates:
            return []
        created = repository.create_experiments(candidates)
        logger.info("Queued %s evolution experiments.", len(created))
        return created

    def _evaluate(self, experiment_ids: List[str]) -> List[EvaluationResult]:
        if not experiment_ids:
            return []
        batch = experiment_ids[: self.evaluation_config.max_concurrent]
        results = evaluate_batch(batch, self.evaluation_config)
        return results

    def _promote(self, experiment_ids: List[str]) -> List[PromotionDecision]:
        decisions: List[PromotionDecision] = []
        for experiment_id in experiment_ids:
            decision = decide_promotion(experiment_id, self.promotion_policy)
            if decision:
                apply_decision(decision)
                decisions.append(decision)
        return decisions

    def _record_knowledge(self, evaluations: List[EvaluationResult], decisions: List[PromotionDecision]) -> None:
        if not self.knowledge_service or not evaluations:
            return
        try:
            self.knowledge_service.record_cycle(evaluations, decisions)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to record knowledge cycle: %s", exc)

    def run_cycle(self) -> Dict[str, Any]:
        parents = self._select_parents()
        generations = self._generate_candidates(parents)
        queued_docs = self._enqueue_candidates(generations)
        experiment_ids = [doc["experiment_id"] for doc in queued_docs]
        evaluations = self._evaluate(experiment_ids)
        decisions = self._promote([result.experiment_id for result in evaluations])
        self._record_knowledge(evaluations, decisions)
        summary = {
            "parents_considered": len(parents),
            "candidates_generated": sum(len(gen.produced) for gen in generations),
            "experiments_created": len(queued_docs),
            "evaluations_completed": len(evaluations),
            "promotions": len([d for d in decisions if d.approved]),
            "rejections": len([d for d in decisions if not d.approved]),
            "experiment_ids": experiment_ids,
        }
        return summary


def toggle_scheduler(enabled: bool) -> Dict[str, Any]:
    state = repository.upsert_scheduler_state({"enabled": enabled})
    return state


def save_scheduler_config(state: EvolutionSchedulerState) -> Dict[str, Any]:
    payload = state.to_dict()
    stored = repository.upsert_scheduler_state(payload)
    return stored


