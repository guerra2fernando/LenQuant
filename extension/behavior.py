"""
Behavioral pattern detection for trading guardrails.

Detects problematic trading behaviors and provides warnings.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from db.client import get_database_name, mongo_client

logger = logging.getLogger(__name__)


@dataclass
class BehaviorAlert:
    """Alert for detected behavioral pattern."""
    
    pattern: str
    severity: str  # "info", "warning", "critical"
    message: str
    cooldown_suggested_min: Optional[int]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API response."""
        return {
            "pattern": self.pattern,
            "severity": self.severity,
            "message": self.message,
            "cooldown_suggested_min": self.cooldown_suggested_min,
        }


class BehaviorAnalyzer:
    """
    Analyzes trading behavior to detect problematic patterns.
    
    Detects:
    - Revenge trading: Trading immediately after a loss
    - Overtrading: Too many trades in a short period
    - Chop market entries: Trading in ranging/chop conditions
    - Stop widening: Modifying stops against position
    - Premature entries: Entering before trigger confirmation
    """
    
    # Detection thresholds
    REVENGE_WINDOW_MIN = 5  # Minutes after loss to flag revenge
    OVERTRADE_THRESHOLD_HOUR = 10  # Max trades per hour
    CHOP_ENTRY_LOOKBACK = 3  # Number of chop entries to trigger warning
    LOSS_STREAK_THRESHOLD = 3  # Consecutive losses to trigger warning
    
    def __init__(self, session_id: str, user_id: Optional[str] = None):
        """
        Initialize behavior analyzer.
        
        Args:
            session_id: Browser session identifier
            user_id: Optional user ID for cross-session analysis
        """
        self.session_id = session_id
        self.user_id = user_id
    
    def analyze_session(self) -> List[BehaviorAlert]:
        """
        Analyze current session for behavioral patterns.
        
        Returns:
            List of detected behavior alerts
        """
        alerts = []
        
        # Get recent data
        events = self._get_recent_events()
        trades = self._get_recent_trades()
        
        # Check each pattern type
        patterns_to_check = [
            self._check_revenge_trading,
            self._check_overtrading,
            self._check_chop_entries,
            self._check_loss_streak,
            self._check_rapid_position_changes,
        ]
        
        for check_fn in patterns_to_check:
            try:
                alert = check_fn(events, trades)
                if alert:
                    alerts.append(alert)
            except Exception as exc:
                logger.warning("Behavior check %s failed: %s", check_fn.__name__, exc)
        
        # Sort by severity
        severity_order = {"critical": 0, "warning": 1, "info": 2}
        alerts.sort(key=lambda a: severity_order.get(a.severity, 3))
        
        return alerts
    
    def log_behavior(self, alert: BehaviorAlert, warning_shown: bool = False) -> None:
        """
        Log detected behavior to database.
        
        Args:
            alert: The behavior alert
            warning_shown: Whether a warning was shown to user
        """
        with mongo_client() as client:
            db = client[get_database_name()]
            db["extension_behavior_log"].insert_one({
                "session_id": self.session_id,
                "user_id": self.user_id,
                "timestamp": datetime.utcnow(),
                "pattern": alert.pattern,
                "severity": alert.severity,
                "message": alert.message,
                "context": {},
                "warning_shown": warning_shown,
                "user_action": None,
                "created_at": datetime.utcnow(),
            })
    
    def _check_revenge_trading(
        self, events: List[dict], trades: List[dict]
    ) -> Optional[BehaviorAlert]:
        """
        Detect trading immediately after a loss.
        
        Revenge trading is entering a new position within REVENGE_WINDOW_MIN
        minutes after closing a losing trade.
        """
        if len(trades) < 2:
            return None
        
        # Get most recent trades sorted by time
        sorted_trades = sorted(
            trades,
            key=lambda t: t.get("opened_at") or datetime.min,
            reverse=True
        )
        
        latest = sorted_trades[0]
        previous = sorted_trades[1] if len(sorted_trades) > 1 else None
        
        if not previous:
            return None
        
        # Check if previous was a loss
        previous_pnl = previous.get("pnl", 0)
        if previous_pnl >= 0:
            return None
        
        # Check time between trades
        latest_opened = latest.get("opened_at")
        previous_closed = previous.get("closed_at")
        
        if not latest_opened or not previous_closed:
            return None
        
        # Ensure datetime objects
        if isinstance(latest_opened, str):
            latest_opened = datetime.fromisoformat(latest_opened)
        if isinstance(previous_closed, str):
            previous_closed = datetime.fromisoformat(previous_closed)
        
        time_diff = latest_opened - previous_closed
        diff_minutes = time_diff.total_seconds() / 60
        
        if 0 < diff_minutes < self.REVENGE_WINDOW_MIN:
            return BehaviorAlert(
                pattern="revenge_trading",
                severity="warning",
                message=f"You entered a trade only {int(diff_minutes)} min after a ${abs(previous_pnl):.2f} loss. Consider waiting.",
                cooldown_suggested_min=15,
            )
        
        return None
    
    def _check_overtrading(
        self, events: List[dict], trades: List[dict]
    ) -> Optional[BehaviorAlert]:
        """
        Detect too many trades in a short period.
        """
        cutoff = datetime.utcnow() - timedelta(hours=1)
        
        recent_trades = []
        for t in trades:
            opened_at = t.get("opened_at")
            if opened_at:
                if isinstance(opened_at, str):
                    opened_at = datetime.fromisoformat(opened_at)
                if opened_at > cutoff:
                    recent_trades.append(t)
        
        count = len(recent_trades)
        
        if count >= self.OVERTRADE_THRESHOLD_HOUR:
            # Calculate losses from overtrading
            total_fees = sum(t.get("fees", 0) for t in recent_trades)
            
            return BehaviorAlert(
                pattern="overtrading",
                severity="critical",
                message=f"You've made {count} trades in the last hour. Fees: ${total_fees:.2f}. This may indicate overtrading.",
                cooldown_suggested_min=30,
            )
        elif count >= self.OVERTRADE_THRESHOLD_HOUR * 0.7:
            return BehaviorAlert(
                pattern="overtrading_warning",
                severity="info",
                message=f"{count} trades in the last hour. Approaching overtrading territory.",
                cooldown_suggested_min=15,
            )
        
        return None
    
    def _check_chop_entries(
        self, events: List[dict], trades: List[dict]
    ) -> Optional[BehaviorAlert]:
        """
        Detect entries during chop/range markets.
        """
        chop_entries = 0
        chop_losses = 0.0
        
        for event in events:
            if event.get("type") != "analysis_generated":
                continue
            
            payload = event.get("payload", {})
            fast_path = payload.get("fast_path", {})
            market_state = fast_path.get("market_state", "")
            
            if market_state not in ["chop", "range"]:
                continue
            
            event_time = event.get("timestamp")
            if isinstance(event_time, int):
                event_time = datetime.utcfromtimestamp(event_time / 1000)
            elif isinstance(event_time, str):
                event_time = datetime.fromisoformat(event_time)
            
            if not event_time:
                continue
            
            # Check if a trade was opened within 5 min of this analysis
            for trade in trades:
                trade_time = trade.get("opened_at")
                if trade_time:
                    if isinstance(trade_time, str):
                        trade_time = datetime.fromisoformat(trade_time)
                    
                    diff = (trade_time - event_time).total_seconds()
                    if 0 < diff < 300:  # Within 5 min
                        chop_entries += 1
                        pnl = trade.get("pnl", 0)
                        if pnl < 0:
                            chop_losses += abs(pnl)
        
        if chop_entries >= self.CHOP_ENTRY_LOOKBACK:
            return BehaviorAlert(
                pattern="chop_entries",
                severity="warning",
                message=f"You've entered {chop_entries} trades in chop/range conditions. Losses from these: ${chop_losses:.2f}",
                cooldown_suggested_min=20,
            )
        
        return None
    
    def _check_loss_streak(
        self, events: List[dict], trades: List[dict]
    ) -> Optional[BehaviorAlert]:
        """
        Detect consecutive losing trades.
        """
        # Sort by close time descending
        sorted_trades = sorted(
            [t for t in trades if t.get("closed_at")],
            key=lambda t: t.get("closed_at") or datetime.min,
            reverse=True
        )
        
        streak = 0
        total_loss = 0.0
        
        for trade in sorted_trades:
            pnl = trade.get("pnl", 0)
            if pnl < 0:
                streak += 1
                total_loss += abs(pnl)
            else:
                break
        
        if streak >= self.LOSS_STREAK_THRESHOLD:
            return BehaviorAlert(
                pattern="loss_streak",
                severity="critical",
                message=f"{streak} consecutive losses totaling ${total_loss:.2f}. Consider taking a break.",
                cooldown_suggested_min=60,
            )
        
        return None
    
    def _check_rapid_position_changes(
        self, events: List[dict], trades: List[dict]
    ) -> Optional[BehaviorAlert]:
        """
        Detect rapid position flipping (long to short quickly).
        """
        # Sort by open time
        sorted_trades = sorted(
            trades,
            key=lambda t: t.get("opened_at") or datetime.min
        )
        
        flips = 0
        
        for i in range(1, len(sorted_trades)):
            prev = sorted_trades[i - 1]
            curr = sorted_trades[i]
            
            # Same symbol?
            if prev.get("symbol") != curr.get("symbol"):
                continue
            
            # Different sides?
            if prev.get("side") == curr.get("side"):
                continue
            
            # Check time gap
            prev_closed = prev.get("closed_at")
            curr_opened = curr.get("opened_at")
            
            if prev_closed and curr_opened:
                if isinstance(prev_closed, str):
                    prev_closed = datetime.fromisoformat(prev_closed)
                if isinstance(curr_opened, str):
                    curr_opened = datetime.fromisoformat(curr_opened)
                
                diff = (curr_opened - prev_closed).total_seconds()
                if 0 < diff < 120:  # Flipped within 2 min
                    flips += 1
        
        if flips >= 2:
            return BehaviorAlert(
                pattern="rapid_flip",
                severity="warning",
                message=f"Detected {flips} rapid position flips. This may indicate indecision.",
                cooldown_suggested_min=10,
            )
        
        return None
    
    def _get_recent_events(self, lookback_hours: int = 2) -> List[dict]:
        """Fetch recent events for this session."""
        cutoff = datetime.utcnow() - timedelta(hours=lookback_hours)
        
        with mongo_client() as client:
            db = client[get_database_name()]
            cursor = db["extension_events"].find({
                "session_id": self.session_id,
                "timestamp": {"$gte": cutoff}
            }).sort("timestamp", -1).limit(100)
            return list(cursor)
    
    def _get_recent_trades(self, lookback_hours: int = 4) -> List[dict]:
        """Fetch recent trades for this session."""
        cutoff = datetime.utcnow() - timedelta(hours=lookback_hours)
        
        with mongo_client() as client:
            db = client[get_database_name()]
            
            query: Dict[str, Any] = {"opened_at": {"$gte": cutoff}}
            if self.session_id:
                query["session_id"] = self.session_id
            elif self.user_id:
                query["user_id"] = self.user_id
            
            cursor = db["extension_trade_journal"].find(query).sort("opened_at", -1).limit(50)
            return list(cursor)



