from __future__ import annotations

import asyncio
import hashlib
import json
from datetime import datetime
from functools import lru_cache
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field

from db.client import get_database_name, mongo_client
from exec.order_manager import CancelRequest, OrderManager, OrderRequest, OrderResponse
from exec.risk_manager import RiskManager, RiskViolation
from exec.settlement import LEDGER_COLLECTION, SettlementEngine

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


@router.get("/reconciliation", response_model=Dict[str, Any])
def get_reconciliation_report(modes: Optional[List[str]] = Query(None)) -> Dict[str, Any]:
    """Get reconciliation report for trading settlement."""
    settlement = SettlementEngine()
    report = settlement.reconciliation_report(modes=modes)
    return report


@router.post("/reconciliation/run", response_model=Dict[str, Any])
def run_reconciliation(modes: Optional[List[str]] = None) -> Dict[str, Any]:
    """Trigger reconciliation report (can be called by scheduled jobs)."""
    from manager.tasks import run_daily_reconciliation

    task = run_daily_reconciliation.delay(modes=modes)
    return {"task_id": task.id, "status": "scheduled"}


# ========================================================================
# Portfolio Management Endpoints (Phase 1)
# ========================================================================


def _get_parent_wallet_snapshot(mode: str) -> Optional[Dict[str, Any]]:
    """
    Get parent wallet capital allocation for a mode.
    Queries simulator.account.ParentWallet snapshots from DB.
    """
    with mongo_client() as client:
        db = client[get_database_name()]
        # Look for parent wallet snapshots (stored during cohort runs)
        parent_doc = db["parent_wallet_snapshots"].find_one(
            {"mode": mode},
            sort=[("timestamp", -1)]
        )
        if parent_doc:
            return {
                "name": parent_doc.get("name"),
                "balance": parent_doc.get("balance"),
                "outstanding_capital": parent_doc.get("outstanding_capital"),
                "aggregate_exposure": parent_doc.get("aggregate_exposure"),
                "utilization": parent_doc.get("utilization"),
                "cohort_allocations": parent_doc.get("capital_assigned", {})
            }
    return None


