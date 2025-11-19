from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field, validator

from ai import HypothesisAgent
from data_ingest.retention import DataRetentionConfig
from assistant import (
    AssistantSettings,
    get_settings as get_assistant_settings,
    test_llm_connection,
    update_settings as update_assistant_settings,
)
from assistant.llm_worker import LLMWorker, LLMWorkerError
from db.client import get_database_name, mongo_client
from exec.risk_manager import (
    MacroSettings,
    TradingSettings,
    get_macro_settings,
    get_trading_settings,
    save_macro_settings,
    save_trading_settings,
)
from evolution.repository import get_autonomy_settings as get_autonomy_settings_doc
from evolution.repository import update_autonomy_settings as update_autonomy_settings_doc
from learning.repository import get_learning_settings, update_learning_settings
from monitor.trade_alerts import TradeAlertClient
from strategy_genome.repository import DEFAULT_EXPERIMENT_SETTINGS

router = APIRouter()

COLLECTION_NAME = "settings"
MODEL_DOCUMENT_ID = "models_settings"
EXPERIMENT_DOCUMENT_ID = "experiment_settings"

DEFAULT_HORIZON_SETTINGS = [
    {"name": "1m", "train_window_days": 90, "retrain_cadence": "daily", "threshold_pct": 0.001},
    {"name": "1h", "train_window_days": 180, "retrain_cadence": "daily", "threshold_pct": 0.005},
    {"name": "1d", "train_window_days": 365, "retrain_cadence": "weekly", "threshold_pct": 0.02},
]

VALID_CADENCE = {"daily", "weekly", "monthly"}


class HorizonSettings(BaseModel):
    name: str = Field(..., min_length=1)
    train_window_days: int = Field(..., ge=1, le=3650)
    retrain_cadence: str = Field(..., description="Retraining cadence, e.g., daily")
    threshold_pct: float = Field(..., ge=0.0, le=1.0)

    @validator("retrain_cadence")
    def validate_cadence(cls, value: str) -> str:
        cadence = value.lower()
        if cadence not in VALID_CADENCE:
            raise ValueError(f"Unsupported cadence '{value}'. Use one of: {', '.join(sorted(VALID_CADENCE))}.")
        return cadence


class ModelSettingsPayload(BaseModel):
    horizons: List[HorizonSettings]


def _fetch_settings() -> Dict[str, Any]:
    with mongo_client() as client:
        db = client[get_database_name()]
        doc = db[COLLECTION_NAME].find_one({"_id": MODEL_DOCUMENT_ID})
    if not doc:
        return {"horizons": DEFAULT_HORIZON_SETTINGS, "updated_at": None}
    horizons = doc.get("horizons", DEFAULT_HORIZON_SETTINGS)
    updated_at = doc.get("updated_at")
    if hasattr(updated_at, "isoformat"):
        updated_at = updated_at.isoformat()
    return {"horizons": horizons, "updated_at": updated_at}


@router.get("/models")
def get_model_settings() -> Dict[str, Any]:
    return _fetch_settings()


class ExperimentSettingsPayload(BaseModel):
    symbol: str = Field(..., min_length=3)
    interval: str = Field(..., min_length=1)
    accounts: int = Field(..., ge=1, le=200)
    mutations_per_parent: int = Field(..., ge=1, le=20)
    champion_limit: int = Field(..., ge=1, le=20)
    families: List[str] = Field(default_factory=lambda: ["ema-cross"])
    auto_promote_threshold: float = Field(..., ge=0.0, le=10.0)
    min_confidence: float = Field(..., ge=0.0, le=1.0)
    min_return: float = Field(..., ge=0.0, le=0.5)
    max_queue: int = Field(..., ge=1, le=500)

    @validator("families")
    def validate_families(cls, value: List[str]) -> List[str]:
        cleaned = [family.strip() for family in value if family.strip()]
        if not cleaned:
            raise ValueError("At least one strategy family must be provided.")
        return cleaned


def _fetch_experiment_settings() -> Dict[str, Any]:
    with mongo_client() as client:
        db = client[get_database_name()]
        doc = db[COLLECTION_NAME].find_one({"_id": EXPERIMENT_DOCUMENT_ID})
    if not doc:
        return {**DEFAULT_EXPERIMENT_SETTINGS, "updated_at": None}
    payload = {**DEFAULT_EXPERIMENT_SETTINGS, **doc}
    payload.pop("_id", None)
    updated_at = payload.get("updated_at")
    if hasattr(updated_at, "isoformat"):
        payload["updated_at"] = updated_at.isoformat()
    return payload


