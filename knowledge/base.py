from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence

from ai import HypothesisAgent
from evolution.repository import load_experiment
from evolution.schemas import EvaluationResult, PromotionDecision
from knowledge import repository as knowledge_repository


def _week_period(dt: datetime) -> str:
    year, week, _ = dt.isocalendar()
    return f"{year}-W{week:02d}"


def _evaluation_payload(results: Sequence[EvaluationResult]) -> List[Dict[str, Any]]:
    payload: List[Dict[str, Any]] = []
    for result in results:
        experiment = load_experiment(result.experiment_id) or {}
        candidate = experiment.get("candidate") or {}
        metadata = candidate.get("metadata") or {}
        payload.append(
            {
                "experiment_id": result.experiment_id,
                "strategy_id": result.strategy_id,
                "metrics": result.metrics,
                "score": result.score,
                "features": metadata.get("features", []),
                "horizon": metadata.get("horizon"),
                "model_type": metadata.get("model_type"),
            }
        )
    return payload


def _decision_payload(decisions: Sequence[PromotionDecision]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for decision in decisions:
        rows.append(
            {
                "strategy_id": decision.strategy_id,
                "parent_id": decision.parent_id,
                "approved": decision.approved,
                "reason": decision.reason,
                "effective_at": decision.effective_at.isoformat(),
                "metadata": decision.metadata,
            }
        )
    return rows


def _feature_correlations(evaluations: Sequence[Dict[str, Any]]) -> Dict[str, float]:
    buckets: Dict[str, List[float]] = defaultdict(list)
    for row in evaluations:
        roi = float(row.get("metrics", {}).get("roi", 0.0))
        for feature in row.get("features", []):
            buckets[feature].append(roi)
    correlations = {feature: sum(values) / len(values) for feature, values in buckets.items() if values}
    return correlations


class KnowledgeBaseService:
    """High-level interface coordinating knowledge base persistence."""

    def __init__(self, agent: Optional[HypothesisAgent] = None) -> None:
        self.agent = agent or HypothesisAgent()

    def record_cycle(
        self,
        evaluations: Sequence[EvaluationResult],
        decisions: Sequence[PromotionDecision],
        *,
        period: Optional[str] = None,
    ) -> Dict[str, Any]:
        evaluation_rows = _evaluation_payload(evaluations)
        decision_rows = _decision_payload(decisions)
        report = self.agent.analyse(
            [
                {
                    "strategy_id": row["strategy_id"],
                    **row["metrics"],
                    "score": row["score"],
                    "horizon": row["horizon"],
                    "model_type": row["model_type"],
                }
                for row in evaluation_rows
            ],
            decision_rows,
        )
        entry_period = period or _week_period(datetime.utcnow())
        entry_payload = {
            "period": entry_period,
            **report.to_entry(),
            "evaluation_count": len(evaluation_rows),
            "decisions": decision_rows,
            "feature_correlations": _feature_correlations(evaluation_rows),
            "agent_provider": report.provider,
        }
        stored = knowledge_repository.record_entry(entry_payload)
        return stored

    def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        entries = knowledge_repository.list_entries(limit=100)
        query_lower = query.lower()
        filtered = [
            entry
            for entry in entries
            if query_lower in (entry.get("summary") or "").lower()
            or any(query_lower in insight.lower() for insight in entry.get("insights", []))
        ]
        return filtered[:limit]

    def pin_entry(self, period: str) -> Dict[str, Any]:
        entry = knowledge_repository.get_entry_by_period(period)
        if not entry:
            raise ValueError(f"No knowledge entry for period '{period}'")
        update = knowledge_repository.record_entry({**entry, "pinned": True})
        return update


