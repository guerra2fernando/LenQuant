from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from knowledge.repository import record_entry as record_knowledge_entry
from learning.allocator import AllocationResult, AllocationError, rebalance_allocations
from learning.bayes_optimizer import OptimizedGenome, optimise_genomes, queue_optimised_genomes
from learning.meta_model import (
    MetaModelBundle,
    MetaModelNotFoundError,
    MetaModelTrainingError,
    MetaModelTrainingResult,
    load_latest_meta_model,
    train_meta_model,
)
from learning.repository import (
    DEFAULT_LEARNING_SETTINGS,
    get_learning_settings,
    record_learning_summary,
    record_overfit_alerts,
)
from monitor.overfit_detector import OverfitSignal, detect_overfit


@dataclass
class LearningCycleSummary:
    meta_model: Optional[Dict[str, Any]]
    optimizer: Dict[str, Any]
    allocator: Optional[Dict[str, Any]]
    overfit_alerts: List[Dict[str, Any]]
    knowledge_entry: Optional[Dict[str, Any]]
    created_at: datetime


def _serialise_meta_result(result: Optional[MetaModelTrainingResult]) -> Optional[Dict[str, Any]]:
    if not result:
        return None
    return {
        "metadata": result.metadata,
        "metrics": result.metrics,
        "feature_importances": result.feature_importances,
        "sample_count": result.sample_count,
    }


def _serialise_optimizer(candidates: List[OptimizedGenome]) -> Dict[str, Any]:
    return {
        "generated": [
            {
                "strategy_id": candidate.genome.strategy_id,
                "parent_strategy_id": candidate.parent_strategy_id,
                "predicted_roi": candidate.predicted_roi,
                "params": candidate.genome.params,
                "trial_number": candidate.trial_number,
            }
            for candidate in candidates
        ],
        "count": len(candidates),
    }


def _serialise_allocator(result: Optional[AllocationResult]) -> Optional[Dict[str, Any]]:
    if not result:
        return None
    return {
        "weights": result.weights,
        "expected_portfolio_return": result.expected_portfolio_return,
        "expected_portfolio_risk": result.expected_portfolio_risk,
        "settings": result.settings,
    }


def _serialise_overfit(signals: List[OverfitSignal]) -> List[Dict[str, Any]]:
    serialised: List[Dict[str, Any]] = []
    for signal in signals:
        serialised.append(
            {
                "strategy_id": signal.strategy_id,
                "decay": signal.decay,
                "baseline_roi": signal.baseline_roi,
                "recent_roi": signal.recent_roi,
                "window": signal.window,
                "latest_run_id": signal.latest_run_id,
                "detected_at": signal.detected_at,
                "sharpe_delta": signal.sharpe_delta,
                "run_history": signal.run_history,
            }
        )
    return serialised


def _compose_knowledge_summary(
    meta: Optional[MetaModelTrainingResult],
    optimizer: List[OptimizedGenome],
    allocator: Optional[AllocationResult],
    alerts: List[OverfitSignal],
) -> str:
    lines: List[str] = []
    if meta:
        top_features = ", ".join(feature["feature"] for feature in meta.feature_importances[:5])
        lines.append(
            f"Meta-model retrained on {meta.sample_count} samples. Top drivers: {top_features}."
        )
    if optimizer:
        best = max(optimizer, key=lambda candidate: candidate.predicted_roi)
        lines.append(
            f"Bayesian search proposed {len(optimizer)} genomes; best candidate {best.genome.strategy_id} from "
            f"{best.parent_strategy_id} with predicted ROI {best.predicted_roi:.4f}."
        )
    if allocator:
        top_weight = max(allocator.weights, key=lambda w: w.get("weight", 0.0), default=None)
        if top_weight:
            lines.append(
                f"Allocator weights favour {top_weight['strategy_id']} at {top_weight['weight']:.2%}; "
                f"portfolio expected ROI {allocator.expected_portfolio_return:.4f}."
            )
    if alerts:
        lines.append(
            f"Overfitting alerts raised for {len(alerts)} strategies: "
            + ", ".join(signal.strategy_id for signal in alerts)
        )
    if not lines:
        return "Learning cycle completed with no new findings."
    return " ".join(lines)


