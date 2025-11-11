from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from assistant import (
    ActionManager,
    AssistantConversationTurn,
    AssistantExplainer,
    AssistantQueryContext,
    AssistantRetriever,
    AssistantSettings,
    LLMWorker,
    RecommendationDecision,
    fetch_evidence_by_reference,
    get_settings,
    list_conversation_history,
    list_recommendations,
    log_conversation,
)

router = APIRouter()


class QueryContextPayload(BaseModel):
    symbol: Optional[str] = None
    date: Optional[date] = None
    strategy_id: Optional[str] = None
    horizon: Optional[str] = None
    run_id: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None


class AssistantQueryPayload(BaseModel):
    query: str = Field(..., min_length=3)
    context: Optional[QueryContextPayload] = None
    include_recommendations: bool = False


class RecommendationDecisionPayload(BaseModel):
    decision: str = Field(..., pattern="^(approve|reject|modify|snooze)$")
    user_id: Optional[str] = None
    user_notes: Optional[str] = None
    modified_params: Optional[Dict[str, Any]] = None


class GenerateRecommendationPayload(BaseModel):
    limit: int = Field(default=3, ge=1, le=10)
    symbol: Optional[str] = None


def _build_context(payload: Optional[QueryContextPayload]) -> AssistantQueryContext:
    if not payload:
        return AssistantQueryContext()
    base = payload.dict()
    extra = base.pop("extra", None) or {}
    context = AssistantQueryContext(**base, extra=extra)
    return context


@router.post("/query")
def post_query(payload: AssistantQueryPayload) -> Dict[str, Any]:
    settings_data = get_settings()
    settings = AssistantSettings(**settings_data)
    context = _build_context(payload.context)

    retriever = AssistantRetriever(
        lookback_days=settings.lookback_days,
        max_evidence=settings.max_evidence,
    )
    worker = LLMWorker(provider=settings.provider, model=settings.model)
    explainer = AssistantExplainer(worker=worker)

    evidence_items = retriever.gather(payload.query, context)
    explanation = explainer.synthesise(payload.query, context, evidence_items)

    answer_id = f"ans-{uuid4().hex[:12]}"
    conversation = AssistantConversationTurn(
        answer_id=answer_id,
        user_text=payload.query,
        assistant_payload=explanation.payload,
        retrieved_evidence=list(evidence_items),
        context=context,
        llm_model_id=explanation.model_id,
        provider=explanation.provider,
        raw_answer=explanation.raw_content,
        grounded=explanation.grounded,
    )
    stored = log_conversation(conversation)

    response: Dict[str, Any] = {
        "answer_id": answer_id,
        "payload": explanation.payload.dict(),
        "evidence": [item.dict() for item in evidence_items],
        "provider": explanation.provider,
        "model_id": explanation.model_id,
        "grounded": explanation.grounded,
        "created_at": stored.get("created_at"),
    }

    if payload.include_recommendations:
        manager = ActionManager(settings=settings)
        recommendations = manager.auto_generate_recommendations(symbol=context.symbol)
        response["recommendations"] = recommendations

    return response


@router.get("/history")
def get_history(limit: int = Query(default=50, ge=1, le=200)) -> Dict[str, Any]:
    history = list_conversation_history(limit=limit)
    return {"history": history}


@router.get("/recommendations")
def get_recommendations(
    limit: int = Query(default=10, ge=1, le=50),
    status: Optional[str] = Query(default=None),
    refresh: bool = Query(default=False),
) -> Dict[str, Any]:
    manager = ActionManager()
    if refresh:
        manager.auto_generate_recommendations(limit=limit)
    recommendations = list_recommendations(status=status, limit=limit, include_closed=bool(status))
    return {"recommendations": recommendations}


@router.post("/recommendations/generate")
def post_generate_recommendations(payload: GenerateRecommendationPayload) -> Dict[str, Any]:
    manager = ActionManager()
    generated = manager.auto_generate_recommendations(symbol=payload.symbol, limit=payload.limit)
    return {"status": "ok", "generated": generated}


@router.post("/recommendations/{rec_id}/decision")
def post_recommendation_decision(rec_id: str, payload: RecommendationDecisionPayload) -> Dict[str, Any]:
    manager = ActionManager()
    try:
        updated = manager.record_decision(
            rec_id,
            decision=payload.decision,
            user_id=payload.user_id,
            user_notes=payload.user_notes,
            modified_params=payload.modified_params,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"status": "ok", "recommendation": updated}


@router.post("/recommendations/{rec_id}/snooze")
def post_recommendation_snooze(rec_id: str) -> Dict[str, Any]:
    manager = ActionManager()
    try:
        updated = manager.record_decision(rec_id, decision="snooze")
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"status": "ok", "recommendation": updated}


@router.get("/evidence/{namespace}/{identifier}")
def get_evidence(namespace: str, identifier: str) -> Dict[str, Any]:
    reference = f"{namespace}/{identifier}"
    doc = fetch_evidence_by_reference(reference)
    if not doc:
        raise HTTPException(status_code=404, detail="Evidence not found.")
    return {"reference": reference, "document": doc}


