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
    decision: str = Field(..., regex="^(approve|reject|modify|snooze)$")
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

