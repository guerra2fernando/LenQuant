from __future__ import annotations

from typing import Any, Dict

from celery_config import celery_app

from evolution.engine import EvolutionEngine
from exec.settlement import SettlementEngine
from knowledge.base import KnowledgeBaseService
from manager.experiment_runner import ExperimentRequest, run_experiment_cycle
from data_ingest.retention import run_data_retention_maintenance

_evolution_engine = EvolutionEngine(knowledge_service=KnowledgeBaseService())


@celery_app.task(name="manager.tasks.run_experiment_cycle_task", bind=True)
def run_experiment_cycle_task(self, request_payload: Dict[str, Any]) -> Dict[str, Any]:
    request = ExperimentRequest.from_dict(request_payload or {})
    summary = run_experiment_cycle(request)
    return summary


@celery_app.task(name="manager.tasks.run_autonomous_evolution", bind=True)
def run_autonomous_evolution(self) -> Dict[str, Any]:
    return _evolution_engine.run_cycle()


@celery_app.task(name="manager.tasks.run_daily_reconciliation", bind=True)
def run_daily_reconciliation(self, modes: Any = None) -> Dict[str, Any]:
    """Run daily reconciliation report for trading settlement."""
    settlement = SettlementEngine()
    report = settlement.reconciliation_report(modes=modes)
    return report


@celery_app.task(name="manager.tasks.run_data_retention_maintenance", bind=True)
def run_data_retention_maintenance_task(self) -> Dict[str, Any]:
    """Run automated data retention maintenance to clean up old data."""
    return run_data_retention_maintenance()


@celery_app.task(name="manager.tasks.run_daily_reconciliation_task", bind=True)
def run_daily_reconciliation_task(self, modes: Any = None) -> Dict[str, Any]:
    """Run daily reconciliation report for trading settlement (beat scheduled)."""
    settlement = SettlementEngine()
    report = settlement.reconciliation_report(modes=modes)
    return report

