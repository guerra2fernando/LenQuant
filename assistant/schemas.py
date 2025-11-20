from __future__ import annotations

from datetime import date as dt_date, datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, validator


def _utcnow() -> datetime:
    return datetime.utcnow().replace(microsecond=0)


class AssistantQueryContext(BaseModel):
    """Structured query metadata supplied by the UI/backend when asking the assistant."""

    symbol: Optional[str] = Field(default=None, description="Trading pair symbol, e.g. BTC/USD")
    date: Optional[dt_date] = Field(default=None, description="Primary date of interest.")
    strategy_id: Optional[str] = Field(default=None, description="Strategy identifier if scoped.")
    horizon: Optional[str] = Field(default=None, description="Forecast horizon such as 1h.")
    run_id: Optional[str] = Field(default=None, description="Related simulation or live run id.")
    extra: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary additional context.")

    def to_serialisable_dict(self) -> Dict[str, Any]:
        payload = self.dict(exclude_none=True)
        if "date" in payload and isinstance(payload["date"], dt_date):
            payload["date"] = payload["date"].isoformat()
        return payload


class EvidenceItem(BaseModel):
    """Structured evidence artefact retrieved to ground the assistant response."""

    evidence_id: str = Field(..., min_length=3, description="Unique reference id, e.g. sim_runs/run-123")
    kind: Literal[
        "sim_run",
        "report",
        "forecast",
        "model_eval",
        "strategy",
        "knowledge",
        "allocator",
        "overfit_alert",
        "custom",
    ] = Field(..., description="Evidence category to help frontend rendering.")
    title: str = Field(..., min_length=1)
    summary: str = Field(default="", description="Short human readable synopsis.")
    score: float = Field(default=0.0, ge=0.0, description="Relevance score computed during retrieval.")
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @validator("evidence_id")
    def validate_reference(cls, value: str) -> str:
        if "/" not in value:
            raise ValueError("evidence_id must include a namespace prefix, e.g. 'sim_runs/run-123'.")
        return value


class AssistantAnswerPayload(BaseModel):
    """Minimal schema returned to the UI."""

    summary: str = Field(..., min_length=1, description="High level explanation.")
    causes: List[str] = Field(default_factory=list, description="Evidence-backed reasons.")
    actions: List[str] = Field(default_factory=list, description="Suggested next steps.")
    evidence_refs: List[str] = Field(default_factory=list, description="Evidence reference ids.")


class AssistantConversationTurn(BaseModel):
    """Stored audit entry for a Q&A turn."""

    answer_id: str = Field(..., min_length=6)
    user_text: str = Field(..., min_length=1)
    assistant_payload: AssistantAnswerPayload
    retrieved_evidence: List[EvidenceItem] = Field(default_factory=list)
    context: AssistantQueryContext = Field(default_factory=AssistantQueryContext)
    llm_model_id: Optional[str] = Field(default=None)
    provider: str = Field(default="disabled")
    raw_answer: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=_utcnow)
    grounded: bool = Field(default=True)

    def serialise_for_db(self) -> Dict[str, Any]:
        payload = {
            "answer_id": self.answer_id,
            "user_text": self.user_text,
            "assistant_payload": self.assistant_payload.dict(),
            "retrieved_evidence": [item.dict() for item in self.retrieved_evidence],
            "context": self.context.to_serialisable_dict(),
            "llm_model_id": self.llm_model_id,
            "provider": self.provider,
            "raw_answer": self.raw_answer,
            "created_at": self.created_at,
            "grounded": self.grounded,
        }
        return payload


class RecommendationDecision(BaseModel):
    """Decision event recorded for a recommendation."""

    decision: Literal["approve", "reject", "modify", "snooze"]
    user_id: Optional[str] = None
    user_notes: Optional[str] = None
    modified_params: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=_utcnow)

    def serialise_for_db(self) -> Dict[str, Any]:
        payload = self.dict()
        payload["timestamp"] = self.timestamp
        return payload


class TradeRecommendation(BaseModel):
    """Recommendation surfaced to the user for approval."""

    rec_id: str = Field(..., min_length=6)
    symbol: str = Field(..., min_length=3)
    horizon: str = Field(..., min_length=1)
    pred_return: float = Field(..., description="Predicted return as decimal, e.g. 0.012")
    confidence: float = Field(..., ge=0.0, le=1.0)
    recommended_size_usd: float = Field(..., ge=0.0)
    stop_loss_pct: float = Field(..., ge=0.0)
    take_profit_pct: float = Field(..., ge=0.0)
    rationale_summary: str = Field(..., min_length=3)
    evidence_refs: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    status: Literal["pending", "approved", "rejected", "modified", "snoozed"] = Field(default="pending")
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
    decisions: List[RecommendationDecision] = Field(default_factory=list)

    def serialise_for_db(self) -> Dict[str, Any]:
        payload = self.dict()
        payload["created_at"] = self.created_at
        payload["updated_at"] = self.updated_at
        payload["decisions"] = [decision.serialise_for_db() for decision in self.decisions]
        return payload


class AssistantSettings(BaseModel):
    """Persisted assistant configuration accessible via REST."""

    provider: str = Field(default="disabled", description="LLM provider identifier.")
    model: Optional[str] = Field(default=None, description="Model override or version string.")
    redaction_rules: List[str] = Field(default_factory=list)
    max_evidence: int = Field(default=5, ge=1, le=20)
    lookback_days: int = Field(default=7, ge=1, le=90)
    auto_execute: bool = Field(default=False)
    auto_approve_below_usd: float = Field(default=0.0, ge=0.0)
    approval_threshold_usd: float = Field(default=1000.0, ge=0.0)
    require_mfa: bool = Field(default=True)
    notification_channels: List[str] = Field(default_factory=lambda: ["in_app"])
    updated_at: datetime = Field(default_factory=_utcnow)

    def serialise_for_db(self) -> Dict[str, Any]:
        payload = self.dict()
        payload["updated_at"] = self.updated_at
        return payload


