from __future__ import annotations

from datetime import date
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from db.client import get_database_name, mongo_client

router = APIRouter()


@router.get("")
def list_reports(limit: int = 7) -> Dict[str, Any]:
    with mongo_client() as client:
        db = client[get_database_name()]
        cursor = (
            db["daily_reports"]
            .find({}, {"_id": 0, "date": 1, "summary": 1})
            .sort("date", -1)
            .limit(limit)
        )
        reports = list(cursor)
    return {"reports": reports}


@router.get("/{report_date}")
def get_report(report_date: str) -> Dict[str, Any]:
    with mongo_client() as client:
        db = client[get_database_name()]
        record = db["daily_reports"].find_one({"date": report_date}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Report not found")
    return record

