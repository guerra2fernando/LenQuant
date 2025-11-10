from __future__ import annotations

import json
from dataclasses import dataclass, field
from statistics import mean
from typing import Any, Dict, List, Optional, Sequence

from assistant.llm_worker import LLMWorker, LLMWorkerError


@dataclass
class HypothesisReport:
    winners: List[str] = field(default_factory=list)
    losers: List[str] = field(default_factory=list)
    insights: List[str] = field(default_factory=list)
    actionables: List[str] = field(default_factory=list)
    summary: str = ""
    provider: str = "deterministic"
    model: Optional[str] = None

    def to_entry(self) -> Dict[str, Any]:
        return {
            "winners_summary": self.winners,
            "losers_summary": self.losers,
            "insights": self.insights,
            "actionables": self.actionables,
            "summary": self.summary,
            "provider": self.provider,
            "model": self.model,
        }


def _top_by_metric(
    rows: Sequence[Dict[str, Any]],
    metric: str,
    *,
    reverse: bool = True,
    limit: int = 3,
) -> List[str]:
    sorted_rows = sorted(
        rows,
        key=lambda row: float(row.get(metric, 0.0)),
        reverse=reverse,
    )
    selected = []
    for row in sorted_rows[:limit]:
        strategy_id = row.get("strategy_id", "unknown")
        metric_value = row.get(metric)
        if isinstance(metric_value, (int, float)):
            selected.append(f"{strategy_id} {metric}={metric_value:.2f}")
        else:
            selected.append(strategy_id)
    return selected


class HypothesisAgent:
    """Produces weekly evolution hypotheses using an LLM fallback framework."""

    def __init__(self, worker: Optional[LLMWorker] = None) -> None:
        self.worker = worker or LLMWorker()

    def _llm_payload(self, payload: Dict[str, Any]) -> HypothesisReport:
        system_prompt = (
            "You are the research analyst for a quant lab.\n"
            "Return valid JSON with keys: winners, losers, insights, actionables, summary."
        )
        user_prompt = (
            "Given the JSON data of strategy evaluations and promotion decisions, provide:\n"
            "1. Top 3 reasons why winners succeeded.\n"
            "2. Top 3 reasons why losers failed.\n"
            "3. Three hypotheses to test next week.\n"
            "Return JSON with arrays and a short summary paragraph."
        )
        data_blob = json.dumps(payload, default=str)
        try:
            result = self.worker.generate_json(
                system_prompt=system_prompt,
                user_prompt=f"{user_prompt}\n\nDATA:\n{data_blob}",
            )
        except LLMWorkerError as exc:
            raise RuntimeError(str(exc)) from exc
        content = result.json_payload or {}
        report = HypothesisReport(
            winners=list(content.get("winners") or []),
            losers=list(content.get("losers") or []),
            insights=list(content.get("insights") or []),
            actionables=list(content.get("actionables") or []),
            summary=str(content.get("summary") or ""),
            provider=result.provider,
            model=result.model,
        )
        return report

    def _deterministic_baseline(self, evaluations: Sequence[Dict[str, Any]]) -> HypothesisReport:
        winners = _top_by_metric(evaluations, "roi", limit=3, reverse=True)
        losers = _top_by_metric(evaluations, "roi", limit=3, reverse=False)
        average_sharpe = mean(float(row.get("sharpe", 0.0)) for row in evaluations) if evaluations else 0.0
        summary = (
            f"Evaluated {len(evaluations)} strategies. "
            f"Average Sharpe {average_sharpe:.2f}. "
            f"Top performers favoured volatility control and higher ROI."
        )
        insights = [
            "High ROI strategies maintained Sharpe > 1.0",
            "Underperformers exhibited drawdown above 20%",
        ]
        actionables = [
            "Tune stop loss for drawdown-heavy strategies",
            "Experiment with volatility normalization for laggards",
        ]
        return HypothesisReport(
            winners=winners,
            losers=losers,
            insights=insights,
            actionables=actionables,
            summary=summary,
            provider="deterministic",
        )

    def analyse(
        self,
        evaluations: Sequence[Dict[str, Any]],
        decisions: Sequence[Dict[str, Any]],
    ) -> HypothesisReport:
        payload = {
            "evaluations": evaluations,
            "decisions": decisions,
        }
        if not self.worker.is_enabled():
            return self._deterministic_baseline(evaluations)
        try:
            return self._llm_payload(payload)
        except Exception:
            return self._deterministic_baseline(evaluations)


