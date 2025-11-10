from __future__ import annotations

from functools import lru_cache
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from exec.order_manager import CancelRequest, OrderManager, OrderRequest, OrderResponse
from exec.risk_manager import RiskManager, RiskViolation

router = APIRouter()


@lru_cache(maxsize=1)
def _get_order_manager() -> OrderManager:
    return OrderManager()


def _handle_risk_violation(exc: RiskViolation) -> None:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"message": exc.message, "code": exc.code, "details": exc.details},
    ) from exc


@router.get("/orders", response_model=List[Dict[str, Any]])
def list_orders(
    limit: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None, alias="status"),
    mode: Optional[str] = None,
) -> List[Dict[str, Any]]:
    manager = _get_order_manager()
    return manager.list_orders(limit=limit, status=status_filter, mode=mode)


@router.get("/orders/{order_id}", response_model=Dict[str, Any])
def get_order(order_id: str) -> Dict[str, Any]:
    manager = _get_order_manager()
    order = manager.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found.")
    return order


@router.post("/orders", response_model=OrderResponse)
def create_order(payload: OrderRequest) -> OrderResponse:
    manager = _get_order_manager()
    try:
        return manager.place_order(payload)
    except RiskViolation as exc:
        _handle_risk_violation(exc)
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    raise HTTPException(status_code=500, detail="Unknown error")


@router.post("/orders/{order_id}/cancel", response_model=OrderResponse)
def cancel_order(order_id: str, payload: CancelRequest) -> OrderResponse:
    manager = _get_order_manager()
    return manager.cancel_order(order_id, payload)


@router.post("/orders/{order_id}/amend", response_model=OrderResponse)
def amend_order(order_id: str, updates: Dict[str, Any]) -> OrderResponse:
    manager = _get_order_manager()
    return manager.amend_order(order_id, updates)


@router.post("/orders/{order_id}/sync", response_model=OrderResponse)
def sync_order(order_id: str) -> OrderResponse:
    manager = _get_order_manager()
    return manager.sync_order(order_id)


@router.get("/positions", response_model=List[Dict[str, Any]])
def list_positions(mode: Optional[str] = None) -> List[Dict[str, Any]]:
    manager = _get_order_manager()
    return manager.list_positions(mode)


@router.get("/fills", response_model=List[Dict[str, Any]])
def list_fills(limit: int = Query(100, ge=1, le=500), mode: Optional[str] = None) -> List[Dict[str, Any]]:
    manager = _get_order_manager()
    return manager.list_fills(limit=limit, mode=mode)


@router.get("/ledger", response_model=List[Dict[str, Any]])
def ledger_snapshots(limit: int = Query(50, ge=1, le=200), mode: Optional[str] = None) -> List[Dict[str, Any]]:
    manager = _get_order_manager()
    return manager.ledger_snapshots(limit=limit, mode=mode)


@router.get("/summary", response_model=Dict[str, Any])
def trading_summary() -> Dict[str, Any]:
    manager = _get_order_manager()
    risk = manager.risk_manager.get_summary()
    return {
        "orders": manager.list_orders(limit=20),
        "positions": manager.list_positions(),
        "fills": manager.list_fills(limit=50),
        "ledger": manager.ledger_snapshots(limit=10),
        "risk": risk,
    }


@router.get("/stream", response_model=Dict[str, Any])
def trading_stream(limit: int = Query(20, ge=1, le=200)) -> Dict[str, Any]:
    manager = _get_order_manager()
    return {
        "orders": manager.list_orders(limit=limit),
        "fills": manager.list_fills(limit=limit),
        "positions": manager.list_positions(),
    }


def get_risk_manager() -> RiskManager:
    return _get_order_manager().risk_manager


