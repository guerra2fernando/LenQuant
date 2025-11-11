"""Virtual trading account to support backtests and simulations."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


def _coerce_timestamp(value: str | datetime | None) -> datetime:
    """Best-effort conversion of incoming timestamps to datetime objects."""
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return datetime.utcnow()
    return datetime.utcnow()


@dataclass
class Position:
    symbol: str
    quantity: float
    entry_price: float


@dataclass
class TradeLog:
    symbol: str
    entry_ts: str
    exit_ts: str | None
    entry_price: float
    exit_price: float | None
    quantity: float
    pnl: float | None


@dataclass
class AccountEvent:
    timestamp: datetime
    event_type: str
    amount: float
    balance_after: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LedgerEntry:
    timestamp: datetime
    account: str
    entry_type: str
    amount: float
    parent_balance_after: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class VirtualAccount:
    """Represents an individual agent account in a cohort."""

    name: str
    starting_balance: float = 10_000.0
    leverage_limit: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    balance: float = field(init=False)
    positions: List[Position] = field(default_factory=list)
    trades: List[TradeLog] = field(default_factory=list)
    events: List[AccountEvent] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.balance = self.starting_balance
        self.events.append(
            AccountEvent(
                timestamp=datetime.utcnow(),
                event_type="initial_allocation",
                amount=self.starting_balance,
                balance_after=self.balance,
                metadata={"source": "initialise"},
            )
        )

    def open_position(self, symbol: str, quantity: float, price: float, timestamp: str | datetime) -> None:
        event_ts = _coerce_timestamp(timestamp)
        notional = quantity * price
        self.positions.append(Position(symbol=symbol, quantity=quantity, entry_price=price))
        self.balance -= notional
        self.trades.append(
            TradeLog(
                symbol=symbol,
                entry_ts=str(timestamp),
                exit_ts=None,
                entry_price=price,
                exit_price=None,
                quantity=quantity,
                pnl=None,
            )
        )
        self.events.append(
            AccountEvent(
                timestamp=event_ts,
                event_type="open_position",
                amount=-notional,
                balance_after=self.balance,
                metadata={"symbol": symbol, "quantity": quantity, "price": price},
            )
        )

    def close_position(self, symbol: str, price: float, timestamp: str | datetime) -> None:
        position = next((pos for pos in self.positions if pos.symbol == symbol), None)
        if not position:
            return
        event_ts = _coerce_timestamp(timestamp)
        self.positions.remove(position)
        proceeds = position.quantity * price
        pnl = (price - position.entry_price) * position.quantity
        self.balance += proceeds

        for trade in reversed(self.trades):
            if trade.symbol == symbol and trade.exit_ts is None:
                trade.exit_ts = str(timestamp)
                trade.exit_price = price
                trade.pnl = pnl
                break

        self.events.append(
            AccountEvent(
                timestamp=event_ts,
                event_type="close_position",
                amount=proceeds,
                balance_after=self.balance,
                metadata={
                    "symbol": symbol,
                    "quantity": position.quantity,
                    "price": price,
                    "entry_price": position.entry_price,
                    "pnl": pnl,
                },
            )
        )

    def deposit(self, amount: float, *, reason: str = "deposit", metadata: Optional[Dict[str, Any]] = None) -> None:
        if amount <= 0:
            raise ValueError("Deposit amount must be positive.")
        self.balance += amount
        self.events.append(
            AccountEvent(
                timestamp=datetime.utcnow(),
                event_type=reason,
                amount=amount,
                balance_after=self.balance,
                metadata=metadata or {},
            )
        )

    def withdraw(
        self,
        amount: float,
        *,
        reason: str = "withdrawal",
        metadata: Optional[Dict[str, Any]] = None,
        allow_negative: bool = False,
    ) -> None:
        if amount <= 0:
            raise ValueError("Withdrawal amount must be positive.")
        if not allow_negative and amount > self.balance:
            raise ValueError("Insufficient balance for withdrawal.")
        self.balance -= amount
        self.events.append(
            AccountEvent(
                timestamp=datetime.utcnow(),
                event_type=reason,
                amount=-amount,
                balance_after=self.balance,
                metadata=metadata or {},
            )
        )

    @property
    def current_exposure(self) -> float:
        return sum(pos.quantity * pos.entry_price for pos in self.positions)

    @property
    def equity(self) -> float:
        return self.balance + self.current_exposure

    def to_snapshot(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "starting_balance": self.starting_balance,
            "balance": self.balance,
            "equity": self.equity,
            "positions": [position.__dict__ for position in self.positions],
            "trades": [trade.__dict__ for trade in self.trades],
            "events": [
                {
                    "timestamp": event.timestamp.isoformat(),
                    "event_type": event.event_type,
                    "amount": event.amount,
                    "balance_after": event.balance_after,
                    "metadata": event.metadata,
                }
                for event in self.events
            ],
            "metadata": self.metadata,
        }


@dataclass
class ParentWallet:
    """Shared parent wallet that allocates capital to intraday cohort agents."""

    name: str
    starting_balance: float
    exposure_limit: Optional[float] = None
    leverage_ceiling: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    balance: float = field(init=False)
    ledger: List[LedgerEntry] = field(default_factory=list)
    capital_assigned: Dict[str, float] = field(default_factory=dict)
    capital_outstanding: Dict[str, float] = field(default_factory=dict)
    current_exposures: Dict[str, float] = field(default_factory=dict)
    realized_pnl: float = 0.0

    def __post_init__(self) -> None:
        self.balance = self.starting_balance
        if self.exposure_limit is None:
            self.exposure_limit = self.starting_balance

    def allocate(
        self,
        account_name: str,
        amount: float,
        *,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        if amount <= 0:
            raise ValueError("Allocation amount must be positive.")
        if amount > self.balance:
            raise ValueError("Insufficient parent balance for allocation.")
        self.balance -= amount
        self.capital_assigned[account_name] = self.capital_assigned.get(account_name, 0.0) + amount
        self.capital_outstanding[account_name] = self.capital_outstanding.get(account_name, 0.0) + amount
        self.ledger.append(
            LedgerEntry(
                timestamp=datetime.utcnow(),
                account=account_name,
                entry_type="allocate",
                amount=amount,
                parent_balance_after=self.balance,
                metadata=metadata or {},
            )
        )

    def settle(
        self,
        account_name: str,
        final_equity: float,
        *,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> float:
        if final_equity < 0:
            raise ValueError("Final equity must be >= 0.")
        outstanding = self.capital_outstanding.get(account_name, 0.0)
        pnl = final_equity - outstanding
        self.balance += final_equity
        self.capital_outstanding[account_name] = 0.0
        self.current_exposures.pop(account_name, None)
        self.realized_pnl += pnl
        self.ledger.append(
            LedgerEntry(
                timestamp=datetime.utcnow(),
                account=account_name,
                entry_type="settle",
                amount=final_equity,
                parent_balance_after=self.balance,
                metadata={**(metadata or {}), "pnl": pnl, "outstanding_before": outstanding},
            )
        )
        return pnl

    def update_exposure(
        self,
        account_name: str,
        notional: float,
        *,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        if notional < 0:
            raise ValueError("Exposure notional must be positive.")
        outstanding = self.capital_outstanding.get(account_name, 0.0)
        leverage_cap = self.leverage_ceiling or float("inf")
        if leverage_cap != float("inf") and outstanding > 0:
            max_notional = outstanding * leverage_cap
            if notional > max_notional + 1e-6:
                raise ValueError(
                    f"Leverage ceiling exceeded for {account_name}: notional {notional} > {max_notional}"
                )

        new_total = self.aggregate_exposure - self.current_exposures.get(account_name, 0.0) + notional
        if self.exposure_limit is not None and new_total > self.exposure_limit + 1e-6:
            raise ValueError(
                f"Aggregate exposure limit exceeded for {self.name}: requested {new_total}, "
                f"limit {self.exposure_limit}"
            )

        self.current_exposures[account_name] = notional
        self.ledger.append(
            LedgerEntry(
                timestamp=datetime.utcnow(),
                account=account_name,
                entry_type="exposure_update",
                amount=notional,
                parent_balance_after=self.balance,
                metadata=metadata or {},
            )
        )

    @property
    def aggregate_exposure(self) -> float:
        return sum(self.current_exposures.values())

    @property
    def outstanding_capital(self) -> float:
        return sum(self.capital_outstanding.values())

    @property
    def utilization(self) -> float:
        if self.starting_balance == 0:
            return 0.0
        return self.outstanding_capital / self.starting_balance

    @property
    def equity(self) -> float:
        return self.balance + self.aggregate_exposure

    def to_snapshot(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "starting_balance": self.starting_balance,
            "balance": self.balance,
            "equity": self.equity,
            "exposure_limit": self.exposure_limit,
            "aggregate_exposure": self.aggregate_exposure,
            "leverage_ceiling": self.leverage_ceiling,
            "utilization": self.utilization,
            "capital_assigned": self.capital_assigned,
            "capital_outstanding": self.capital_outstanding,
            "current_exposures": self.current_exposures,
            "realized_pnl": self.realized_pnl,
            "ledger": [
                {
                    "timestamp": entry.timestamp.isoformat(),
                    "account": entry.account,
                    "entry_type": entry.entry_type,
                    "amount": entry.amount,
                    "parent_balance_after": entry.parent_balance_after,
                    "metadata": entry.metadata,
                }
                for entry in self.ledger
            ],
            "metadata": self.metadata,
        }
