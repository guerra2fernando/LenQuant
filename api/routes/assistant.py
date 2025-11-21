from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

import db.client as db_client
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
    def _created_at_key(doc: Dict[str, Any]) -> datetime:
        value = doc.get("created_at")
        if isinstance(value, datetime):
            return value
        return datetime.min

    with db_client.mongo_client() as client:
        db = client[db_client.get_database_name()]
        cohorts_cursor = (
            db["sim_runs_intraday"].find(
                {},
                {"cohort_id": 1, "created_at": 1, "bankroll": 1, "agent_count": 1},
            )
        )

        cohorts: List[Dict[str, Any]]
        try:
            sorted_cursor = cohorts_cursor.sort("created_at", -1)
        except TypeError:
            cohorts_list = list(cohorts_cursor or [])
            cohorts_list.sort(key=_created_at_key, reverse=True)
            cohorts = cohorts_list[:limit]
        else:
            try:
                sorted_cursor = sorted_cursor.limit(limit)
            except TypeError:
                pass
            cohorts = list(sorted_cursor)

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
    with db_client.mongo_client() as client:
        db = client[db_client.get_database_name()]
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
    cutoff = datetime.utcnow() - timedelta(days=7)
    with db_client.mongo_client() as client:
        db = client[db_client.get_database_name()]
        cohorts_cursor = db["sim_runs_intraday"].find(
            {"created_at": {"$gte": cutoff}},
            {"cohort_id": 1, "bankroll": 1, "created_at": 1, "agent_count": 1},
        )
        cohorts = list(cohorts_cursor or [])
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


def _get_context_aware_recommendation() -> Dict[str, Any]:
    """Generate a context-aware recommendation based on current system state."""
    with db_client.mongo_client() as client:
        db = client[db_client.get_database_name()]
        
        # Check portfolio state
        from api.routes.trade import get_order_manager
        manager = get_order_manager()
        portfolio_summary = manager.get_portfolio_summary()
        
        paper_balance = portfolio_summary.get("modes", {}).get("paper", {}).get("wallet_balance", 0)
        positions_count = len(portfolio_summary.get("modes", {}).get("paper", {}).get("positions", []))
        
        # Check data availability
        ohlcv_count = db["ohlcv"].count_documents({})
        has_data = ohlcv_count > 0
        
        # Check high confidence signals (from reports)
        reports = list(db["daily_reports"].find({}).sort("created_at", -1).limit(1))
        high_confidence_signals = 0
        if reports:
            signals = reports[0].get("top_signals", [])
            high_confidence_signals = sum(1 for s in signals if s.get("confidence", 0) > 0.8)
        
        # Determine recommendation type and content
        if not has_data:
            return {
                "type": "no_data",
                "title": "Get Started: Ingest Data",
                "description": "Your system has no market data yet. Start by ingesting historical data to enable forecasting and trading.",
                "actions": [
                    {"label": "Get Started", "url": "/get-started", "variant": "primary"},
                ],
                "priority": 10,
                "expires_at": None,
            }
        elif paper_balance == 0:
            return {
                "type": "no_funds",
                "title": "Add Paper Money",
                "description": "You have market data but no paper trading balance. Add virtual funds to start testing strategies.",
                "actions": [
                    {"label": "Add Funds", "url": "/portfolio", "variant": "primary"},
                ],
                "priority": 9,
                "expires_at": None,
            }
        elif high_confidence_signals > 0 and positions_count == 0:
            return {
                "type": "high_signal",
                "title": f"High Confidence Signals Detected",
                "description": f"Found {high_confidence_signals} high-confidence trading signals. Consider reviewing and acting on them.",
                "actions": [
                    {"label": "View Signals", "url": "/analytics?tab=forecasts", "variant": "primary"},
                    {"label": "Start Trading", "url": "/terminal", "variant": "outline"},
                ],
                "priority": 8,
                "expires_at": (datetime.utcnow() + timedelta(hours=4)).isoformat(),
            }
        elif positions_count == 0 and paper_balance > 0:
            return {
                "type": "ready_to_trade",
                "title": "Ready to Trade",
                "description": "Your system is set up and ready. Start by placing your first trade on the trading terminal.",
                "actions": [
                    {"label": "Open Terminal", "url": "/terminal", "variant": "primary"},
                    {"label": "View Forecasts", "url": "/analytics?tab=forecasts", "variant": "outline"},
                ],
                "priority": 7,
                "expires_at": None,
            }
        else:
            return {
                "type": "portfolio_good",
                "title": "Portfolio Active",
                "description": "Your portfolio is active with open positions. Monitor performance and adjust as needed.",
                "actions": [
                    {"label": "View Portfolio", "url": "/portfolio", "variant": "primary"},
                    {"label": "Check Insights", "url": "/insights", "variant": "outline"},
                ],
                "priority": 5,
                "expires_at": None,
            }


