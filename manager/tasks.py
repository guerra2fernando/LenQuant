from __future__ import annotations

from typing import Any, Dict

from celery_config import celery_app

from evolution.engine import EvolutionEngine
from exec.settlement import SettlementEngine
from knowledge.base import KnowledgeBaseService
from manager.experiment_runner import ExperimentRequest, run_experiment_cycle
from data_ingest.retention import run_data_retention_maintenance

_evolution_engine = EvolutionEngine(knowledge_service=KnowledgeBaseService())


@celery_app.task(name="manager.tasks.run_experiment_cycle_task", bind=True)
def run_experiment_cycle_task(self, request_payload: Dict[str, Any]) -> Dict[str, Any]:
    request = ExperimentRequest.from_dict(request_payload or {})
    summary = run_experiment_cycle(request)
    return summary


@celery_app.task(name="manager.tasks.run_autonomous_evolution", bind=True)
def run_autonomous_evolution(self) -> Dict[str, Any]:
    return _evolution_engine.run_cycle()


@celery_app.task(name="manager.tasks.run_daily_reconciliation", bind=True)
def run_daily_reconciliation(self, modes: Any = None) -> Dict[str, Any]:
    """Run daily reconciliation report for trading settlement."""
    settlement = SettlementEngine()
    report = settlement.reconciliation_report(modes=modes)
    return report


@celery_app.task(name="manager.tasks.run_data_retention_maintenance", bind=True)
def run_data_retention_maintenance_task(self) -> Dict[str, Any]:
    """Run automated data retention maintenance to clean up old data."""
    return run_data_retention_maintenance()


@celery_app.task(name="manager.tasks.run_daily_reconciliation_task", bind=True)
def run_daily_reconciliation_task(self, modes: Any = None) -> Dict[str, Any]:
    """Run daily reconciliation report for trading settlement (beat scheduled)."""
    settlement = SettlementEngine()
    report = settlement.reconciliation_report(modes=modes)
    return report


@celery_app.task(name="manager.tasks.cache_portfolio_snapshot", bind=True)
def cache_portfolio_snapshot(self) -> Dict[str, Any]:
    """
    Pre-calculate and cache portfolio summary for fast retrieval.
    Runs every 10 seconds via Celery Beat.
    """
    from datetime import datetime
    import logging
    
    from db.client import mongo_client, get_database_name
    
    PORTFOLIO_CACHE_COLLECTION = "portfolio_snapshots"
    logger = logging.getLogger(__name__)
    
    try:
        # Import the portfolio summary function from the API routes
        # We'll calculate it directly here to avoid circular imports
        from exec.order_manager import OrderManager
        
        manager = OrderManager()
        settlement = manager.settlement
        
        modes_to_check = ["paper", "testnet", "live"]
        portfolio = {
            "timestamp": datetime.utcnow().isoformat(),
            "total_equity_usd": 0.0,
            "total_pnl_usd": 0.0,
            "total_realized_pnl": 0.0,
            "total_unrealized_pnl": 0.0,
            "modes": {},
            "by_symbol": {},
        }
        
        # Get current regime from macro.regime
        try:
            from macro.regime import RegimeDetector
            detector = RegimeDetector()
            btc_regime = detector.get_latest_regime("BTC/USD")
            if btc_regime:
                portfolio["regime"] = {
                    "current": btc_regime.trend_regime.value,
                    "volatility": btc_regime.volatility_regime.value,
                    "multiplier": 1.0,
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
            
            portfolio["modes"][mode] = mode_data
            portfolio["total_equity_usd"] += equity
            portfolio["total_realized_pnl"] += realized_pnl
            portfolio["total_unrealized_pnl"] += unrealized_pnl
            portfolio["total_pnl_usd"] += realized_pnl + unrealized_pnl
        
        # Cache in MongoDB
        with mongo_client() as client:
            db = client[get_database_name()]
            
            # Upsert per-mode data
            for mode in modes_to_check:
                db[PORTFOLIO_CACHE_COLLECTION].update_one(
                    {"mode": mode},
                    {
                        "$set": {
                            "mode": mode,
                            "data": portfolio["modes"].get(mode, {}),
                            "cached_at": datetime.utcnow(),
                        }
                    },
                    upsert=True
                )
            
            # Also cache totals
            db[PORTFOLIO_CACHE_COLLECTION].update_one(
                {"mode": "totals"},
                {
                    "$set": {
                        "mode": "totals",
                        "data": {
                            "total_equity_usd": portfolio["total_equity_usd"],
                            "total_pnl_usd": portfolio["total_pnl_usd"],
                            "total_realized_pnl": portfolio["total_realized_pnl"],
                            "total_unrealized_pnl": portfolio["total_unrealized_pnl"],
                            "by_symbol": portfolio["by_symbol"],
                            "regime": portfolio.get("regime"),
                        },
                        "cached_at": datetime.utcnow(),
                    }
                },
                upsert=True
            )
        
        logger.info("Portfolio snapshot cached successfully")
        return {"status": "success", "timestamp": datetime.utcnow().isoformat()}
        
    except Exception as exc:
        logger.exception("Failed to cache portfolio snapshot: %s", exc)
        return {"status": "error", "error": str(exc)}
