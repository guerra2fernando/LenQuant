"""Utility helpers for model persistence and metadata logging."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

import joblib

from db.client import get_database_name, mongo_client

MODEL_DIR = Path("models/artifacts")
MODEL_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_HORIZON_SETTINGS = [
    {"name": "1m", "train_window_days": 90, "retrain_cadence": "daily", "threshold_pct": 0.001},
    {"name": "1h", "train_window_days": 180, "retrain_cadence": "daily", "threshold_pct": 0.005},
    {"name": "1d", "train_window_days": 365, "retrain_cadence": "weekly", "threshold_pct": 0.02},
]


def save_model(model: Any, name: str, metadata: Dict[str, Any] | None = None) -> Path:
    path = MODEL_DIR / f"{name}.joblib"
    joblib.dump(model, path)
    if metadata:
        meta_path = MODEL_DIR / f"{name}.meta.json"
        meta_path.write_text(json.dumps(metadata, indent=2))
    return path


def load_model(name: str) -> Any:
    path = MODEL_DIR / f"{name}.joblib"
    if not path.exists():
        raise FileNotFoundError(f"Model {name} not found at {path}")
    return joblib.load(path)


def load_horizon_settings() -> List[dict]:
    """
    Load horizon training settings from database or return defaults.
    
    Returns:
        List of horizon configurations with training parameters
    """
    try:
        with mongo_client() as client:
            db = client[get_database_name()]
            doc = db["settings"].find_one({"_id": "models_settings"})
        
        if doc and doc.get("horizons"):
            return list(doc["horizons"])
    except Exception:
        # If database is unavailable or collection doesn't exist, use defaults
        pass
    
    return DEFAULT_HORIZON_SETTINGS

