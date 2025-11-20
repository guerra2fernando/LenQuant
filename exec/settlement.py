"""Ledger, settlement, and accounting utilities for Phase 5 trading."""
from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

from bson import ObjectId

from db.client import get_database_name, get_ohlcv_df, mongo_client

LOGGER = logging.getLogger(__name__)

WALLETS_COLLECTION = "trading_wallets"
POSITIONS_COLLECTION = "trading_positions"
FILLS_COLLECTION = "trading_fills"
LEDGER_COLLECTION = "trading_ledgers"


def _utcnow() -> datetime:
    return datetime.utcnow().replace(tzinfo=timezone.utc)


@dataclass
class LedgerSnapshot:
    mode: str
    wallet_balance: float
    positions_value: float
    realized_pnl: float
    unrealized_pnl: float
    timestamp: datetime
    hash: str


class SettlementEngine:
    """Handles balance tracking, PnL attribution, and ledger snapshots."""

    def __init__(
        self,
        *,
        base_currency: str = "USDT",
        default_wallets: Optional[Dict[str, float]] = None,
    ) -> None:
        self.base_currency = base_currency
        self.default_wallets = default_wallets or {"paper": 100_000.0}
        self.logger = LOGGER

    # --------------------------------------------------------------------- #
    # Wallet helpers
    # --------------------------------------------------------------------- #
    def _ensure_wallet(self, mode: str) -> Dict[str, Any]:
        now = _utcnow()
        with mongo_client() as client:
            db = client[get_database_name()]
            doc = db[WALLETS_COLLECTION].find_one({"mode": mode})
            if doc:
                return doc

            starting_balance = float(self.default_wallets.get(mode, 0.0))
            payload = {
                "_id": ObjectId(),
                "mode": mode,
                "balance": starting_balance,
                "currency": self.base_currency,
                "created_at": now,
                "updated_at": now,
                "metadata": {"source": "auto-init"},
            }
            db[WALLETS_COLLECTION].insert_one(payload)
            return payload

    def get_wallet_balance(self, mode: str) -> float:
        doc = self._ensure_wallet(mode)
        return float(doc.get("balance", 0.0))

    def set_wallet_balance(self, mode: str, balance: float) -> None:
        now = _utcnow()
        with mongo_client() as client:
            db = client[get_database_name()]
            db[WALLETS_COLLECTION].update_one(
                {"mode": mode},
                {
                    "$set": {
                        "balance": float(balance),
                        "updated_at": now,
                    }
                },
                upsert=True,
            )

    # --------------------------------------------------------------------- #
    # Position helpers
    # --------------------------------------------------------------------- #
    def list_positions(self, mode: Optional[str] = None) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {}
        if mode:
            query["mode"] = mode
        with mongo_client() as client:
            db = client[get_database_name()]
            positions = list(db[POSITIONS_COLLECTION].find(query))
        return [self._serialise_doc(doc) for doc in positions]

    def _fetch_position(
        self, *, symbol: str, mode: str, side: str = "long"
    ) -> Optional[Dict[str, Any]]:
        with mongo_client() as client:
            db = client[get_database_name()]
            doc = db[POSITIONS_COLLECTION].find_one({"symbol": symbol, "mode": mode, "side": side})
        return doc

    def _upsert_position(
        self,
        *,
        symbol: str,
        mode: str,
        side: str,
        quantity: float,
        avg_entry_price: float,
        realized_pnl: float,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        now = _utcnow()
        
        # Extract attribution from metadata
        strategy_id = None
        cohort_id = None
        genome_id = None
        if metadata:
            strategy_id = metadata.get("strategy_id")
            cohort_id = metadata.get("cohort_id")
            genome_id = metadata.get("genome_id")
        
        payload = {
            "symbol": symbol,
            "mode": mode,
            "side": side,
            "quantity": float(quantity),
            "avg_entry_price": float(avg_entry_price),
            "realized_pnl": float(realized_pnl),
            "updated_at": now,
            "metadata": metadata or {},
            # Attribution fields for Phase 3 portfolio hierarchy
            "strategy_id": strategy_id,
            "cohort_id": cohort_id,
            "genome_id": genome_id,
        }
        with mongo_client() as client:
            db = client[get_database_name()]
            db[POSITIONS_COLLECTION].update_one(
                {"symbol": symbol, "mode": mode, "side": side},
                {"$set": payload, "$setOnInsert": {"created_at": now}},
                upsert=True,
            )
            stored = db[POSITIONS_COLLECTION].find_one({"symbol": symbol, "mode": mode, "side": side})
        return stored or payload

    def _delete_position(self, *, symbol: str, mode: str, side: str = "long") -> None:
        with mongo_client() as client:
            db = client[get_database_name()]
            db[POSITIONS_COLLECTION].delete_one({"symbol": symbol, "mode": mode, "side": side})

    # --------------------------------------------------------------------- #
    # Reference data
    # --------------------------------------------------------------------- #
    def get_reference_price(
        self,
        symbol: str,
        *,
        mode: Optional[str] = None,
        default: Optional[float] = None,
    ) -> Optional[float]:
        """Retrieve the latest known execution price for a symbol."""
        lookup_filters: Dict[str, Any] = {"symbol": symbol}
        if mode:
            lookup_filters["mode"] = mode

        with mongo_client() as client:
            db = client[get_database_name()]
            fill = (
                db[FILLS_COLLECTION]
                .find(lookup_filters)
                .sort("executed_at", -1)
                .limit(1)
            )
            latest = next(iter(fill), None)
        if latest:
            return float(latest.get("price", 0.0))

        # Fall back to OHLCV collection if available.
        candles = get_ohlcv_df(symbol, "1m", limit=1)
        if not candles.empty and "close" in candles.columns:
            return float(candles["close"].iloc[-1])
        if default is not None:
            return float(default)
        return None

    # --------------------------------------------------------------------- #
    # Ledger management
    # --------------------------------------------------------------------- #
    def record_fill(
        self,
        *,
        order: Dict[str, Any],
        fill: Dict[str, Any],
        connector_balance: Optional[Dict[str, Any]] = None,
    ) -> LedgerSnapshot:
        """Persist fill, update positions/wallet, and return ledger snapshot."""
        mode = order.get("mode", "paper")
        symbol = order.get("symbol")
        side = order.get("side", "buy")
        quantity = float(fill.get("quantity", 0.0))
        price = float(fill.get("price", 0.0))
        fee = float(fill.get("fee", 0.0))

        if quantity <= 0 or price <= 0:
            raise ValueError("Fill must include positive quantity and price.")

        pnl = 0.0
        existing = self._fetch_position(symbol=symbol, mode=mode, side="long")

        wallet_before = self.get_wallet_balance(mode)

        if side.lower() == "buy":
            new_quantity, new_avg_price = self._accumulate_position(existing, quantity, price)
            self._upsert_position(
                symbol=symbol,
                mode=mode,
                side="long",
                quantity=new_quantity,
                avg_entry_price=new_avg_price,
                realized_pnl=float(existing.get("realized_pnl", 0.0) if existing else 0.0),
                metadata=order.get("metadata"),
            )
            wallet_after = wallet_before - (quantity * price) - fee
        else:
            if not existing:
                pnl = quantity * price
                wallet_after = wallet_before + (quantity * price) - fee
            else:
                pnl = (price - float(existing.get("avg_entry_price", price))) * quantity
                remaining = float(existing.get("quantity", 0.0)) - quantity
                realized_total = float(existing.get("realized_pnl", 0.0)) + pnl
                if remaining > 1e-8:
                    self._upsert_position(
                        symbol=symbol,
                        mode=mode,
                        side="long",
                        quantity=remaining,
                        avg_entry_price=float(existing.get("avg_entry_price", price)),
                        realized_pnl=realized_total,
                        metadata=order.get("metadata"),
                    )
                else:
                    self._delete_position(symbol=symbol, mode=mode, side="long")
                wallet_after = wallet_before + (quantity * price) - fee
        self.set_wallet_balance(mode, wallet_after)

        fill_payload = {
            "_id": fill.get("_id") or ObjectId(),
            "fill_id": fill.get("fill_id") or str(ObjectId()),
            "order_id": order.get("order_id"),
            "mode": mode,
            "symbol": symbol,
            "side": side,
            "quantity": quantity,
            "price": price,
            "fee": fee,
            "pnl": pnl,
            "executed_at": fill.get("executed_at") or _utcnow(),
            "raw": fill.get("raw") or {},
            "connector_balance": connector_balance or {},
        }

        with mongo_client() as client:
            db = client[get_database_name()]
            db[FILLS_COLLECTION].insert_one(fill_payload)

        snapshot = self._snapshot(mode=mode, last_fill=fill_payload)
        return snapshot

    def _accumulate_position(
        self, existing: Optional[Dict[str, Any]], quantity: float, price: float
    ) -> Tuple[float, float]:
        if not existing:
            return (quantity, price)
        prev_qty = float(existing.get("quantity", 0.0))
        prev_price = float(existing.get("avg_entry_price", price))
        total_qty = prev_qty + quantity
        if total_qty <= 0:
            return (0.0, price)
        new_avg = ((prev_qty * prev_price) + (quantity * price)) / total_qty
        return (total_qty, new_avg)

    def _snapshot(
        self,
        *,
        mode: str,
        last_fill: Optional[Dict[str, Any]] = None,
    ) -> LedgerSnapshot:
        positions = self.list_positions(mode)
        wallet_balance = self.get_wallet_balance(mode)

        positions_value = sum(
            float(position.get("quantity", 0.0)) * float(position.get("avg_entry_price", 0.0))
            for position in positions
        )
        # Unrealized pnl approximated using avg_entry_price; refined outside.
        unrealized = 0.0
        for position in positions:
            reference_price = self.get_reference_price(position["symbol"], mode=mode)
            avg_price = float(position.get("avg_entry_price", 0.0))
            qty = float(position.get("quantity", 0.0))
            if reference_price is not None and avg_price:
                unrealized += (float(reference_price) - avg_price) * qty

        last_realized = 0.0
        with mongo_client() as client:
            db = client[get_database_name()]
            latest = (
                db[LEDGER_COLLECTION]
                .find({"mode": mode})
                .sort("timestamp", -1)
                .limit(1)
            )
            latest_doc = next(iter(latest), None)
            if latest_doc:
                last_realized = float(latest_doc.get("realized_pnl", 0.0))

        realized_pnl = last_realized + float(last_fill.get("pnl", 0.0)) if last_fill else last_realized
        now = last_fill.get("executed_at") if last_fill else _utcnow()

        hash_payload = {
            "mode": mode,
            "wallet_balance": wallet_balance,
            "positions_value": positions_value,
            "realized_pnl": realized_pnl,
            "unrealized_pnl": unrealized,
            "timestamp": now.isoformat(),
            "fill_id": last_fill.get("fill_id") if last_fill else None,
        }
        digest = hashlib.sha256(str(hash_payload).encode("utf-8")).hexdigest()

        ledger_doc = {
            "_id": ObjectId(),
            **hash_payload,
            "hash": digest,
        }

        with mongo_client() as client:
            db = client[get_database_name()]
            db[LEDGER_COLLECTION].insert_one(ledger_doc)

        return LedgerSnapshot(
            mode=mode,
            wallet_balance=float(wallet_balance),
            positions_value=float(positions_value),
            realized_pnl=float(realized_pnl),
            unrealized_pnl=float(unrealized),
            timestamp=now if isinstance(now, datetime) else _utcnow(),
            hash=digest,
        )

    # ------------------------------------------------------------------ #
    # Utilities
    # ------------------------------------------------------------------ #
    def reconciliation_report(self, *, modes: Optional[Iterable[str]] = None) -> Dict[str, Any]:
        modes_to_check = list(modes or self.default_wallets.keys())
        report: Dict[str, Any] = {
            "generated_at": _utcnow().isoformat(),
            "modes": [],
        }
        with mongo_client() as client:
            db = client[get_database_name()]
            for mode in modes_to_check:
                latest_wallet = self.get_wallet_balance(mode)
                last_ledger = (
                    db[LEDGER_COLLECTION]
                    .find({"mode": mode})
                    .sort("timestamp", -1)
                    .limit(1)
                )
                ledger_doc = next(iter(last_ledger), None)
                last_hash = ledger_doc.get("hash") if ledger_doc else None
                unresolved = list(
                    db[FILLS_COLLECTION].find({"mode": mode, "reconciled": {"$ne": True}})
                )
                report["modes"].append(
                    {
                        "mode": mode,
                        "wallet_balance": float(latest_wallet),
                        "last_hash": last_hash,
                        "pending_fills": len(unresolved),
                    }
                )
        return report

    @staticmethod
    def _serialise_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
        payload = {**doc}
        if "_id" in payload:
            payload["_id"] = str(payload["_id"])
        for key, value in list(payload.items()):
            if isinstance(value, datetime):
                payload[key] = value.isoformat()
        return payload

"""Ledger, settlement, and accounting utilities for Phase 5 trading."""
