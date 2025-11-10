from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from db.client import get_database_name, mongo_client
from learning import ARTIFACTS_DIR
from learning.repository import (
    DEFAULT_LEARNING_SETTINGS,
    get_learning_settings,
    latest_meta_model,
    record_meta_model,
)
from strategy_genome.encoding import normalize_params


class MetaModelNotFoundError(RuntimeError):
    """Raised when predictions are requested but no trained meta-model exists."""


class MetaModelTrainingError(RuntimeError):
    """Raised when the meta-model training loop cannot complete successfully."""


@dataclass
class MetaModelBundle:
    model: RandomForestRegressor
    feature_columns: List[str]
    metadata: Dict[str, Any]


@dataclass
class MetaModelTrainingResult:
    metadata: Dict[str, Any]
    artifact_path: str
    feature_columns: List[str]
    metrics: Dict[str, float]
    feature_importances: List[Dict[str, float]]
    sample_count: int


NUMERIC_KEYS = {"pnl", "roi", "sharpe", "max_drawdown", "forecast_alignment", "stability"}
FITNESS_NUMERIC_KEYS = {"roi", "sharpe", "max_drawdown", "forecast_alignment", "stability", "composite"}


def _fetch_sim_runs(limit: Optional[int] = None) -> List[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        cursor = db["sim_runs"].find({"results.roi": {"$exists": True}}).sort("created_at", 1)
        if limit:
            cursor = cursor.limit(limit)
        runs = list(cursor)
    return runs


def _flatten_genome(genome: Dict[str, Any]) -> Dict[str, float]:
    params = genome.get("params", {}) or {}
    normalized = normalize_params(params)
    features: Dict[str, float] = {}
    for key, value in normalized.items():
        features[f"param_{key}"] = float(value)
    features["generation"] = float(genome.get("generation", 0))
    features["uses_forecast"] = 1.0 if genome.get("uses_forecast", True) else 0.0
    features["forecast_weight"] = float(
        genome.get("forecast_weight", normalized.get("forecast_weight", 0.0))
    )
    fitness = genome.get("fitness", {}) or {}
    for key in FITNESS_NUMERIC_KEYS:
        if key in fitness:
            try:
                features[f"fitness_{key}"] = float(fitness[key])
            except (TypeError, ValueError):
                features[f"fitness_{key}"] = 0.0
    features["param_count"] = float(len(normalized))
    return features


def _metrics_features(metrics: Dict[str, Any]) -> Dict[str, float]:
    features: Dict[str, float] = {}
    for key in NUMERIC_KEYS:
        value = metrics.get(key)
        if value is None:
            continue
        try:
            features[f"prev_{key}"] = float(value)
        except (TypeError, ValueError):
            features[f"prev_{key}"] = 0.0
    return features


def _build_feature_row(
    genome: Dict[str, Any],
    previous_metrics: Dict[str, Any],
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, float]:
    features = {}
    features.update(_flatten_genome(genome))
    features.update(_metrics_features(previous_metrics))
    features["prev_trade_count"] = float(previous_metrics.get("trade_count") or len(previous_metrics.get("trades", [])) or 0)
    features["prev_roi_positive"] = 1.0 if previous_metrics.get("roi", 0.0) > 0 else 0.0
    features["prev_sharpe_positive"] = 1.0 if previous_metrics.get("sharpe", 0.0) > 0 else 0.0
    if extra:
        for key, value in extra.items():
            try:
                features[key] = float(value)
            except (TypeError, ValueError):
                continue
    return features


def _collect_training_samples(train_window_runs: Optional[int]) -> Tuple[List[Dict[str, float]], List[float]]:
    runs = _fetch_sim_runs()
    previous_by_strategy: Dict[str, Dict[str, Any]] = {}
    feature_rows: List[Dict[str, float]] = []
    targets: List[float] = []

    for run in runs:
        strategy_id = run.get("strategy")
        metrics = run.get("results") or {}
        if strategy_id is None or not metrics:
            continue
        previous_metrics = previous_by_strategy.get(strategy_id)
        if not previous_metrics:
            previous_by_strategy[strategy_id] = {**metrics}
            continue

        genome_doc = run.get("genome") or {}
        feature_row = _build_feature_row(genome_doc, previous_metrics)
        feature_rows.append(feature_row)
        targets.append(float(metrics.get("roi", 0.0)))
        previous_by_strategy[strategy_id] = {**metrics}

    if train_window_runs and train_window_runs > 0 and len(feature_rows) > train_window_runs:
        feature_rows = feature_rows[-train_window_runs:]
        targets = targets[-train_window_runs:]

    return feature_rows, targets


def _train_random_forest(
    X_train: np.ndarray,
    y_train: np.ndarray,
    *,
    n_estimators: int,
    max_depth: Optional[int],
    min_samples_leaf: int,
) -> RandomForestRegressor:
    model = RandomForestRegressor(
        n_estimators=n_estimators,
        max_depth=max_depth,
        min_samples_leaf=min_samples_leaf,
        n_jobs=-1,
        random_state=42,
    )
    model.fit(X_train, y_train)
    return model


def _artifact_name() -> str:
    return f"meta_model_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.joblib"


def train_meta_model(settings: Optional[Dict[str, Any]] = None) -> MetaModelTrainingResult:
    config = settings or get_learning_settings().get("meta_model", DEFAULT_LEARNING_SETTINGS["meta_model"])
    train_window = int(config.get("train_window_runs", 0) or 0)
    min_samples = int(config.get("min_samples", 50))

    feature_rows, targets = _collect_training_samples(train_window)
    if len(feature_rows) < max(min_samples, 5):
        raise MetaModelTrainingError(
            f"Insufficient training samples for meta-model (required {min_samples}, observed {len(feature_rows)})."
        )

    feature_frame = pd.DataFrame(feature_rows)
    feature_frame.fillna(0.0, inplace=True)
    feature_columns = sorted(feature_frame.columns.tolist())
    X = feature_frame[feature_columns].to_numpy(dtype=float)
    y = np.asarray(targets, dtype=float)

    test_size = max(1, int(round(len(feature_rows) * 0.2)))
    split_index = len(feature_rows) - test_size
    X_train, X_test = X[:split_index], X[split_index:]
    y_train, y_test = y[:split_index], y[split_index:]

    model = _train_random_forest(
        X_train,
        y_train,
        n_estimators=int(config.get("n_estimators", 300)),
        max_depth=config.get("max_depth"),
        min_samples_leaf=int(config.get("min_samples_leaf", 2)),
    )

    train_predictions = model.predict(X_train)
    test_predictions = model.predict(X_test)

    metrics = {
        "train_rmse": float(mean_squared_error(y_train, train_predictions, squared=False)),
        "test_rmse": float(mean_squared_error(y_test, test_predictions, squared=False)),
        "test_mae": float(mean_absolute_error(y_test, test_predictions)),
        "test_r2": float(r2_score(y_test, test_predictions)) if len(y_test) > 1 else 0.0,
        "sample_count": int(len(feature_rows)),
    }

    importances: List[Dict[str, float]] = []
    if hasattr(model, "feature_importances_"):
        for col, value in sorted(
            zip(feature_columns, model.feature_importances_), key=lambda item: item[1], reverse=True
        ):
            importances.append({"feature": col, "importance": float(value)})

    artifact_name = _artifact_name()
    artifact_path = ARTIFACTS_DIR / artifact_name
    artifact_payload = {
        "model": model,
        "feature_columns": feature_columns,
        "trained_at": datetime.utcnow(),
        "metrics": metrics,
    }
    joblib.dump(artifact_payload, artifact_path)

    metadata = record_meta_model(
        {
            "model_id": artifact_name.replace(".joblib", ""),
            "artifact_path": artifact_name,
            "algorithm": config.get("algorithm", "random_forest"),
            "feature_columns": feature_columns,
            "metrics": metrics,
            "feature_importances": importances,
            "sample_count": len(feature_rows),
        }
    )

    return MetaModelTrainingResult(
        metadata=metadata,
        artifact_path=str(artifact_path),
        feature_columns=feature_columns,
        metrics=metrics,
        feature_importances=importances,
        sample_count=len(feature_rows),
    )


def _load_artifact(path: Path) -> MetaModelBundle:
    payload = joblib.load(path)
    model = payload["model"]
    feature_columns = payload["feature_columns"]
    metadata = {
        "trained_at": payload.get("trained_at"),
        "metrics": payload.get("metrics"),
    }
    return MetaModelBundle(model=model, feature_columns=feature_columns, metadata=metadata)


def load_latest_meta_model() -> MetaModelBundle:
    metadata = latest_meta_model()
    if not metadata:
        raise MetaModelNotFoundError("No trained meta-model available.")
    artifact_path = metadata.get("artifact_path")
    path = Path(artifact_path)
    if not path.is_absolute():
        path = ARTIFACTS_DIR / artifact_path
    bundle = _load_artifact(path)
    bundle.metadata.update(metadata)
    return bundle


def build_feature_vector(
    genome: Dict[str, Any],
    previous_metrics: Optional[Dict[str, Any]] = None,
    *,
    feature_columns: Optional[Iterable[str]] = None,
) -> Dict[str, float]:
    features = _flatten_genome(genome or {})
    previous_metrics = previous_metrics or {}
    features.update(_metrics_features(previous_metrics))
    features["prev_trade_count"] = float(previous_metrics.get("trade_count") or 0.0)
    features["prev_roi_positive"] = 1.0 if previous_metrics.get("roi", 0.0) > 0 else 0.0
    features["prev_sharpe_positive"] = 1.0 if previous_metrics.get("sharpe", 0.0) > 0 else 0.0

    if feature_columns:
        for column in feature_columns:
            features.setdefault(column, 0.0)
    return features


def predict_expected_roi(
    genome: Dict[str, Any],
    previous_metrics: Optional[Dict[str, Any]] = None,
    *,
    bundle: Optional[MetaModelBundle] = None,
) -> float:
    bundle = bundle or load_latest_meta_model()
    feature_vector = build_feature_vector(genome, previous_metrics, feature_columns=bundle.feature_columns)
    ordered = [feature_vector.get(col, 0.0) for col in bundle.feature_columns]
    prediction = float(bundle.model.predict(np.array([ordered]))[0])
    return prediction