@router.get("/recommendations/context-aware")
def get_context_aware_recommendation() -> Dict[str, Any]:
    """
    Get a single context-aware recommendation based on current system state.
    
    Analyzes portfolio, data, forecasts, and models to provide the most
    relevant action recommendation.
    """
    recommendation = _get_context_aware_recommendation()
    
    # Get context information
    with db_client.mongo_client() as client:
        db = client[db_client.get_database_name()]
        
        from api.routes.trade import get_order_manager
        manager = get_order_manager()
        portfolio_summary = manager.get_portfolio_summary()
        
        has_data = db["ohlcv"].count_documents({}) > 0
        paper_balance = portfolio_summary.get("modes", {}).get("paper", {}).get("wallet_balance", 0)
        positions = portfolio_summary.get("modes", {}).get("paper", {}).get("positions", [])
        
        # Count high confidence signals
        reports = list(db["daily_reports"].find({}).sort("created_at", -1).limit(1))
        high_confidence_signals = 0
        if reports:
            signals = reports[0].get("top_signals", [])
            high_confidence_signals = sum(1 for s in signals if s.get("confidence", 0) > 0.8)
    
    return {
        "recommendation": recommendation,
        "context": {
            "has_data": has_data,
            "has_funds": paper_balance > 0,
            "positions_count": len(positions),
            "high_confidence_signals": high_confidence_signals,
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/context")
def get_assistant_context() -> Dict[str, Any]:
    """
    Get consolidated context for the AI Assistant.
    
    Aggregates portfolio, market, opportunities, models, and knowledge data
    into a single endpoint to replace multiple separate API calls.
    """
    with db_client.mongo_client() as client:
        db = client[db_client.get_database_name()]
        
        from api.routes.trade import get_order_manager
        manager = get_order_manager()
        portfolio_summary = manager.get_portfolio_summary()
        
        # Portfolio context
        paper_mode = portfolio_summary.get("modes", {}).get("paper", {})
        live_mode = portfolio_summary.get("modes", {}).get("live", {})
        
        total_pnl = paper_mode.get("unrealized_pnl", 0) + live_mode.get("unrealized_pnl", 0)
        pnl_pct = 0
        equity_usd = paper_mode.get("equity_usd", 0) + live_mode.get("equity_usd", 0)
        if equity_usd > 0:
            pnl_pct = (total_pnl / equity_usd) * 100
        
        positions_count = len(paper_mode.get("positions", [])) + len(live_mode.get("positions", []))
        
        portfolio_status = "neutral"
        if pnl_pct > 2:
            portfolio_status = "positive"
        elif pnl_pct < -2:
            portfolio_status = "negative"
        
        # Market context - check data freshness
        has_data = db["ohlcv"].count_documents({}) > 0
        data_status = "inactive"
        regime = "unknown"
        if has_data:
            # Get most recent data point
            recent_data = list(db["ohlcv"].find({}).sort("timestamp", -1).limit(1))
            if recent_data:
                last_timestamp = recent_data[0].get("timestamp")
                if last_timestamp:
                    hours_since = (datetime.utcnow() - last_timestamp).total_seconds() / 3600
                    if hours_since < 2:
                        data_status = "active"
                    else:
                        data_status = "limited_data"
        
        # Get forecasts count
        reports = list(db["daily_reports"].find({}).sort("created_at", -1).limit(1))
        forecasts_count = 0
        high_confidence_count = 0
        if reports:
            forecasts = reports[0].get("forecasts", [])
            forecasts_count = len(forecasts)
            high_confidence_count = sum(1 for f in forecasts if f.get("confidence", 0) > 0.8)
        
        # Opportunities context
        top_signal = None
        if high_confidence_count > 0 and reports:
            signals = reports[0].get("top_signals", [])
            if signals:
                top = signals[0]
                top_signal = {
                    "symbol": top.get("symbol"),
                    "direction": "buy" if top.get("pred_return", 0) > 0 else "sell",
                    "confidence": top.get("confidence", 0),
                    "expected_return": top.get("pred_return", 0),
                }
        
        avg_confidence = 0
        if reports and forecasts_count > 0:
            forecasts = reports[0].get("forecasts", [])
            total_conf = sum(f.get("confidence", 0) for f in forecasts)
            avg_confidence = total_conf / forecasts_count if forecasts_count > 0 else 0
        
        # Models context
        model_count = db["model_registry"].count_documents({})
        models_status = "pending" if model_count == 0 else "healthy"
        
        # Check staleness
        oldest_model_age_hours = 0
        if model_count > 0:
            oldest_model = list(db["model_registry"].find({}).sort("trained_at", 1).limit(1))
            if oldest_model and oldest_model[0].get("trained_at"):
                age_seconds = (datetime.utcnow() - oldest_model[0]["trained_at"]).total_seconds()
                oldest_model_age_hours = age_seconds / 3600
                if oldest_model_age_hours > 168:  # 7 days
                    models_status = "stale"
        
        # Knowledge context
        recent_insights = list(db["knowledge"].find({}).sort("timestamp", -1).limit(10))
        recent_insights_count = len(recent_insights)
        last_insight_date = None
        knowledge_status = "stale"
        
        if recent_insights:
            last_insight_date = recent_insights[0].get("timestamp")
            if last_insight_date:
                hours_since = (datetime.utcnow() - last_insight_date).total_seconds() / 3600
                if hours_since < 48:
                    knowledge_status = "active"
        
    return {
        "portfolio": {
            "equity_usd": equity_usd,
            "total_pnl": total_pnl,
            "pnl_pct": pnl_pct,
            "positions_count": positions_count,
            "status": portfolio_status,
        },
        "market": {
            "status": data_status,
            "regime": regime,
            "volatility": "normal",  # TODO: calculate from data
            "forecasts_count": forecasts_count,
            "high_confidence_count": high_confidence_count,
        },
        "opportunities": {
            "signals_count": high_confidence_count,
            "avg_confidence": avg_confidence,
            "top_signal": top_signal,
        },
        "models": {
            "status": models_status,
            "trained_count": model_count,
            "pending_count": 0,  # TODO: track pending training jobs
            "oldest_model_age_hours": oldest_model_age_hours,
        },
        "knowledge": {
            "recent_insights_count": recent_insights_count,
            "last_insight_date": last_insight_date.isoformat() if last_insight_date else None,
            "status": knowledge_status,
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/suggestions")
def get_proactive_suggestions(
    user_mode: str = Query(default="easy", pattern="^(easy|advanced)$")
) -> Dict[str, Any]:
    """
    Get proactive AI-powered suggestions based on current system state.
    
    Returns prioritized list of actionable suggestions with AI-generated reasoning.
    """
    suggestions = []
    
    with db_client.mongo_client() as client:
        db = client[db_client.get_database_name()]
        
        from api.routes.trade import get_order_manager
        manager = get_order_manager()
        portfolio_summary = manager.get_portfolio_summary()
        
        paper_balance = portfolio_summary.get("modes", {}).get("paper", {}).get("wallet_balance", 0)
        positions = portfolio_summary.get("modes", {}).get("paper", {}).get("positions", [])
        positions_count = len(positions)
        
        # Check model staleness
        model_count = db["model_registry"].count_documents({})
        stale_models = 0
        if model_count > 0:
            week_ago = datetime.utcnow() - timedelta(days=7)
            stale_models = db["model_registry"].count_documents({
                "trained_at": {"$lt": week_ago}
            })
        
        # Check high confidence signals
        reports = list(db["daily_reports"].find({}).sort("created_at", -1).limit(1))
        high_conf_signals = []
        if reports:
            signals = reports[0].get("top_signals", [])
            high_conf_signals = [s for s in signals if s.get("confidence", 0) > 0.85]
        
        # Check positions for profit-taking opportunities
        profitable_positions = []
        for pos in positions:
            pnl_pct = pos.get("pnl_pct", 0)
            if pnl_pct > 5:
                profitable_positions.append(pos)
        
        # Generate suggestions based on state
        
        # 1. Stale models suggestion
        if stale_models > 3:
            suggestions.append({
                "id": f"stale-models-{datetime.utcnow().timestamp()}",
                "type": "model_stale",
                "priority": 8,
                "title": "Models Need Retraining",
                "description": f"{stale_models} models are over 7 days old and may be producing inaccurate forecasts.",
                "reasoning": "Stale models can lead to poor predictions as market conditions change. Regular retraining ensures your strategies adapt to current market dynamics.",
                "actions": [
                    {"label": "Retrain Models", "url": "/models/registry", "type": "navigate"},
                ],
                "context": {"stale_count": stale_models, "total_count": model_count},
                "expires_at": (datetime.utcnow() + timedelta(hours=24)).isoformat(),
            })
        
        # 2. High confidence signal suggestion
        if len(high_conf_signals) > 0 and positions_count < 5:
            top_signal = high_conf_signals[0]
            direction = "buy" if top_signal.get("pred_return", 0) > 0 else "sell"
            suggestions.append({
                "id": f"high-signal-{datetime.utcnow().timestamp()}",
                "type": "high_signal",
                "priority": 9,
                "title": f"High Confidence {direction.upper()} Signal Detected",
                "description": f"{top_signal.get('symbol')} showing {top_signal.get('confidence', 0):.1%} confidence {direction} signal.",
                "reasoning": f"Multiple models agree on this opportunity with high confidence. Expected return: {top_signal.get('pred_return', 0):.2%}.",
                "actions": [
                    {"label": "View Signal", "url": "/analytics?tab=forecasts", "type": "navigate"},
                    {"label": "Trade Now", "url": "/terminal", "type": "navigate"},
                ],
                "context": {
                    "symbol": top_signal.get("symbol"),
                    "confidence": top_signal.get("confidence"),
                    "direction": direction,
                },
                "expires_at": (datetime.utcnow() + timedelta(hours=4)).isoformat(),
            })
        
        # 3. Take profits suggestion
        if len(profitable_positions) > 0:
            total_profit = sum(p.get("unrealized_pnl", 0) for p in profitable_positions)
            suggestions.append({
                "id": f"take-profits-{datetime.utcnow().timestamp()}",
                "type": "take_profits",
                "priority": 7,
                "title": "Consider Taking Profits",
                "description": f"{len(profitable_positions)} positions showing >5% gains (${total_profit:.2f} unrealized).",
                "reasoning": "Locking in profits is a key risk management strategy. Consider setting trailing stops or closing profitable positions.",
                "actions": [
                    {"label": "View Portfolio", "url": "/portfolio", "type": "navigate"},
                    {"label": "Ask Assistant", "url": "/assistant", "type": "navigate"},
                ],
                "context": {
                    "profitable_count": len(profitable_positions),
                    "total_unrealized_pnl": total_profit,
                },
                "expires_at": (datetime.utcnow() + timedelta(hours=12)).isoformat(),
            })
        
        # 4. Ready to trade suggestion (has funds, no positions)
        if paper_balance > 0 and positions_count == 0 and len(high_conf_signals) == 0:
            suggestions.append({
                "id": f"ready-to-trade-{datetime.utcnow().timestamp()}",
                "type": "ready_to_trade",
                "priority": 6,
                "title": "Ready to Start Trading",
                "description": f"You have ${paper_balance:.2f} in paper funds ready to deploy.",
                "reasoning": "Your system is set up with data and models. Start by reviewing forecasts and placing your first trade.",
                "actions": [
                    {"label": "View Forecasts", "url": "/analytics?tab=forecasts", "type": "navigate"},
                    {"label": "Open Terminal", "url": "/terminal", "type": "navigate"},
                ],
                "context": {"balance": paper_balance},
                "expires_at": None,
            })
        
        # 5. Add funds suggestion
        if paper_balance == 0:
            suggestions.append({
                "id": f"add-funds-{datetime.utcnow().timestamp()}",
                "type": "add_funds",
                "priority": 10,
                "title": "Add Paper Trading Funds",
                "description": "You need to add virtual funds to start testing strategies.",
                "reasoning": "Paper trading allows you to test strategies risk-free before deploying real capital.",
                "actions": [
                    {"label": "Add Funds", "url": "/portfolio", "type": "navigate"},
                ],
                "context": {},
                "expires_at": None,
            })
        
        # 6. Explore insights (knowledge base active)
        knowledge_count = db["knowledge"].count_documents({})
        if knowledge_count > 5 and positions_count > 0:
            suggestions.append({
                "id": f"explore-insights-{datetime.utcnow().timestamp()}",
                "type": "explore_insights",
                "priority": 4,
                "title": "New Market Insights Available",
                "description": f"{knowledge_count} insights generated from strategy evolution.",
                "reasoning": "These insights reveal patterns and strategies that worked in similar market conditions.",
                "actions": [
                    {"label": "View Knowledge", "url": "/knowledge", "type": "navigate"},
                ],
                "context": {"insights_count": knowledge_count},
                "expires_at": (datetime.utcnow() + timedelta(days=3)).isoformat(),
            })
    
    # Sort by priority (higher first)
    suggestions.sort(key=lambda x: x["priority"], reverse=True)
    
    # Limit to top 3 for easy mode, top 5 for advanced
    limit = 3 if user_mode == "easy" else 5
    suggestions = suggestions[:limit]
    
    return {
        "suggestions": suggestions,
        "generated_at": datetime.utcnow().isoformat(),
        "user_mode": user_mode,
    }


@router.get("/quick-prompts")
def get_quick_prompts(
    user_mode: str = Query(default="easy", pattern="^(easy|advanced)$")
) -> Dict[str, Any]:
    """
    Get dynamic quick prompts based on user mode and context.
    
    Returns personalized prompt suggestions for the AI Assistant.
    """
    with db_client.mongo_client() as client:
        db = client[db_client.get_database_name()]
        
        from api.routes.trade import get_order_manager
        manager = get_order_manager()
        portfolio_summary = manager.get_portfolio_summary()
        
        positions_count = len(portfolio_summary.get("modes", {}).get("paper", {}).get("positions", []))
        has_data = db["ohlcv"].count_documents({}) > 0
        has_models = db["model_registry"].count_documents({}) > 0
        has_forecasts = db["daily_reports"].count_documents({}) > 0
        
        # Base prompts for all users
        prompts = [
            {
                "id": "explain-portfolio",
                "label": "Explain my portfolio performance",
                "prompt": "Analyze my current portfolio performance and explain what's driving the PnL.",
                "category": "trading",
                "mode": "both",
                "context_relevant": positions_count > 0,
                "icon": "TrendingUp",
            },
            {
                "id": "market-overview",
                "label": "What's happening in the market?",
                "prompt": "Give me an overview of current market conditions and any notable patterns.",
                "category": "analysis",
                "mode": "both",
                "context_relevant": has_data,
                "icon": "Activity",
            },
            {
                "id": "best-opportunities",
                "label": "Show me the best opportunities",
                "prompt": "What are the highest confidence trading opportunities right now?",
                "category": "trading",
                "mode": "both",
                "context_relevant": has_forecasts,
                "icon": "Target",
            },
        ]
        
        # Easy mode specific prompts
        if user_mode == "easy":
            prompts.extend([
                {
                    "id": "should-i-trade",
                    "label": "Should I make a trade right now?",
                    "prompt": "Based on current signals and my portfolio, should I make a trade? If so, what should I trade?",
                    "category": "trading",
                    "mode": "easy",
                    "context_relevant": has_forecasts and positions_count < 5,
                    "icon": "HelpCircle",
                },
                {
                    "id": "explain-system",
                    "label": "How does the system work?",
                    "prompt": "Explain how LenQuant's forecasting and trading system works in simple terms.",
                    "category": "learning",
                    "mode": "easy",
                    "context_relevant": True,
                    "icon": "BookOpen",
                },
            ])
        
        # Advanced mode specific prompts
        else:
            prompts.extend([
                {
                    "id": "model-performance",
                    "label": "How are my models performing?",
                    "prompt": "Analyze the performance of my prediction models and identify which ones are working best.",
                    "category": "analysis",
                    "mode": "advanced",
                    "context_relevant": has_models,
                    "icon": "Brain",
                },
                {
                    "id": "strategy-evolution",
                    "label": "Strategy evolution insights",
                    "prompt": "What patterns has the evolution engine discovered? Show me the most promising strategies.",
                    "category": "analysis",
                    "mode": "advanced",
                    "context_relevant": True,
                    "icon": "Zap",
                },
                {
                    "id": "risk-assessment",
                    "label": "Assess my risk exposure",
                    "prompt": "Analyze my current risk exposure and suggest adjustments to my position sizing or stop losses.",
                    "category": "trading",
                    "mode": "advanced",
                    "context_relevant": positions_count > 0,
                    "icon": "Shield",
                },
            ])
        
        # Common learning prompts
        prompts.extend([
            {
                "id": "explain-knowledge",
                "label": "What have we learned recently?",
                "prompt": "Summarize the most important insights from recent strategy evaluations.",
                "category": "learning",
                "mode": "both",
                "context_relevant": db["knowledge"].count_documents({}) > 0,
                "icon": "Lightbulb",
            },
        ])
        
        # Sort: context-relevant first, then by category
        prompts.sort(key=lambda x: (not x["context_relevant"], x["category"]))
        
    return {
        "prompts": prompts,
        "user_mode": user_mode,
    }