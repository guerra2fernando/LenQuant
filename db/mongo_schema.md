# MongoDB Collections — Core Data

## `ohlcv`

```json
{
  "symbol": "BTC/USD",
  "interval": "1m",
  "timestamp": "ISODate",
  "open": 60000.0,
  "high": 60100.0,
  "low": 59900.0,
  "close": 60050.0,
  "volume": 12.34,
  "source": "binance"
}
```

Index: `{ "symbol": 1, "interval": 1, "timestamp": 1 }` (unique)

## `features`

```json
{
  "symbol": "BTC/USD",
  "interval": "1m",
  "timestamp": "ISODate",
  "features": {
    "r_1m": 0.0012,
    "ema_9": 59920.1,
    "rsi_14": 62.3
  }
}
```

Index: `{ "symbol": 1, "interval": 1, "timestamp": 1 }`

## `sim_runs`

```json
{
  "run_id": "run-20251104-001",
  "start": "ISODate",
  "end": "ISODate",
  "strategy": "ema-cross-9-21",
  "account": "virt-01",
  "results": { "pnl": 123.45, "sharpe": 1.2, "max_dd": 0.12 },
  "trades": []
}
```

## `daily_reports`

```json
{
  "date": "2025-11-04",
  "generated_at": "ISODate",
  "summary": "",
  "top_strategies": [],
  "charts": []
}
```

## `models.registry`

```json
{
  "_id": ObjectId,
  "model_id": "rf_1h_20251110",
  "symbol": "BTC/USD",
  "horizon": "1h",
  "algorithm": "RandomForestRegressor",
  "status": "candidate",
  "trained_at": "ISODate",
  "train_start": "ISODate",
  "train_end": "ISODate",
  "feature_columns": ["return_1", "ema_9", "ema_21", "..."],
  "metrics": {
    "val": { "rmse": 0.0012, "mae": 0.0009, "directional_accuracy": 0.56 },
    "test": { "rmse": 0.0013, "mae": 0.0010, "directional_accuracy": 0.54 }
  },
  "artifact_path": "models/artifacts/rf_1h_20251110.joblib",
  "evaluation_artifact": "reports/model_eval/rf_1h_20251110_test.csv"
}
```

