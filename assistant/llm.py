from __future__ import annotations

from typing import Any, Dict, Iterable, Optional, Tuple

from .explainer import AssistantExplainer
from .schemas import AssistantQueryContext, EvidenceItem


def get_provider() -> str:
    return AssistantExplainer().worker.provider


def _strategy_to_evidence(doc: Dict[str, Any]) -> EvidenceItem:
    strategy_id = doc.get("strategy_id", "unknown")
    fitness = doc.get("fitness") or {}
    summary_parts = []
    roi = fitness.get("roi")
    sharpe = fitness.get("sharpe")
    if isinstance(roi, (int, float)):
        summary_parts.append(f"ROI {roi:.2%}")
    if isinstance(sharpe, (int, float)):
        summary_parts.append(f"Sharpe {sharpe:.2f}")
    alignment = fitness.get("forecast_alignment")
    if isinstance(alignment, (int, float)):
        summary_parts.append(f"Alignment {alignment:.1%}")
    summary = ", ".join(summary_parts)
    return EvidenceItem(
        evidence_id=f"strategies/{strategy_id}",
        kind="strategy",
        title=f"Strategy {strategy_id}",
        summary=summary,
        metadata={
            "fitness": fitness,
            "family": doc.get("family"),
            "generation": doc.get("generation"),
            "status": doc.get("status"),
        },
    )


def generate_assistant_message(
    question: str,
    strategies: Iterable[Dict[str, Any]],
) -> Tuple[Optional[str], str]:
    evidence = [_strategy_to_evidence(doc) for doc in strategies]
    explainer = AssistantExplainer()
    result = explainer.synthesise(question, AssistantQueryContext(), evidence)
    payload = result.payload
    lines = [payload.summary]
    if payload.causes:
        lines.append("")
        lines.append("Reasons:")
        lines.extend(f"- {cause}" for cause in payload.causes)
    if payload.actions:
        lines.append("")
        lines.append("Next actions:")
        lines.extend(f"- {action}" for action in payload.actions)
    message = "\n".join(lines).strip()
    return message or None, result.provider or "disabled"
