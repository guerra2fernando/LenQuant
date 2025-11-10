"""Assistant Phase 4 utilities: retrieval, explanation, action management."""

from .action_manager import ActionManager
from .explainer import AssistantExplainer
from .llm import generate_assistant_message, get_provider
from .llm_worker import LLMWorker, test_connection as test_llm_connection
from .repository import (
    fetch_conversation,
    get_settings,
    list_conversation_history,
    list_recommendations,
    log_conversation,
    update_settings,
    upsert_recommendation,
)
from .retriever import AssistantRetriever, fetch_evidence_by_reference
from .schemas import (
    AssistantAnswerPayload,
    AssistantConversationTurn,
    AssistantQueryContext,
    AssistantSettings,
    EvidenceItem,
    RecommendationDecision,
    TradeRecommendation,
)

__all__ = [
    "ActionManager",
    "AssistantAnswerPayload",
    "AssistantConversationTurn",
    "AssistantExplainer",
    "AssistantQueryContext",
    "AssistantRetriever",
    "AssistantSettings",
    "EvidenceItem",
    "LLMWorker",
    "RecommendationDecision",
    "TradeRecommendation",
    "fetch_conversation",
    "fetch_evidence_by_reference",
    "generate_assistant_message",
    "get_provider",
    "get_settings",
    "list_conversation_history",
    "list_recommendations",
    "log_conversation",
    "test_llm_connection",
    "update_settings",
    "upsert_recommendation",
]
