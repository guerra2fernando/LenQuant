"""
Report generation for Chrome extension.

Generates daily, weekly, and monthly trading reports with performance analytics.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Literal, Optional

from db.client import get_database_name, mongo_client

logger = logging.getLogger(__name__)


# Collections
TRADES_COLLECTION = "extension_trade_journal"
ANALYSES_COLLECTION = "extension_analyses"
EVENTS_COLLECTION = "extension_events"
BEHAVIOR_COLLECTION = "extension_behavior_log"
REPORTS_COLLECTION = "extension_daily_reports"


class ReportGenerator:
    """
    Generates comprehensive trading reports.
    
    Report types:
    - Daily: Single day summary
    - Weekly: Week summary with daily breakdown
    - Monthly: Month summary with weekly trends
    """
    
    def __init__(self, user_id: Optional[str] = None, session_id: Optional[str] = None):
        """
        Initialize report generator.
        
        Args:
            user_id: Filter by user ID
            session_id: Filter by session ID
        """
        self.user_id = user_id
        self.session_id = session_id
    
    def generate_daily_report(
        self,
        date: Optional[datetime] = None,
        save_to_db: bool = True,
    ) -> Dict[str, Any]:
        """
        Generate daily trading report.
        
        Args:
            date: Date to report on (default: today)
            save_to_db: Whether to save report to database
        
        Returns:
            Complete daily report
        """
        if date is None:
            date = datetime.utcnow()
        
        day_start = date.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        # Fetch data
        trades = self._get_trades(day_start, day_end)
        events = self._get_events(day_start, day_end)
        behavior_logs = self._get_behavior_logs(day_start, day_end)
        
        # Build report sections
        summary = self._build_summary(trades)
        by_setup = self._analyze_by_setup(trades)
        by_timeframe = self._analyze_by_timeframe(trades, events)
        by_hour = self._analyze_by_hour(trades)
        behavior = self._analyze_behavior(trades, behavior_logs)
        highlights = self._get_highlights(trades)
        
        report = {
            "date": day_start.date().isoformat(),
            "user_id": self.user_id,
            "session_id": self.session_id,
            "generated_at": datetime.utcnow().isoformat(),
            "summary": summary,
            "by_setup": by_setup,
            "by_timeframe": by_timeframe,
            "by_hour": by_hour,
            "behavior": behavior,
            "biggest_mistake": highlights.get("worst"),
            "best_trade": highlights.get("best"),
            "streaks": self._calculate_streaks(trades),
            "metrics": self._calculate_advanced_metrics(trades),
        }
        
        if save_to_db:
            self._save_report(report)
        
        return report
    
    def generate_weekly_report(
        self,
        week_start: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Generate weekly trading report.
        
        Args:
            week_start: Start of week (default: current week Monday)
        
        Returns:
            Complete weekly report
        """
        if week_start is None:
            today = datetime.utcnow()
            week_start = today - timedelta(days=today.weekday())
        
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        week_end = week_start + timedelta(days=7)
        
        # Fetch all trades for the week
        trades = self._get_trades(week_start, week_end)
        
        # Generate daily breakdowns
        daily_breakdown = []
        for i in range(7):
            day = week_start + timedelta(days=i)
            day_end = day + timedelta(days=1)
            day_trades = [
                t for t in trades
                if day <= t.get("opened_at", datetime.min) < day_end
            ]
            daily_breakdown.append({
                "date": day.date().isoformat(),
                "day_name": day.strftime("%A"),
                "trades": len(day_trades),
                "pnl": sum(t.get("pnl", 0) or 0 for t in day_trades if t.get("pnl")),
                "winners": len([t for t in day_trades if (t.get("pnl") or 0) > 0]),
            })
        
        return {
            "week_start": week_start.date().isoformat(),
            "week_end": (week_end - timedelta(days=1)).date().isoformat(),
            "user_id": self.user_id,
            "generated_at": datetime.utcnow().isoformat(),
            "summary": self._build_summary(trades),
            "daily_breakdown": daily_breakdown,
            "by_setup": self._analyze_by_setup(trades),
            "behavior": self._analyze_behavior(trades, []),
            "best_day": max(daily_breakdown, key=lambda d: d["pnl"]) if daily_breakdown else None,
            "worst_day": min(daily_breakdown, key=lambda d: d["pnl"]) if daily_breakdown else None,
            "metrics": self._calculate_advanced_metrics(trades),
        }
    
    def generate_monthly_report(
        self,
        year: Optional[int] = None,
        month: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Generate monthly trading report.
        
        Args:
            year: Year (default: current year)
            month: Month (default: current month)
        
        Returns:
            Complete monthly report
        """
        if year is None or month is None:
            now = datetime.utcnow()
            year = year or now.year
            month = month or now.month
        
        month_start = datetime(year, month, 1)
        if month == 12:
            month_end = datetime(year + 1, 1, 1)
        else:
            month_end = datetime(year, month + 1, 1)
        
        trades = self._get_trades(month_start, month_end)
        
        # Generate weekly breakdowns
        weekly_breakdown = []
        current = month_start
        week_num = 1
        
        while current < month_end:
            week_end = min(current + timedelta(days=7), month_end)
            week_trades = [
                t for t in trades
                if current <= t.get("opened_at", datetime.min) < week_end
            ]
            weekly_breakdown.append({
                "week": week_num,
                "start_date": current.date().isoformat(),
                "trades": len(week_trades),
                "pnl": sum(t.get("pnl", 0) or 0 for t in week_trades if t.get("pnl")),
            })
            current = week_end
            week_num += 1
        
        return {
            "month": f"{year}-{month:02d}",
            "user_id": self.user_id,
            "generated_at": datetime.utcnow().isoformat(),
            "summary": self._build_summary(trades),
            "weekly_breakdown": weekly_breakdown,
            "by_setup": self._analyze_by_setup(trades),
            "behavior": self._analyze_behavior(trades, []),
            "metrics": self._calculate_advanced_metrics(trades),
            "equity_curve": self._build_equity_curve(trades),
        }
    
    def get_performance_analytics(
        self,
        days: int = 30,
    ) -> Dict[str, Any]:
        """
        Get comprehensive performance analytics.
        
        Args:
            days: Number of days to analyze
        
        Returns:
            Performance analytics data
        """
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        trades = self._get_trades(start_date, end_date)
        
        return {
            "period_days": days,
            "start_date": start_date.date().isoformat(),
            "end_date": end_date.date().isoformat(),
            "total_trades": len(trades),
            "summary": self._build_summary(trades),
            "by_setup": self._analyze_by_setup(trades),
            "by_timeframe": self._analyze_by_timeframe(trades, []),
            "by_symbol": self._analyze_by_symbol(trades),
            "by_day_of_week": self._analyze_by_day_of_week(trades),
            "by_hour": self._analyze_by_hour(trades),
            "metrics": self._calculate_advanced_metrics(trades),
            "equity_curve": self._build_equity_curve(trades),
            "drawdown_analysis": self._analyze_drawdown(trades),
        }
    
    def _get_trades(self, start: datetime, end: datetime) -> List[Dict[str, Any]]:
        """Fetch trades in date range."""
        with mongo_client() as client:
            db = client[get_database_name()]
            
            query: Dict[str, Any] = {
                "opened_at": {"$gte": start, "$lt": end}
            }
            if self.user_id:
                query["user_id"] = self.user_id
            if self.session_id:
                query["session_id"] = self.session_id
            
            return list(db[TRADES_COLLECTION].find(query).sort("opened_at", 1))
    
    def _get_events(self, start: datetime, end: datetime) -> List[Dict[str, Any]]:
        """Fetch events in date range."""
        with mongo_client() as client:
            db = client[get_database_name()]
            
            query: Dict[str, Any] = {
                "timestamp": {"$gte": start, "$lt": end}
            }
            if self.user_id:
                query["user_id"] = self.user_id
            if self.session_id:
                query["session_id"] = self.session_id
            
            return list(db[EVENTS_COLLECTION].find(query))
    
    def _get_behavior_logs(self, start: datetime, end: datetime) -> List[Dict[str, Any]]:
        """Fetch behavior logs in date range."""
        with mongo_client() as client:
            db = client[get_database_name()]
            
            query: Dict[str, Any] = {
                "timestamp": {"$gte": start, "$lt": end}
            }
            if self.user_id:
                query["user_id"] = self.user_id
            if self.session_id:
                query["session_id"] = self.session_id
            
            return list(db[BEHAVIOR_COLLECTION].find(query))
    
    def _build_summary(self, trades: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Build trade summary statistics."""
        closed_trades = [t for t in trades if t.get("closed_at")]
        winners = [t for t in closed_trades if (t.get("pnl") or 0) > 0]
        losers = [t for t in closed_trades if (t.get("pnl") or 0) < 0]
        
        total_pnl = sum(t.get("pnl", 0) or 0 for t in closed_trades)
        total_fees = sum(t.get("fees", 0) or 0 for t in trades)
        
        gross_profit = sum(t.get("pnl", 0) for t in winners)
        gross_loss = sum(t.get("pnl", 0) for t in losers)
        
        avg_win = gross_profit / len(winners) if winners else 0
        avg_loss = abs(gross_loss / len(losers)) if losers else 0
        
        return {
            "total_trades": len(trades),
            "closed_trades": len(closed_trades),
            "open_trades": len(trades) - len(closed_trades),
            "winners": len(winners),
            "losers": len(losers),
            "breakeven": len(closed_trades) - len(winners) - len(losers),
            "win_rate": round(len(winners) / len(closed_trades), 3) if closed_trades else 0,
            "total_pnl": round(total_pnl, 2),
            "gross_profit": round(gross_profit, 2),
            "gross_loss": round(gross_loss, 2),
            "fees_paid": round(total_fees, 2),
            "net_pnl": round(total_pnl - total_fees, 2),
            "avg_win": round(avg_win, 2),
            "avg_loss": round(avg_loss, 2),
            "profit_factor": round(gross_profit / abs(gross_loss), 2) if gross_loss else 0,
            "expectancy": round((avg_win * (len(winners) / len(closed_trades)) - avg_loss * (len(losers) / len(closed_trades))), 2) if closed_trades else 0,
        }
    
    def _analyze_by_setup(self, trades: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Analyze performance by setup pattern."""
        by_setup: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        
        with mongo_client() as client:
            db = client[get_database_name()]
            
            for trade in trades:
                analysis_id = trade.get("matched_analysis_id")
                setup = "unmatched"
                
                if analysis_id:
                    analysis = db[ANALYSES_COLLECTION].find_one({"analysis_id": analysis_id})
                    if analysis:
                        setups = analysis.get("fast_path", {}).get("setup_candidates", [])
                        setup = setups[0] if setups else "unknown"
                
                by_setup[setup].append(trade)
        
        result = {}
        for setup, setup_trades in by_setup.items():
            closed = [t for t in setup_trades if t.get("pnl") is not None]
            winners = [t for t in closed if t.get("pnl", 0) > 0]
            
            result[setup] = {
                "trades": len(setup_trades),
                "closed": len(closed),
                "winners": len(winners),
                "win_rate": round(len(winners) / len(closed), 3) if closed else 0,
                "total_pnl": round(sum(t.get("pnl", 0) or 0 for t in closed), 2),
                "avg_pnl": round(sum(t.get("pnl", 0) or 0 for t in closed) / len(closed), 2) if closed else 0,
            }
        
        return result
    
    def _analyze_by_timeframe(
        self,
        trades: List[Dict[str, Any]],
        events: List[Dict[str, Any]],
    ) -> Dict[str, Dict[str, Any]]:
        """Analyze performance by timeframe."""
        by_tf: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        
        # Try to match trades to timeframes from events
        for trade in trades:
            timeframe = "unknown"
            
            trade_time = trade.get("opened_at")
            if trade_time:
                # Find closest analysis event
                for event in events:
                    if event.get("type") == "analysis_generated":
                        event_time = event.get("timestamp")
                        if isinstance(event_time, datetime):
                            diff = abs((trade_time - event_time).total_seconds())
                            if diff < 300:  # Within 5 minutes
                                timeframe = event.get("timeframe", "unknown")
                                break
            
            by_tf[timeframe].append(trade)
        
        result = {}
        for tf, tf_trades in by_tf.items():
            closed = [t for t in tf_trades if t.get("pnl") is not None]
            winners = [t for t in closed if t.get("pnl", 0) > 0]
            
            result[tf] = {
                "trades": len(tf_trades),
                "win_rate": round(len(winners) / len(closed), 3) if closed else 0,
                "total_pnl": round(sum(t.get("pnl", 0) or 0 for t in closed), 2),
            }
        
        return result
    
    def _analyze_by_symbol(self, trades: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Analyze performance by trading symbol."""
        by_symbol: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        
        for trade in trades:
            symbol = trade.get("symbol", "unknown")
            by_symbol[symbol].append(trade)
        
        result = {}
        for symbol, sym_trades in by_symbol.items():
            closed = [t for t in sym_trades if t.get("pnl") is not None]
            winners = [t for t in closed if t.get("pnl", 0) > 0]
            
            result[symbol] = {
                "trades": len(sym_trades),
                "win_rate": round(len(winners) / len(closed), 3) if closed else 0,
                "total_pnl": round(sum(t.get("pnl", 0) or 0 for t in closed), 2),
            }
        
        return result
    
    def _analyze_by_day_of_week(self, trades: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Analyze performance by day of week."""
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        by_day: Dict[str, List[Dict[str, Any]]] = {day: [] for day in days}
        
        for trade in trades:
            opened_at = trade.get("opened_at")
            if isinstance(opened_at, datetime):
                day_name = days[opened_at.weekday()]
                by_day[day_name].append(trade)
        
        result = {}
        for day, day_trades in by_day.items():
            closed = [t for t in day_trades if t.get("pnl") is not None]
            winners = [t for t in closed if t.get("pnl", 0) > 0]
            
            result[day] = {
                "trades": len(day_trades),
                "win_rate": round(len(winners) / len(closed), 3) if closed else 0,
                "total_pnl": round(sum(t.get("pnl", 0) or 0 for t in closed), 2),
            }
        
        return result
    
    def _analyze_by_hour(self, trades: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Analyze performance by hour of day."""
        by_hour: Dict[int, List[Dict[str, Any]]] = {h: [] for h in range(24)}
        
        for trade in trades:
            opened_at = trade.get("opened_at")
            if isinstance(opened_at, datetime):
                by_hour[opened_at.hour].append(trade)
        
        result = {}
        for hour, hour_trades in by_hour.items():
            if not hour_trades:
                continue
            
            closed = [t for t in hour_trades if t.get("pnl") is not None]
            winners = [t for t in closed if t.get("pnl", 0) > 0]
            
            result[f"{hour:02d}:00"] = {
                "trades": len(hour_trades),
                "win_rate": round(len(winners) / len(closed), 3) if closed else 0,
                "total_pnl": round(sum(t.get("pnl", 0) or 0 for t in closed), 2),
            }
        
        return result
    
    def _analyze_behavior(
        self,
        trades: List[Dict[str, Any]],
        behavior_logs: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Analyze trading behavior patterns."""
        # Count behavior flags from trades
        behavior_flags = []
        for trade in trades:
            flags = trade.get("behavior_flags", [])
            behavior_flags.extend(flags)
        
        # Also count from behavior logs
        for log in behavior_logs:
            pattern = log.get("pattern")
            if pattern:
                behavior_flags.append(pattern)
        
        revenge_count = behavior_flags.count("revenge_trading")
        overtrade_count = behavior_flags.count("overtrading")
        chop_count = behavior_flags.count("chop_entries")
        loss_streak_count = behavior_flags.count("loss_streak")
        
        # Calculate overtrading score based on trade frequency
        trades_per_hour = len(trades) / 24 if trades else 0
        overtrading_score = min(1.0, trades_per_hour / 5)  # 5 trades/hour = max score
        
        return {
            "revenge_trades": revenge_count,
            "overtrading_count": overtrade_count,
            "chop_entries": chop_count,
            "loss_streaks": loss_streak_count,
            "overtrading_score": round(overtrading_score, 2),
            "total_violations": len(behavior_flags),
            "breakdown": {
                "revenge_trading": revenge_count,
                "overtrading": overtrade_count,
                "chop_entries": chop_count,
                "loss_streak": loss_streak_count,
                "rapid_flip": behavior_flags.count("rapid_flip"),
            },
        }
    
    def _get_highlights(self, trades: List[Dict[str, Any]]) -> Dict[str, Optional[Dict[str, Any]]]:
        """Get best and worst trades."""
        closed = [t for t in trades if t.get("pnl") is not None]
        
        if not closed:
            return {"best": None, "worst": None}
        
        best = max(closed, key=lambda t: t.get("pnl", 0))
        worst = min(closed, key=lambda t: t.get("pnl", 0))
        
        return {
            "best": {
                "trade_id": best.get("trade_id"),
                "symbol": best.get("symbol"),
                "side": best.get("side"),
                "profit": round(best.get("pnl", 0), 2),
                "r_multiple": self._calculate_r_multiple(best),
            } if best.get("pnl", 0) > 0 else None,
            "worst": {
                "trade_id": worst.get("trade_id"),
                "symbol": worst.get("symbol"),
                "side": worst.get("side"),
                "loss": round(abs(worst.get("pnl", 0)), 2),
                "type": self._identify_mistake_type(worst),
            } if worst.get("pnl", 0) < 0 else None,
        }
    
    def _calculate_r_multiple(self, trade: Dict[str, Any]) -> Optional[float]:
        """Calculate R-multiple for a trade."""
        pnl = trade.get("pnl", 0)
        # Would need risk amount from analysis - return simplified version
        entry = trade.get("entry_price", 0)
        if entry and pnl:
            return round(pnl / (entry * 0.01), 2)  # Assume 1% risk
        return None
    
    def _identify_mistake_type(self, trade: Dict[str, Any]) -> str:
        """Identify type of trading mistake."""
        flags = trade.get("behavior_flags", [])
        if "revenge_trading" in flags:
            return "revenge_trade"
        if "chop_entries" in flags:
            return "chop_entry"
        if "overtrading" in flags:
            return "overtrading"
        return "loss"
    
    def _calculate_streaks(self, trades: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate win/loss streaks."""
        sorted_trades = sorted(
            [t for t in trades if t.get("pnl") is not None],
            key=lambda t: t.get("closed_at") or t.get("opened_at") or datetime.min,
        )
        
        if not sorted_trades:
            return {"current_streak": 0, "max_win_streak": 0, "max_loss_streak": 0}
        
        current_streak = 0
        max_win = 0
        max_loss = 0
        temp_streak = 0
        last_win = None
        
        for trade in sorted_trades:
            is_win = trade.get("pnl", 0) > 0
            
            if last_win is None:
                temp_streak = 1
            elif is_win == last_win:
                temp_streak += 1
            else:
                if last_win:
                    max_win = max(max_win, temp_streak)
                else:
                    max_loss = max(max_loss, temp_streak)
                temp_streak = 1
            
            last_win = is_win
        
        # Final streak
        if last_win:
            max_win = max(max_win, temp_streak)
            current_streak = temp_streak
        else:
            max_loss = max(max_loss, temp_streak)
            current_streak = -temp_streak
        
        return {
            "current_streak": current_streak,
            "max_win_streak": max_win,
            "max_loss_streak": max_loss,
        }
    
    def _calculate_advanced_metrics(self, trades: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate advanced trading metrics."""
        closed = [t for t in trades if t.get("pnl") is not None]
        
        if not closed:
            return {}
        
        pnls = [t.get("pnl", 0) for t in closed]
        
        # Sharpe-like ratio (simplified)
        import statistics
        if len(pnls) > 1:
            mean_pnl = statistics.mean(pnls)
            std_pnl = statistics.stdev(pnls)
            sharpe = mean_pnl / std_pnl if std_pnl else 0
        else:
            sharpe = 0
        
        # Average trade duration
        durations = []
        for t in closed:
            opened = t.get("opened_at")
            closed_at = t.get("closed_at")
            if opened and closed_at:
                duration = (closed_at - opened).total_seconds() / 60  # minutes
                durations.append(duration)
        
        avg_duration = statistics.mean(durations) if durations else 0
        
        # Matched trade ratio
        matched = [t for t in trades if t.get("matched_analysis_id")]
        match_ratio = len(matched) / len(trades) if trades else 0
        
        return {
            "sharpe_ratio": round(sharpe, 2),
            "avg_trade_duration_min": round(avg_duration, 1),
            "plan_adherence": round(match_ratio, 3),
            "total_volume": sum(
                (t.get("quantity", 0) * t.get("entry_price", 0)) 
                for t in trades
            ),
        }
    
    def _build_equity_curve(self, trades: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Build equity curve data."""
        sorted_trades = sorted(
            [t for t in trades if t.get("pnl") is not None and t.get("closed_at")],
            key=lambda t: t.get("closed_at"),
        )
        
        curve = []
        cumulative = 0
        
        for trade in sorted_trades:
            pnl = trade.get("pnl", 0)
            cumulative += pnl
            closed_at = trade.get("closed_at")
            
            curve.append({
                "timestamp": closed_at.isoformat() if isinstance(closed_at, datetime) else str(closed_at),
                "pnl": round(pnl, 2),
                "cumulative": round(cumulative, 2),
            })
        
        return curve
    
    def _analyze_drawdown(self, trades: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze drawdown statistics."""
        curve = self._build_equity_curve(trades)
        
        if not curve:
            return {"max_drawdown": 0, "max_drawdown_pct": 0}
        
        peak = 0
        max_dd = 0
        
        for point in curve:
            cumulative = point["cumulative"]
            if cumulative > peak:
                peak = cumulative
            dd = peak - cumulative
            if dd > max_dd:
                max_dd = dd
        
        max_dd_pct = (max_dd / peak * 100) if peak > 0 else 0
        
        return {
            "max_drawdown": round(max_dd, 2),
            "max_drawdown_pct": round(max_dd_pct, 2),
            "current_drawdown": round(peak - curve[-1]["cumulative"], 2) if curve else 0,
        }
    
    def _save_report(self, report: Dict[str, Any]) -> None:
        """Save report to database."""
        with mongo_client() as client:
            db = client[get_database_name()]
            
            # Upsert by date and user
            query = {"date": report["date"]}
            if report.get("user_id"):
                query["user_id"] = report["user_id"]
            
            db[REPORTS_COLLECTION].update_one(
                query,
                {"$set": report},
                upsert=True,
            )

