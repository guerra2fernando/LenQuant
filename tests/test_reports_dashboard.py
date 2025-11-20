from __future__ import annotations

from datetime import datetime

import pandas as pd

from reports import evaluation_dashboard


def test_generate_dashboard_creates_file(tmp_path) -> None:
    metadata = {
        "model_id": "rf_1h_demo",
        "algorithm": "RandomForestRegressor",
        "symbol": "BTC/USD",
        "horizon": "1h",
        "train_start": "2025-10-01T00:00:00Z",
        "train_end": "2025-11-01T00:00:00Z",
    }
    metrics = {
        "val": {"rmse": 0.1, "mae": 0.05, "directional_accuracy": 0.6},
        "test": {"rmse": 0.12, "mae": 0.06, "directional_accuracy": 0.58},
    }
    shap_summary = [
        {"feature": "feat_a", "importance": 0.8},
        {"feature": "feat_b", "importance": 0.4},
    ]

    csv_path = tmp_path / "predictions.csv"
    pd.DataFrame(
        [
            {"timestamp": datetime.utcnow(), "prediction": 0.01, "actual": 0.02},
            {"timestamp": datetime.utcnow(), "prediction": -0.01, "actual": -0.015},
        ]
    ).to_csv(csv_path, index=False)

    # Redirect output directory to tmp path
    original_output_dir = evaluation_dashboard.OUTPUT_DIR
    evaluation_dashboard.OUTPUT_DIR = tmp_path

    try:
        output_path = evaluation_dashboard.generate_dashboard(metadata, metrics, shap_summary, str(csv_path))
    finally:
        evaluation_dashboard.OUTPUT_DIR = original_output_dir

    content = output_path.read_text()
    assert "Model Evaluation — rf_1h_demo" in content
    assert "Top SHAP Features" in content
    assert "Recent Predictions" in content