@router.get("/portfolio/summary", response_model=Dict[str, Any])
def get_portfolio_summary(
    modes: Optional[List[str]] = Query(None),
    include_hierarchy: bool = Query(False),
) -> Dict[str, Any]:
    """
    Aggregated portfolio view across modes with real-time valuations.
    Reuses existing settlement engine, risk manager, and regime detector.
    """
    manager = _get_order_manager()
    settlement = manager.settlement
    
    modes_to_check = modes or ["paper", "testnet", "live"]
    portfolio = {
        "timestamp": datetime.utcnow().isoformat(),
        "total_equity_usd": 0.0,
        "total_pnl_usd": 0.0,
        "total_realized_pnl": 0.0,
        "total_unrealized_pnl": 0.0,
        "modes": {},
        "by_symbol": {},
    }
    
    # Get current regime from macro.regime (for BTC as primary indicator)
    try:
        from macro.regime import RegimeDetector
        detector = RegimeDetector()
        btc_regime = detector.get_latest_regime("BTC/USD")
        if btc_regime:
            portfolio["regime"] = {
                "current": btc_regime.trend_regime.value,
                "volatility": btc_regime.volatility_regime.value,
                "multiplier": 1.0,  # Default multiplier
                "description": f"{btc_regime.trend_regime.value} / {btc_regime.volatility_regime.value}",
                "confidence": btc_regime.confidence,
            }
        else:
            portfolio["regime"] = {
                "current": "UNDEFINED",
                "volatility": "UNDEFINED",
                "multiplier": 1.0,
                "description": "Regime data not available",
                "confidence": 0.0,
            }
    except Exception as e:
        portfolio["regime"] = {
            "current": "UNDEFINED",
            "volatility": "UNDEFINED",
            "multiplier": 1.0,
            "description": f"Error fetching regime: {str(e)}",
            "confidence": 0.0,
        }
    
    for mode in modes_to_check:
        # Reuse existing settlement engine methods
        wallet_balance = settlement.get_wallet_balance(mode)
        positions = settlement.list_positions(mode)
        
        positions_value = 0.0
        unrealized_pnl = 0.0
        
        for pos in positions:
            # Reuse existing price fetching
            current_price = settlement.get_reference_price(pos["symbol"], mode=mode)
            if current_price:
                pos_value = pos["quantity"] * current_price
                pos_unrealized = (current_price - pos["avg_entry_price"]) * pos["quantity"]
                positions_value += pos_value
                unrealized_pnl += pos_unrealized
                
                # Aggregate by symbol
                symbol = pos["symbol"]
                if symbol not in portfolio["by_symbol"]:
                    portfolio["by_symbol"][symbol] = {
                        "quantity": 0.0,
                        "value_usd": 0.0,
                        "unrealized_pnl": 0.0,
                        "avg_price": 0.0,
                        "current_price": current_price,
                        "modes": []
                    }
                portfolio["by_symbol"][symbol]["quantity"] += pos["quantity"]
                portfolio["by_symbol"][symbol]["value_usd"] += pos_value
                portfolio["by_symbol"][symbol]["unrealized_pnl"] += pos_unrealized
                if mode not in portfolio["by_symbol"][symbol]["modes"]:
                    portfolio["by_symbol"][symbol]["modes"].append(mode)
        
        equity = wallet_balance + positions_value
        
        # Reuse existing ledger for realized PnL
        ledger_history = manager.ledger_snapshots(limit=1, mode=mode)
        realized_pnl = ledger_history[0].get("realized_pnl", 0.0) if ledger_history else 0.0
        
        mode_data = {
            "wallet_balance": wallet_balance,
            "positions_value": positions_value,
            "equity": equity,
            "realized_pnl": realized_pnl,
            "unrealized_pnl": unrealized_pnl,
            "total_pnl": realized_pnl + unrealized_pnl,
            "positions_count": len(positions),
            "positions": positions
        }
        
        # Add parent wallet hierarchy if requested
        if include_hierarchy:
            mode_data["parent_wallet"] = _get_parent_wallet_snapshot(mode)
        
        portfolio["modes"][mode] = mode_data
        portfolio["total_equity_usd"] += equity
        portfolio["total_realized_pnl"] += realized_pnl
        portfolio["total_unrealized_pnl"] += unrealized_pnl
        portfolio["total_pnl_usd"] += realized_pnl + unrealized_pnl
    
    return portfolio


class WalletAdjustRequest(BaseModel):
    mode: str = Field(..., pattern="^(paper|testnet|live)$")
    operation: str = Field(..., pattern="^(add|remove|reset)$")
    amount: Optional[float] = Field(default=None, gt=0)
    reason: Optional[str] = Field(default="manual adjustment")