@router.get("/cohorts/status")
def get_cohorts_status(limit: int = Query(default=3, ge=1, le=10)) -> Dict[str, Any]:
    """Lightweight endpoint for assistant to poll cohort status."""
    from db.client import get_database_name, mongo_client

    with mongo_client() as client:
        db = client[get_database_name()]
        cohorts_cursor = (
            db["sim_runs_intraday"]
            .find({}, {"cohort_id": 1, "created_at": 1, "bankroll": 1, "agent_count": 1})
            .sort("created_at", -1)
            .limit(limit)
        )
        cohorts = list(cohorts_cursor)
        cohort_ids = [doc.get("cohort_id") for doc in cohorts if doc.get("cohort_id")]
        summaries_cursor = db["cohort_summaries"].find(
            {"cohort_id": {"$in": cohort_ids}},
            {"cohort_id": 1, "total_roi": 1, "total_pnl": 1, "confidence_score": 1, "generated_at": 1},
        )
        summaries_map = {doc.get("cohort_id"): doc for doc in summaries_cursor}

    status_list = []
    for cohort in cohorts:
        cohort_id = cohort.get("cohort_id")
        summary = summaries_map.get(cohort_id, {})
        status_list.append(
            {
                "cohort_id": cohort_id,
                "created_at": cohort.get("created_at").isoformat() if cohort.get("created_at") else None,
                "bankroll": cohort.get("bankroll"),
                "agent_count": cohort.get("agent_count"),
                "total_roi": summary.get("total_roi"),
                "total_pnl": summary.get("total_pnl"),
                "confidence_score": summary.get("confidence_score"),
            }
        )

    return {"cohorts": status_list, "count": len(status_list)}


@router.get("/cohorts/{cohort_id}/promotion-readiness")
def get_promotion_readiness(cohort_id: str) -> Dict[str, Any]:
    """Check if a cohort is ready for Day-3 promotion (assistant-friendly endpoint)."""
    from db.client import get_database_name, mongo_client

    with mongo_client() as client:
        db = client[get_database_name()]
        cohort_doc = db["sim_runs_intraday"].find_one({"cohort_id": cohort_id})
        summary_doc = db["cohort_summaries"].find_one({"cohort_id": cohort_id})

    if not cohort_doc or not summary_doc:
        raise HTTPException(status_code=404, detail="Cohort not found.")

    # Reuse promotion preview logic from experiments route
    from api.routes.experiments import (
        _build_promotion_preview,
        _serialise_parent_snapshot,
    )

    parent_snapshot = _serialise_parent_snapshot(cohort_doc.get("parent_wallet") or {})
    promotion_preview = _build_promotion_preview(cohort_doc, summary_doc, parent_snapshot)

    return {
        "cohort_id": cohort_id,
        "ready": promotion_preview.get("ready", False),
        "passed_checks": sum(1 for check in promotion_preview.get("checks", []) if check.get("status")),
        "total_checks": len(promotion_preview.get("checks", [])),
        "recommended_allocation": promotion_preview.get("recommended_allocation"),
        "best_candidate_id": promotion_preview.get("best_candidate", {}).get("strategy_id"),
        "leverage_breaches": len(promotion_preview.get("leverage_breaches", [])),
        "high_severity_alerts": len(promotion_preview.get("high_severity_alerts", [])),
    }


@router.get("/cohorts/bankroll-summary")
def get_bankroll_summary() -> Dict[str, Any]:
    """Summarize bankroll usage across recent cohorts (assistant-friendly)."""
    from datetime import datetime, timedelta
    from db.client import get_database_name, mongo_client

    cutoff = datetime.utcnow() - timedelta(days=7)
    with mongo_client() as client:
        db = client[get_database_name()]
        cohorts_cursor = db["sim_runs_intraday"].find(
            {"created_at": {"$gte": cutoff}},
            {"cohort_id": 1, "bankroll": 1, "created_at": 1, "agent_count": 1},
        )
        cohorts = list(cohorts_cursor)
        cohort_ids = [doc.get("cohort_id") for doc in cohorts if doc.get("cohort_id")]
        summaries_cursor = db["cohort_summaries"].find(
            {"cohort_id": {"$in": cohort_ids}}, {"cohort_id": 1, "total_pnl": 1, "bankroll_utilization_pct": 1}
        )
        summaries_map = {doc.get("cohort_id"): doc for doc in summaries_cursor}

    total_bankroll = 0.0
    total_pnl = 0.0
    utilization_samples = []
    cohort_count = len(cohorts)

    for cohort in cohorts:
        cohort_id = cohort.get("cohort_id")
        bankroll = float(cohort.get("bankroll") or 0.0)
        total_bankroll += bankroll
        summary = summaries_map.get(cohort_id, {})
        pnl = float(summary.get("total_pnl") or 0.0)
        total_pnl += pnl
        utilization = float(summary.get("bankroll_utilization_pct") or 0.0)
        if utilization > 0:
            utilization_samples.append(utilization)

    avg_utilization = sum(utilization_samples) / len(utilization_samples) if utilization_samples else 0.0

    return {
        "cohort_count": cohort_count,
        "total_bankroll_allocated": total_bankroll,
        "total_pnl": total_pnl,
        "avg_utilization_pct": avg_utilization,
        "lookback_days": 7,
    }
