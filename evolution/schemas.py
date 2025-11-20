from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Sequence

from strategy_genome.encoding import StrategyGenome


MutationOperation = str


@dataclass
class MutationConfig:
    """Configuration for spawning strategy variants."""

    variants_per_parent: int = 6
    feature_library: Sequence[str] = field(
        default_factory=lambda: (
            "rsi_14",
            "ema_20",
            "ema_50",
            "volatility_5m",
            "trend_strength",
            "bollinger_band_width",
            "volume_zscore",
            "atr_14",
        )
    )
    allowed_horizons: Sequence[str] = field(default_factory=lambda: ("5m", "15m", "1h", "4h"))
    allowed_models: Sequence[str] = field(default_factory=lambda: ("LGBM", "RandomForest", "Transformer"))
    param_perturbation_scale: float = 0.15
    ensure_unique_features: bool = True


@dataclass
class MutationGeneration:
    """Represents the results of generating variants for experiment queueing."""

    parent_id: str
    produced: List["EvolutionCandidate"] = field(default_factory=list)
    skipped_reason: Optional[str] = None


@dataclass
class EvolutionCandidate:
    """Candidate genome pending evaluation."""

    genome: StrategyGenome
    parent_id: Optional[str]
    operations: List[MutationOperation] = field(default_factory=list)
    horizon: str = "1h"
    model_type: str = "LGBM"
    features: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "genome": self.genome.document(),
            "parent_id": self.parent_id,
            "operations": list(self.operations),
            "horizon": self.horizon,
            "model_type": self.model_type,
            "features": list(self.features),
            "metadata": dict(self.metadata),
        }
        return payload


@dataclass
class EvolutionExperiment:
    """Persists the lifecycle of a candidate evaluation."""

    experiment_id: str
    candidate: EvolutionCandidate
    status: str = "pending"
    score: float = 0.0
    metrics: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    lineage: List[str] = field(default_factory=list)
    insights: Dict[str, Any] = field(default_factory=dict)
    notes: List[str] = field(default_factory=list)


@dataclass
class EvaluationConfig:
    """Parameters controlling evaluation runs."""

    symbol: str = "BTC/USD"
    horizon: str = "1h"
    paper_days: int = 7
    max_concurrent: int = 4


@dataclass
class EvaluationResult:
    """Metrics produced by backtests or paper runs."""

    experiment_id: str
    strategy_id: str
    metrics: Dict[str, Any]
    score: float
    run_id: Optional[str] = None
    completed_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class PromotionDecision:
    """Represents an automated promoter decision."""

    strategy_id: str
    parent_id: Optional[str]
    approved: bool
    reason: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    effective_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class PromotionPolicy:
    """Thresholds for automated promotion."""

    min_roi: float = 0.02
    min_sharpe: float = 1.0
    max_drawdown: float = 0.15
    min_score_gain: float = 0.05
    min_paper_days: int = 10
    require_parent_score: bool = True

    def passes(self, candidate_metrics: Dict[str, Any], parent_metrics: Optional[Dict[str, Any]]) -> bool:
        roi = float(candidate_metrics.get("roi", 0.0))
        sharpe = float(candidate_metrics.get("sharpe", 0.0))
        drawdown = float(candidate_metrics.get("max_drawdown", 1.0))
        score = float(candidate_metrics.get("composite", candidate_metrics.get("score", 0.0)))

        if roi < self.min_roi or sharpe < self.min_sharpe or drawdown > self.max_drawdown:
            return False

        if self.require_parent_score and parent_metrics:
            parent_score = float(
                parent_metrics.get("composite", parent_metrics.get("score", 0.0))
            )
            if parent_score <= 0:
                return score > 0
            score_gain = (score - parent_score) / max(1e-6, parent_score)
            return score_gain >= self.min_score_gain
        return True


def flatten_metrics(metrics_list: Iterable[Dict[str, Any]]) -> Dict[str, float]:
    summary: Dict[str, List[float]] = {}
    for metrics in metrics_list:
        for key, value in metrics.items():
            try:
                numeric = float(value)
            except (TypeError, ValueError):
                continue
            summary.setdefault(key, []).append(numeric)

    aggregated: Dict[str, float] = {}
    for key, values in summary.items():
        if not values:
            continue
        aggregated[key] = sum(values) / len(values)
    return aggregated

