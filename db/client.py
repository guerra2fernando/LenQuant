"""MongoDB client helpers used across core data modules."""
from __future__ import annotations

import os
from contextlib import contextmanager
from datetime import datetime
from typing import Iterator, List, Optional
from urllib.parse import urlparse, urlunparse

import pandas as pd
from pymongo import MongoClient


def _mongo_uri() -> str:
    return os.getenv("MONGO_URI", "mongodb://localhost:27017/cryptotrader")


def _clean_mongo_uri(uri: str) -> str:
    """
    Remove database name from MongoDB URI to avoid parsing issues.
    Returns URI without database name in path, preserving query params.
    """
    parsed = urlparse(uri)
    # Remove database name from path (keep only the leading /)
    clean_path = "/"
    # Reconstruct URI without database name
    clean_uri = urlunparse((
        parsed.scheme,
        parsed.netloc,
        clean_path,
        parsed.params,
        parsed.query,
        parsed.fragment
    ))
    return clean_uri


@contextmanager
def mongo_client() -> Iterator[MongoClient]:
    # Clean URI to remove database name from path (prevents issues with query params)
    uri = _mongo_uri()
    clean_uri = _clean_mongo_uri(uri)
    client = MongoClient(clean_uri)
    try:
        yield client
    finally:
        client.close()


def get_database_name(default: str = "cryptotrader") -> str:
    """
    Return the database name from MONGO_URI, stripping any query params
    (e.g. ?authSource=admin) so we don't accidentally treat them as part
    of the DB name (which was creating databases like
    "lenquant?authSource=ad").
    """
    uri = _mongo_uri()
    parsed = urlparse(uri)
    # parsed.path includes a leading '/', e.g. '/lenquant'
    path = parsed.path.lstrip("/")
    if not path:
        return default
    # If there are extra path segments, take the first one
    return path.split("/", 1)[0]


def get_ohlcv_df(symbol: str, interval: str, limit: int | None = None) -> pd.DataFrame:
    with mongo_client() as client:
        db = client[get_database_name()]
        cursor = (
            db["ohlcv"]
            .find({"symbol": symbol, "interval": interval})
            .sort("timestamp", 1)
        )
        if limit:
            cursor = cursor.limit(limit)
        records = list(cursor)

    if not records:
        return pd.DataFrame()

    df = pd.DataFrame(records)
    df.set_index("timestamp", inplace=True)
    return df


def write_features(symbol: str, interval: str, timestamp, feature_dict: dict) -> None:
    with mongo_client() as client:
        db = client[get_database_name()]
        db["features"].update_one(
            {"symbol": symbol, "interval": interval, "timestamp": timestamp},
            {"$set": {"features": feature_dict}},
            upsert=True,
        )


def get_feature_df(symbol: str, interval: str, limit: Optional[int] = None) -> pd.DataFrame:
    with mongo_client() as client:
        db = client[get_database_name()]
        cursor = (
            db["features"]
            .find({"symbol": symbol, "interval": interval})
            .sort("timestamp", 1)
        )
        if limit:
            cursor = cursor.limit(limit)
        records: List[dict] = list(cursor)

    if not records:
        return pd.DataFrame()

    rows = []
    for rec in records:
        feature_values = rec.get("features", {})
        feature_values = feature_values if isinstance(feature_values, dict) else {}
        rows.append({"timestamp": rec["timestamp"], **feature_values})

    df = pd.DataFrame(rows)
    df.set_index("timestamp", inplace=True)
    return df


def get_feature_row(symbol: str, interval: str, timestamp: datetime) -> Optional[dict]:
    with mongo_client() as client:
        db = client[get_database_name()]
        doc = db["features"].find_one(
            {"symbol": symbol, "interval": interval, "timestamp": {"$lte": timestamp}},
            sort=[("timestamp", -1)],
        )
        if not doc:
            return None
        feature_values = doc.get("features", {})
        feature_values = feature_values if isinstance(feature_values, dict) else {}
        return {"timestamp": doc["timestamp"], **feature_values}

