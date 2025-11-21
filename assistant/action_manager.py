from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence
from uuid import uuid4

from api.routes.trade import get_portfolio_summary
from exec.order_manager import OrderManager, OrderRequest
from exec.risk_manager import RiskViolation
from strategy_genome.repository import list_genomes

from .repository import (
    get_settings as fetch_settings_from_db,
    list_recommendations as list_recommendations_from_db,
    record_recommendation_decision,
    upsert_recommendation,
)
from .schemas import (
    AssistantSettings,
    RecommendationDecision,
    TradeRecommendation,
)


class ActionManager:
    """Builds and manages trade recommendation objects."""

    def __init__(self, settings: Optional[AssistantSettings] = None) -> None:
        self.settings = settings or self._load_settings()
        self.logger = logging.getLogger(__name__)
        self._order_manager: Optional[OrderManager] = None

    def _load_settings(self) -> AssistantSettings:
        data = fetch_settings_from_db()
        return AssistantSettings(**data)

    def _get_order_manager(self) -> OrderManager:
        if self._order_manager is None:
            self._order_manager = OrderManager()
        return self._order_manager

    def refresh_settings(self) -> AssistantSettings:
        self.settings = self._load_settings()
        return self.settings

    def get_portfolio_summary(
        self,
        modes: Optional[List[str]] = None,
        include_hierarchy: bool = False,
    ) -> Dict[str, Any]:
        """Get portfolio summary using the trade API function."""
        return get_portfolio_summary(modes=modes, include_hierarchy=include_hierarchy)

    def auto_generate_recommendations(
        self,
        *,
        symbol: Optional[str] = None,
        limit: int = 3,
        strategies: Optional[Sequence[Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        strategies = strategies or list_genomes(status="champion", limit=limit)
        stored: List[Dict[str, Any]] = []
        for doc in strategies:
            recommendation = self._build_from_strategy(doc, symbol_override=symbol)
            stored.append(upsert_recommendation(recommendation))
        return stored

    def _build_from_strategy(
        self,
        doc: Dict[str, Any],
        *,
        symbol_override: Optional[str] = None,
    ) -> TradeRecommendation:
        strategy_id = doc.get("strategy_id", "")
        symbol = symbol_override or doc.get("symbol") or "BTC/USD"
        horizon = doc.get("interval") or doc.get("horizon") or "1h"
        fitness = doc.get("fitness") or {}
        roi = float(fitness.get("roi", 0.0))
        alignment = float(fitness.get("forecast_alignment", 0.5))
        max_drawdown = abs(float(fitness.get("max_drawdown", 0.02)))

        pred_return = max(0.0, roi)
        confidence = max(0.0, min(alignment, 1.0))

        base_size = min(self.settings.approval_threshold_usd or 1000.0, 1000.0)
        if confidence > 0.75:
            recommended_size = base_size * 1.2
        elif confidence < 0.45:
            recommended_size = base_size * 0.6
        else:
            recommended_size = base_size

        stop_loss_pct = max(0.005, max_drawdown * 0.6)
        take_profit_pct = max(0.01, pred_return * 1.8 or 0.02)

        evidence_refs = [f"strategies/{strategy_id}"]
        last_run_id = doc.get("last_run_id")
        if last_run_id:
            evidence_refs.append(f"sim_runs/{last_run_id}")

        rationale = (
            f"{strategy_id} shows ROI {roi:.2%} with forecast alignment {alignment:.1%}. "
            f"Recommended allocation targets {symbol} on {horizon} horizon."
        )

        rec_id = self._generate_rec_id(strategy_id)
        metadata = {
            "family": doc.get("family"),
            "generation": doc.get("generation"),
            "fitness": fitness,
            "source": "auto-strategy-scan",
        }

        recommendation = TradeRecommendation(
            rec_id=rec_id,
            symbol=symbol,
            horizon=horizon,
            pred_return=pred_return,
            confidence=confidence,
            recommended_size_usd=recommended_size,
            stop_loss_pct=stop_loss_pct,
            take_profit_pct=take_profit_pct,
            rationale_summary=rationale,
            evidence_refs=evidence_refs,
            metadata=metadata,
            status="pending",
        )
        return recommendation

    def list_active(self, *, limit: int = 10) -> List[Dict[str, Any]]:
        return list_recommendations_from_db(limit=limit)

    def record_decision(
        self,
        rec_id: str,
        *,
        decision: str,
        user_id: Optional[str] = None,
        user_notes: Optional[str] = None,
        modified_params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        decision_payload = RecommendationDecision(
            decision=decision, user_id=user_id, user_notes=user_notes, modified_params=modified_params or {}
        )
        status_override = decision
        if decision == "modify":
            status_override = "modified"
        if decision == "approve" and self.settings.auto_execute:
            status_override = "approved"
        updated = record_recommendation_decision(
            rec_id,
            decision_payload,
            status_override=status_override,
        )
        if not updated:
            raise ValueError(f"Recommendation '{rec_id}' not found.")
        if decision == "approve" and self.settings.auto_execute:
            self._maybe_execute_auto(updated, decision_payload)
        return updated

    def _maybe_execute_auto(self, recommendation: Dict[str, Any], decision: RecommendationDecision) -> None:
        manager = self._get_order_manager()
        try:
            order_request = self._build_auto_order_request(recommendation, decision, manager)
        except ValueError as exc:
            self.logger.warning("Auto execution skipped for %s: %s", recommendation.get("rec_id"), exc)
            return
        if not order_request:
            return
        try:
            response = manager.place_order(order_request)
            self.logger.info(
                "Auto executed recommendation %s -> order %s", recommendation.get("rec_id"), response.order_id
            )
        except RiskViolation as exc:
            self.logger.warning("Auto execution blocked by risk manager: %s", exc)
        except Exception as exc:
            self.logger.exception("Failed auto execution for %s: %s", recommendation.get("rec_id"), exc)

    def _build_auto_order_request(
        self,
        recommendation: Dict[str, Any],
        decision: RecommendationDecision,
        manager: OrderManager,
    ) -> Optional[OrderRequest]:
        params = decision.modified_params or {}
        mode = params.get("mode") or manager.settings.auto_mode.default_mode
        side = params.get("side")
        if not side:
            side = "buy" if float(recommendation.get("pred_return", 0.0)) >= 0 else "sell"
        order_type = (params.get("type") or "limit").lower()
        price = params.get("price")
        if order_type != "market" and price is None:
            price = manager.estimate_price(recommendation["symbol"], side, mode)
        if order_type != "market" and (price is None or price <= 0):
            raise ValueError("Price required for auto limit order.")
        quantity = params.get("quantity")
        size_usd = params.get("size_usd") or recommendation.get("recommended_size_usd", 0.0)
        if quantity is None:
            if order_type == "market" and price is None:
                price = manager.estimate_price(recommendation["symbol"], side, mode)
            if price and price > 0:
                quantity = float(size_usd) / float(price) if size_usd else 0.0
        if not quantity or quantity <= 0:
            raise ValueError("Quantity unavailable for auto execution.")
        metadata = {
            "source": "auto",
            "recommendation_id": recommendation.get("rec_id"),
            "confidence": recommendation.get("confidence"),
        }
        metadata.update(params.get("metadata", {}))
        stop_loss = params.get("stop_loss") or recommendation.get("stop_loss_pct")
        take_profit = params.get("take_profit") or recommendation.get("take_profit_pct")
        return OrderRequest(
            mode=mode,
            symbol=recommendation["symbol"],
            side=side,
            type=order_type,
            quantity=float(quantity),
            price=price if order_type != "market" else None,
            metadata=metadata,
            tags=["assistant-auto"],
            notes=decision.user_notes,
            strategy_id=recommendation.get("metadata", {}).get("strategy_id"),
            source="auto",
            stop_loss=stop_loss,
            take_profit=take_profit,
            max_slippage_pct=params.get("max_slippage_pct"),
            allow_partial_fills=params.get("allow_partial_fills", True),
        )

    def _generate_rec_id(self, strategy_id: str) -> str:
        suffix = uuid4().hex[:6]
        ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        if strategy_id:
            return f"rec-{ts}-{strategy_id}-{suffix}"
        return f"rec-{ts}-{suffix}"


