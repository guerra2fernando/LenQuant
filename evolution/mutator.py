from __future__ import annotations

import random
from typing import Iterable, List, Sequence

from strategy_genome.encoding import StrategyGenome
from strategy_genome.evolver import crossover as base_crossover
from strategy_genome.evolver import mutate as base_mutate

from .schemas import EvolutionCandidate, MutationConfig, MutationGeneration

MutationPool = Sequence[StrategyGenome]


def _clone_metadata(genome: StrategyGenome) -> dict:
    metadata = dict(genome.metadata or {})
    if "features" not in metadata or not isinstance(metadata["features"], list):
        metadata["features"] = ["rsi_14", "ema_20", "volatility_5m"]
    return metadata


def _apply_feature_mutations(
    metadata: dict,
    operations: List[str],
    config: MutationConfig,
    rng: random.Random,
) -> None:
    features = list(metadata.get("features", []))
    if config.ensure_unique_features:
        features = list(dict.fromkeys(features))

    if rng.random() < 0.5 and features:
        drop_index = rng.randrange(len(features))
        dropped = features.pop(drop_index)
        operations.append(f"feature_drop:{dropped}")

    available = [feat for feat in config.feature_library if feat not in features]
    if rng.random() < 0.7 and available:
        added = rng.choice(available)
        features.append(added)
        operations.append(f"feature_add:{added}")

    metadata["features"] = features


def _apply_horizon_mutation(metadata: dict, operations: List[str], config: MutationConfig, rng: random.Random) -> None:
    current = metadata.get("horizon", "1h")
    if rng.random() < 0.4 and config.allowed_horizons:
        choices = [h for h in config.allowed_horizons if h != current]
        if choices:
            selected = rng.choice(choices)
            metadata["horizon"] = selected
            operations.append(f"horizon_change:{current}->{selected}")


def _apply_model_mutation(metadata: dict, operations: List[str], config: MutationConfig, rng: random.Random) -> None:
    current = metadata.get("model_type", "LGBM")
    if rng.random() < 0.35 and config.allowed_models:
        choices = [m for m in config.allowed_models if m != current]
        if choices:
            selected = rng.choice(choices)
            metadata["model_type"] = selected
            operations.append(f"model_swap:{current}->{selected}")


def generate_mutations(
    parents: MutationPool,
    config: MutationConfig | None = None,
    *,
    seed: int | None = None,
) -> List[MutationGeneration]:
    if not parents:
        return []
    mutation_config = config or MutationConfig()
    rng = random.Random(seed)
    generations: List[MutationGeneration] = []

    for parent in parents:
        metadata = _clone_metadata(parent)
        generation = MutationGeneration(parent_id=parent.strategy_id)

        for _ in range(max(1, mutation_config.variants_per_parent)):
            mutated = base_mutate(
                parent,
                mutation_rate=0.35,
                mutation_scale=mutation_config.param_perturbation_scale,
                seed=rng.randint(0, 10**9),
            )
            operations: List[str] = ["param_shift"]
            candidate_metadata = {**metadata}
            _apply_feature_mutations(candidate_metadata, operations, mutation_config, rng)
            _apply_horizon_mutation(candidate_metadata, operations, mutation_config, rng)
            _apply_model_mutation(candidate_metadata, operations, mutation_config, rng)

            candidate = EvolutionCandidate(
                genome=mutated,
                parent_id=parent.strategy_id,
                operations=operations,
                horizon=candidate_metadata.get("horizon", "1h"),
                model_type=candidate_metadata.get("model_type", "LGBM"),
                features=list(candidate_metadata.get("features", [])),
                metadata=candidate_metadata,
            )
            generation.produced.append(candidate)

        generations.append(generation)

    if len(parents) >= 2:
        for idx in range(len(parents) - 1):
            parent_a = parents[idx]
            parent_b = parents[idx + 1]
            hybrid_metadata = {**_clone_metadata(parent_a)}
            child = base_crossover(
                parent_a,
                parent_b,
                seed=rng.randint(0, 10**9),
            )
            features_union = list(
                dict.fromkeys(
                    list(_clone_metadata(parent_a).get("features", []))
                    + list(_clone_metadata(parent_b).get("features", []))
                )
            )
            hybrid_metadata.update(
                {
                    "features": features_union,
                    "horizon": rng.choice(
                        [
                            _clone_metadata(parent_a).get("horizon", "1h"),
                            _clone_metadata(parent_b).get("horizon", "1h"),
                        ]
                    ),
                    "model_type": rng.choice(
                        [
                            _clone_metadata(parent_a).get("model_type", "LGBM"),
                            _clone_metadata(parent_b).get("model_type", "LGBM"),
                        ]
                    ),
                }
            )
            generation = MutationGeneration(
                parent_id=f"{parent_a.strategy_id}|{parent_b.strategy_id}",
                produced=[
                    EvolutionCandidate(
                        genome=child,
                        parent_id=parent_a.strategy_id,
                        operations=["crossover"],
                        horizon=hybrid_metadata.get("horizon", "1h"),
                        model_type=hybrid_metadata.get("model_type", "LGBM"),
                        features=features_union,
                        metadata=hybrid_metadata,
                    )
                ],
            )
            generations.append(generation)
    return generations

