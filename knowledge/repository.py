from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from db.client import get_database_name, mongo_client

COLLECTION = "knowledge_base"


def record_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    payload = entry.copy()
    payload.setdefault("created_at", datetime.utcnow())
    period = payload.get("period")
    if not period and payload.get("created_at"):
        period = payload["created_at"].strftime("%Y-%m-%d")
        payload["period"] = period
    identifier = payload.get("_id") or period or payload["created_at"].strftime("%Y%m%d%H%M%S")
    payload["_id"] = identifier
    with mongo_client() as client:
        db = client[get_database_name()]
        db[COLLECTION].update_one(
            {"_id": identifier},
            {"$set": payload},
            upsert=True,
        )
        stored = db[COLLECTION].find_one({"_id": identifier})
    if stored and isinstance(stored.get("created_at"), datetime):
        stored["created_at"] = stored["created_at"].isoformat()
    if stored and "_id" in stored:
        stored["_id"] = str(stored["_id"])
    return stored or payload


def get_latest_entry() -> Optional[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        doc = db[COLLECTION].find_one(sort=[("created_at", -1)])
    if not doc:
        return None
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    doc["_id"] = str(doc["_id"])
    return doc


def get_entry_by_period(period: str) -> Optional[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        doc = db[COLLECTION].find_one({"period": period})
    if not doc:
        return None
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    doc["_id"] = str(doc["_id"])
    return doc


def list_entries(limit: int = 10) -> List[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        cursor = db[COLLECTION].find().sort("created_at", -1).limit(limit)
        docs = list(cursor)
    entries: List[Dict[str, Any]] = []
    for doc in docs:
        if isinstance(doc.get("created_at"), datetime):
            doc["created_at"] = doc["created_at"].isoformat()
        doc["_id"] = str(doc["_id"])
        entries.append(doc)
    return entries