def run_learning_cycle(
    *,
    train_meta: bool = True,
    generate_candidates: bool = True,
    rebalance: bool = True,
    evaluate_overfit: bool = True,
    settings_override: Optional[Dict[str, Any]] = None,
) -> LearningCycleSummary:
    settings = get_learning_settings()
    if settings_override:
        settings = {**settings, **settings_override}

    meta_settings = settings.get("meta_model", DEFAULT_LEARNING_SETTINGS["meta_model"])
    optimizer_settings = settings.get("optimizer", DEFAULT_LEARNING_SETTINGS["optimizer"])
    allocator_settings = settings.get("allocator", DEFAULT_LEARNING_SETTINGS["allocator"])
    overfit_settings = settings.get("overfit", DEFAULT_LEARNING_SETTINGS["overfit"])

    meta_result: Optional[MetaModelTrainingResult] = None
    meta_bundle: Optional[MetaModelBundle] = None
    meta_error: Optional[str] = None

    if train_meta:
        try:
            meta_result = train_meta_model(settings=meta_settings)
            meta_bundle = load_latest_meta_model()
        except MetaModelTrainingError as exc:
            meta_error = str(exc)
        except MetaModelNotFoundError as exc:
            meta_error = str(exc)
    if meta_bundle is None:
        try:
            meta_bundle = load_latest_meta_model()
        except MetaModelNotFoundError as exc:
            meta_error = meta_error or str(exc)

    optimizer_candidates: List[OptimizedGenome] = []
    queued_docs: List[Dict[str, Any]] = []
    if generate_candidates and meta_bundle:
        optimizer_candidates = optimise_genomes(bundle=meta_bundle, settings=optimizer_settings)
        queued_docs = queue_optimised_genomes(optimizer_candidates)

    allocator_result: Optional[AllocationResult] = None
    allocation_error: Optional[str] = None
    if rebalance and meta_bundle:
        try:
            allocator_result = rebalance_allocations(bundle=meta_bundle, settings=allocator_settings)
        except AllocationError as exc:
            allocation_error = str(exc)

    overfit_signals: List[OverfitSignal] = []
    recorded_alerts: List[Dict[str, Any]] = []
    if evaluate_overfit:
        overfit_signals = detect_overfit(
            window=int(overfit_settings.get("window", 6)),
            decay_threshold=float(overfit_settings.get("decay_threshold", 0.35)),
            min_runs=int(overfit_settings.get("min_runs", 5)),
        )
        if overfit_signals:
            recorded_alerts = record_overfit_alerts(_serialise_overfit(overfit_signals))

    knowledge_entry: Optional[Dict[str, Any]] = None
    knowledge_summary = _compose_knowledge_summary(meta_result, optimizer_candidates, allocator_result, overfit_signals)
    knowledge_entry = record_knowledge_entry(
        {
            "period": datetime.utcnow().strftime("%Y-%m-%d"),
            "summary": knowledge_summary,
            "meta_model_id": meta_result.metadata.get("model_id") if meta_result else None,
            "allocator_portfolio_return": allocator_result.expected_portfolio_return if allocator_result else None,
            "overfit_ids": [signal.strategy_id for signal in overfit_signals],
            "queued_strategies": [doc.get("strategy_id") for doc in queued_docs],
        }
    )

    meta_summary = _serialise_meta_result(meta_result)
    if meta_summary:
        if meta_error:
            meta_summary = {**meta_summary, "error": meta_error}
    elif meta_error:
        meta_summary = {"error": meta_error}

    allocator_summary: Optional[Dict[str, Any]]
    if allocation_error and allocator_result is None:
        allocator_summary = {"error": allocation_error}
    else:
        allocator_summary = _serialise_allocator(allocator_result)
        if allocator_summary and allocation_error:
            allocator_summary = {**allocator_summary, "warning": allocation_error}

    summary_payload = {
        "meta_model": meta_summary,
        "optimizer": {
            **_serialise_optimizer(optimizer_candidates),
            "queued": queued_docs,
        },
        "allocator": allocator_summary,
        "overfit_alerts": recorded_alerts,
        "knowledge_entry": knowledge_entry,
    }
    record_learning_summary(summary_payload)

    return LearningCycleSummary(
        meta_model=summary_payload.get("meta_model"),
        optimizer=summary_payload.get("optimizer", {}),
        allocator=summary_payload.get("allocator"),
        overfit_alerts=summary_payload.get("overfit_alerts", []),
        knowledge_entry=knowledge_entry,
        created_at=datetime.utcnow(),
    )

