from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query

from reports.leaderboard import generate_leaderboard, list_leaderboards, load_leaderboard

router = APIRouter()


@router.get("/today")
def get_today_leaderboard(limit: int = Query(default=10, ge=1, le=50)) -> Dict[str, Any]:
    payload = generate_leaderboard(limit=limit)
    return {"leaderboard": payload}


@router.get("/history")
def get_leaderboard_history() -> Dict[str, Any]:
    return {"history": list_leaderboards()}


@router.get("/{slug}")
def get_leaderboard_slug(slug: str) -> Dict[str, Any]:
    payload = load_leaderboard(slug)
    if not payload:
        raise HTTPException(status_code=404, detail=f"Leaderboard '{slug}' not found.")
    return {"leaderboard": payload}


