"""
LenQuant Chrome Extension Integration Module.

Provides real-time trading assistance for Binance Futures via Chrome extension.

Key components:
- ExtensionAnalyzer: Fast path market analysis
- BehaviorAnalyzer: Trading behavior pattern detection
- JournalRepository: Event logging and retrieval
- BinanceSyncService: Binance trade reconciliation
- ReportGenerator: Daily/weekly/monthly reports
"""

from .analyzer import ExtensionAnalyzer, FastAnalysisResult
from .behavior import BehaviorAnalyzer, BehaviorAlert
from .journal import JournalRepository
from .sync import BinanceSyncService, SyncError, create_sync_service
from .reports import ReportGenerator
from .schemas import (
    ContextPayload,
    FastAnalysisResponse,
    ExplainRequest,
    ExplainResponse,
    JournalEvent,
    TradePlan,
)

__all__ = [
    # Phase 1
    "ExtensionAnalyzer",
    "FastAnalysisResult",
    # Phase 4
    "JournalRepository",
    # Phase 5
    "BinanceSyncService",
    "SyncError",
    "create_sync_service",
    # Phase 6
    "BehaviorAnalyzer",
    "BehaviorAlert",
    # Phase 7
    "ReportGenerator",
    # Schemas
    "ContextPayload",
    "FastAnalysisResponse",
    "ExplainRequest",
    "ExplainResponse",
    "JournalEvent",
    "TradePlan",
]

