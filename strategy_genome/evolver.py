"""Mutation and crossover helpers for strategy genomes."""
from __future__ import annotations

import random
from typing import List, Sequence

from .encoding import StrategyGenome, normalize_params


def mutate(
    genome: StrategyGenome,
    mutation_rate: float = 0.3,
    mutation_scale: float = 0.2,
    *,
    seed: int | None = None,
) -> StrategyGenome:
    rng = random.Random(seed)
    next_params = genome.params.copy()
    for key, value in genome.params.items():
        if rng.random() <= mutation_rate:
            jitter = 1 + rng.uniform(-mutation_scale, mutation_scale)
            mutated = value * jitter
            next_params[key] = mutated
    normalized = normalize_params(next_params)
    next_generation = max(genome.generation + 1, 1)
    mutated_genome = StrategyGenome(
        strategy_id=f"{genome.family}-gen{next_generation}-{rng.randint(0, 9999):04d}",
        family=genome.family,
        params=normalized,
        uses_forecast=genome.uses_forecast,
        forecast_weight=normalized.get("forecast_weight", genome.forecast_weight),
        mutation_parent=genome.strategy_id,
        generation=next_generation,
        status="candidate",
        tags=list({*genome.tags, "mutation"}),
        metadata={**genome.metadata},
    )
    return mutated_genome


def crossover(
    parent_a: StrategyGenome,
    parent_b: StrategyGenome,
    *,
    seed: int | None = None,
) -> StrategyGenome:
    rng = random.Random(seed)
    child_params = {}
    keys = set(parent_a.params) | set(parent_b.params)
    for key in keys:
        value_a = parent_a.params.get(key)
        value_b = parent_b.params.get(key)
        if value_a is None and value_b is None:
            continue
        if value_a is None:
            child_params[key] = value_b
            continue
        if value_b is None:
            child_params[key] = value_a
            continue
        weight = rng.random()
        child_params[key] = value_a * weight + value_b * (1 - weight)

    normalized = normalize_params(child_params)
    generation = max(parent_a.generation, parent_b.generation) + 1
    child = StrategyGenome(
        strategy_id=f"{parent_a.family}-gen{generation}-{rng.randint(0, 9999):04d}",
        family=parent_a.family,
        params=normalized,
        uses_forecast=parent_a.uses_forecast or parent_b.uses_forecast,
        forecast_weight=(parent_a.forecast_weight + parent_b.forecast_weight) / 2,
        mutation_parent=parent_a.strategy_id,
        generation=generation,
        status="candidate",
        tags=list({*parent_a.tags, *parent_b.tags, "crossover"}),
        metadata={**parent_a.metadata, **parent_b.metadata},
    )
    return child


def spawn_variants(
    genomes: Sequence[StrategyGenome],
    mutations_per_parent: int = 5,
    *,
    seed: int | None = None,
) -> List[StrategyGenome]:
    rng = random.Random(seed)
    variants: List[StrategyGenome] = []
    for genome in genomes:
        for _ in range(mutations_per_parent):
            variants.append(mutate(genome, seed=rng.randint(0, 1_000_000)))

    if len(genomes) >= 2:
        for idx in range(len(genomes) - 1):
            parent_a = genomes[idx]
            parent_b = genomes[idx + 1]
            variants.append(
                crossover(
                    parent_a,
                    parent_b,
                    seed=rng.randint(0, 1_000_000),
                )
            )
    return variants

