from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional
from uuid import uuid4

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING, ReturnDocument

from db.client import get_database_name, mongo_client
from strategy_genome.encoding import StrategyGenome, create_genome_from_dict

from .schemas import EvolutionCandidate

EXPERIMENT_COLLECTION = "evolution_experiments"
SCHEDULER_COLLECTION = "evolution_schedulers"
AUTONOMY_SETTINGS_ID = "autonomy_settings"


def _ensure_indexes() -> None:
    with mongo_client() as client:
        db = client[get_database_name()]
        collection = db[EXPERIMENT_COLLECTION]
        collection.create_index("experiment_id", unique=True)
        collection.create_index([("status", ASCENDING), ("score", DESCENDING)])
        collection.create_index([("candidate.genome.family", ASCENDING), ("created_at", DESCENDING)])
        db[SCHEDULER_COLLECTION].create_index("scheduler_id", unique=True)


def _candidate_payload(candidate: EvolutionCandidate) -> Dict[str, Any]:
    payload = candidate.to_dict()
    payload["genome"]["metadata"] = dict(candidate.metadata)
    return payload


def create_experiments(candidates: Iterable[EvolutionCandidate]) -> List[Dict[str, Any]]:
    _ensure_indexes()
    documents: List[Dict[str, Any]] = []
    now = datetime.utcnow()
    with mongo_client() as client:
        db = client[get_database_name()]
        collection = db[EXPERIMENT_COLLECTION]
        for candidate in candidates:
            experiment_id = f"exp-{uuid4().hex[:12]}"
            document = {
                "_id": ObjectId(),
                "experiment_id": experiment_id,
                "candidate": _candidate_payload(candidate),
                "status": "pending",
                "score": 0.0,
                "metrics": {},
                "created_at": now,
                "updated_at": now,
                "lineage": [candidate.parent_id] if candidate.parent_id else [],
                "insights": {},
                "notes": [],
            }
            collection.insert_one(document)
            document["_id"] = str(document["_id"])
            documents.append(document)
    return documents


def list_experiments(
    *,
    status: Optional[str] = None,
    limit: int = 50,
    sort_by: str = "updated_at",
    descending: bool = True,
) -> List[Dict[str, Any]]:
    _ensure_indexes()
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    with mongo_client() as client:
        db = client[get_database_name()]
        order = DESCENDING if descending else ASCENDING
        cursor = db[EXPERIMENT_COLLECTION].find(query).sort(sort_by, order).limit(limit)
        docs = list(cursor)
    results: List[Dict[str, Any]] = []
    for doc in docs:
        doc["_id"] = str(doc["_id"])
        results.append(doc)
    return results


def load_experiment(experiment_id: str) -> Optional[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        doc = db[EXPERIMENT_COLLECTION].find_one({"experiment_id": experiment_id})
    if not doc:
        return None
    doc["_id"] = str(doc["_id"])
    return doc


def update_experiment(experiment_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    updates = dict(updates)
    updates["updated_at"] = datetime.utcnow()
    with mongo_client() as client:
        db = client[get_database_name()]
        updated = db[EXPERIMENT_COLLECTION].find_one_and_update(
            {"experiment_id": experiment_id},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
    if not updated:
        return None
    updated["_id"] = str(updated["_id"])
    return updated


def append_note(experiment_id: str, note: str) -> Optional[Dict[str, Any]]:
    payload = {
        "updated_at": datetime.utcnow(),
        "note": note,
    }
    with mongo_client() as client:
        db = client[get_database_name()]
        updated = db[EXPERIMENT_COLLECTION].find_one_and_update(
            {"experiment_id": experiment_id},
            {
                "$set": {"updated_at": payload["updated_at"]},
                "$push": {"notes": {"note": note, "created_at": payload["updated_at"]}},
            },
            return_document=ReturnDocument.AFTER,
        )
    if not updated:
        return None
    updated["_id"] = str(updated["_id"])
    return updated


def upsert_scheduler_state(state: Dict[str, Any]) -> Dict[str, Any]:
    scheduler_id = state.get("scheduler_id", "daily_evolution")
    payload = {**state, "scheduler_id": scheduler_id, "updated_at": datetime.utcnow()}
    with mongo_client() as client:
        db = client[get_database_name()]
        db[SCHEDULER_COLLECTION].update_one(
            {"scheduler_id": scheduler_id},
            {"$set": payload},
            upsert=True,
        )
        stored = db[SCHEDULER_COLLECTION].find_one({"scheduler_id": scheduler_id})
    stored["_id"] = str(stored["_id"])
    return stored


def get_scheduler_states() -> List[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        docs = list(db[SCHEDULER_COLLECTION].find({}))
    states: List[Dict[str, Any]] = []
    for doc in docs:
        doc["_id"] = str(doc["_id"])
        states.append(doc)
    return states


def get_autonomy_settings() -> Dict[str, Any]:
    with mongo_client() as client:
        db = client[get_database_name()]
        doc = db["settings"].find_one({"_id": AUTONOMY_SETTINGS_ID})
    if not doc:
        return {
            "auto_promote": False,
            "auto_promote_threshold": 0.05,
            "safety_limits": {"max_leverage": 5, "max_drawdown": 0.2},
            "knowledge_retention_weeks": 12,
            "llm_provider": "disabled",
        }
    payload = dict(doc)
    payload.pop("_id", None)
    return payload


def update_autonomy_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
    payload = {**settings, "updated_at": datetime.utcnow()}
    with mongo_client() as client:
        db = client[get_database_name()]
        db["settings"].update_one(
            {"_id": AUTONOMY_SETTINGS_ID},
            {"$set": payload},
            upsert=True,
        )
        stored = db["settings"].find_one({"_id": AUTONOMY_SETTINGS_ID})
    stored["_id"] = str(stored["_id"])
    return stored


def load_strategy_from_candidate(experiment: Dict[str, Any]) -> StrategyGenome:
    candidate = experiment.get("candidate") or {}
    genome_dict = candidate.get("genome") or {}
    return create_genome_from_dict(genome_dict)

