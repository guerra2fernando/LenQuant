from __future__ import annotations

from contextlib import contextmanager

import mongomock
import pytest

from exec.order_manager import OrderManager, OrderRequest, OrderStatus
from exec.risk_manager import RiskManager, RiskViolation


@pytest.fixture(autouse=True)
def mock_mongo(monkeypatch):
    client = mongomock.MongoClient()

    @contextmanager
    def _mongo_client():
        yield client

    from db import client as db_client  # Local import to avoid circulars

    monkeypatch.setattr(db_client, "mongo_client", _mongo_client)
    monkeypatch.setattr(db_client, "get_database_name", lambda default="lenxys-trader": "lenxys-test")
    yield
    client.close()


def test_risk_manager_blocks_notional_exceeding_limit():
    manager = RiskManager()
    request = OrderRequest(
        mode="paper",
        symbol="BTC/USDT",
        side="buy",
        type="limit",
        quantity=10,
        price=10_000,
    )
    with pytest.raises(RiskViolation) as exc:
        manager.pre_trade_check(request=request, notional_usd=request.quantity * request.price)
    assert exc.value.code in {"max_trade_exceeded", "mode_trade_limit"}


def test_order_manager_places_paper_order_and_records_fill():
    order_manager = OrderManager()
    request = OrderRequest(
        mode="paper",
        symbol="ETH/USDT",
        side="buy",
        type="limit",
        quantity=0.5,
        price=2000,
    )

    response = order_manager.place_order(request)
    assert response.status == OrderStatus.FILLED
    assert response.symbol == "ETH/USDT"
    assert response.mode == "paper"

    # Paper fill should result in a ledger snapshot.
    fills = order_manager.list_fills(limit=5, mode="paper")
    assert any(fill["symbol"] == "ETH/USDT" for fill in fills)


def test_kill_switch_blocks_new_orders():
    order_manager = OrderManager()
    order_manager.risk_manager.trigger_kill_switch(reason="Test", actor="pytest")

    request = OrderRequest(
        mode="paper",
        symbol="BTC/USDT",
        side="buy",
        type="limit",
        quantity=0.1,
        price=100,
    )
    with pytest.raises(RiskViolation):
        order_manager.place_order(request)

