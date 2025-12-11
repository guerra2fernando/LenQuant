"""Mongo-backed model registry helpers"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from db.client import get_database_name, mongo_client

COLLECTION_NAME = "models.registry"


def record_model(entry: Dict[str, Any]) -> Dict[str, Any]:
    """Insert a new model registry document and return the stored record."""
    payload = entry.copy()
    payload.setdefault("trained_at", datetime.utcnow())
    payload.setdefault("status", "candidate")

    with mongo_client() as client:
        db = client[get_database_name()]
        inserted_id = db[COLLECTION_NAME].insert_one(payload).inserted_id
        payload["_id"] = inserted_id
        return payload


def list_models(
    symbol: Optional[str] = None,
    horizon: Optional[str] = None,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    query: Dict[str, Any] = {}
    if symbol:
        query["symbol"] = symbol
    if horizon:
        query["horizon"] = horizon

    with mongo_client() as client:
        db = client[get_database_name()]
        cursor = (
            db[COLLECTION_NAME]
            .find(query)
            .sort("trained_at", -1)
            .limit(limit)
        )
        return list(cursor)


def latest_model(symbol: str, horizon: str, status: Optional[str] = None) -> Optional[Dict[str, Any]]:
    query: Dict[str, Any] = {"symbol": symbol, "horizon": horizon}
    if status:
        query["status"] = status

    with mongo_client() as client:
        db = client[get_database_name()]
        doc = db[COLLECTION_NAME].find_one(query, sort=[("trained_at", -1)])
        return doc


def get_model(model_identifier) -> Optional[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        if ObjectId.is_valid(str(model_identifier)):
            doc = db[COLLECTION_NAME].find_one({"_id": ObjectId(str(model_identifier))})
            if doc:
                return doc
        doc = db[COLLECTION_NAME].find_one({"model_id": model_identifier})
        return doc


def update_model_status(model_id, status: str) -> None:
    oid = model_id if isinstance(model_id, ObjectId) else ObjectId(str(model_id))
    with mongo_client() as client:
        db = client[get_database_name()]
        db[COLLECTION_NAME].update_one({"_id": oid}, {"$set": {"status": status}})

