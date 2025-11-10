"""Helpers for representing strategy genomes used in Phase 2."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Mapping, Optional
from uuid import uuid4

# Default parameter bounds to keep mutations within reasonable space.
DEFAULT_PARAM_BOUNDS: Dict[str, tuple[float, float]] = {
    "ema_short": (3, 50),
    "ema_long": (10, 200),
    "take_profit_pct": (0.002, 0.1),
    "stop_loss_pct": (0.002, 0.1),
    "risk_pct": (0.01, 0.5),
    "min_return_threshold": (0.0001, 0.05),
    "min_confidence": (0.5, 0.9),
    "forecast_weight": (0.0, 1.0),
}


@dataclass
class StrategyFitness:
    """Captures evaluation metrics for a strategy genome."""

    roi: float = 0.0
    sharpe: float = 0.0
    max_drawdown: float = 0.0
    forecast_alignment: float = 0.0
    stability: float = 0.0
    composite: float = 0.0

    def to_dict(self) -> Dict[str, float]:
        return {
            "roi": self.roi,
            "sharpe": self.sharpe,
            "max_drawdown": self.max_drawdown,
            "forecast_alignment": self.forecast_alignment,
            "stability": self.stability,
            "composite": self.composite,
        }


@dataclass
class StrategyGenome:
    """Data structure describing a strategy genome."""

    strategy_id: str
    family: str
    params: Dict[str, float]
    uses_forecast: bool = True
    forecast_weight: float = 0.4
    mutation_parent: Optional[str] = None
    generation: int = 0
    status: str = "candidate"
    fitness: StrategyFitness = field(default_factory=StrategyFitness)
    created_at: datetime = field(default_factory=datetime.utcnow)
    tags: list[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def document(self) -> Dict[str, Any]:
        doc = {
            "strategy_id": self.strategy_id,
            "family": self.family,
            "params": self.params,
            "uses_forecast": self.uses_forecast,
            "forecast_weight": self.forecast_weight,
            "mutation_parent": self.mutation_parent,
            "generation": self.generation,
            "status": self.status,
            "fitness": self.fitness.to_dict(),
            "created_at": self.created_at,
            "tags": self.tags,
            "metadata": self.metadata,
        }
        return doc


def _clamp(value: float, param: str) -> float:
    bounds = DEFAULT_PARAM_BOUNDS.get(param)
    if not bounds:
        return value
    lower, upper = bounds
    return max(lower, min(upper, value))


def normalize_params(params: Mapping[str, float]) -> Dict[str, float]:
    normalized: Dict[str, float] = {}
    for key, value in params.items():
        normalized[key] = _clamp(float(value), key)
    if normalized.get("ema_short", 9) >= normalized.get("ema_long", 21):
        normalized["ema_short"], normalized["ema_long"] = sorted(
            (normalized["ema_short"], normalized["ema_long"])
        )
    return normalized


def _strategy_id(family: str, generation: int) -> str:
    suffix = uuid4().hex[:6]
    return f"{family}-gen{generation}-{suffix}"


def default_genome_document(family: str = "ema-cross") -> Dict[str, Any]:
    params = {
        "ema_short": 9,
        "ema_long": 21,
        "take_profit_pct": 0.02,
        "stop_loss_pct": 0.01,
        "risk_pct": 0.05,
        "min_return_threshold": 0.001,
        "min_confidence": 0.6,
        "forecast_weight": 0.4,
    }
    genome = StrategyGenome(
        strategy_id=_strategy_id(family, 0),
        family=family,
        params=normalize_params(params),
        uses_forecast=True,
        forecast_weight=0.4,
        mutation_parent=None,
        generation=0,
        status="champion",
        fitness=StrategyFitness(composite=0.0),
        tags=["seed"],
        metadata={
            "features": ["ema_short", "ema_long", "forecast_signal"],
            "horizon": "1m",
            "model_type": "baseline",
        },
    )
    return genome.document()


def create_genome_from_dict(payload: Mapping[str, Any]) -> StrategyGenome:
    strategy_id = payload.get("strategy_id") or _strategy_id(
        payload.get("family", "ema-cross"),
        int(payload.get("generation", 0)),
    )
    params_raw = payload.get("params", {})
    params = normalize_params(params_raw)
    fitness_payload = payload.get("fitness", {}) or {}
    fitness = StrategyFitness(
        roi=float(fitness_payload.get("roi", 0.0)),
        sharpe=float(fitness_payload.get("sharpe", 0.0)),
        max_drawdown=float(fitness_payload.get("max_drawdown", 0.0)),
        forecast_alignment=float(fitness_payload.get("forecast_alignment", 0.0)),
        stability=float(fitness_payload.get("stability", 0.0)),
        composite=float(fitness_payload.get("composite", 0.0)),
    )
    genome = StrategyGenome(
        strategy_id=strategy_id,
        family=str(payload.get("family", "ema-cross")),
        params=params,
        uses_forecast=bool(payload.get("uses_forecast", True)),
        forecast_weight=float(payload.get("forecast_weight", params.get("forecast_weight", 0.4))),
        mutation_parent=payload.get("mutation_parent"),
        generation=int(payload.get("generation", 0)),
        status=str(payload.get("status", "candidate")),
        fitness=fitness,
        created_at=payload.get("created_at", datetime.utcnow()),
        tags=list(payload.get("tags", [])),
        metadata=dict(payload.get("metadata") or {}),
    )
    return genome