@router.get("/experiments")
def get_experiment_settings() -> Dict[str, Any]:
    return _fetch_experiment_settings()


class LearningSettingsPayload(BaseModel):
    meta_model: Optional[Dict[str, Any]] = None
    optimizer: Optional[Dict[str, Any]] = None
    allocator: Optional[Dict[str, Any]] = None
    overfit: Optional[Dict[str, Any]] = None
    knowledge: Optional[Dict[str, Any]] = None


class AssistantSettingsPayload(BaseModel):
    provider: Optional[str] = Field(default=None)
    model: Optional[str] = Field(default=None)
    redaction_rules: Optional[List[str]] = None
    max_evidence: Optional[int] = Field(default=None, ge=1, le=20)
    lookback_days: Optional[int] = Field(default=None, ge=1, le=90)
    auto_execute: Optional[bool] = None
    auto_approve_below_usd: Optional[float] = Field(default=None, ge=0.0)
    approval_threshold_usd: Optional[float] = Field(default=None, ge=0.0)
    require_mfa: Optional[bool] = None
    notification_channels: Optional[List[str]] = None

    @validator("provider")
    def validate_provider(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        allowed = {"disabled", "openai", "google", "gemini"}
        if value.lower() not in allowed:
            raise ValueError(f"Unsupported assistant provider '{value}'. Allowed: {sorted(allowed)}")
        return value.lower()


class AutonomySettingsPayload(BaseModel):
    auto_promote: bool = False
    auto_promote_threshold: float = Field(default=0.05, ge=0.0, le=1.0)
    safety_limits: Dict[str, Any] = Field(default_factory=dict)
    knowledge_retention_weeks: int = Field(default=12, ge=1, le=52)
    llm_provider: str = Field(default="disabled")
    llm_model: Optional[str] = None

    @validator("llm_provider")
    def validate_llm_provider(cls, value: str) -> str:
        allowed = {"disabled", "openai", "google", "gemini"}
        provider = value.lower()
        if provider not in allowed:
            raise ValueError(f"Unsupported LLM provider '{value}'. Allowed: {sorted(allowed)}")
        return provider


class AutonomyTestPayload(BaseModel):
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None

class TradingSettingsPayload(BaseModel):
    modes: Optional[Dict[str, Dict[str, Any]]] = None
    paper: Optional[Dict[str, Any]] = None
    alerts: Optional[Dict[str, Any]] = None
    auto_mode: Optional[Dict[str, Any]] = None
    risk: Optional[Dict[str, Any]] = None
    kill_switch: Optional[Dict[str, Any]] = None


class RegimeMultipliersPayload(BaseModel):
    """Payload for updating regime multipliers."""
    TRENDING_UP: Optional[float] = Field(None, ge=0.3, le=2.0)
    TRENDING_DOWN: Optional[float] = Field(None, ge=0.3, le=2.0)
    SIDEWAYS: Optional[float] = Field(None, ge=0.3, le=2.0)
    HIGH_VOLATILITY: Optional[float] = Field(None, ge=0.3, le=2.0)
    LOW_VOLATILITY: Optional[float] = Field(None, ge=0.3, le=2.0)
    NORMAL_VOLATILITY: Optional[float] = Field(None, ge=0.3, le=2.0)
    UNDEFINED: Optional[float] = Field(None, ge=0.3, le=2.0)


class MacroSettingsPayload(BaseModel):
    """Payload for updating macro analysis risk settings."""
    regime_risk_enabled: Optional[bool] = None
    regime_multipliers: Optional[RegimeMultipliersPayload] = None
    regime_cache_ttl_seconds: Optional[int] = Field(None, ge=60)
    alert_on_significant_reduction: Optional[bool] = None
    significant_reduction_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)


class DataRetentionSettingsPayload(BaseModel):
    """Payload for updating data retention settings."""
    tier1_days: Optional[int] = Field(None, ge=30, le=365, description="Days to keep full-resolution data (1m, 1h, 1d)")
    tier2_days: Optional[int] = Field(None, ge=180, le=3650, description="Days to keep medium-resolution data (1h, 1d)")
    tier3_days: Optional[int] = Field(None, ge=365, le=36500, description="Days to keep low-resolution data (1d only)")
    cleanup_interval_hours: Optional[int] = Field(None, ge=1, le=168, description="How often to run cleanup (hours)")


