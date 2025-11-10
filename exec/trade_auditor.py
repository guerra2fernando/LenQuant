"""Audit logging utilities for trading execution."""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from bson import ObjectId

from db.client import get_database_name, mongo_client

LOGGER = logging.getLogger(__name__)

AUDIT_COLLECTION = "trading_audit"


def _utcnow() -> datetime:
    return datetime.utcnow().replace(tzinfo=timezone.utc)


class TradeAuditor:
    """Persists immutable audit logs for every trading event."""

    def __init__(self) -> None:
        self.logger = LOGGER

    def record_event(
        self,
        *,
        event_type: str,
        mode: str,
        order_id: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
        actor: Optional[str] = None,
        severity: str = "info",
    ) -> Dict[str, Any]:
        """Persist an audit event with tamper-evident hash."""
        payload = payload or {}
        timestamp = _utcnow()
        serialised_payload = json.dumps(payload, sort_keys=True, default=str)
        base = f"{event_type}|{mode}|{order_id or ''}|{timestamp.isoformat()}|{serialised_payload}"
        digest = hashlib.sha256(base.encode("utf-8")).hexdigest()

        document = {
            "_id": ObjectId(),
            "event_type": event_type,
            "mode": mode,
            "order_id": order_id,
            "payload": payload,
            "actor": actor,
            "severity": severity,
            "hash": digest,
            "created_at": timestamp,
        }

        with mongo_client() as client:
            db = client[get_database_name()]
            db[AUDIT_COLLECTION].insert_one(document)

        self.logger.debug("Recorded trading audit event %s for order %s", event_type, order_id)
        return self._serialise(document)

    def fetch_recent(self, *, limit: int = 100) -> list[Dict[str, Any]]:
        with mongo_client() as client:
            db = client[get_database_name()]
            cursor = (
                db[AUDIT_COLLECTION]
                .find({})
                .sort("created_at", -1)
                .limit(max(1, limit))
            )
            docs = list(cursor)
        return [self._serialise(doc) for doc in docs]

    @staticmethod
    def _serialise(doc: Dict[str, Any]) -> Dict[str, Any]:
        payload = {**doc}
        if "_id" in payload:
            payload["_id"] = str(payload["_id"])
        for key, value in list(payload.items()):
            if isinstance(value, datetime):
                payload[key] = value.isoformat()
        return payload

"""Audit logging utilities for trading execution."""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from bson import ObjectId

from db.client import get_database_name, mongo_client

LOGGER = logging.getLogger(__name__)

AUDIT_COLLECTION = "trading_audit"


def _utcnow() -> datetime:
    return datetime.utcnow().replace(tzinfo=timezone.utc)


class TradeAuditor:
    """Persists immutable audit logs for every trading event."""

    def __init__(self) -> None:
        self.logger = LOGGER

    def record_event(
        self,
        *,
        event_type: str,
        mode: str,
        order_id: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
        actor: Optional[str] = None,
        severity: str = "info",
    ) -> Dict[str, Any]:
        """Persist an audit event with tamper-evident hash."""
        payload = payload or {}
        timestamp = _utcnow()
        serialised_payload = json.dumps(payload, sort_keys=True, default=str)
        base = f"{event_type}|{mode}|{order_id or ''}|{timestamp.isoformat()}|{serialised_payload}"
        digest = hashlib.sha256(base.encode("utf-8")).hexdigest()

        document = {
            "_id": ObjectId(),
            "event_type": event_type,
            "mode": mode,
            "order_id": order_id,
            "payload": payload,
            "actor": actor,
            "severity": severity,
            "hash": digest,
            "created_at": timestamp,
        }

        with mongo_client() as client:
            db = client[get_database_name()]
            db[AUDIT_COLLECTION].insert_one(document)

        self.logger.debug("Recorded trading audit event %s for order %s", event_type, order_id)
        return self._serialise(document)

    def fetch_recent(self, *, limit: int = 100) -> list[Dict[str, Any]]:
        with mongo_client() as client:
            db = client[get_database_name()]
            cursor = (
                db[AUDIT_COLLECTION]
                .find({})
                .sort("created_at", -1)
                .limit(max(1, limit))
            )
            docs = list(cursor)
        return [self._serialise(doc) for doc in docs]

    @staticmethod
    def _serialise(doc: Dict[str, Any]) -> Dict[str, Any]:
        payload = {**doc}
        if "_id" in payload:
            payload["_id"] = str(payload["_id"])
        for key, value in list(payload.items()):
            if isinstance(value, datetime):
                payload[key] = value.isoformat()
        return payload


