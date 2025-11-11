"""Redis-backed feature cache utilities for intraday pipelines."""
from __future__ import annotations

import os
import pickle
import zlib
from dataclasses import dataclass
from typing import Optional

import pandas as pd
from redis import Redis
from redis.exceptions import RedisError


def _redis_url() -> str:
    return os.getenv("REDIS_URL", "redis://localhost:6379/0")


@dataclass
class FeatureCache:
    """Caches short-horizon feature frames in Redis."""

    namespace: str = "lenxys:features"
    ttl_seconds: int = 1_800
    _client: Optional[Redis] = None

    def _client_or_none(self) -> Optional[Redis]:
        if self._client is not None:
            return self._client
        try:
            self._client = Redis.from_url(_redis_url(), decode_responses=False)
        except RedisError:
            self._client = None
        return self._client

    def _key(self, symbol: str, interval: str) -> str:
        return f"{self.namespace}:{symbol}:{interval}"

    def get_frame(self, symbol: str, interval: str) -> Optional[pd.DataFrame]:
        client = self._client_or_none()
        if client is None:
            return None
        try:
            payload = client.get(self._key(symbol, interval))
            if not payload:
                return None
            frame = pickle.loads(zlib.decompress(payload))
            if isinstance(frame, pd.DataFrame):
                return frame
        except (RedisError, pickle.PickleError, zlib.error):
            return None
        return None

    def set_frame(self, symbol: str, interval: str, frame: pd.DataFrame) -> None:
        client = self._client_or_none()
        if client is None:
            return
        try:
            payload = zlib.compress(pickle.dumps(frame, protocol=pickle.HIGHEST_PROTOCOL))
            client.set(self._key(symbol, interval), payload, ex=self.ttl_seconds)
        except RedisError:
            return

    def invalidate(self, symbol: str, interval: str) -> None:
        client = self._client_or_none()
        if client is None:
            return
        try:
            client.delete(self._key(symbol, interval))
        except RedisError:
            return

    def invalidate_all(self) -> None:
        client = self._client_or_none()
        if client is None:
            return
        try:
            for key in client.scan_iter(match=f"{self.namespace}:*"):
                client.delete(key)
        except RedisError:
            return


GLOBAL_FEATURE_CACHE = FeatureCache()
