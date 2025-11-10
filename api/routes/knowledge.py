from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Query

from knowledge.base import KnowledgeBaseService
from knowledge.repository import get_entry_by_period, get_latest_entry, list_entries

router = APIRouter()
service = KnowledgeBaseService()


@router.get("/")
def get_recent(limit: int = 10) -> Dict[str, Any]:
    return {"entries": list_entries(limit=limit)}


@router.get("/latest")
def get_latest() -> Dict[str, Any]:
    entry = get_latest_entry()
    if not entry:
        raise HTTPException(status_code=404, detail="No knowledge entries recorded.")
    return {"entry": entry}


@router.get("/{period}")
def get_period(period: str) -> Dict[str, Any]:
    entry = get_entry_by_period(period)
    if not entry:
        raise HTTPException(status_code=404, detail=f"No knowledge entry for period '{period}'.")
    return {"entry": entry}


@router.get("/search")
def search_knowledge(q: str = Query(..., min_length=2), limit: int = Query(default=10, ge=1, le=50)) -> Dict[str, Any]:
    results = service.search(q, limit=limit)
    return {"results": results}


@router.post("/pin/{period}")
def pin_knowledge_entry(period: str) -> Dict[str, Any]:
    try:
        updated = service.pin_entry(period)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"entry": updated}

