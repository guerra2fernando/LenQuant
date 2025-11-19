"""Training entrypoint for horizon-specific return forecasting models."""
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

from db.client import get_feature_df, get_ohlcv_df
from models import model_utils, registry
from reports.evaluation_dashboard import generate_dashboard

try:
    import lightgbm as lgb

    HAS_LIGHTGBM = True
except ImportError:  # pragma: no cover - optional dependency
    HAS_LIGHTGBM = False

try:  # pragma: no cover - optional dependency
    import shap  # type: ignore

    HAS_SHAP = True
except ImportError:  # pragma: no cover
    HAS_SHAP = False


DEFAULT_CONFIG: Dict[str, Dict[str, int | str]] = {
    "1m": {"lookahead": 1, "interval": "1m"},
    "5m": {"lookahead": 5, "interval": "1m"},
    "15m": {"lookahead": 15, "interval": "1m"},
    "1h": {"lookahead": 1, "interval": "1h"},
    "4h": {"lookahead": 4, "interval": "1h"},
    "1d": {"lookahead": 1, "interval": "1d"},
}


def build_dataset(symbol: str, horizon: str, train_window_days: int | None) -> Tuple[pd.DataFrame, pd.Series]:
    if horizon not in DEFAULT_CONFIG:
        raise KeyError(f"Unsupported horizon {horizon}. Known horizons: {', '.join(DEFAULT_CONFIG.keys())}")

    cfg = DEFAULT_CONFIG[horizon]
    interval = cfg["interval"]
    lookahead = int(cfg["lookahead"])

    feature_df = get_feature_df(symbol, interval)
    price_df = get_ohlcv_df(symbol, interval)

    if feature_df.empty or price_df.empty:
        raise RuntimeError(f"Missing data: features ({len(feature_df)}) or prices ({len(price_df)}) for {symbol} {interval}")

    merged = feature_df.join(price_df["close"], how="inner")
    merged.sort_index(inplace=True)
    merged["target"] = (merged["close"].shift(-lookahead) / merged["close"]) - 1.0
    merged.dropna(inplace=True)

    if train_window_days:
        cutoff = merged.index.max() - pd.Timedelta(days=train_window_days)
        merged = merged.loc[merged.index >= cutoff]

    feature_cols = [col for col in merged.columns if col not in {"close", "target"}]
    X = merged[feature_cols]
    y = merged["target"]
    return X, y


def time_based_split(X: pd.DataFrame, y: pd.Series, val_ratio: float = 0.1, test_ratio: float = 0.1) -> Dict[str, pd.DataFrame | pd.Series]:
    """Split data chronologically for time-series forecasting.
    
    Args:
        X: Feature dataframe
        y: Target series
        val_ratio: Proportion of data for validation
        test_ratio: Proportion of data for testing
    
    Returns:
        Dictionary with train/val/test splits
    """
    n = len(X)
    if n < 100:
        raise RuntimeError(f"Dataset too small for split: {n} rows")

    test_size = max(int(n * test_ratio), 1)
    val_size = max(int(n * val_ratio), 1)
    train_size = n - val_size - test_size
    if train_size <= 0:
        raise RuntimeError("Not enough data for requested splits")

    split_points = {
        "train_end": train_size,
        "val_end": train_size + val_size,
    }

    X_train = X.iloc[: split_points["train_end"]]
    y_train = y.iloc[: split_points["train_end"]]

    X_val = X.iloc[split_points["train_end"] : split_points["val_end"]]
    y_val = y.iloc[split_points["train_end"] : split_points["val_end"]]

    X_test = X.iloc[split_points["val_end"] :]
    y_test = y.iloc[split_points["val_end"] :]

    return {
        "X_train": X_train,
        "y_train": y_train,
        "X_val": X_val,
        "y_val": y_val,
        "X_test": X_test,
        "y_test": y_test,
    }


def regime_based_split(
    X: pd.DataFrame,
    y: pd.Series,
    train_regimes: list[str] | None = None,
    test_regimes: list[str] | None = None,
    val_ratio: float = 0.15,
) -> Dict[str, pd.DataFrame | pd.Series]:
    """Split data based on market regime for regime-specific model training.
    
    Example: Train on trending periods, test on ranging periods to evaluate
    how well the model generalizes across regime changes.
    
    Args:
        X: Feature dataframe (must include 'regime_trend' column)
        y: Target series
        train_regimes: List of regime values for training (e.g., ['TRENDING_UP', 'TRENDING_DOWN'])
        test_regimes: List of regime values for testing (e.g., ['SIDEWAYS'])
        val_ratio: Proportion of training data for validation
    
    Returns:
        Dictionary with train/val/test splits filtered by regime
    
    Raises:
        RuntimeError: If regime column missing or insufficient data
    """
    if "regime_trend" not in X.columns:
        raise RuntimeError("regime_trend column required for regime-based splits")
    
    # Default: train on trending, test on sideways
    if train_regimes is None:
        train_regimes = ["TRENDING_UP", "TRENDING_DOWN"]
    if test_regimes is None:
        test_regimes = ["SIDEWAYS"]
    
    # Filter data by regime
    train_mask = X["regime_trend"].isin(train_regimes)
    test_mask = X["regime_trend"].isin(test_regimes)
    
    X_train_full = X[train_mask]
    y_train_full = y[train_mask]
    X_test = X[test_mask]
    y_test = y[test_mask]
    
    # Check for sufficient data
    if len(X_train_full) < 100:
        raise RuntimeError(f"Insufficient training data: {len(X_train_full)} rows (need >= 100)")
    if len(X_test) < 20:
        raise RuntimeError(f"Insufficient test data: {len(X_test)} rows (need >= 20)")
    
    # Split training into train/val chronologically
    val_size = max(int(len(X_train_full) * val_ratio), 1)
    train_size = len(X_train_full) - val_size
    
    X_train = X_train_full.iloc[:train_size]
    y_train = y_train_full.iloc[:train_size]
    X_val = X_train_full.iloc[train_size:]
    y_val = y_train_full.iloc[train_size:]
    
    return {
        "X_train": X_train,
        "y_train": y_train,
        "X_val": X_val,
        "y_val": y_val,
        "X_test": X_test,
        "y_test": y_test,
    }


