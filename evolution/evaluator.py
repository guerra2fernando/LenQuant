from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence

from db.client import get_database_name, mongo_client
from simulator.runner import run_simulation
from strategy_genome.encoding import create_genome_from_dict
from strategy_genome.repository import save_genome, update_genome_fitness

from .repository import load_experiment, update_experiment
from .schemas import EvaluationConfig, EvaluationResult

logger = logging.getLogger(__name__)


def _load_run_document(run_id: str) -> Dict[str, Any]:
    with mongo_client() as client:
        db = client[get_database_name()]
        doc = db["sim_runs"].find_one({"run_id": run_id}) or {}
    return doc


def _score_from_metrics(metrics: Dict[str, Any]) -> float:
    roi = float(metrics.get("roi", 0.0))
    sharpe = float(metrics.get("sharpe", 0.0))
    drawdown = float(metrics.get("max_drawdown", 0.0))
    stability = float(metrics.get("stability", 0.0))
    composite = float(metrics.get("composite", 0.0))
    if composite:
        return composite
    score = (roi * 0.6) + (sharpe * 0.4) + (stability * 0.2) - (drawdown * 0.3)
    return float(score)


def _strategy_payload(genome_doc: Dict[str, Any], candidate: Dict[str, Any], config: EvaluationConfig) -> Dict[str, Any]:
    params = dict(genome_doc.get("params", {}))
    params.setdefault("uses_forecast", genome_doc.get("uses_forecast", True))
    params.setdefault("forecast_weight", genome_doc.get("forecast_weight", params.get("forecast_weight", 0.4)))
    params.setdefault("risk_pct", params.get("risk_pct", 0.05))
    params.setdefault("take_profit_pct", params.get("take_profit_pct", 0.02))
    params.setdefault("stop_loss_pct", params.get("stop_loss_pct", 0.01))
    metadata = dict(candidate.get("metadata") or {})
    params["features"] = metadata.get("features", [])
    params["model_type"] = metadata.get("model_type", "LGBM")
    params["horizon"] = metadata.get("horizon", config.horizon)
    return params


def evaluate_experiment(experiment_id: str, config: EvaluationConfig) -> Optional[EvaluationResult]:
    experiment = load_experiment(experiment_id)
    if not experiment:
        logger.warning("Experiment %s not found", experiment_id)
        return None
    candidate = experiment.get("candidate") or {}
    genome_doc = candidate.get("genome")
    if not genome_doc:
        logger.warning("Experiment %s missing genome doc", experiment_id)
        update_experiment(experiment_id, {"status": "failed", "insights": {"reason": "missing_genome"}})
        return None

    try:
        genome = create_genome_from_dict(genome_doc)
        saved = save_genome(genome)
        strategy_id = saved["strategy_id"]
        strategy_config = _strategy_payload(genome_doc, candidate, config)
        horizon = strategy_config.get("horizon", config.horizon)
        run_id = run_simulation(
            config.symbol,
            horizon,
            strategy_name=strategy_id,
            horizon=horizon,
            strategy_config=strategy_config,
            genome=saved,
        )
        if not run_id:
            raise RuntimeError("Simulation did not produce a run identifier")
        run_doc = _load_run_document(run_id)
        metrics = run_doc.get("results", {}) if run_doc else {}
        updated = update_genome_fitness(strategy_id, metrics, run_id=run_id)
        score = _score_from_metrics(updated.get("fitness", {}) if updated else metrics)
        update_experiment(
            experiment_id,
            {
                "status": "completed",
                "metrics": metrics,
                "score": score,
                "updated_at": datetime.utcnow(),
                "insights": {
                    "horizon": strategy_config.get("horizon"),
                    "model_type": strategy_config.get("model_type"),
                },
                "candidate": {
                    **candidate,
                    "genome": saved,
                },
            },
        )
        return EvaluationResult(
            experiment_id=experiment_id,
            strategy_id=strategy_id,
            metrics=metrics,
            score=score,
            run_id=run_id,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Evaluation failed for experiment %s: %s", experiment_id, exc)
        update_experiment(
            experiment_id,
            {"status": "failed", "insights": {"error": str(exc)}},
        )
        return None


def evaluate_batch(experiment_ids: Sequence[str], config: EvaluationConfig) -> List[EvaluationResult]:
    results: List[EvaluationResult] = []
    for experiment_id in experiment_ids:
        result = evaluate_experiment(experiment_id, config)
        if result:
            results.append(result)
    return results

