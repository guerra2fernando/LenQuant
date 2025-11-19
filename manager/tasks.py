from __future__ import annotations

import os
from typing import Any, Dict

from celery import Celery

from evolution.engine import EvolutionEngine
from exec.settlement import SettlementEngine
from knowledge.base import KnowledgeBaseService
from manager.experiment_runner import ExperimentRequest, run_experiment_cycle
from data_ingest.retention import run_data_retention_maintenance

BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", BROKER_URL)
EXPERIMENT_QUEUE = os.getenv("CELERY_EXPERIMENT_QUEUE", "experiments")

celery_app = Celery(
    "cryptotrader",
    broker=BROKER_URL,
    backend=RESULT_BACKEND,
)

celery_app.conf.task_routes = {
    "manager.tasks.run_experiment_cycle_task": {"queue": EXPERIMENT_QUEUE},
    "manager.tasks.run_autonomous_evolution": {"queue": EXPERIMENT_QUEUE},
    "manager.tasks.run_daily_reconciliation": {"queue": EXPERIMENT_QUEUE},
    "manager.tasks.run_data_retention_maintenance": {"queue": EXPERIMENT_QUEUE},
}

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

