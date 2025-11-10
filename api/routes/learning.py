from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from learning.allocator import AllocationError, rebalance_allocations, latest_allocation
from learning.loop import LearningCycleSummary, run_learning_cycle
from learning.meta_model import (
    MetaModelNotFoundError,
    MetaModelTrainingError,
    train_meta_model,
)
from learning.repository import (
    acknowledge_overfit_alert,
    get_learning_settings,
    latest_meta_model,
    list_meta_models,
    list_overfit_alerts,
    update_learning_settings,
)

router = APIRouter()


class MetaModelTrainRequest(BaseModel):
    train: bool = Field(default=True, description="Whether to trigger a fresh training run.")


class LearningCycleRequest(BaseModel):
    train_meta: bool = True
    generate_candidates: bool = True
    rebalance: bool = True
    evaluate_overfit: bool = True
    settings_override: Optional[Dict[str, Any]] = None


class OverfitAckPayload(BaseModel):
    alert_id: str


class LearningSettingsPayload(BaseModel):
    meta_model: Optional[Dict[str, Any]] = None
    optimizer: Optional[Dict[str, Any]] = None
    allocator: Optional[Dict[str, Any]] = None
    overfit: Optional[Dict[str, Any]] = None
    knowledge: Optional[Dict[str, Any]] = None


def _cycle_summary_to_dict(summary: LearningCycleSummary) -> Dict[str, Any]:
    payload = {
        "meta_model": summary.meta_model,
        "optimizer": summary.optimizer,
        "allocator": summary.allocator,
        "overfit_alerts": summary.overfit_alerts,
        "knowledge_entry": summary.knowledge_entry,
        "created_at": summary.created_at.isoformat(),
    }
    return payload


@router.get("/meta-model")
def get_meta_model() -> Dict[str, Any]:
    latest = latest_meta_model()
    history = list_meta_models(limit=10)
    return {"latest": latest, "history": history}


@router.post("/meta-model/train")
def post_meta_model_train(payload: MetaModelTrainRequest) -> Dict[str, Any]:
    if not payload.train:
        raise HTTPException(status_code=400, detail="Set 'train' to true to trigger training.")
    try:
        result = train_meta_model()
    except MetaModelTrainingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "status": "ok",
        "result": {
            "metadata": result.metadata,
            "metrics": result.metrics,
            "feature_importances": result.feature_importances,
            "sample_count": result.sample_count,
        },
    }


@router.get("/feature-importance")
def get_feature_importance() -> Dict[str, Any]:
    metadata = latest_meta_model()
    if not metadata:
        raise HTTPException(status_code=404, detail="No meta-model available.")
    return {
        "feature_importances": metadata.get("feature_importances", []),
        "trained_at": metadata.get("trained_at"),
        "sample_count": metadata.get("sample_count"),
    }


@router.get("/allocator")
def get_allocator(refresh: bool = Query(default=False, description="Run a fresh optimisation pass before returning results.")) -> Dict[str, Any]:
    if refresh:
        try:
            result = rebalance_allocations()
        except (AllocationError, MetaModelNotFoundError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {"snapshot": {
            "weights": result.weights,
            "expected_portfolio_return": result.expected_portfolio_return,
            "expected_portfolio_risk": result.expected_portfolio_risk,
            "settings": result.settings,
        }}
    snapshot = latest_allocation()
    if not snapshot:
        raise HTTPException(status_code=404, detail="No allocation snapshot recorded yet.")
    return {"snapshot": snapshot}


@router.post("/allocator/rebalance")
def post_allocator_rebalance() -> Dict[str, Any]:
    try:
        result = rebalance_allocations()
    except (AllocationError, MetaModelNotFoundError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "status": "ok",
        "snapshot": {
            "weights": result.weights,
            "expected_portfolio_return": result.expected_portfolio_return,
            "expected_portfolio_risk": result.expected_portfolio_risk,
            "settings": result.settings,
        },
    }


@router.get("/overfit")
def get_overfit(status: Optional[str] = Query(default=None, description="Filter alerts by status, e.g. 'open'.")) -> Dict[str, Any]:
    alerts = list_overfit_alerts(status=status)
    return {"alerts": alerts}


@router.post("/overfit/ack")
def post_overfit_ack(payload: OverfitAckPayload) -> Dict[str, Any]:
    updated = acknowledge_overfit_alert(payload.alert_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Alert not found.")
    return {"status": "ok", "alert": updated}


@router.post("/cycle/run")
def post_learning_cycle(payload: LearningCycleRequest) -> Dict[str, Any]:
    summary = run_learning_cycle(
        train_meta=payload.train_meta,
        generate_candidates=payload.generate_candidates,
        rebalance=payload.rebalance,
        evaluate_overfit=payload.evaluate_overfit,
        settings_override=payload.settings_override,
    )
    return {"status": "ok", "summary": _cycle_summary_to_dict(summary)}


@router.get("/settings")
def get_learning_settings_route() -> Dict[str, Any]:
    return get_learning_settings()


@router.put("/settings")
def put_learning_settings(payload: LearningSettingsPayload) -> Dict[str, Any]:
    current = get_learning_settings()
    merged = {**current}
    for section in ("meta_model", "optimizer", "allocator", "overfit", "knowledge"):
        value = getattr(payload, section)
        if value is not None:
            merged[section] = {**current.get(section, {}), **value}
    return update_learning_settings(merged)

