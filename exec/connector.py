"""Exchange connectivity layer for trading execution."""
from __future__ import annotations

import logging
import os
import random
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, Optional

import ccxt  # type: ignore

from db.client import get_database_name, mongo_client

from .risk_manager import ModeSettings, TradingSettings
from .settlement import SettlementEngine

LOGGER = logging.getLogger(__name__)


class ConnectorError(Exception):
    """Raised when an exchange connector fails."""


def _lower(value: Optional[str]) -> Optional[str]:
    return value.lower() if isinstance(value, str) else value


@dataclass
class OrderPayload:
    symbol: str
    side: str
    type: str
    quantity: float
    price: Optional[float] = None
    client_order_id: Optional[str] = None
    params: Optional[Dict[str, Any]] = None


class ExchangeConnector(ABC):
    """Interface for trading connectors."""

    def __init__(self, *, name: str, mode: str) -> None:
        self.name = name
        self.mode = mode
        self.logger = LOGGER

    @abstractmethod
    def get_balance(self) -> Dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def create_order(self, payload: OrderPayload) -> Dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def fetch_order(self, order_id: str) -> Dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def cancel_order(self, order_id: str) -> Dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def get_orderbook(self, symbol: str, limit: int = 5) -> Dict[str, Any]:
        raise NotImplementedError


class CCXTConnector(ExchangeConnector):
    """Connector that uses ccxt under the hood."""

    def __init__(self, *, mode: str, settings: ModeSettings) -> None:
        super().__init__(name=settings.exchange, mode=mode)
        self.settings = settings
        try:
            exchange_cls = getattr(ccxt, settings.exchange)
        except AttributeError as exc:
            raise ConnectorError(f"Unsupported exchange '{settings.exchange}'.") from exc

        credentials = settings.credentials
        exchange_kwargs: Dict[str, Any] = {
            "apiKey": self._resolve_env(credentials.api_key_env),
            "secret": self._resolve_env(credentials.secret_env),
        }
        password = self._resolve_env(credentials.password_env)
        if password:
            exchange_kwargs["password"] = password
        if credentials.subaccount_env:
            exchange_kwargs.setdefault("options", {})["subaccount"] = self._resolve_env(credentials.subaccount_env)

        self.exchange = exchange_cls(exchange_kwargs)
        if settings.testnet and hasattr(self.exchange, "set_sandbox_mode"):
            self.exchange.set_sandbox_mode(True)

        self.logger.info("Initialised CCXT connector for %s (%s)", settings.exchange, mode)

    def _resolve_env(self, key: Optional[str]) -> Optional[str]:
        if not key:
            return None
        return os.getenv(key)

    def get_balance(self) -> Dict[str, Any]:
        try:
            return self.exchange.fetch_balance()
        except Exception as exc:  # pylint: disable=broad-except
            raise ConnectorError(f"Failed to fetch balance: {exc}") from exc

    def create_order(self, payload: OrderPayload) -> Dict[str, Any]:
        params = payload.params or {}
        try:
            order = self.exchange.create_order(
                symbol=payload.symbol,
                type=payload.type,
                side=payload.side,
                amount=payload.quantity,
                price=payload.price,
                params=params,
            )
            return self._normalise_order(order)
        except Exception as exc:  # pylint: disable=broad-except
            raise ConnectorError(f"Failed to create order: {exc}") from exc

    def fetch_order(self, order_id: str) -> Dict[str, Any]:
        try:
            order = self.exchange.fetch_order(order_id)
            return self._normalise_order(order)
        except Exception as exc:  # pylint: disable=broad-except
            raise ConnectorError(f"Failed to fetch order {order_id}: {exc}") from exc

    def cancel_order(self, order_id: str) -> Dict[str, Any]:
        try:
            order = self.exchange.cancel_order(order_id)
            return self._normalise_order(order)
        except Exception as exc:  # pylint: disable=broad-except
            raise ConnectorError(f"Failed to cancel order {order_id}: {exc}") from exc

    def get_orderbook(self, symbol: str, limit: int = 5) -> Dict[str, Any]:
        try:
            return self.exchange.fetch_order_book(symbol, limit=limit)
        except Exception as exc:  # pylint: disable=broad-except
            raise ConnectorError(f"Failed to fetch order book for {symbol}: {exc}") from exc

    @staticmethod
    def _normalise_order(order: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": order.get("id"),
            "client_order_id": order.get("clientOrderId"),
            "status": _lower(order.get("status", "")),
            "symbol": order.get("symbol"),
            "type": _lower(order.get("type")),
            "side": _lower(order.get("side")),
            "price": order.get("price"),
            "quantity": order.get("amount"),
            "filled": order.get("filled") or 0.0,
            "remaining": order.get("remaining"),
            "average": order.get("average"),
            "cost": order.get("cost"),
            "time_in_force": order.get("timeInForce"),
            "timestamp": order.get("timestamp"),
            "datetime": order.get("datetime"),
            "raw": order,
        }


