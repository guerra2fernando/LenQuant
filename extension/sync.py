"""
Binance trade synchronization service for Chrome extension.

Syncs trades from Binance Futures and matches them to extension analyses.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import ccxt

from db.client import get_database_name, mongo_client

logger = logging.getLogger(__name__)


# Collections
TRADES_COLLECTION = "extension_trade_journal"
ANALYSES_COLLECTION = "extension_analyses"
SYNC_STATE_COLLECTION = "extension_sync_state"


class SyncError(Exception):
    """Raised when sync operation fails."""
    pass


class BinanceSyncService:
    """
    Synchronizes trades from Binance Futures with extension journal.
    
    Features:
    - Fetches closed trades from Binance
    - Matches trades to prior analyses
    - Calculates performance metrics
    - Stores sync state for incremental updates
    """
    
    # Match window: trades opened within this time of analysis are considered matches
    MATCH_WINDOW_SECONDS = 180  # 3 minutes
    
    def __init__(
        self,
        mode: str = "testnet",
        api_key_env: str = "BINANCE_API_KEY",
        secret_env: str = "BINANCE_SECRET",
    ):
        """
        Initialize sync service.
        
        Args:
            mode: "live" or "testnet"
            api_key_env: Environment variable for API key
            secret_env: Environment variable for API secret
        """
        self.mode = mode
        self.api_key_env = api_key_env
        self.secret_env = secret_env
        self._exchange: Optional[ccxt.binance] = None
    
    def _get_exchange(self) -> ccxt.binance:
        """Get or create exchange connection."""
        if self._exchange is not None:
            return self._exchange
        
        api_key = os.getenv(self.api_key_env)
        api_secret = os.getenv(self.secret_env)
        
        if not api_key or not api_secret:
            raise SyncError(
                f"Missing credentials. Set {self.api_key_env} and {self.secret_env} environment variables."
            )
        
        config = {
            "apiKey": api_key,
            "secret": api_secret,
            "enableRateLimit": True,
            "options": {"defaultType": "future"},
        }
        
        self._exchange = ccxt.binance(config)
        
        if self.mode == "testnet":
            self._exchange.set_sandbox_mode(True)
        
        return self._exchange
    
    def sync_trades(
        self,
        since_ms: Optional[int] = None,
        symbol: Optional[str] = None,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Sync trades from Binance.
        
        Args:
            since_ms: Unix timestamp (ms) to sync from
            symbol: Optional symbol filter
            session_id: Session ID for matching
            user_id: User ID for storage
        
        Returns:
            Sync result with metrics
        """
        try:
            exchange = self._get_exchange()
            
            # Get last sync time if not specified
            if since_ms is None:
                since_ms = self._get_last_sync_time(user_id)
            
            # Fetch trades from Binance
            trades = self._fetch_trades(exchange, since_ms, symbol)
            
            if not trades:
                return {
                    "trades_imported": 0,
                    "trades_matched": 0,
                    "trades_unmatched": 0,
                    "last_sync": datetime.utcnow().isoformat(),
                    "performance": self._calculate_performance(user_id),
                }
            
            # Process and store trades
            imported = 0
            matched = 0
            
            for trade in trades:
                trade_id = str(trade.get("id"))
                
                # Check if already imported
                if self._trade_exists(trade_id):
                    continue
                
                # Parse trade data
                parsed = self._parse_trade(trade)
                parsed["session_id"] = session_id
                parsed["user_id"] = user_id
                
                # Try to match to analysis
                match_result = self._match_to_analysis(
                    parsed["symbol"],
                    parsed["opened_at"],
                    session_id,
                    user_id,
                )
                
                if match_result:
                    parsed["matched_analysis_id"] = match_result["analysis_id"]
                    parsed["match_window_seconds"] = match_result["window_seconds"]
                    matched += 1
                
                # Store trade
                self._store_trade(parsed)
                imported += 1
            
            # Update sync state
            self._update_sync_state(user_id)
            
            return {
                "trades_imported": imported,
                "trades_matched": matched,
                "trades_unmatched": imported - matched,
                "last_sync": datetime.utcnow().isoformat(),
                "performance": self._calculate_performance(user_id),
            }
            
        except ccxt.AuthenticationError as exc:
            raise SyncError(f"Authentication failed: {exc}") from exc
        except ccxt.NetworkError as exc:
            raise SyncError(f"Network error: {exc}") from exc
        except Exception as exc:
            logger.error("Sync error: %s", exc, exc_info=True)
            raise SyncError(f"Sync failed: {exc}") from exc
    
    def _fetch_trades(
        self,
        exchange: ccxt.binance,
        since_ms: int,
        symbol: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch trades from Binance."""
        try:
            # For futures, use fetch_my_trades
            if symbol:
                trades = exchange.fetch_my_trades(
                    symbol=symbol,
                    since=since_ms,
                    limit=500,
                )
            else:
                # Fetch for common futures pairs
                all_trades = []
                symbols = ["BTC/USDT:USDT", "ETH/USDT:USDT", "SOL/USDT:USDT"]
                
                for sym in symbols:
                    try:
                        sym_trades = exchange.fetch_my_trades(
                            symbol=sym,
                            since=since_ms,
                            limit=100,
                        )
                        all_trades.extend(sym_trades)
                    except Exception:
                        continue
                
                trades = all_trades
            
            return trades
            
        except Exception as exc:
            logger.warning("Failed to fetch trades: %s", exc)
            return []
    
    def _parse_trade(self, trade: Dict[str, Any]) -> Dict[str, Any]:
        """Parse ccxt trade into storage format."""
        timestamp = trade.get("timestamp", 0)
        
        return {
            "trade_id": str(trade.get("id")),
            "order_id": str(trade.get("order")),
            "symbol": trade.get("symbol", "").replace(":USDT", ""),
            "side": trade.get("side", "").lower(),
            "quantity": float(trade.get("amount", 0)),
            "entry_price": float(trade.get("price", 0)),
            "exit_price": None,
            "pnl": None,
            "fees": float(trade.get("fee", {}).get("cost", 0)),
            "opened_at": datetime.utcfromtimestamp(timestamp / 1000) if timestamp else datetime.utcnow(),
            "closed_at": None,
            "matched_analysis_id": None,
            "match_window_seconds": None,
            "attribution": {},
            "behavior_flags": [],
            "raw_data": trade,
            "created_at": datetime.utcnow(),
        }
    
    def _trade_exists(self, trade_id: str) -> bool:
        """Check if trade already exists."""
        with mongo_client() as client:
            db = client[get_database_name()]
            return db[TRADES_COLLECTION].find_one({"trade_id": trade_id}) is not None
    
    def _store_trade(self, trade: Dict[str, Any]) -> None:
        """Store trade in database."""
        with mongo_client() as client:
            db = client[get_database_name()]
            db[TRADES_COLLECTION].insert_one(trade)
    
    def _match_to_analysis(
        self,
        symbol: str,
        trade_opened_at: datetime,
        session_id: Optional[str],
        user_id: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        """Find matching analysis for trade."""
        window_start = trade_opened_at - timedelta(seconds=self.MATCH_WINDOW_SECONDS)
        
        with mongo_client() as client:
            db = client[get_database_name()]
            
            query: Dict[str, Any] = {
                "symbol": {"$regex": symbol.replace("/", ""), "$options": "i"},
                "timestamp": {"$gte": window_start, "$lte": trade_opened_at},
            }
            
            if session_id:
                query["session_id"] = session_id
            elif user_id:
                query["user_id"] = user_id
            
            analysis = db[ANALYSES_COLLECTION].find_one(
                query,
                sort=[("timestamp", -1)],
            )
            
            if analysis:
                window_seconds = (trade_opened_at - analysis["timestamp"]).total_seconds()
                return {
                    "analysis_id": analysis["analysis_id"],
                    "window_seconds": window_seconds,
                }
        
        return None
    
    def _get_last_sync_time(self, user_id: Optional[str]) -> int:
        """Get last sync timestamp."""
        with mongo_client() as client:
            db = client[get_database_name()]
            
            query: Dict[str, Any] = {"mode": self.mode}
            if user_id:
                query["user_id"] = user_id
            
            state = db[SYNC_STATE_COLLECTION].find_one(query)
            
            if state and state.get("last_sync_ms"):
                return state["last_sync_ms"]
        
        # Default to 24 hours ago
        return int((datetime.utcnow() - timedelta(hours=24)).timestamp() * 1000)
    
    def _update_sync_state(self, user_id: Optional[str]) -> None:
        """Update sync state."""
        with mongo_client() as client:
            db = client[get_database_name()]
            
            query: Dict[str, Any] = {"mode": self.mode}
            if user_id:
                query["user_id"] = user_id
            
            db[SYNC_STATE_COLLECTION].update_one(
                query,
                {
                    "$set": {
                        "last_sync_ms": int(datetime.utcnow().timestamp() * 1000),
                        "last_sync_at": datetime.utcnow(),
                        "mode": self.mode,
                        "user_id": user_id,
                    }
                },
                upsert=True,
            )
    
    def _calculate_performance(self, user_id: Optional[str]) -> Dict[str, Any]:
        """Calculate performance metrics from synced trades."""
        with mongo_client() as client:
            db = client[get_database_name()]
            
            query: Dict[str, Any] = {}
            if user_id:
                query["user_id"] = user_id
            
            trades = list(db[TRADES_COLLECTION].find(query))
        
        if not trades:
            return {
                "total_pnl": 0.0,
                "win_rate": 0.0,
                "plan_adherence": 0.0,
            }
        
        # Calculate metrics
        closed_trades = [t for t in trades if t.get("pnl") is not None]
        winners = [t for t in closed_trades if t.get("pnl", 0) > 0]
        matched_trades = [t for t in trades if t.get("matched_analysis_id")]
        
        total_pnl = sum(t.get("pnl", 0) for t in closed_trades)
        win_rate = len(winners) / len(closed_trades) if closed_trades else 0.0
        plan_adherence = len(matched_trades) / len(trades) if trades else 0.0
        
        return {
            "total_pnl": round(total_pnl, 2),
            "win_rate": round(win_rate, 3),
            "plan_adherence": round(plan_adherence, 3),
        }
    
    def get_open_positions(self) -> List[Dict[str, Any]]:
        """Fetch current open positions from Binance."""
        try:
            exchange = self._get_exchange()
            positions = exchange.fetch_positions()
            
            return [
                {
                    "symbol": p.get("symbol", "").replace(":USDT", ""),
                    "side": "long" if float(p.get("contracts", 0)) > 0 else "short",
                    "size": abs(float(p.get("contracts", 0))),
                    "entry_price": float(p.get("entryPrice", 0)),
                    "mark_price": float(p.get("markPrice", 0)),
                    "unrealized_pnl": float(p.get("unrealizedPnl", 0)),
                    "leverage": int(p.get("leverage", 1)),
                    "liquidation_price": float(p.get("liquidationPrice", 0) or 0),
                }
                for p in positions
                if float(p.get("contracts", 0)) != 0
            ]
            
        except Exception as exc:
            logger.warning("Failed to fetch positions: %s", exc)
            return []
    
    def close_trade(
        self,
        trade_id: str,
        exit_price: float,
        pnl: float,
        fees: float = 0.0,
    ) -> bool:
        """
        Mark a trade as closed with exit information.
        
        Args:
            trade_id: Trade ID to close
            exit_price: Exit price
            pnl: Realized PnL
            fees: Additional fees
        
        Returns:
            Whether update succeeded
        """
        with mongo_client() as client:
            db = client[get_database_name()]
            
            result = db[TRADES_COLLECTION].update_one(
                {"trade_id": trade_id},
                {
                    "$set": {
                        "exit_price": exit_price,
                        "pnl": pnl,
                        "fees": fees,
                        "closed_at": datetime.utcnow(),
                    }
                },
            )
            
            return result.modified_count > 0


def create_sync_service(mode: str = "testnet") -> BinanceSyncService:
    """Factory function to create sync service."""
    if mode == "live":
        return BinanceSyncService(
            mode="live",
            api_key_env="BINANCE_LIVE_API_KEY",
            secret_env="BINANCE_LIVE_SECRET",
        )
    else:
        return BinanceSyncService(
            mode="testnet",
            api_key_env="BINANCE_TESTNET_API_KEY",
            secret_env="BINANCE_TESTNET_SECRET",
        )