def _fetch_data_retention_settings() -> Dict[str, Any]:
    """Get current data retention settings."""
    config = DataRetentionConfig.from_env()
    return {
        "tier1_days": config.tier1_days,
        "tier2_days": config.tier2_days,
        "tier3_days": config.tier3_days,
        "cleanup_interval_hours": config.cleanup_interval_hours,
        "updated_at": datetime.utcnow().isoformat(),
    }


def _update_data_retention_settings(payload: DataRetentionSettingsPayload) -> Dict[str, Any]:
    """Update data retention settings in environment/database."""
    # For now, store in database settings collection
    # In production, these would be environment variables
    document = payload.dict(exclude_none=True)
    document["updated_at"] = datetime.utcnow()

    with mongo_client() as client:
        db = client[get_database_name()]
        db[COLLECTION_NAME].update_one(
            {"_id": "data_retention_settings"},
            {"$set": document},
            upsert=True,
        )

    return _fetch_data_retention_settings()


@router.get("/learning")
def get_learning_settings_route() -> Dict[str, Any]:
    return get_learning_settings()


@router.put("/learning")
def put_learning_settings_route(payload: LearningSettingsPayload) -> Dict[str, Any]:
    current = get_learning_settings()
    merged = {**current}
    for section in ("meta_model", "optimizer", "allocator", "overfit", "knowledge"):
        value = getattr(payload, section)
        if value is not None:
            merged[section] = {**current.get(section, {}), **value}
    return update_learning_settings(merged)


@router.get("/assistant")
def get_assistant_settings_route() -> Dict[str, Any]:
    return get_assistant_settings()


@router.put("/assistant")
def put_assistant_settings_route(payload: AssistantSettingsPayload) -> Dict[str, Any]:
    current = AssistantSettings(**get_assistant_settings())
    updated = current.dict()
    for field_name, value in payload.dict(exclude_none=True).items():
        updated[field_name] = value
    return update_assistant_settings(updated)


@router.post("/assistant/test-connection")
def post_assistant_test_connection() -> Dict[str, Any]:
    try:
        result = test_llm_connection()
    except LLMWorkerError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "status": "ok",
        "provider": result.provider,
        "model": result.model,
        "raw": result.raw_content,
        "payload": result.json_payload,
    }


@router.get("/autonomy")
def get_autonomy_settings_route() -> Dict[str, Any]:
    return get_autonomy_settings_doc()


@router.put("/autonomy")
def put_autonomy_settings_route(payload: AutonomySettingsPayload) -> Dict[str, Any]:
    stored = update_autonomy_settings_doc(payload.dict())
    stored.pop("_id", None)
    return stored


@router.post("/autonomy/test")
def post_autonomy_test_route(payload: AutonomyTestPayload | None = None) -> Dict[str, Any]:
    settings = get_autonomy_settings_doc()
    if payload:
        if payload.llm_provider is not None:
            settings["llm_provider"] = payload.llm_provider
        if payload.llm_model is not None:
            settings["llm_model"] = payload.llm_model
    worker = LLMWorker(provider=settings.get("llm_provider"), model=settings.get("llm_model"))
    agent = HypothesisAgent(worker=worker)
    sample_evaluations = [
        {"strategy_id": "alpha", "roi": 0.04, "sharpe": 1.3, "max_drawdown": 0.08, "score": 0.9},
        {"strategy_id": "beta", "roi": -0.02, "sharpe": 0.4, "max_drawdown": 0.2, "score": 0.3},
    ]
    try:
        report = agent.analyse(sample_evaluations, [])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "status": "ok",
        "provider": report.provider,
        "summary": report.summary,
        "winners": report.winners,
        "insights": report.insights,
    }


