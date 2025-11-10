from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from pymongo import ReturnDocument

from db.client import get_database_name, mongo_client

META_MODEL_COLLECTION = "learning.meta_models"
ALLOCATION_COLLECTION = "learning.allocations"
OVERFIT_COLLECTION = "learning.overfit_alerts"
SUMMARY_COLLECTION = "learning.summaries"
SETTINGS_COLLECTION = "settings"
LEARNING_SETTINGS_ID = "learning_settings"

DEFAULT_LEARNING_SETTINGS: Dict[str, Any] = {
    "meta_model": {
        "algorithm": "random_forest",
        "n_estimators": 300,
        "max_depth": None,
        "min_samples_leaf": 2,
        "min_samples": 60,
        "train_window_runs": 500,
    },
    "optimizer": {
        "trials": 60,
        "top_k": 8,
        "exploration_weight": 0.3,
    },
    "allocator": {
        "risk_penalty": 0.45,
        "max_risk": 0.25,
        "min_weight": 0.02,
        "diversification_floor": 0.1,
    },
    "overfit": {
        "window": 6,
        "decay_threshold": 0.35,
        "min_runs": 6,
    },
    "knowledge": {
        "summary_horizon_days": 7,
    },
}


def _db():
    client_context = mongo_client()
    client = client_context.__enter__()
    db = client[get_database_name()]
    return db, client_context


def _with_iso_dates(document: Dict[str, Any]) -> Dict[str, Any]:
    payload = document.copy()
    for key, value in list(payload.items()):
        if isinstance(value, datetime):
            payload[key] = value.isoformat()
    if "_id" in payload:
        payload["_id"] = str(payload["_id"])
    return payload


def record_meta_model(metadata: Dict[str, Any]) -> Dict[str, Any]:
    payload = metadata.copy()
    payload.setdefault("trained_at", datetime.utcnow())
    db, ctx = _db()
    try:
        result = db[META_MODEL_COLLECTION].insert_one(payload)
        payload["_id"] = result.inserted_id
    finally:
        ctx.__exit__(None, None, None)
    return _with_iso_dates(payload)


def latest_meta_model() -> Optional[Dict[str, Any]]:
    db, ctx = _db()
    try:
        doc = db[META_MODEL_COLLECTION].find_one(sort=[("trained_at", -1)])
    finally:
        ctx.__exit__(None, None, None)
    if not doc:
        return None
    return _with_iso_dates(doc)


def list_meta_models(limit: int = 20) -> List[Dict[str, Any]]:
    db, ctx = _db()
    try:
        cursor = (
            db[META_MODEL_COLLECTION]
            .find({})
            .sort("trained_at", -1)
            .limit(max(1, limit))
        )
        docs = list(cursor)
    finally:
        ctx.__exit__(None, None, None)
    return [_with_iso_dates(doc) for doc in docs]


def record_allocator_snapshot(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    payload = snapshot.copy()
    payload.setdefault("created_at", datetime.utcnow())
    db, ctx = _db()
    try:
        result = db[ALLOCATION_COLLECTION].insert_one(payload)
        payload["_id"] = result.inserted_id
    finally:
        ctx.__exit__(None, None, None)
    return _with_iso_dates(payload)


def latest_allocator_snapshot() -> Optional[Dict[str, Any]]:
    db, ctx = _db()
    try:
        doc = db[ALLOCATION_COLLECTION].find_one(sort=[("created_at", -1)])
    finally:
        ctx.__exit__(None, None, None)
    if not doc:
        return None
    return _with_iso_dates(doc)


def record_overfit_alerts(alerts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not alerts:
        return []
    stored: List[Dict[str, Any]] = []
    db, ctx = _db()
    try:
        collection = db[OVERFIT_COLLECTION]
        for alert in alerts:
            payload = alert.copy()
            payload.setdefault("status", "open")
            payload.setdefault("detected_at", datetime.utcnow())
            key = {
                "strategy_id": payload.get("strategy_id"),
                "detected_at": payload.get("detected_at"),
            }
            result = collection.find_one_and_update(
                key,
                {"$set": payload},
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
            if result is None:
                result = collection.find_one(key)
            if result:
                stored.append(_with_iso_dates(result))
    finally:
        ctx.__exit__(None, None, None)
    return stored


def list_overfit_alerts(status: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    db, ctx = _db()
    try:
        cursor = (
            db[OVERFIT_COLLECTION]
            .find(query)
            .sort("detected_at", -1)
            .limit(max(1, limit))
        )
        docs = list(cursor)
    finally:
        ctx.__exit__(None, None, None)
    return [_with_iso_dates(doc) for doc in docs]


def acknowledge_overfit_alert(alert_id: str) -> Optional[Dict[str, Any]]:
    db, ctx = _db()
    try:
        updated = db[OVERFIT_COLLECTION].find_one_and_update(
            {"_id": ObjectId(alert_id)},
            {"$set": {"status": "acknowledged", "acknowledged_at": datetime.utcnow()}},
            return_document=ReturnDocument.AFTER,
        )
    finally:
        ctx.__exit__(None, None, None)
    if not updated:
        return None
    return _with_iso_dates(updated)


def record_learning_summary(summary: Dict[str, Any]) -> Dict[str, Any]:
    payload = summary.copy()
    payload.setdefault("created_at", datetime.utcnow())
    slug = payload.get("slug") or payload["created_at"].strftime("%Y%m%d")
    payload["_id"] = slug
    db, ctx = _db()
    try:
        db[SUMMARY_COLLECTION].update_one(
            {"_id": slug},
            {"$set": payload},
            upsert=True,
        )
        stored = db[SUMMARY_COLLECTION].find_one({"_id": slug})
    finally:
        ctx.__exit__(None, None, None)
    return _with_iso_dates(stored or payload)


def latest_learning_summary() -> Optional[Dict[str, Any]]:
    db, ctx = _db()
    try:
        doc = db[SUMMARY_COLLECTION].find_one(sort=[("created_at", -1)])
    finally:
        ctx.__exit__(None, None, None)
    if not doc:
        return None
    return _with_iso_dates(doc)


def get_learning_settings() -> Dict[str, Any]:
    db, ctx = _db()
    try:
        doc = db[SETTINGS_COLLECTION].find_one({"_id": LEARNING_SETTINGS_ID})
    finally:
        ctx.__exit__(None, None, None)
    if not doc:
        return {**DEFAULT_LEARNING_SETTINGS, "updated_at": None}
    payload = {**DEFAULT_LEARNING_SETTINGS, **doc}
    payload.pop("_id", None)
    updated_at = payload.get("updated_at")
    if isinstance(updated_at, datetime):
        payload["updated_at"] = updated_at.isoformat()
    return payload


def update_learning_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    document = {**DEFAULT_LEARNING_SETTINGS, **payload}
    document["updated_at"] = datetime.utcnow()
    db, ctx = _db()
    try:
        db[SETTINGS_COLLECTION].update_one(
            {"_id": LEARNING_SETTINGS_ID},
            {"$set": document},
            upsert=True,
        )
    finally:
        ctx.__exit__(None, None, None)
    return get_learning_settings()

