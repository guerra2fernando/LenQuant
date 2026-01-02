"""
Event journal repository for Chrome extension.

Provides append-only event storage for complete trading session history.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

from bson import ObjectId

from db.client import get_database_name, mongo_client

logger = logging.getLogger(__name__)


# Collection names
EVENTS_COLLECTION = "extension_events"
ANALYSES_COLLECTION = "extension_analyses"
TRADES_COLLECTION = "extension_trade_journal"
REPORTS_COLLECTION = "extension_daily_reports"


class JournalRepository:
    """
    Repository for extension event journaling.
    
    Implements an append-only event log for complete trading session history.
    Events are immutable once written.
    """
    
    # Valid event types
    EVENT_TYPES = {
        "context_changed",
        "analysis_generated",
        "explain_requested",
        "order_intent_detected",
        "position_opened",
        "position_closed",
        "stop_changed",
        "tp_changed",
        "bookmark_added",
        "warning_shown",
        "warning_dismissed",
        "session_started",
        "session_ended",
    }
    
    def __init__(self, session_id: Optional[str] = None, user_id: Optional[str] = None):
        """
        Initialize journal repository.
        
        Args:
            session_id: Browser session identifier
            user_id: Optional user ID for cross-session queries
        """
        self.session_id = session_id or str(uuid4())
        self.user_id = user_id
    
    def log_event(
        self,
        event_type: str,
        symbol: str,
        timeframe: str,
        timestamp_ms: int,
        payload: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Log a single event.
        
        Args:
            event_type: Type of event
            symbol: Trading pair
            timeframe: Chart timeframe
            timestamp_ms: Unix timestamp in milliseconds
            payload: Event-specific data
        
        Returns:
            Event ID
        """
        event_id = str(ObjectId())
        
        event = {
            "_id": ObjectId(event_id),
            "event_id": event_id,
            "session_id": self.session_id,
            "user_id": self.user_id,
            "type": event_type,
            "symbol": symbol,
            "timeframe": timeframe,
            "timestamp": datetime.utcfromtimestamp(timestamp_ms / 1000),
            "payload": payload or {},
            "created_at": datetime.utcnow(),
        }
        
        with mongo_client() as client:
            db = client[get_database_name()]
            db[EVENTS_COLLECTION].insert_one(event)
        
        logger.debug("Logged event %s: %s %s", event_type, symbol, timeframe)
        return event_id
    
    def log_events_batch(self, events: List[Dict[str, Any]]) -> int:
        """
        Log multiple events in a batch.
        
        Args:
            events: List of event dictionaries with keys:
                - type: Event type
                - symbol: Trading pair
                - timeframe: Chart timeframe
                - timestamp: Unix timestamp in ms
                - payload: Optional event data
        
        Returns:
            Number of events stored
        """
        if not events:
            return 0
        
        docs = []
        for event in events:
            event_id = str(ObjectId())
            timestamp_ms = event.get("timestamp", 0)
            
            docs.append({
                "_id": ObjectId(event_id),
                "event_id": event_id,
                "session_id": self.session_id,
                "user_id": self.user_id,
                "type": event.get("type", "unknown"),
                "symbol": event.get("symbol", ""),
                "timeframe": event.get("timeframe", ""),
                "timestamp": datetime.utcfromtimestamp(timestamp_ms / 1000) if timestamp_ms else datetime.utcnow(),
                "payload": event.get("payload", {}),
                "created_at": datetime.utcnow(),
            })
        
        with mongo_client() as client:
            db = client[get_database_name()]
            result = db[EVENTS_COLLECTION].insert_many(docs)
        
        count = len(result.inserted_ids)
        logger.info("Logged %d events for session %s", count, self.session_id)
        return count
    
    def store_analysis(
        self,
        analysis_id: str,
        symbol: str,
        timeframe: str,
        fast_path: Dict[str, Any],
        slow_path: Optional[Dict[str, Any]] = None,
        regime_features: Optional[Dict[str, Any]] = None,
        latency_ms: int = 0,
    ) -> str:
        """
        Store analysis result.
        
        Args:
            analysis_id: Unique analysis identifier
            symbol: Trading pair
            timeframe: Chart timeframe
            fast_path: Fast path analysis results
            slow_path: Optional slow path (AI) results
            regime_features: Regime technical features
            latency_ms: Analysis latency
        
        Returns:
            Analysis ID
        """
        doc = {
            "_id": ObjectId(),
            "analysis_id": analysis_id,
            "session_id": self.session_id,
            "user_id": self.user_id,
            "symbol": symbol,
            "timeframe": timeframe,
            "timestamp": datetime.utcnow(),
            "fast_path": fast_path,
            "slow_path": slow_path,
            "regime_features": regime_features,
            "latency_ms": latency_ms,
            "created_at": datetime.utcnow(),
        }
        
        with mongo_client() as client:
            db = client[get_database_name()]
            db[ANALYSES_COLLECTION].insert_one(doc)
        
        return analysis_id
    
    def store_trade(
        self,
        trade_id: str,
        symbol: str,
        side: str,
        quantity: float,
        entry_price: float,
        opened_at: datetime,
        matched_analysis_id: Optional[str] = None,
    ) -> str:
        """
        Store trade record.
        
        Args:
            trade_id: Exchange trade ID
            symbol: Trading pair
            side: "buy" or "sell"
            quantity: Trade quantity
            entry_price: Entry price
            opened_at: Trade open timestamp
            matched_analysis_id: Linked analysis ID if matched
        
        Returns:
            Trade ID
        """
        doc = {
            "_id": ObjectId(),
            "trade_id": trade_id,
            "session_id": self.session_id,
            "user_id": self.user_id,
            "symbol": symbol,
            "side": side,
            "quantity": quantity,
            "entry_price": entry_price,
            "exit_price": None,
            "pnl": None,
            "fees": 0.0,
            "opened_at": opened_at,
            "closed_at": None,
            "matched_analysis_id": matched_analysis_id,
            "match_window_seconds": None,
            "attribution": {},
            "behavior_flags": [],
            "created_at": datetime.utcnow(),
        }
        
        with mongo_client() as client:
            db = client[get_database_name()]
            db[TRADES_COLLECTION].insert_one(doc)
        
        return trade_id
    
    def update_trade_close(
        self,
        trade_id: str,
        exit_price: float,
        pnl: float,
        fees: float,
        closed_at: datetime,
        attribution: Optional[Dict[str, Any]] = None,
        behavior_flags: Optional[List[str]] = None,
    ) -> bool:
        """
        Update trade with close information.
        
        Args:
            trade_id: Trade ID to update
            exit_price: Exit price
            pnl: Realized PnL
            fees: Trading fees
            closed_at: Close timestamp
            attribution: Performance attribution
            behavior_flags: Detected behavior flags
        
        Returns:
            Whether update succeeded
        """
        update = {
            "$set": {
                "exit_price": exit_price,
                "pnl": pnl,
                "fees": fees,
                "closed_at": closed_at,
            }
        }
        
        if attribution:
            update["$set"]["attribution"] = attribution
        
        if behavior_flags:
            update["$set"]["behavior_flags"] = behavior_flags
        
        with mongo_client() as client:
            db = client[get_database_name()]
            result = db[TRADES_COLLECTION].update_one(
                {"trade_id": trade_id},
                update
            )
        
        return result.modified_count > 0
    
    def get_session_events(
        self,
        limit: int = 100,
        event_types: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get events for current session.
        
        Args:
            limit: Maximum events to return
            event_types: Filter to specific event types
        
        Returns:
            List of events
        """
        query: Dict[str, Any] = {"session_id": self.session_id}
        
        if event_types:
            query["type"] = {"$in": event_types}
        
        with mongo_client() as client:
            db = client[get_database_name()]
            cursor = db[EVENTS_COLLECTION].find(query).sort("timestamp", -1).limit(limit)
            events = list(cursor)
        
        # Serialize
        for event in events:
            event["_id"] = str(event["_id"])
            if isinstance(event.get("timestamp"), datetime):
                event["timestamp"] = event["timestamp"].isoformat()
            if isinstance(event.get("created_at"), datetime):
                event["created_at"] = event["created_at"].isoformat()
        
        return events
    
    def get_analysis_by_id(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Get analysis by ID."""
        with mongo_client() as client:
            db = client[get_database_name()]
            doc = db[ANALYSES_COLLECTION].find_one({"analysis_id": analysis_id})
        
        if doc:
            doc["_id"] = str(doc["_id"])
            if isinstance(doc.get("timestamp"), datetime):
                doc["timestamp"] = doc["timestamp"].isoformat()
        
        return doc
    
    def get_session_trades(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get trades for current session."""
        with mongo_client() as client:
            db = client[get_database_name()]
            cursor = db[TRADES_COLLECTION].find(
                {"session_id": self.session_id}
            ).sort("opened_at", -1).limit(limit)
            trades = list(cursor)
        
        # Serialize
        for trade in trades:
            trade["_id"] = str(trade["_id"])
            for key in ["opened_at", "closed_at", "created_at"]:
                if isinstance(trade.get(key), datetime):
                    trade[key] = trade[key].isoformat()
        
        return trades
    
    def match_trade_to_analysis(
        self,
        trade_id: str,
        trade_opened_at: datetime,
        symbol: str,
        window_seconds: int = 180,
    ) -> Optional[str]:
        """
        Find and link the most relevant analysis for a trade.
        
        Args:
            trade_id: Trade ID to match
            trade_opened_at: When trade was opened
            symbol: Trading pair
            window_seconds: Maximum time window for match (default 3 min)
        
        Returns:
            Matched analysis ID or None
        """
        window_start = trade_opened_at - timedelta(seconds=window_seconds)
        
        with mongo_client() as client:
            db = client[get_database_name()]
            
            # Find closest analysis before trade
            analysis = db[ANALYSES_COLLECTION].find_one(
                {
                    "symbol": symbol,
                    "timestamp": {
                        "$gte": window_start,
                        "$lte": trade_opened_at
                    }
                },
                sort=[("timestamp", -1)]
            )
            
            if not analysis:
                return None
            
            analysis_id = analysis["analysis_id"]
            match_window = (trade_opened_at - analysis["timestamp"]).total_seconds()
            
            # Update trade with match
            db[TRADES_COLLECTION].update_one(
                {"trade_id": trade_id},
                {
                    "$set": {
                        "matched_analysis_id": analysis_id,
                        "match_window_seconds": match_window
                    }
                }
            )
        
        logger.info(
            "Matched trade %s to analysis %s (window: %.1fs)",
            trade_id, analysis_id, match_window
        )
        return analysis_id
    
    def generate_daily_summary(self, date: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Generate daily trading summary.
        
        Args:
            date: Date to summarize (default today)
        
        Returns:
            Daily summary dictionary
        """
        if date is None:
            date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        day_start = date.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        with mongo_client() as client:
            db = client[get_database_name()]
            
            # Get trades for the day
            query: Dict[str, Any] = {
                "opened_at": {"$gte": day_start, "$lt": day_end}
            }
            if self.user_id:
                query["user_id"] = self.user_id
            
            trades = list(db[TRADES_COLLECTION].find(query))
        
        # Calculate summary
        total_trades = len(trades)
        closed_trades = [t for t in trades if t.get("closed_at")]
        winners = [t for t in closed_trades if (t.get("pnl") or 0) > 0]
        losers = [t for t in closed_trades if (t.get("pnl") or 0) < 0]
        
        total_pnl = sum(t.get("pnl", 0) or 0 for t in closed_trades)
        total_fees = sum(t.get("fees", 0) or 0 for t in trades)
        
        # By setup
        by_setup: Dict[str, Dict[str, Any]] = {}
        for trade in closed_trades:
            analysis_id = trade.get("matched_analysis_id")
            if analysis_id:
                analysis = self.get_analysis_by_id(analysis_id)
                if analysis:
                    setups = analysis.get("fast_path", {}).get("setup_candidates", [])
                    setup_name = setups[0] if setups else "unknown"
                    
                    if setup_name not in by_setup:
                        by_setup[setup_name] = {"trades": 0, "wins": 0, "pnl": 0.0}
                    
                    by_setup[setup_name]["trades"] += 1
                    by_setup[setup_name]["pnl"] += trade.get("pnl", 0) or 0
                    if trade in winners:
                        by_setup[setup_name]["wins"] += 1
        
        # Calculate win rates for setups
        for setup_name, stats in by_setup.items():
            stats["win_rate"] = stats["wins"] / stats["trades"] if stats["trades"] > 0 else 0
        
        # Behavior flags
        behavior_flags = []
        for trade in trades:
            flags = trade.get("behavior_flags", [])
            behavior_flags.extend(flags)
        
        revenge_count = behavior_flags.count("revenge_trading")
        overtrade_count = behavior_flags.count("overtrading")
        chop_count = behavior_flags.count("chop_entries")
        
        # Find best and worst trades
        best_trade = max(closed_trades, key=lambda t: t.get("pnl", 0) or 0) if closed_trades else None
        worst_trade = min(closed_trades, key=lambda t: t.get("pnl", 0) or 0) if closed_trades else None
        
        summary = {
            "date": day_start.date().isoformat(),
            "user_id": self.user_id,
            "summary": {
                "total_trades": total_trades,
                "winners": len(winners),
                "losers": len(losers),
                "total_pnl": total_pnl,
                "fees_paid": total_fees,
                "funding_paid": 0.0,  # TODO: sync from exchange
            },
            "by_setup": {
                name: {
                    "trades": stats["trades"],
                    "win_rate": round(stats["win_rate"], 2),
                    "total_pnl": stats["pnl"],
                }
                for name, stats in by_setup.items()
            },
            "by_timeframe": {},  # TODO: implement
            "behavior": {
                "revenge_trades": revenge_count,
                "overtrading_count": overtrade_count,
                "chop_entries": chop_count,
                "overtrading_score": min(1.0, total_trades / 20),  # Simple score
            },
            "biggest_mistake": None,
            "best_trade": None,
        }
        
        if worst_trade and (worst_trade.get("pnl") or 0) < 0:
            summary["biggest_mistake"] = {
                "trade_id": worst_trade.get("trade_id"),
                "type": "loss",
                "loss": abs(worst_trade.get("pnl", 0)),
            }
        
        if best_trade and (best_trade.get("pnl") or 0) > 0:
            summary["best_trade"] = {
                "trade_id": best_trade.get("trade_id"),
                "profit": best_trade.get("pnl", 0),
            }
        
        return summary



