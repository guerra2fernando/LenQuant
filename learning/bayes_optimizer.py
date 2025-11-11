from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence

import numpy as np
import optuna

from learning.meta_model import MetaModelBundle, build_feature_vector, load_latest_meta_model
from learning.repository import (
    DEFAULT_LEARNING_SETTINGS,
    get_learning_settings,
)
from strategy_genome.encoding import (
    DEFAULT_PARAM_BOUNDS,
    StrategyFitness,
    StrategyGenome,
    create_genome_from_dict,
    normalize_params,
)
from strategy_genome.repository import list_genomes, record_queue_items, save_genome


@dataclass
class OptimizedGenome:
    genome: StrategyGenome
    predicted_roi: float
    parent_strategy_id: str
    trial_number: int


def _champion_pool(limit: int = 8) -> List[StrategyGenome]:
    docs = list_genomes(status="champion", limit=limit)
    return [create_genome_from_dict(doc) for doc in docs]


def _bounded_range(param: str, base_value: float, exploration_weight: float) -> tuple[float, float]:
    lower, upper = DEFAULT_PARAM_BOUNDS.get(param, (base_value * 0.5, base_value * 1.5))
    span = (upper - lower) * exploration_weight
    candidate_lower = max(lower, base_value - span)
    candidate_upper = min(upper, base_value + span)
    if candidate_lower >= candidate_upper:
        return lower, upper
    return candidate_lower, candidate_upper


def _mutate_params(parent: StrategyGenome, trial: optuna.Trial, exploration_weight: float) -> Dict[str, float]:
    mutated: Dict[str, float] = {}
    for param, bounds in DEFAULT_PARAM_BOUNDS.items():
        base_value = parent.params.get(param)
        if base_value is None:
            base_value = sum(bounds) / 2
        low, high = _bounded_range(param, float(base_value), exploration_weight)
        mutated[param] = trial.suggest_float(param, low, high)
    return normalize_params(mutated)


def _make_candidate(parent: StrategyGenome, params: Dict[str, float]) -> StrategyGenome:
    payload = parent.document()
    payload.pop("strategy_id", None)
    payload["params"] = params
    payload["generation"] = parent.generation + 1
    payload["mutation_parent"] = parent.strategy_id
    payload["status"] = "candidate"
    payload["tags"] = list({*payload.get("tags", []), "bayes-opt"})
    payload["fitness"] = StrategyFitness().to_dict()
    return create_genome_from_dict(payload)


def optimise_genomes(
    *,
    champions: Optional[Sequence[StrategyGenome]] = None,
    bundle: Optional[MetaModelBundle] = None,
    settings: Optional[Dict[str, Any]] = None,
) -> List[OptimizedGenome]:
    settings = settings or get_learning_settings().get("optimizer", DEFAULT_LEARNING_SETTINGS["optimizer"])
    champions = list(champions) if champions is not None else _champion_pool()
    family_filter = settings.get("families")
    if family_filter:
        champions = [champ for champ in champions if champ.family in family_filter]
        if not champions:
            fallback_docs = list_genomes(status="champion", limit=16)
            champions = [create_genome_from_dict(doc) for doc in fallback_docs if doc.get("family") in family_filter]
    if not champions:
        return []
    bundle = bundle or load_latest_meta_model()

    trials = int(settings.get("trials", 50))
    exploration_weight = float(settings.get("exploration_weight", 0.3))

    def objective(trial: optuna.Trial) -> float:
        parent = random.choice(champions)
        mutated_params = _mutate_params(parent, trial, exploration_weight)
        candidate = _make_candidate(parent, mutated_params)
        lookback_hours = settings.get("lookback_hours")
        if lookback_hours:
            candidate.metadata["lookback_hours"] = lookback_hours
            candidate.tags = list({*candidate.tags, "intraday"})
        feature_vector = build_feature_vector(
            candidate.document(), parent.fitness.to_dict(), feature_columns=bundle.feature_columns
        )
        ordered = [feature_vector.get(col, 0.0) for col in bundle.feature_columns]
        predicted_roi = float(bundle.model.predict(np.array([ordered]))[0])
        trial.set_user_attr("candidate_genome", candidate)
        trial.set_user_attr("parent_id", parent.strategy_id)
        return predicted_roi

    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=trials, show_progress_bar=False)

    ranked_trials = [
        trial
        for trial in sorted(study.trials, key=lambda t: (t.value is None, -(t.value or 0.0)))
        if trial.value is not None and trial.user_attrs.get("candidate_genome")
    ]
    top_k = int(settings.get("top_k", 5))
    selections: List[OptimizedGenome] = []
    seen_keys: set[str] = set()

    for trial in ranked_trials:
        candidate: StrategyGenome = trial.user_attrs["candidate_genome"]
        candidate_key = repr(sorted(candidate.params.items()))
        if candidate_key in seen_keys:
            continue
        seen_keys.add(candidate_key)
        selections.append(
            OptimizedGenome(
                genome=candidate,
                predicted_roi=float(trial.value or 0.0),
                parent_strategy_id=str(trial.user_attrs.get("parent_id")),
                trial_number=trial.number,
            )
        )
        if len(selections) >= top_k:
            break

    return selections


def queue_optimised_genomes(candidates: Sequence[OptimizedGenome]) -> List[Dict[str, Any]]:
    if not candidates:
        return []
    genomes = [candidate.genome for candidate in candidates]
    for genome in genomes:
        save_genome(genome)
    queued_docs = record_queue_items(genomes, max_queue=None)
    return queued_docs