def _merge_dict(base: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
    merged = {**base}
    for key, value in updates.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _merge_dict(merged.get(key, {}), value)
        else:
            merged[key] = value
    return merged


def _serialise_trading(settings: TradingSettings) -> Dict[str, Any]:
    payload = settings.dict()
    payload["updated_at"] = settings.updated_at.isoformat() if settings.updated_at else None
    return jsonable_encoder(payload)


@router.get("/trading")
def get_trading_settings_route() -> Dict[str, Any]:
    settings = get_trading_settings()
    return _serialise_trading(settings)


@router.put("/trading")
def put_trading_settings_route(payload: TradingSettingsPayload) -> Dict[str, Any]:
    current = get_trading_settings()
    data = current.dict()
    if payload.modes:
        modes = data.get("modes", {})
        for mode, config in payload.modes.items():
            modes[mode] = _merge_dict(modes.get(mode, {}), config)
        data["modes"] = modes
    for field in ("paper", "alerts", "auto_mode", "risk", "kill_switch"):
        value = getattr(payload, field)
        if value is not None:
            data[field] = _merge_dict(data.get(field, {}), value)
    updated = save_trading_settings(data)
    return _serialise_trading(updated)


@router.post("/trading/test-alert")
def post_trading_test_alert() -> Dict[str, Any]:
    settings = get_trading_settings()
    client = TradeAlertClient(settings.alerts)
    client.send_alert(title="Trading Alert Test", message="This is a test trading alert.")
    return {"status": "ok"}


@router.put("/experiments")
def put_experiment_settings(payload: ExperimentSettingsPayload) -> Dict[str, Any]:
    document = payload.dict()
    with mongo_client() as client:
        db = client[get_database_name()]
        db[COLLECTION_NAME].update_one(
            {"_id": EXPERIMENT_DOCUMENT_ID},
            {"$set": {**document, "updated_at": datetime.utcnow()}},
            upsert=True,
        )
    return _fetch_experiment_settings()


@router.put("/models")
def put_model_settings(payload: ModelSettingsPayload) -> Dict[str, Any]:
    if not payload.horizons:
        raise HTTPException(status_code=400, detail="At least one horizon must be provided.")

    written = [settings.dict() for settings in payload.horizons]

    with mongo_client() as client:
        db = client[get_database_name()]
        db[COLLECTION_NAME].update_one(
            {"_id": MODEL_DOCUMENT_ID},
            {
                "$set": {
                    "horizons": written,
                    "updated_at": datetime.utcnow(),
                }
            },
            upsert=True,
        )

    return _fetch_settings()


def _serialise_macro(settings: MacroSettings) -> Dict[str, Any]:
    """Serialize MacroSettings for JSON response."""
    payload = settings.dict()
    payload["updated_at"] = settings.updated_at.isoformat() if settings.updated_at else None
    return jsonable_encoder(payload)


@router.get("/macro")
def get_macro_settings_route() -> Dict[str, Any]:
    """Get current macro analysis risk settings.
    
    Returns:
        Dictionary with macro settings including regime multipliers
        
    Example:
        GET /api/settings/macro
    """
    settings = get_macro_settings()
    return _serialise_macro(settings)


@router.put("/macro")
def put_macro_settings_route(payload: MacroSettingsPayload) -> Dict[str, Any]:
    """Update macro analysis risk settings.
    
    Args:
        payload: MacroSettingsPayload with fields to update
        
    Returns:
        Updated macro settings dictionary
        
    Example:
        PUT /api/settings/macro
        {
            "regime_risk_enabled": true,
            "regime_multipliers": {
                "TRENDING_UP": 1.3,
                "HIGH_VOLATILITY": 0.5
            }
        }
    """
    current = get_macro_settings()
    data = current.dict()
    
    # Update top-level fields
    for field in ("regime_risk_enabled", "regime_cache_ttl_seconds", 
                  "alert_on_significant_reduction", "significant_reduction_threshold"):
        value = getattr(payload, field)
        if value is not None:
            data[field] = value
    
    # Update regime multipliers
    if payload.regime_multipliers is not None:
        multipliers_dict = data.get("regime_multipliers", {})
        for field, value in payload.regime_multipliers.dict(exclude_none=True).items():
            multipliers_dict[field] = value
        data["regime_multipliers"] = multipliers_dict
    
    updated = save_macro_settings(data)
    return _serialise_macro(updated)


@router.get("/data-retention")
def get_data_retention_settings_route() -> Dict[str, Any]:
    """Get current data retention settings."""
    return _fetch_data_retention_settings()


@router.put("/data-retention")
def put_data_retention_settings_route(payload: DataRetentionSettingsPayload) -> Dict[str, Any]:
    """Update data retention settings."""
    return _update_data_retention_settings(payload)
