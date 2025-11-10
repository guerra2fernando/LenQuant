"""Order lifecycle management for Phase 5 trading."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from bson import ObjectId
from pydantic import BaseModel, Field, validator

from db.client import get_database_name, mongo_client
from monitor.trade_alerts import TradeAlertClient

from .connector import CCXTConnector, ExchangeConnector, OrderPayload, PaperConnector
from .risk_manager import RiskManager, RiskViolation, TradingSettings, get_trading_settings
from .settlement import FILLS_COLLECTION, LEDGER_COLLECTION, SettlementEngine
from .trade_auditor import TradeAuditor

ORDERS_COLLECTION = "trading_orders"

LOGGER = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.utcnow().replace(tzinfo=timezone.utc)


class OrderStatus(str, Enum):
    NEW = "new"
    SUBMITTED = "submitted"
    PARTIALLY_FILLED = "partially_filled"
    FILLED = "filled"
    CANCELED = "canceled"
    REJECTED = "rejected"
    ERROR = "error"


class OrderRequest(BaseModel):
    mode: str = Field(default="paper", regex="^(paper|testnet|live)$")
    symbol: str = Field(..., min_length=3)
    side: str = Field(..., regex="^(buy|sell)$")
    type: str = Field(default="limit", regex="^(limit|market|stop|stop_limit)$")
    quantity: float = Field(..., gt=0)
    price: Optional[float] = Field(default=None, gt=0)
    time_in_force: Optional[str] = Field(default=None)
    max_slippage_pct: Optional[float] = Field(default=None, ge=0.0)
    allow_partial_fills: bool = Field(default=True)
    client_order_id: Optional[str] = Field(default=None)
    strategy_id: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)
    source: Optional[str] = Field(default=None)
    preview: bool = Field(default=False)
    escalate_seconds: Optional[int] = Field(default=None, ge=0)
    stop_loss: Optional[float] = Field(default=None, ge=0.0)
    take_profit: Optional[float] = Field(default=None, ge=0.0)
    user_id: Optional[str] = Field(default=None)

    @validator("side", "type", pre=True)
    def _lowercase(cls, value: str) -> str:
        return value.lower() if isinstance(value, str) else value

    @validator("mode", pre=True)
    def _mode_lower(cls, value: str) -> str:
        return value.lower() if isinstance(value, str) else value


class OrderResponse(BaseModel):
    order_id: str
    client_order_id: str
    exchange_order_id: Optional[str]
    status: OrderStatus
    mode: str
    symbol: str
    side: str
    type: str
    quantity: float
    filled_quantity: float
    price: Optional[float]
    avg_fill_price: Optional[float]
    cost: Optional[float]
    created_at: str
    updated_at: str
    metadata: Dict[str, Any]
    tags: List[str]


class CancelRequest(BaseModel):
    reason: Optional[str] = Field(default=None)
    actor: Optional[str] = Field(default=None)


class OrderManager:
    """Coordinates order placement, reconciliation, and storage."""

    def __init__(
        self,
        *,
        settings: Optional[TradingSettings] = None,
        risk_manager: Optional[RiskManager] = None,
        settlement: Optional[SettlementEngine] = None,
        auditor: Optional[TradeAuditor] = None,
    ) -> None:
        self.logger = LOGGER
        self.settings = settings or get_trading_settings()
        self.settlement = settlement or SettlementEngine(default_wallets={"paper": self.settings.paper.starting_balance})
        self.risk_manager = risk_manager or RiskManager(settings=self.settings)
        self.auditor = auditor or TradeAuditor()
        self.alerts = TradeAlertClient(self.settings.alerts)
        self._connector_cache: Dict[str, ExchangeConnector] = {}

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #
    def place_order(self, request: OrderRequest) -> OrderResponse:
        if request.preview:
            estimated_price = request.price or self.estimate_price(request.symbol, request.side, request.mode)
            notional = float(request.quantity) * float(estimated_price or 0.0)
            check = self.risk_manager.pre_trade_check(
                request=request, notional_usd=notional, actor=request.user_id, source=request.source
            )
            return self._build_preview_response(request, notional, check)

        connector = self._ensure_connector(request.mode)
        price = request.price
        if price is None:
            price = self.estimate_price(request.symbol, request.side, request.mode)
            if price is None:
                raise ValueError("Price unavailable for order.")

        notional = float(price) * float(request.quantity)
        risk_result = self.risk_manager.pre_trade_check(
            request=request, notional_usd=notional, actor=request.user_id, source=request.source
        )

        client_order_id = request.client_order_id or self._generate_client_order_id()

        payload = OrderPayload(
            symbol=request.symbol,
            side=request.side,
            type=request.type,
            quantity=request.quantity,
            price=price if request.type != "market" else None,
            client_order_id=client_order_id,
            params={
                "timeInForce": request.time_in_force,
                "clientOrderId": client_order_id,
            },
        )

        try:
            raw_order = connector.create_order(payload)
        except Exception as exc:  # pylint: disable=broad-except
            self.logger.exception("Failed to create order: %s", exc)
            self.risk_manager.log_breach(
                code="order_creation_failed",
                message=str(exc),
                context={"mode": request.mode, "symbol": request.symbol, "side": request.side},
                severity="error",
            )
            self.auditor.record_event(
                event_type="order.error",
                mode=request.mode,
                order_id=client_order_id,
                payload={"error": str(exc), "request": request.dict()},
                actor=request.user_id,
                severity="error",
            )
            raise

        order_doc = self._persist_order(request, raw_order, client_order_id, price, risk_result)

        if order_doc.get("filled_quantity"):
            self._process_fill(order_doc, connector, risk_result)

        self.auditor.record_event(
            event_type="order.created",
            mode=request.mode,
            order_id=order_doc["order_id"],
            payload={"order": self._serialise(order_doc)},
            actor=request.user_id or request.metadata.get("actor"),
        )
        self.alerts.send_alert(
            title=f"Order {order_doc['order_id']} submitted",
            message=f"{order_doc['side'].upper()} {order_doc['quantity']} {order_doc['symbol']} via {order_doc['mode']}",
            severity="info",
            extra={"status": order_doc["status"], "price": order_doc.get("price")},
        )

        return self._serialise_response(order_doc)

    def cancel_order(self, order_id: str, payload: CancelRequest) -> OrderResponse:
        order = self._get_order(order_id)
        if not order:
            raise ValueError(f"Order {order_id} not found.")

        connector = self._ensure_connector(order["mode"])
        connector.cancel_order(order["exchange_order_id"] or order["client_order_id"])

        update = {
            "$set": {
                "status": OrderStatus.CANCELED.value,
                "updated_at": _utcnow(),
            },
            "$push": {"history": {"status": OrderStatus.CANCELED.value, "timestamp": _utcnow(), "reason": payload.reason}},
        }
        with mongo_client() as client:
            db = client[get_database_name()]
            db[ORDERS_COLLECTION].update_one({"order_id": order_id}, update)
            doc = db[ORDERS_COLLECTION].find_one({"order_id": order_id})

        self.auditor.record_event(
            event_type="order.canceled",
            mode=order["mode"],
            order_id=order_id,
            payload={"reason": payload.reason},
            actor=payload.actor,
        )
        self.alerts.send_alert(
            title=f"Order {order_id} canceled",
            message=f"{order['symbol']} {order['side']} canceled by {payload.actor or 'system'}",
            severity="warning",
            extra={"reason": payload.reason},
        )
        return self._serialise_response(doc)

    def amend_order(self, order_id: str, updates: Dict[str, Any]) -> OrderResponse:
        order = self._get_order(order_id)
        if not order:
            raise ValueError(f"Order {order_id} not found.")

        connector = self._ensure_connector(order["mode"])
        new_price = updates.get("price")
        if new_price:
            connector.cancel_order(order["exchange_order_id"] or order["client_order_id"])
            payload = OrderRequest(
                mode=order["mode"],
                symbol=order["symbol"],
                side=order["side"],
                type=order["type"],
                quantity=order["quantity"] - order.get("filled_quantity", 0.0),
                price=new_price,
                client_order_id=order["client_order_id"],
            )
            return self.place_order(payload)

        with mongo_client() as client:
            db = client[get_database_name()]
            db[ORDERS_COLLECTION].update_one(
                {"order_id": order_id},
                {"$set": {**updates, "updated_at": _utcnow()}, "$push": {"history": {"updates": updates, "timestamp": _utcnow()}}},
            )
            doc = db[ORDERS_COLLECTION].find_one({"order_id": order_id})
        self.auditor.record_event(
            event_type="order.amended",
            mode=order["mode"],
            order_id=order_id,
            payload={"updates": updates},
        )
        return self._serialise_response(doc)

    def sync_order(self, order_id: str) -> OrderResponse:
        order = self._get_order(order_id)
        if not order:
            raise ValueError(f"Order {order_id} not found.")
        connector = self._ensure_connector(order["mode"])
        exchange_state = connector.fetch_order(order["exchange_order_id"] or order["client_order_id"])
        updates = {
            "status": self._map_status(exchange_state.get("status")),
            "filled_quantity": float(exchange_state.get("filled") or 0.0),
            "avg_fill_price": exchange_state.get("average"),
            "cost": exchange_state.get("cost"),
            "updated_at": _utcnow(),
        }
        with mongo_client() as client:
            db = client[get_database_name()]
            db[ORDERS_COLLECTION].update_one({"order_id": order_id}, {"$set": updates})
            doc = db[ORDERS_COLLECTION].find_one({"order_id": order_id})

        if doc and doc.get("filled_quantity") and doc.get("status") == OrderStatus.FILLED.value:
            self._process_fill(doc, connector, None)

        return self._serialise_response(doc)

    def list_orders(self, *, limit: int = 50, status: Optional[str] = None, mode: Optional[str] = None) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {}
        if status:
            query["status"] = status
        if mode:
            query["mode"] = mode
        with mongo_client() as client:
            db = client[get_database_name()]
            cursor = (
                db[ORDERS_COLLECTION]
                .find(query)
                .sort("created_at", -1)
                .limit(max(1, limit))
            )
            docs = list(cursor)
        return [self._serialise(doc) for doc in docs]

    def get_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        doc = self._get_order(order_id)
        if not doc:
            return None
        return self._serialise(doc)

    def list_positions(self, mode: Optional[str] = None) -> List[Dict[str, Any]]:
        return self.settlement.list_positions(mode)

    def list_fills(self, *, limit: int = 100, mode: Optional[str] = None) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {}
        if mode:
            query["mode"] = mode
        with mongo_client() as client:
            db = client[get_database_name()]
            cursor = (
                db[FILLS_COLLECTION]
                .find(query)
                .sort("executed_at", -1)
                .limit(max(1, limit))
            )
            docs = list(cursor)
        return [self._serialise(doc) for doc in docs]

    def ledger_snapshots(self, *, limit: int = 50, mode: Optional[str] = None) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {}
        if mode:
            query["mode"] = mode
        with mongo_client() as client:
            db = client[get_database_name()]
            cursor = (
                db[LEDGER_COLLECTION]
                .find(query)
                .sort("timestamp", -1)
                .limit(max(1, limit))
            )
            docs = list(cursor)
        return [self._serialise(doc) for doc in docs]

    def cancel_all_orders(self, *, mode: Optional[str] = None, actor: Optional[str] = None) -> int:
        query: Dict[str, Any] = {"status": {"$in": ["new", "submitted", "partially_filled"]}}
        if mode:
            query["mode"] = mode
        with mongo_client() as client:
            db = client[get_database_name()]
            orders = list(db[ORDERS_COLLECTION].find(query))
        cancelled = 0
        for order in orders:
            try:
                self.cancel_order(order["order_id"], CancelRequest(reason="kill_switch", actor=actor))
                cancelled += 1
            except Exception as exc:  # pylint: disable=broad-except
                self.logger.warning("Failed to cancel order %s: %s", order["order_id"], exc)
        return cancelled

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    def _ensure_connector(self, mode: str) -> ExchangeConnector:
        if mode in self._connector_cache:
            return self._connector_cache[mode]

        if mode == "paper":
            connector = PaperConnector(settlement=self.settlement, settings=self.settings)
        else:
            mode_settings = self.settings.modes.get(mode)
            if not mode_settings:
                raise ValueError(f"Mode {mode} configuration missing.")
            connector = CCXTConnector(mode=mode, settings=mode_settings)
        self._connector_cache[mode] = connector
        return connector

    def _persist_order(
        self,
        request: OrderRequest,
        raw_order: Dict[str, Any],
        client_order_id: str,
        price: float,
        risk_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        status = self._map_status(raw_order.get("status"))
        filled_quantity = float(raw_order.get("filled") or 0.0)
        avg_price = raw_order.get("average")
        now = _utcnow()
        order_id = raw_order.get("client_order_id") or raw_order.get("id") or client_order_id or uuid.uuid4().hex
        document = {
            "_id": ObjectId(),
            "order_id": order_id,
            "exchange_order_id": raw_order.get("id"),
            "client_order_id": client_order_id,
            "mode": request.mode,
            "symbol": request.symbol,
            "side": request.side,
            "type": request.type,
            "status": status,
            "quantity": float(request.quantity),
            "price": price,
            "filled_quantity": filled_quantity,
            "avg_fill_price": avg_price,
            "cost": raw_order.get("cost"),
            "time_in_force": request.time_in_force,
            "strategy_id": request.strategy_id,
            "notes": request.notes,
            "metadata": request.metadata,
            "tags": request.tags,
            "source": request.source,
            "allow_partial_fills": request.allow_partial_fills,
            "max_slippage_pct": request.max_slippage_pct,
            "stop_loss": request.stop_loss,
            "take_profit": request.take_profit,
            "risk_check": risk_result,
            "history": [
                {"status": status, "timestamp": now},
            ],
            "created_at": now,
            "updated_at": now,
        }
        with mongo_client() as client:
            db = client[get_database_name()]
            db[ORDERS_COLLECTION].insert_one(document)
        return document

    def _process_fill(
        self,
        order: Dict[str, Any],
        connector: ExchangeConnector,
        risk_result: Optional[Dict[str, Any]],
    ) -> None:
        fill = {
            "fill_id": uuid.uuid4().hex,
            "order_id": order["order_id"],
            "mode": order["mode"],
            "symbol": order["symbol"],
            "side": order["side"],
            "quantity": order["filled_quantity"],
            "price": order.get("avg_fill_price") or order.get("price"),
            "fee": 0.0,
            "executed_at": _utcnow(),
            "raw": order.get("raw"),
        }
        snapshot = self.settlement.record_fill(order=order, fill=fill, connector_balance=connector.get_balance())
        pnl = float(fill.get("pnl", 0.0))
        self.risk_manager.record_fill(
            mode=order["mode"],
            symbol=order["symbol"],
            pnl=pnl,
            executed_at=fill["executed_at"],
        )
        self.auditor.record_event(
            event_type="order.filled",
            mode=order["mode"],
            order_id=order["order_id"],
            payload={
                "fill": fill,
                "ledger_hash": snapshot.hash,
                "risk": risk_result,
            },
        )
        self.alerts.send_alert(
            title=f"Order {order['order_id']} filled",
            message=f"{order['symbol']} {order['side']} filled qty {order['filled_quantity']}",
            severity="success" if pnl >= 0 else "warning",
            extra={"pnl": pnl, "mode": order["mode"]},
        )

    def estimate_price(self, symbol: str, side: str, mode: str) -> Optional[float]:
        connector = self._ensure_connector(mode)
        try:
            book = connector.get_orderbook(symbol, limit=1)
        except Exception:  # pylint: disable=broad-except
            return None
        if not book:
            return None
        if side.lower() == "buy":
            if book.get("asks"):
                return float(book["asks"][0][0])
        else:
            if book.get("bids"):
                return float(book["bids"][0][0])
        return None

    def _generate_client_order_id(self) -> str:
        return f"ord-{uuid.uuid4().hex[:12]}"

    def _map_status(self, status: Optional[str]) -> str:
        mapping = {
            None: OrderStatus.NEW.value,
            "": OrderStatus.NEW.value,
            "open": OrderStatus.SUBMITTED.value,
            "pending": OrderStatus.SUBMITTED.value,
            "closed": OrderStatus.FILLED.value,
            "canceled": OrderStatus.CANCELED.value,
            "cancelled": OrderStatus.CANCELED.value,
            "partial": OrderStatus.PARTIALLY_FILLED.value,
            "rejected": OrderStatus.REJECTED.value,
            "expired": OrderStatus.CANCELED.value,
        }
        return mapping.get((status or "").lower(), status or OrderStatus.NEW.value)

    def _get_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        with mongo_client() as client:
            db = client[get_database_name()]
            doc = db[ORDERS_COLLECTION].find_one({"order_id": order_id})
        return doc

    def _serialise(self, document: Dict[str, Any]) -> Dict[str, Any]:
        payload = {**document}
        if "_id" in payload:
            payload["_id"] = str(payload["_id"])
        for key, value in list(payload.items()):
            if isinstance(value, datetime):
                payload[key] = value.isoformat()
        return payload

    def _serialise_response(self, document: Dict[str, Any]) -> OrderResponse:
        serialised = self._serialise(document)
        return OrderResponse(
            order_id=serialised["order_id"],
            client_order_id=serialised["client_order_id"],
            exchange_order_id=serialised.get("exchange_order_id"),
            status=OrderStatus(serialised["status"]),
            mode=serialised["mode"],
            symbol=serialised["symbol"],
            side=serialised["side"],
            type=serialised["type"],
            quantity=float(serialised["quantity"]),
            filled_quantity=float(serialised.get("filled_quantity", 0.0)),
            price=serialised.get("price"),
            avg_fill_price=serialised.get("avg_fill_price"),
            cost=serialised.get("cost"),
            created_at=serialised["created_at"],
            updated_at=serialised["updated_at"],
            metadata=serialised.get("metadata", {}),
            tags=serialised.get("tags", []),
        )

    def _build_preview_response(
        self,
        request: OrderRequest,
        notional: float,
        risk_result: Dict[str, Any],
    ) -> OrderResponse:
        now = _utcnow().isoformat()
        price = None
        if request.quantity:
            price = notional / request.quantity if request.type != "market" else None
        return OrderResponse(
            order_id="preview",
            client_order_id=request.client_order_id or self._generate_client_order_id(),
            exchange_order_id=None,
            status=OrderStatus.NEW,
            mode=request.mode,
            symbol=request.symbol,
            side=request.side,
            type=request.type,
            quantity=request.quantity,
            filled_quantity=0.0,
            price=price,
            avg_fill_price=None,
            cost=notional,
            created_at=now,
            updated_at=now,
            metadata={"preview": True, "risk": risk_result},
            tags=request.tags,
        )