@router.post("/wallet/adjust", response_model=Dict[str, Any])
def adjust_wallet_balance(payload: WalletAdjustRequest) -> Dict[str, Any]:
    """
    Adjust wallet balance (primarily for paper trading).
    Logs adjustment in ledger with special event type.
    """
    manager = _get_order_manager()
    settlement = manager.settlement
    
    # Security: Only allow paper and testnet adjustments
    if payload.mode == "live":
        raise HTTPException(
            status_code=403,
            detail="Cannot manually adjust live trading wallet. Use exchange deposits."
        )
    
    current_balance = settlement.get_wallet_balance(payload.mode)
    
    if payload.operation == "add":
        if not payload.amount:
            raise HTTPException(400, "Amount required for add operation")
        new_balance = current_balance + payload.amount
    
    elif payload.operation == "remove":
        if not payload.amount:
            raise HTTPException(400, "Amount required for remove operation")
        if payload.amount > current_balance:
            raise HTTPException(400, "Insufficient balance for withdrawal")
        new_balance = current_balance - payload.amount
    
    elif payload.operation == "reset":
        # Reset to default from settings
        new_balance = settlement.default_wallets.get(payload.mode, 100_000.0)
        payload.amount = new_balance - current_balance
    
    else:
        raise HTTPException(400, "Invalid operation")
    
    # Update balance
    settlement.set_wallet_balance(payload.mode, new_balance)
    
    # Log adjustment in ledger
    with mongo_client() as client:
        db = client[get_database_name()]
        db[LEDGER_COLLECTION].insert_one({
            "_id": ObjectId(),
            "mode": payload.mode,
            "wallet_balance": new_balance,
            "positions_value": 0.0,
            "realized_pnl": 0.0,
            "unrealized_pnl": 0.0,
            "timestamp": datetime.utcnow(),
            "fill_id": None,
            "hash": hashlib.sha256(
                f"{payload.mode}:{new_balance}:{payload.operation}".encode()
            ).hexdigest(),
            "event_type": "wallet_adjustment",
            "adjustment_reason": payload.reason,
            "adjustment_amount": payload.amount,
        })
    
    return {
        "mode": payload.mode,
        "operation": payload.operation,
        "amount": payload.amount,
        "previous_balance": current_balance,
        "new_balance": new_balance,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/portfolio/equity-history", response_model=Dict[str, Any])
def get_equity_history(
    mode: str = Query(..., pattern="^(paper|testnet|live)$"),
    limit: int = Query(100, ge=1, le=1000),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Get historical equity snapshots from ledger.
    Reuses existing trading_ledgers collection.
    """
    query: Dict[str, Any] = {"mode": mode}
    
    if start_date or end_date:
        query["timestamp"] = {}
        if start_date:
            query["timestamp"]["$gte"] = datetime.fromisoformat(start_date)
        if end_date:
            query["timestamp"]["$lte"] = datetime.fromisoformat(end_date)
    
    with mongo_client() as client:
        db = client[get_database_name()]
        cursor = (
            db[LEDGER_COLLECTION]
            .find(query)
            .sort("timestamp", -1)
            .limit(limit)
        )
        ledgers = list(cursor)
    
    snapshots = []
    for ledger in reversed(ledgers):  # Chronological order
        equity = ledger.get("wallet_balance", 0) + ledger.get("positions_value", 0)

        # Handle timestamp - could be datetime object or ISO string
        timestamp = ledger["timestamp"]
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp)

        snapshots.append({
            "timestamp": timestamp.isoformat(),
            "equity": equity,
            "wallet_balance": ledger.get("wallet_balance", 0),
            "positions_value": ledger.get("positions_value", 0),
            "realized_pnl": ledger.get("realized_pnl", 0),
            "unrealized_pnl": ledger.get("unrealized_pnl", 0),
        })
    
    return {
        "mode": mode,
        "snapshots": snapshots,
    }


@router.get("/portfolio/cohort-performance", response_model=Dict[str, Any])
def get_cohort_performance(mode: Optional[str] = None) -> Dict[str, Any]:
    """
    Aggregate P&L and position counts by cohort.
    Useful for understanding which cohorts are profitable.
    Phase 3: Hierarchy & Attribution feature.
    """
    from exec.settlement import POSITIONS_COLLECTION
    
    query: Dict[str, Any] = {}
    if mode:
        query["mode"] = mode
    
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Aggregate positions by cohort
        pipeline = [
            {"$match": query},
            {"$group": {
                "_id": "$cohort_id",
                "position_count": {"$sum": 1},
                "total_realized_pnl": {"$sum": "$realized_pnl"},
                "symbols": {"$addToSet": "$symbol"},
            }},
            {"$sort": {"total_realized_pnl": -1}},
        ]
        
        cohort_stats = list(db[POSITIONS_COLLECTION].aggregate(pipeline))
    
    # Format results
    cohorts = []
    for stat in cohort_stats:
        if stat["_id"]:  # Skip null cohort_id
            cohorts.append({
                "cohort_id": stat["_id"],
                "position_count": stat["position_count"],
                "realized_pnl": stat["total_realized_pnl"],
                "total_pnl": stat["total_realized_pnl"],
                "symbols": stat["symbols"],
            })
    
    return {
        "cohorts": cohorts,
        "total_cohorts": len(cohorts),
        "mode": mode or "all",
    }


# ========================================================================
# Portfolio Caching Endpoints (Phase 4)
# ========================================================================

PORTFOLIO_CACHE_COLLECTION = "portfolio_snapshots"


@router.get("/portfolio/summary/cached", response_model=Dict[str, Any])
def get_cached_portfolio_summary() -> Dict[str, Any]:
    """
    Fetch pre-calculated portfolio from cache.
    Much faster than real-time calculation.
    Falls back to real-time if cache is stale or missing.
    Phase 4: Real-time & Caching feature.
    """
    import logging
    
    logger = logging.getLogger(__name__)
    
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Fetch totals from cache
        totals_doc = db[PORTFOLIO_CACHE_COLLECTION].find_one({"mode": "totals"})
        
        if not totals_doc:
            # Cache miss - fall back to real-time
            logger.warning("Portfolio cache miss - falling back to real-time calculation")
            return get_portfolio_summary(include_hierarchy=True)
        
        # Check freshness (if older than 30 seconds, recalculate)
        cached_at = totals_doc.get("cached_at")
        if cached_at:
            age_seconds = (datetime.utcnow() - cached_at).total_seconds()
            if age_seconds > 30:
                logger.warning(f"Portfolio cache stale ({age_seconds}s) - recalculating")
                return get_portfolio_summary(include_hierarchy=True)
        
        # Build response from cache
        portfolio = {
            "timestamp": totals_doc["cached_at"].isoformat(),
            "cached": True,
            **totals_doc["data"],
            "modes": {},
        }
        
        # Fetch per-mode data from cache
        for mode in ["paper", "testnet", "live"]:
            mode_doc = db[PORTFOLIO_CACHE_COLLECTION].find_one({"mode": mode})
            if mode_doc:
                portfolio["modes"][mode] = mode_doc["data"]
        
        return portfolio


@router.get("/portfolio/performance/{mode}", response_model=Dict[str, Any])
def get_performance_metrics(mode: str) -> Dict[str, Any]:
    """
    Calculate performance metrics from fills history.
    Includes win rate, avg win/loss, profit factor, Sharpe ratio, etc.
    """
    manager = _get_order_manager()
    
    # Get all fills for this mode
    fills = manager.list_fills(limit=1000, mode=mode)
    
    if not fills:
        return {
            "mode": mode,
            "win_rate": None,
            "avg_win": None,
            "avg_loss": None,
            "profit_factor": None,
            "sharpe_ratio": None,
            "total_trades": 0,
            "winning_trades": 0,
            "losing_trades": 0,
        }
    
    # Calculate metrics
    winning_trades = [f for f in fills if f.get("pnl", 0) > 0]
    losing_trades = [f for f in fills if f.get("pnl", 0) < 0]
    
    total_trades = len(fills)
    win_count = len(winning_trades)
    win_rate = win_count / total_trades if total_trades > 0 else 0.0
    
    total_wins = sum(f.get("pnl", 0) for f in winning_trades)
    total_losses = abs(sum(f.get("pnl", 0) for f in losing_trades))
    
    avg_win = total_wins / win_count if win_count > 0 else 0.0
    avg_loss = -total_losses / len(losing_trades) if losing_trades else 0.0
    
    profit_factor = total_wins / total_losses if total_losses > 0 else None
    
    # Calculate Sharpe ratio from equity curve
    sharpe_annualized = 0.0
    ledgers = manager.ledger_snapshots(limit=100, mode=mode)
    if len(ledgers) > 1:
        returns = []
        for i in range(1, len(ledgers)):
            prev_equity = ledgers[i-1].get("wallet_balance", 0) + ledgers[i-1].get("positions_value", 0)
            curr_equity = ledgers[i].get("wallet_balance", 0) + ledgers[i].get("positions_value", 0)
            if prev_equity > 0:
                returns.append((curr_equity - prev_equity) / prev_equity)
        
        if returns and len(returns) > 1:
            try:
                import numpy as np
                returns_arr = np.array(returns)
                mean_return = np.mean(returns_arr)
                std_return = np.std(returns_arr)
                if std_return > 0:
                    sharpe = mean_return / std_return
                    sharpe_annualized = sharpe * np.sqrt(252)  # Assuming daily returns
                else:
                    sharpe_annualized = 0.0
            except ImportError:
                # Fallback if numpy not available
                mean_return = sum(returns) / len(returns)
                variance = sum((r - mean_return) ** 2 for r in returns) / len(returns)
                std_return = variance ** 0.5
                if std_return > 0:
                    sharpe = mean_return / std_return
                    sharpe_annualized = sharpe * (252 ** 0.5)
                else:
                    sharpe_annualized = 0.0
    
    return {
        "mode": mode,
        "win_rate": win_rate,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "profit_factor": profit_factor,
        "sharpe_ratio": sharpe_annualized,
        "total_trades": total_trades,
        "winning_trades": win_count,
        "losing_trades": len(losing_trades),
    }


def get_risk_manager() -> RiskManager:
    return _get_order_manager().risk_manager


def get_order_manager() -> OrderManager:
    return _get_order_manager()


# WebSocket connection manager
class TradingConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, data: Dict[str, Any]):
        """Broadcast data to all connected clients."""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception:
                disconnected.append(connection)
        # Remove disconnected clients
        for connection in disconnected:
            self.disconnect(connection)


trading_manager = TradingConnectionManager()


def _build_quick_portfolio_summary(manager: OrderManager) -> Dict[str, Any]:
    """
    Lightweight portfolio summary for WebSocket.
    Only totals, no full position lists.
    """
    settlement = manager.settlement
    total_equity = 0.0
    total_pnl = 0.0
    
    for mode in ["paper", "testnet", "live"]:
        wallet = settlement.get_wallet_balance(mode)
        positions = settlement.list_positions(mode)
        pos_value = sum(
            p["quantity"] * p.get("avg_entry_price", 0)
            for p in positions
        )
        equity = wallet + pos_value
        total_equity += equity
        
        # Get latest PnL from ledger
        ledgers = manager.ledger_snapshots(limit=1, mode=mode)
        if ledgers:
            total_pnl += ledgers[0].get("realized_pnl", 0) + ledgers[0].get("unrealized_pnl", 0)
    
    return {
        "total_equity": total_equity,
        "total_pnl": total_pnl,
        "timestamp": datetime.utcnow().isoformat(),
    }


async def websocket_trading(websocket: WebSocket):
    """WebSocket endpoint for real-time trading updates (orders, fills, positions)."""
    await trading_manager.connect(websocket)
    try:
        manager = _get_order_manager()
        last_data_hash = None
        limit = 20  # Default limit

        # Send initial data
        orders = manager.list_orders(limit=limit)
        fills = manager.list_fills(limit=limit)
        positions = manager.list_positions()
        initial_data = {
            "type": "trading_update",
            "orders": orders,
            "fills": fills,
            "positions": positions,
            "portfolio_summary": _build_quick_portfolio_summary(manager),
        }
        await websocket.send_json(initial_data)

        while True:
            # Fetch current data
            orders = manager.list_orders(limit=limit)
            fills = manager.list_fills(limit=limit)
            positions = manager.list_positions()

            # Create data payload
            data = {
                "type": "trading_update",
                "orders": orders,
                "fills": fills,
                "positions": positions,
                "portfolio_summary": _build_quick_portfolio_summary(manager),
            }

            # Only send if data changed (simple hash check)
            data_str = json.dumps(data, sort_keys=True, default=str)
            current_hash = hash(data_str)
            if current_hash != last_data_hash:
                await websocket.send_json(data)
                last_data_hash = current_hash

            # Wait before next update (polling interval)
            await asyncio.sleep(2.0)  # Update every 2 seconds

    except WebSocketDisconnect:
        trading_manager.disconnect(websocket)
    except Exception as exc:
        trading_manager.disconnect(websocket)
        # Log error but don't crash
        print(f"WebSocket error: {exc}")


