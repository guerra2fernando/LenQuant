from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from db.client import get_database_name, mongo_client
from reports.leaderboard import generate_leaderboard
from simulator.runner import run_simulation
from strategy_genome.encoding import StrategyGenome, create_genome_from_dict
from strategy_genome.evolver import spawn_variants
from strategy_genome.repository import (
    ensure_seed_genomes,
    get_experiment_settings,
    list_genomes,
    record_queue_items,
    save_genome,
    update_genome_fitness,
    update_queue_item,
)

logger = logging.getLogger(__name__)


@dataclass
class ExperimentRequest:
    symbol: Optional[str] = None
    interval: Optional[str] = None
    horizon: Optional[str] = None
    accounts: int = 20
    mutations_per_parent: int = 5
    champion_limit: int = 5
    queue_only: bool = False
    families: List[str] = field(default_factory=lambda: ["ema-cross"])

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        if payload.get("families") is None:
            payload["families"] = []
        return payload

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExperimentRequest":
        return cls(
            symbol=data.get("symbol"),
            interval=data.get("interval"),
            horizon=data.get("horizon"),
            accounts=data.get("accounts", 20),
            mutations_per_parent=data.get("mutations_per_parent", 5),
            champion_limit=data.get("champion_limit", 5),
            queue_only=data.get("queue_only", False),
            families=data.get("families") or ["ema-cross"],
        )


def _strategy_payload(genome: StrategyGenome) -> Dict[str, Any]:
    payload = genome.document()
    params = dict(payload.get("params", {}))
    params["uses_forecast"] = payload.get("uses_forecast", True)
    params["forecast_weight"] = payload.get("forecast_weight", 0.4)
    params.setdefault("risk_pct", 0.1)
    params.setdefault("take_profit_pct", 0.02)
    params.setdefault("stop_loss_pct", 0.01)
    return params


def _load_run_document(run_id: str) -> Optional[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        return db["sim_runs"].find_one({"run_id": run_id})


def _touch_queue_item(queue_item_id: str, status: str, **extra: Any) -> None:
    updates = {"status": status, "updated_at": datetime.utcnow(), **extra}
    if status == "running":
        updates.setdefault("started_at", datetime.utcnow())
    if status in {"completed", "failed"}:
        updates.setdefault("finished_at", datetime.utcnow())
    update_queue_item(queue_item_id, updates)


def run_experiment_cycle(request: ExperimentRequest) -> Dict[str, Any]:
    settings = get_experiment_settings()
    ensure_seed_genomes(request.families or settings.get("families", []))
    champions_docs = list_genomes(status="champion", limit=request.champion_limit)
    if not champions_docs:
        raise RuntimeError("No champion genomes available to seed experiments.")
    champions = [create_genome_from_dict(doc) for doc in champions_docs]
    variants = spawn_variants(
        champions,
        mutations_per_parent=request.mutations_per_parent,
    )
    if not variants:
        raise RuntimeError("Failed to spawn variants for experiment cycle.")

    # trim to requested account capacity
    account_capacity = request.accounts or settings.get("accounts", 20)
    variants = variants[: max(1, account_capacity)]

    queue_docs = record_queue_items(variants, max_queue=settings.get("max_queue"))
    if request.queue_only:
        return {"queued": len(queue_docs), "runs": []}
    if not queue_docs:
        logger.info("Experiment queue at capacity; no new runs scheduled.")
        return {"queued": 0, "completed": [], "message": "queue_at_capacity"}

    completed_runs: List[Dict[str, Any]] = []
    for variant, queue_doc in zip(variants, queue_docs):
        queue_id = queue_doc["_id"]
        saved = save_genome(variant)
        _touch_queue_item(queue_id, "running", strategy_id=saved["strategy_id"])
        try:
            strategy_config = _strategy_payload(variant)
            strategy_config["min_confidence"] = settings.get("min_confidence", strategy_config.get("min_confidence"))
            strategy_config["min_return_threshold"] = settings.get("min_return", strategy_config.get("min_return_threshold"))
            run_id = run_simulation(
                request.symbol or settings.get("symbol", "BTC/USDT"),
                request.interval or settings.get("interval", "1m"),
                strategy_name=saved["strategy_id"],
                horizon=request.horizon or request.interval or settings.get("interval", "1m"),
                strategy_config=strategy_config,
                genome=saved,
            )
            run_doc = _load_run_document(run_id)
            metrics = run_doc.get("results", {}) if run_doc else {}
            updated = update_genome_fitness(saved["strategy_id"], metrics, run_id=run_id)
            _touch_queue_item(
                queue_id,
                "completed",
                run_id=run_id,
                metrics=metrics,
            )
            completed_runs.append(
                {
                    "strategy_id": saved["strategy_id"],
                    "run_id": run_id,
                    "metrics": metrics,
                    "fitness": updated.get("fitness") if updated else {},
                }
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Experiment failed for %s: %s", saved["strategy_id"], exc)
            _touch_queue_item(queue_id, "failed", error=str(exc))

    generate_leaderboard(limit=10)

    return {
        "queued": len(queue_docs),
        "completed": completed_runs,
    }