class PaperConnector(ExchangeConnector):
    """In-memory connector for paper trading."""

    def __init__(self, *, settlement: SettlementEngine, settings: TradingSettings) -> None:
        super().__init__(name="paper", mode="paper")
        self.settlement = settlement
        self.settings = settings

    def get_balance(self) -> Dict[str, Any]:
        balance = self.settlement.get_wallet_balance("paper")
        return {
            "mode": "paper",
            "total": balance,
            "free": balance,
            "used": 0.0,
        }

    def create_order(self, payload: OrderPayload) -> Dict[str, Any]:
        price = payload.price
        if price is None:
            reference = self.settlement.get_reference_price(payload.symbol, mode="paper")
            if reference is None:
                raise ConnectorError("Price required for paper order.")
            price = reference

        slippage_pct = self.settings.paper.slippage_bps / 10_000.0
        if payload.type == "market":
            price = self._apply_slippage(price, payload.side, slippage_pct)
        executed = self.settings.paper.fill_on_create
        status = "closed" if executed else "open"
        filled = payload.quantity if executed else 0.0
        average = price if executed else None
        timestamp = int(time.time() * 1000)

        order = {
            "id": payload.client_order_id or f"paper-{timestamp}",
            "client_order_id": payload.client_order_id,
            "status": status,
            "symbol": payload.symbol,
            "type": payload.type,
            "side": payload.side,
            "price": price,
            "quantity": payload.quantity,
            "filled": filled,
            "remaining": payload.quantity - filled,
            "average": average,
            "cost": (average or 0.0) * filled,
            "time_in_force": payload.params.get("timeInForce") if payload.params else None,
            "timestamp": timestamp,
            "datetime": None,
            "raw": {
                "latency_ms": self.settings.paper.latency_ms,
                "slippage_pct": slippage_pct,
            },
        }
        if executed:
            time.sleep(self.settings.paper.latency_ms / 1000.0)
        return order

    def fetch_order(self, order_id: str) -> Dict[str, Any]:
        with mongo_client() as client:
            db = client[get_database_name()]
            doc = db["trading_orders"].find_one({"client_order_id": order_id})
        if not doc:
            raise ConnectorError(f"Paper order {order_id} not found.")
        return {
            "id": doc.get("exchange_order_id") or order_id,
            "client_order_id": order_id,
            "status": doc.get("status"),
            "symbol": doc.get("symbol"),
            "type": doc.get("type"),
            "side": doc.get("side"),
            "price": doc.get("price"),
            "quantity": doc.get("quantity"),
            "filled": doc.get("filled_quantity"),
            "remaining": max(0.0, float(doc.get("quantity", 0.0)) - float(doc.get("filled_quantity", 0.0))),
            "average": doc.get("avg_fill_price"),
            "cost": doc.get("cost"),
            "time_in_force": doc.get("time_in_force"),
            "timestamp": doc.get("created_at"),
            "raw": doc,
        }

    def cancel_order(self, order_id: str) -> Dict[str, Any]:
        with mongo_client() as client:
            db = client[get_database_name()]
            doc = db["trading_orders"].find_one({"client_order_id": order_id})
        if not doc:
            raise ConnectorError(f"Paper order {order_id} not found.")
        doc["status"] = "canceled"
        return {
            "id": doc.get("client_order_id"),
            "status": "canceled",
            "symbol": doc.get("symbol"),
            "type": doc.get("type"),
            "side": doc.get("side"),
            "price": doc.get("price"),
            "quantity": doc.get("quantity"),
            "filled": doc.get("filled_quantity"),
            "remaining": 0.0,
        }

    def get_orderbook(self, symbol: str, limit: int = 5) -> Dict[str, Any]:
        reference = self.settlement.get_reference_price(symbol, mode="paper", default=1.0) or 1.0
        spread = reference * 0.0005
        bids = [[reference - spread, 1.0] for _ in range(limit)]
        asks = [[reference + spread, 1.0] for _ in range(limit)]
        return {
            "symbol": symbol,
            "bids": bids,
            "asks": asks,
            "timestamp": int(time.time() * 1000),
        }

    def _apply_slippage(self, price: float, side: str, slippage_pct: float) -> float:
        direction = 1 if side.lower() == "buy" else -1
        slip = price * slippage_pct * direction
        jitter = price * slippage_pct * (random.random() - 0.5) * 0.1
        return float(price + slip + jitter)

