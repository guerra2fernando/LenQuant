"""User setup and onboarding progress tracking."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db.client import get_database_name, mongo_client

router = APIRouter()


class SetupProgressResponse(BaseModel):
    steps_completed: Dict[str, bool]
    completion_percentage: float
    onboarding_completed: bool
    tour_completions: Dict[str, bool]
    last_updated: str


class UpdateSetupStepPayload(BaseModel):
    step: str = Field(..., pattern="^(data_ingested|models_trained|paper_money_added|first_trade_placed)$")


class UpdateTourPayload(BaseModel):
    page: str = Field(..., pattern="^(dashboard|terminal|portfolio|assistant|analytics)$")


def _get_or_create_progress(user_id: str = "default") -> Dict[str, Any]:
    """Get or create user setup progress document."""
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Try to find existing progress
        progress = db["user_setup_progress"].find_one({"user_id": user_id})
        
        if not progress:
            # Create default progress
            default_progress = {
                "user_id": user_id,
                "steps_completed": {
                    "data_ingested": False,
                    "models_trained": False,
                    "paper_money_added": False,
                    "first_trade_placed": False,
                },
                "tour_completions": {
                    "dashboard": False,
                    "terminal": False,
                    "portfolio": False,
                    "assistant": False,
                    "analytics": False,
                },
                "onboarding_completed": False,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            db["user_setup_progress"].insert_one(default_progress)
            progress = default_progress
        
        return progress


def _calculate_completion(steps: Dict[str, bool]) -> float:
    """Calculate completion percentage."""
    completed = sum(1 for v in steps.values() if v)
    total = len(steps)
    return (completed / total * 100) if total > 0 else 0.0


@router.get("/setup-progress")
def get_setup_progress(user_id: str = "default") -> Dict[str, Any]:
    """
    Get user's setup progress.
    
    Returns current state of onboarding steps and tour completions.
    """
    progress = _get_or_create_progress(user_id)
    
    steps_completed = progress.get("steps_completed", {})
    tour_completions = progress.get("tour_completions", {})
    completion_pct = _calculate_completion(steps_completed)
    
    # Check if all steps are completed
    all_complete = all(steps_completed.values())
    
    # Update onboarding_completed if needed
    if all_complete and not progress.get("onboarding_completed"):
        with mongo_client() as client:
            db = client[get_database_name()]
            db["user_setup_progress"].update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "onboarding_completed": True,
                        "updated_at": datetime.utcnow(),
                    }
                },
            )
    
    return {
        "steps_completed": steps_completed,
        "completion_percentage": completion_pct,
        "onboarding_completed": all_complete,
        "tour_completions": tour_completions,
        "last_updated": progress.get("updated_at", datetime.utcnow()).isoformat(),
    }


@router.post("/setup-progress")
def update_setup_step(payload: UpdateSetupStepPayload, user_id: str = "default") -> Dict[str, Any]:
    """
    Mark a setup step as completed.
    
    Accepts: data_ingested, models_trained, paper_money_added, first_trade_placed
    """
    progress = _get_or_create_progress(user_id)
    
    # Update the specific step
    with mongo_client() as client:
        db = client[get_database_name()]
        db["user_setup_progress"].update_one(
            {"user_id": user_id},
            {
                "$set": {
                    f"steps_completed.{payload.step}": True,
                    "updated_at": datetime.utcnow(),
                }
            },
        )
    
    # Return updated progress
    return get_setup_progress(user_id)


@router.post("/tour-complete")
def complete_tour(payload: UpdateTourPayload, user_id: str = "default") -> Dict[str, Any]:
    """
    Mark a page tour as completed.
    
    Accepts: dashboard, terminal, portfolio, assistant, analytics
    """
    progress = _get_or_create_progress(user_id)
    
    # Update the specific tour
    with mongo_client() as client:
        db = client[get_database_name()]
        db["user_setup_progress"].update_one(
            {"user_id": user_id},
            {
                "$set": {
                    f"tour_completions.{payload.page}": True,
                    "updated_at": datetime.utcnow(),
                }
            },
        )
    
    # Return updated progress
    return get_setup_progress(user_id)


@router.post("/reset-progress")
def reset_progress(user_id: str = "default") -> Dict[str, Any]:
    """Reset user's setup progress (useful for testing or re-onboarding)."""
    with mongo_client() as client:
        db = client[get_database_name()]
        db["user_setup_progress"].delete_one({"user_id": user_id})
    
    return {"status": "ok", "message": "Progress reset successfully"}

