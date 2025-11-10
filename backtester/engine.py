"""Event-driven backtesting engine."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

import pandas as pd

from backtester.execution_model import ExecutionModel
from evaluation.metrics import compute_experiment_metrics


@dataclass
class Position:
    entry_price: float
    quantity: float


@dataclass
class Trade:
    entry_ts: pd.Timestamp
    exit_ts: Optional[pd.Timestamp]
    entry_price: float
    exit_price: Optional[float]
    quantity: float
    pnl: Optional[float]
    predicted_return: Optional[float] = None
    confidence: Optional[float] = None
    realized_return: Optional[float] = None


@dataclass
class BacktestResult:
    trades: List[Trade] = field(default_factory=list)
    equity_curve: List[Dict[str, float]] = field(default_factory=list)
    metrics: Dict[str, float] = field(default_factory=dict)


class Backtester:
    def __init__(
        self,
        initial_capital: float = 10_000.0,
        position_size_pct: float = 0.95,
        execution_model: Optional[ExecutionModel] = None,
        take_profit_pct: Optional[float] = None,
        stop_loss_pct: Optional[float] = None,
    ) -> None:
        self.initial_capital = initial_capital
        self.cash = initial_capital
        self.position_size_pct = position_size_pct
        self.execution = execution_model or ExecutionModel()
        self.position: Optional[Position] = None
        self.trades: List[Trade] = []
        self.equity_curve: List[Dict[str, float]] = []
        self.last_prediction: Dict[str, Optional[float]] = {"predicted_return": None, "confidence": None}
        self.take_profit_pct = take_profit_pct
        self.stop_loss_pct = stop_loss_pct

    def on_signal(
        self,
        ts: pd.Timestamp,
        price: float,
        signal: str,
        predicted_return: Optional[float] = None,
        confidence: Optional[float] = None,
    ) -> None:
        self.last_prediction = {"predicted_return": predicted_return, "confidence": confidence}
        signal = signal.lower()
        self._apply_risk_management(ts, price)
        if signal == "buy":
            self._handle_buy(ts, price)
        elif signal == "sell":
            self._handle_sell(ts, price)
        self._mark_equity(ts, price)

    def _handle_buy(self, ts: pd.Timestamp, price: float) -> None:
        if self.position:
            return
        exec_price = self.execution.apply_slippage(price, "buy")
        notional = self.cash * self.position_size_pct
        net_notional = self.execution.apply_fees(notional)
        qty = net_notional / exec_price
        self.position = Position(entry_price=exec_price, quantity=qty)
        self.cash -= notional
        self.trades.append(
            Trade(
                entry_ts=ts,
                exit_ts=None,
                entry_price=exec_price,
                exit_price=None,
                quantity=qty,
                pnl=None,
                predicted_return=self.last_prediction.get("predicted_return"),
                confidence=self.last_prediction.get("confidence"),
            )
        )

    def _handle_sell(self, ts: pd.Timestamp, price: float) -> None:
        if not self.position:
            return
        exec_price = self.execution.apply_slippage(price, "sell")
        gross = exec_price * self.position.quantity
        net = self.execution.apply_fees(gross)
        self.cash += net
        pnl = (exec_price - self.position.entry_price) * self.position.quantity
        last_trade = self.trades[-1]
        last_trade.exit_ts = ts
        last_trade.exit_price = exec_price
        last_trade.pnl = pnl
        if last_trade.entry_price:
            last_trade.realized_return = (exec_price - last_trade.entry_price) / last_trade.entry_price
        self.position = None

    def _apply_risk_management(self, ts: pd.Timestamp, price: float) -> None:
        if not self.position:
            return
        change = (price - self.position.entry_price) / self.position.entry_price if self.position.entry_price else 0.0
        if self.take_profit_pct is not None and change >= self.take_profit_pct:
            self._handle_sell(ts, price)
        elif self.stop_loss_pct is not None and change <= -self.stop_loss_pct:
            self._handle_sell(ts, price)

    def _mark_equity(self, ts: pd.Timestamp, price: float) -> None:
        position_value = 0.0
        if self.position:
            position_value = price * self.position.quantity
        equity = self.cash + position_value
        self.equity_curve.append(
            {
                "timestamp": ts,
                "equity": equity,
                "predicted_return": self.last_prediction.get("predicted_return"),
                "confidence": self.last_prediction.get("confidence"),
            }
        )

    def finalize(self) -> BacktestResult:
        metrics: Dict[str, float] = {}
        if self.equity_curve:
            series = pd.Series([point["equity"] for point in self.equity_curve])
            metrics = compute_experiment_metrics(series, self.trades, self.initial_capital)
        return BacktestResult(trades=self.trades, equity_curve=self.equity_curve, metrics=metrics)

