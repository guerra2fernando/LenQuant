"""Persistence utilities for strategy genomes and experiment queues."""
from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING, ReturnDocument

from db.client import get_database_name, mongo_client
from strategy_genome.encoding import (
    StrategyFitness,
    StrategyGenome,
    create_genome_from_dict,
    default_genome_document,
)

STRATEGY_COLLECTION = "strategies"
EXPERIMENT_QUEUE_COLLECTION = "experiments_queue"
LEADERBOARD_COLLECTION = "leaderboards"
SETTINGS_COLLECTION = "settings"
EXPERIMENT_SETTINGS_ID = "experiment_settings"

DEFAULT_EXPERIMENT_SETTINGS = {
    "symbol": "BTC/USDT",
    "interval": "1m",
    "accounts": 20,
    "mutations_per_parent": 4,
    "champion_limit": 5,
    "families": ["ema-cross"],
    "auto_promote_threshold": 2.0,
    "min_confidence": 0.6,
    "min_return": 0.001,
    "max_queue": 50,
}


def _ensure_indexes() -> None:
    with mongo_client() as client:
        db = client[get_database_name()]
        strategies = db[STRATEGY_COLLECTION]
        strategies.create_index("strategy_id", unique=True)
        strategies.create_index([("family", ASCENDING), ("generation", DESCENDING)])
        strategies.create_index([("status", ASCENDING)])
        strategies.create_index([("fitness.composite", DESCENDING)])

        queue = db[EXPERIMENT_QUEUE_COLLECTION]
        queue.create_index([("status", ASCENDING), ("priority", ASCENDING)])
        queue.create_index("strategy_id")


def ensure_seed_genomes(families: Sequence[str] | None = None) -> List[Dict[str, Any]]:
    """Guarantee that at least one genome per family exists."""
    _ensure_indexes()
    families = families or ("ema-cross",)
    inserted: List[Dict[str, Any]] = []
    with mongo_client() as client:
        db = client[get_database_name()]
        collection = db[STRATEGY_COLLECTION]
        for family in families:
            existing = collection.find_one({"family": family, "generation": 0})
            if existing:
                inserted.append(existing)
                continue
            seed = default_genome_document(family=family)
            seed["_id"] = seed["strategy_id"]
            seed["updated_at"] = datetime.utcnow()
            collection.insert_one(seed)
            inserted.append(seed)
    return inserted


def list_genomes(
    *,
    status: Optional[str] = None,
    limit: int = 50,
    sort_by: str = "fitness.composite",
    descending: bool = True,
) -> List[Dict[str, Any]]:
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    order = DESCENDING if descending else ASCENDING
    with mongo_client() as client:
        db = client[get_database_name()]
        cursor = (
            db[STRATEGY_COLLECTION]
            .find(query)
            .sort(sort_by, order)
            .limit(limit)
        )
        docs = list(cursor)
    for doc in docs:
        doc["_id"] = str(doc.get("_id", doc.get("strategy_id")))
    return docs


