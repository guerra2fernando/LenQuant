from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from pymongo import ReturnDocument

from db.client import get_database_name, mongo_client

from .schemas import (
    AssistantConversationTurn,
    AssistantSettings,
    RecommendationDecision,
    TradeRecommendation,
)

LOG_COLLECTION = "assistant.logs"
RECOMMENDATION_COLLECTION = "assistant.recommendations"
SETTINGS_COLLECTION = "settings"
SETTINGS_DOCUMENT_ID = "assistant_settings"


def _with_iso_dates(document: Dict[str, Any]) -> Dict[str, Any]:
    payload = {**document}
    for key, value in list(payload.items()):
        if isinstance(value, datetime):
            payload[key] = value.isoformat()
    if "_id" in payload:
        payload["_id"] = str(payload["_id"])
    if "decisions" in payload and isinstance(payload["decisions"], list):
        processed: List[Dict[str, Any]] = []
        for item in payload["decisions"]:
            if isinstance(item, dict):
                processed.append(_with_iso_dates(item))
        payload["decisions"] = processed
    if "retrieved_evidence" in payload and isinstance(payload["retrieved_evidence"], list):
        updated = []
        for item in payload["retrieved_evidence"]:
            if isinstance(item, dict):
                updated.append(item)
        payload["retrieved_evidence"] = updated
    if "context" in payload and isinstance(payload["context"], dict):
        context = payload["context"].copy()
        for key, value in list(context.items()):
            if isinstance(value, datetime):
                context[key] = value.isoformat()
        payload["context"] = context
    return payload


def log_conversation(turn: AssistantConversationTurn) -> Dict[str, Any]:
    """Persist a conversation turn and return the stored document."""
    document = turn.serialise_for_db()
    document["_id"] = document["answer_id"]
    with mongo_client() as client:
        db = client[get_database_name()]
        db[LOG_COLLECTION].update_one(
            {"_id": document["_id"]},
            {"$set": document},
            upsert=True,
        )
        stored = db[LOG_COLLECTION].find_one({"_id": document["_id"]})
    if not stored:
        return document
    return _with_iso_dates(stored)


def list_conversation_history(limit: int = 50) -> List[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        cursor = (
            db[LOG_COLLECTION]
            .find({})
            .sort("created_at", -1)
            .limit(max(1, limit))
        )
        docs = list(cursor)
    return [_with_iso_dates(doc) for doc in docs]


def fetch_conversation(answer_id: str) -> Optional[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        doc = db[LOG_COLLECTION].find_one({"_id": answer_id})
    if not doc:
        return None
    return _with_iso_dates(doc)


def upsert_recommendation(recommendation: TradeRecommendation) -> Dict[str, Any]:
    """Create or update a recommendation entry."""
    document = recommendation.serialise_for_db()
    document["_id"] = recommendation.rec_id
    with mongo_client() as client:
        db = client[get_database_name()]
        db[RECOMMENDATION_COLLECTION].update_one(
            {"_id": document["_id"]},
            {"$set": document},
            upsert=True,
        )
        stored = db[RECOMMENDATION_COLLECTION].find_one({"_id": document["_id"]})
    if not stored:
        return document
    return _with_iso_dates(stored)


def list_recommendations(
    *,
    status: Optional[str] = None,
    limit: int = 20,
    include_closed: bool = False,
) -> List[Dict[str, Any]]:
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    if not include_closed and "status" not in query:
        query["status"] = {"$in": ["pending", "modified", "snoozed"]}
    with mongo_client() as client:
        db = client[get_database_name()]
        cursor = (
            db[RECOMMENDATION_COLLECTION]
            .find(query)
            .sort("created_at", -1)
            .limit(max(1, limit))
        )
        docs = list(cursor)
    return [_with_iso_dates(doc) for doc in docs]


def fetch_recommendation(rec_id: str) -> Optional[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        doc = db[RECOMMENDATION_COLLECTION].find_one({"_id": rec_id})
    if not doc:
        return None
    return _with_iso_dates(doc)


def record_recommendation_decision(
    rec_id: str,
    decision: RecommendationDecision,
    *,
    status_override: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    update_payload = decision.serialise_for_db()
    update_payload.setdefault("decision_id", str(ObjectId()))
    status = status_override or decision.decision
    now = datetime.utcnow()
    with mongo_client() as client:
        db = client[get_database_name()]
        updated = db[RECOMMENDATION_COLLECTION].find_one_and_update(
            {"_id": rec_id},
            {
                "$push": {"decisions": update_payload},
                "$set": {"status": status, "updated_at": now},
            },
            return_document=ReturnDocument.AFTER,
        )
    if not updated:
        return None
    return _with_iso_dates(updated)


def delete_recommendation(rec_id: str) -> bool:
    with mongo_client() as client:
        db = client[get_database_name()]
        result = db[RECOMMENDATION_COLLECTION].delete_one({"_id": rec_id})
    return bool(result.deleted_count)


DEFAULT_SETTINGS = AssistantSettings().serialise_for_db()


def get_settings() -> Dict[str, Any]:
    with mongo_client() as client:
        db = client[get_database_name()]
        doc = db[SETTINGS_COLLECTION].find_one({"_id": SETTINGS_DOCUMENT_ID})
    if not doc:
        payload = AssistantSettings().serialise_for_db()
        payload.pop("_id", None)
        payload["updated_at"] = payload["updated_at"].isoformat()
        return payload
    payload = {**DEFAULT_SETTINGS, **doc}
    payload.pop("_id", None)
    updated_at = payload.get("updated_at")
    if isinstance(updated_at, datetime):
        payload["updated_at"] = updated_at.isoformat()
    return payload


def update_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    document = {**DEFAULT_SETTINGS, **payload}
    document["updated_at"] = datetime.utcnow()
    with mongo_client() as client:
        db = client[get_database_name()]
        db[SETTINGS_COLLECTION].update_one(
            {"_id": SETTINGS_DOCUMENT_ID},
            {"$set": document},
            upsert=True,
        )
    return get_settings()


