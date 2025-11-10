from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from db.client import get_database_name, mongo_client
from strategy_genome.repository import (
    archive_strategy,
    get_genome,
    list_genomes,
    promote_strategy,
)

router = APIRouter()


def _serialize_datetime(value: Any) -> Any:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def _serialize_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    converted = {**doc}
    converted["_id"] = str(converted.get("_id", converted.get("strategy_id", "")))
    converted["created_at"] = _serialize_datetime(converted.get("created_at"))
    converted["updated_at"] = _serialize_datetime(converted.get("updated_at"))
    fitness = converted.get("fitness")
    if fitness:
        converted["fitness"] = {k: float(v) if isinstance(v, (int, float)) else v for k, v in fitness.items()}
    return converted


@router.get("/genomes")
def get_genomes(
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> Dict[str, Any]:
    docs = list_genomes(status=status, limit=limit)
    return {"genomes": [_serialize_doc(doc) for doc in docs]}


def _recent_runs(strategy_id: str, limit: int = 5) -> List[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        cursor = (
            db["sim_runs"]
            .find({"strategy": strategy_id})
            .sort("created_at", -1)
            .limit(limit)
        )
        runs = list(cursor)
    for run in runs:
        run["_id"] = str(run.get("_id", ""))
        run["created_at"] = _serialize_datetime(run.get("created_at"))
    return runs


@router.get("/{strategy_id}")
def get_strategy(strategy_id: str) -> Dict[str, Any]:
    doc = get_genome(strategy_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Strategy '{strategy_id}' not found.")
    return {
        "strategy": _serialize_doc(doc),
        "runs": _recent_runs(strategy_id),
    }


class StrategyActionPayload(BaseModel):
    strategy_id: str


@router.post("/promote")
def post_promote_strategy(payload: StrategyActionPayload) -> Dict[str, Any]:
    updated = promote_strategy(payload.strategy_id)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Strategy '{payload.strategy_id}' not found.")
    return {"strategy": _serialize_doc(updated)}


@router.post("/archive")
def post_archive_strategy(payload: StrategyActionPayload) -> Dict[str, Any]:
    updated = archive_strategy(payload.strategy_id)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Strategy '{payload.strategy_id}' not found.")
    return {"strategy": _serialize_doc(updated)}


@router.get("/lineage")
def get_lineage(limit: int = Query(default=100, ge=1, le=500)) -> Dict[str, Any]:
    docs = list_genomes(limit=limit)
    nodes = []
    links = []
    for doc in docs:
        parent = doc.get("mutation_parent")
        nodes.append(
            {
                "strategy_id": doc.get("strategy_id"),
                "generation": doc.get("generation"),
                "status": doc.get("status"),
                "composite": doc.get("fitness", {}).get("composite"),
                "parent": parent,
            }
        )
        if parent:
            links.append({"source": parent, "target": doc.get("strategy_id")})
    return {"nodes": nodes, "links": links}