def get_genome(strategy_id: str) -> Optional[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        doc = db[STRATEGY_COLLECTION].find_one({"strategy_id": strategy_id})
    if not doc:
        return None
    doc["_id"] = str(doc.get("_id", strategy_id))
    return doc


def save_genome(genome: StrategyGenome) -> Dict[str, Any]:
    payload = genome.document()
    payload["_id"] = payload["strategy_id"]
    payload["updated_at"] = datetime.utcnow()
    with mongo_client() as client:
        db = client[get_database_name()]
        db[STRATEGY_COLLECTION].update_one(
            {"strategy_id": payload["strategy_id"]},
            {"$set": payload},
            upsert=True,
        )
        saved = db[STRATEGY_COLLECTION].find_one({"strategy_id": payload["strategy_id"]})
    if not saved:
        return payload
    saved["_id"] = str(saved.get("_id", payload["strategy_id"]))
    return saved


def _composite_score(metrics: Dict[str, Any]) -> float:
    roi = float(metrics.get("roi", 0.0))
    sharpe = float(metrics.get("sharpe", 0.0))
    alignment = float(metrics.get("forecast_alignment", 0.0))
    max_drawdown = float(metrics.get("max_drawdown", 0.0))
    roi_component = max(0.0, roi + 1.0)  # reward positive ROI, soften negatives
    sharpe_component = max(0.1, sharpe + 1.0)
    alignment_component = max(0.05, alignment)
    drawdown_penalty = max(0.1, 1.0 - max(0.0, min(max_drawdown, 0.9)))
    return roi_component * sharpe_component * alignment_component * drawdown_penalty


def update_genome_fitness(
    strategy_id: str,
    metrics: Dict[str, Any],
    *,
    run_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    fitness = StrategyFitness(
        roi=float(metrics.get("roi", 0.0)),
        sharpe=float(metrics.get("sharpe", 0.0)),
        max_drawdown=float(metrics.get("max_drawdown", 0.0)),
        forecast_alignment=float(metrics.get("forecast_alignment", 0.0)),
        stability=float(metrics.get("stability", 0.0)),
        composite=float(metrics.get("composite", 0.0) or _composite_score(metrics)),
    )
    payload = asdict(fitness)
    payload["composite"] = fitness.composite
    update_fields: Dict[str, Any] = {
        "fitness": payload,
        "updated_at": datetime.utcnow(),
    }
    if run_id:
        update_fields["last_run_id"] = run_id
        update_fields["last_run_at"] = datetime.utcnow()

    with mongo_client() as client:
        db = client[get_database_name()]
        result = db[STRATEGY_COLLECTION].find_one_and_update(
            {"strategy_id": strategy_id},
            {"$set": update_fields},
            return_document=ReturnDocument.AFTER,
        )
    if not result:
        return None
    result["_id"] = str(result.get("_id", strategy_id))
    return result


def promote_strategy(strategy_id: str) -> Optional[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        updated = db[STRATEGY_COLLECTION].find_one_and_update(
            {"strategy_id": strategy_id},
            {"$set": {"status": "champion", "updated_at": datetime.utcnow()}},
            return_document=ReturnDocument.AFTER,
        )
    if not updated:
        return None
    updated["_id"] = str(updated.get("_id", strategy_id))
    return updated


def archive_strategy(strategy_id: str) -> Optional[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        updated = db[STRATEGY_COLLECTION].find_one_and_update(
            {"strategy_id": strategy_id},
            {"$set": {"status": "archived", "updated_at": datetime.utcnow()}},
            return_document=ReturnDocument.AFTER,
        )
    if not updated:
        return None
    updated["_id"] = str(updated.get("_id", strategy_id))
    return updated


def record_queue_items(genomes: Iterable[StrategyGenome], max_queue: Optional[int] = None) -> List[Dict[str, Any]]:
    documents: List[Dict[str, Any]] = []
    now = datetime.utcnow()
    genomes_list = list(genomes)
    with mongo_client() as client:
        db = client[get_database_name()]
        queue = db[EXPERIMENT_QUEUE_COLLECTION]
        existing_count = queue.count_documents({})
        available = max_queue - existing_count if max_queue else None
        if available is not None and available < 0:
            available = 0
        selected = genomes_list if available is None else genomes_list[:available]
        for priority, genome in enumerate(selected, start=existing_count + 1):
            document = genome.document()
            document.update(
                {
                    "_id": ObjectId(),
                    "priority": priority,
                    "status": "pending",
                    "created_at": now,
                }
            )
            inserted_id = queue.insert_one(document).inserted_id
            document["_id"] = inserted_id
            documents.append({**document, "_id": str(inserted_id)})
    return documents


def fetch_queue(status: Optional[str] = None) -> List[Dict[str, Any]]:
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    with mongo_client() as client:
        db = client[get_database_name()]
        cursor = (
            db[EXPERIMENT_QUEUE_COLLECTION]
            .find(query)
            .sort("priority", ASCENDING)
        )
        items = list(cursor)
    for item in items:
        item["_id"] = str(item["_id"])
    return items


def update_queue_item(queue_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        updated = db[EXPERIMENT_QUEUE_COLLECTION].find_one_and_update(
            {"_id": ObjectId(queue_id)},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
    if not updated:
        return None
    updated["_id"] = str(updated["_id"])
    return updated


def reprioritize_queue(queue_ids: Sequence[str]) -> List[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        queue = db[EXPERIMENT_QUEUE_COLLECTION]
        for index, queue_id in enumerate(queue_ids, start=1):
            queue.update_one(
                {"_id": ObjectId(queue_id)},
                {"$set": {"priority": index, "updated_at": datetime.utcnow()}},
            )
        items = list(
            queue.find({}).sort("priority", ASCENDING)
        )
    for item in items:
        item["_id"] = str(item["_id"])
    return items


def record_leaderboard(payload: Dict[str, Any]) -> None:
    with mongo_client() as client:
        db = client[get_database_name()]
        db[LEADERBOARD_COLLECTION].update_one(
            {"_id": payload.get("slug") or payload.get("date")},
            {
                "$set": {
                    **payload,
                    "created_at": datetime.utcnow(),
                }
            },
            upsert=True,
        )


def get_experiment_settings() -> Dict[str, Any]:
    with mongo_client() as client:
        db = client[get_database_name()]
        doc = db[SETTINGS_COLLECTION].find_one({"_id": EXPERIMENT_SETTINGS_ID})
    if not doc:
        return DEFAULT_EXPERIMENT_SETTINGS.copy()
    payload = {**DEFAULT_EXPERIMENT_SETTINGS, **doc}
    payload.pop("_id", None)
    return payload