def evaluate_predictions(y_true: pd.Series, y_pred: np.ndarray) -> Dict[str, float]:
    rmse = mean_squared_error(y_true, y_pred, squared=False)
    mae = mean_absolute_error(y_true, y_pred)
    true_direction = np.asarray(y_true) >= 0
    pred_direction = np.asarray(y_pred) >= 0
    directional_accuracy = float((true_direction == pred_direction).mean())
    return {
        "rmse": float(rmse),
        "mae": float(mae),
        "directional_accuracy": directional_accuracy,
    }


def train_random_forest(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame,
    y_val: pd.Series,
    X_test: pd.DataFrame,
) -> Tuple[RandomForestRegressor, Dict[str, float], np.ndarray]:
    model = RandomForestRegressor(
        n_estimators=400,
        max_depth=12,
        min_samples_leaf=4,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    val_preds = model.predict(X_val)
    val_metrics = evaluate_predictions(y_val, val_preds)
    test_preds = model.predict(X_test)
    return model, val_metrics, test_preds


def train_lightgbm(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame,
    y_val: pd.Series,
    X_test: pd.DataFrame,
) -> Tuple[object, Dict[str, float], np.ndarray]:
    if not HAS_LIGHTGBM:  # pragma: no cover
        raise RuntimeError("LightGBM not installed. Install lightgbm or choose --algorithm rf.")

    train_dataset = lgb.Dataset(X_train, label=y_train)
    valid_dataset = lgb.Dataset(X_val, label=y_val, reference=train_dataset)
    params = {
        "objective": "regression",
        "metric": "rmse",
        "learning_rate": 0.03,
        "num_leaves": 64,
        "feature_fraction": 0.8,
        "bagging_fraction": 0.8,
        "bagging_freq": 5,
        "verbose": -1,
    }
    booster = lgb.train(
        params,
        train_dataset,
        num_boost_round=1000,
        valid_sets=[valid_dataset],
        early_stopping_rounds=50,
        verbose_eval=False,
    )
    val_preds = booster.predict(X_val)
    val_metrics = evaluate_predictions(y_val, val_preds)
    test_preds = booster.predict(X_test)
    return booster, val_metrics, test_preds


def compute_feature_importance(model: object, feature_columns: list[str]) -> list[Dict[str, float]]:
    if hasattr(model, "feature_importances_"):
        importances = getattr(model, "feature_importances_")
        try:
            scores = np.asarray(importances, dtype=float)
        except Exception:  # pragma: no cover
            return []
        ranked_idx = np.argsort(scores)[::-1]
        return [
            {"feature": feature_columns[idx], "importance": float(scores[idx])}
            for idx in ranked_idx[: min(len(feature_columns), 20)]
        ]
    return []


def compute_shap_summary(model: object, sample: pd.DataFrame, feature_columns: list[str]) -> list[Dict[str, float]]:
    if not HAS_SHAP or sample.empty:
        return []
    try:  # pragma: no cover - shap can fail in CI
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(sample)
    except Exception:
        return []

    if isinstance(shap_values, list):
        shap_array = np.asarray(shap_values[0])
    else:
        shap_array = np.asarray(shap_values)

    if shap_array.ndim == 3:
        shap_array = shap_array.mean(axis=0)

    if shap_array.ndim != 2 or shap_array.shape[1] != len(feature_columns):
        return []

    mean_abs = np.mean(np.abs(shap_array), axis=0)
    ranked_idx = np.argsort(mean_abs)[::-1]
    top_idx = ranked_idx[: min(len(feature_columns), 20)]
    return [
        {"feature": feature_columns[idx], "importance": float(mean_abs[idx])}
        for idx in top_idx
    ]


def save_json_artifact(model_id: str, suffix: str, payload: Dict) -> Path:
    output_dir = Path("reports/model_eval")
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f"{model_id}_{suffix}.json"
    path.write_text(json.dumps(payload, indent=2, default=float))
    return path


def save_test_predictions(model_id: str, timestamps: pd.Index, y_true: pd.Series, y_pred: np.ndarray) -> Path:
    output_dir = Path("reports/model_eval")
    output_dir.mkdir(parents=True, exist_ok=True)
    payload = pd.DataFrame({"timestamp": timestamps, "actual": y_true, "prediction": y_pred})
    path = output_dir / f"{model_id}_test.csv"
    payload.to_csv(path, index=False)
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description="Train a forecasting model for a specific horizon.")
    parser.add_argument("--symbol", required=True, help="Trading pair symbol, e.g., BTC/USDT")
    parser.add_argument("--horizon", required=True, help="Forecast horizon key, e.g., 1m, 1h, 1d")
    parser.add_argument("--train-window", type=int, default=None, help="Training window in days")
    parser.add_argument(
        "--algorithm",
        choices=["rf", "lgbm"],
        default="rf",
        help="Algorithm to train (RandomForest or LightGBM)",
    )
    parser.add_argument(
        "--promote",
        action="store_true",
        help="Mark the resulting model as production in the registry",
    )
    parser.add_argument(
        "--regime-split",
        action="store_true",
        help="Use regime-based train/test split (train on trending, test on sideways)",
    )
    parser.add_argument(
        "--train-regimes",
        type=str,
        default=None,
        help="Comma-separated list of regimes for training (e.g., TRENDING_UP,TRENDING_DOWN)",
    )
    parser.add_argument(
        "--test-regimes",
        type=str,
        default=None,
        help="Comma-separated list of regimes for testing (e.g., SIDEWAYS)",
    )
    args = parser.parse_args()

    X, y = build_dataset(args.symbol, args.horizon, args.train_window)
    
    # Choose split strategy based on arguments
    if args.regime_split:
        train_regimes = args.train_regimes.split(",") if args.train_regimes else None
        test_regimes = args.test_regimes.split(",") if args.test_regimes else None
        splits = regime_based_split(X, y, train_regimes=train_regimes, test_regimes=test_regimes)
    else:
        splits = time_based_split(X, y)

    algorithm = args.algorithm
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    model_id = f"{algorithm}_{args.horizon}_{timestamp}"

    if algorithm == "rf":
        model, val_metrics, test_preds = train_random_forest(
            splits["X_train"], splits["y_train"], splits["X_val"], splits["y_val"], splits["X_test"]
        )
    else:
        model, val_metrics, test_preds = train_lightgbm(
            splits["X_train"], splits["y_train"], splits["X_val"], splits["y_val"], splits["X_test"]
        )

    test_metrics = evaluate_predictions(splits["y_test"], test_preds)
    metrics = {
        "val": val_metrics,
        "test": test_metrics,
    }

    metadata = {
        "model_id": model_id,
        "symbol": args.symbol,
        "horizon": args.horizon,
        "algorithm": "RandomForestRegressor" if algorithm == "rf" else "LightGBMRegressor",
        "trained_at": datetime.utcnow(),
        "train_start": splits["X_train"].index.min().isoformat(),
        "train_end": splits["X_train"].index.max().isoformat(),
        "feature_columns": list(splits["X_train"].columns),
        "metrics": metrics,
        "artifact_path": "",
        "status": "production" if args.promote else "candidate",
    }

    artifact_path = model_utils.save_model(model, model_id, metadata={"metrics": metrics})
    metadata["artifact_path"] = str(artifact_path)

    feature_columns = metadata["feature_columns"]
    feature_importance = compute_feature_importance(model, feature_columns)
    if feature_importance:
        metadata["feature_importance"] = feature_importance

    sample = splits["X_test"].fillna(0)
    if len(sample) > 200:
        sample = sample.sample(n=200, random_state=42)
    shap_artifact_path: Path | None = None
    shap_summary = compute_shap_summary(model, sample, feature_columns)
    if shap_summary:
        shap_artifact_path = save_json_artifact(model_id, "shap_summary", {"features": shap_summary})
        metadata["shap_summary_artifact"] = str(shap_artifact_path)
        metadata["shap_summary_top_features"] = shap_summary

    test_report_path = save_test_predictions(model_id, splits["y_test"].index, splits["y_test"], test_preds)
    metadata["evaluation_artifact"] = str(test_report_path)

    dashboard_path = generate_dashboard(metadata, metrics, shap_summary, str(test_report_path))
    metadata["evaluation_dashboard"] = str(dashboard_path)

    registry_record = registry.record_model(metadata)

    if args.promote:
        registry.update_model_status(registry_record["_id"], "production")

    summary = {
        "model_id": model_id,
        "artifact_path": str(artifact_path),
        "metrics": metrics,
        "evaluation_artifact": str(test_report_path),
        "feature_importance": feature_importance,
        "shap_summary_artifact": str(shap_artifact_path) if shap_artifact_path else None,
        "registry_id": str(registry_record["_id"]),
    }
    print(json.dumps(summary, indent=2, default=str))


if __name__ == "__main__":
    main()

