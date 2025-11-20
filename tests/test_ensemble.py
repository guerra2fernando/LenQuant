from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

import numpy as np
import pandas as pd
import pytest

from models import ensemble


class StubModel:
    def __init__(self, prediction: float) -> None:
        self._prediction = prediction

    def predict(self, frame: pd.DataFrame) -> np.ndarray:
        assert not frame.empty
        return np.array([self._prediction], dtype=float)


@pytest.fixture(autouse=True)
def clear_model_cache() -> None:
    ensemble.MODEL_CACHE.clear()


def test_ensemble_predict_weighted_average(monkeypatch: pytest.MonkeyPatch) -> None:
    timestamp = datetime.utcnow()

    def fake_feature_vector(symbol: str, horizon: str, ts: datetime) -> pd.DataFrame:
        assert symbol == "BTC/USD"
        assert horizon == "1h"
        assert ts == timestamp
        frame = pd.DataFrame(
            [{"timestamp": timestamp, "feat_a": 1.0, "feat_b": -2.0}],
        ).set_index("timestamp")
        return frame

    def fake_candidate_models(symbol: str, horizon: str) -> List[Dict[str, Any]]:
        return [
            {
                "model_id": "m1",
                "feature_columns": ["feat_a", "feat_b"],
                "metrics": {"test": {"rmse": 1.0}},
            },
            {
                "model_id": "m2",
                "feature_columns": ["feat_a", "feat_b"],
                "metrics": {"test": {"rmse": 2.0}},
            },
        ]

    def fake_load_model(model_id: str) -> StubModel:
        return StubModel(0.01 if model_id == "m1" else 0.03)

    monkeypatch.setattr(ensemble, "_load_feature_vector", fake_feature_vector)
    monkeypatch.setattr(ensemble, "_load_candidate_models", fake_candidate_models)
    monkeypatch.setattr(ensemble, "_load_model", fake_load_model)

    result = ensemble.ensemble_predict("BTC/USD", "1h", timestamp)

    expected = (0.01 * (1 / (1 + 1e-6)) + 0.03 * (1 / (2 + 1e-6))) / (
        1 / (1 + 1e-6) + 1 / (2 + 1e-6)
    )
    assert pytest.approx(result["predicted_return"], rel=1e-6) == expected
    assert result["confidence"] > 0
    assert result["models"]
    assert result["symbol"] == "BTC/USD"
    assert result["horizon"] == "1h"

