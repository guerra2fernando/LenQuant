"""Seed the database with default symbols."""
from __future__ import annotations

import os
from typing import List

from db.client import get_database_name, mongo_client


def _default_symbols() -> List[str]:
    raw = os.getenv("DEFAULT_SYMBOLS", "BTC/USDT,ETH/USDT")
    return [item.strip() for item in raw.split(",") if item.strip()]


def seed(symbols: List[str] | None = None) -> int:
    symbols = symbols or _default_symbols()
    with mongo_client() as client:
        db = client[get_database_name()]
        bulk = []
        for symbol in symbols:
            bulk.append(
                {
                    "symbol": symbol,
                    "base_increment": 0.0001,
                    "quote_increment": 0.01,
                    "enabled": True,  # Enable symbols by default
                }
            )
        for symbol_doc in bulk:
            db["symbols"].update_one(
                {"symbol": symbol_doc["symbol"]},
                {
                    "$setOnInsert": symbol_doc,
                    "$set": {"enabled": True}  # Always set enabled on seed
                },
                upsert=True,
            )
    return len(symbols)


if __name__ == "__main__":
    count = seed()
    print(f"Seeded {count} symbols.")

