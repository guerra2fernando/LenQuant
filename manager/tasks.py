from __future__ import annotations

import os
from typing import Any, Dict

from celery import Celery

from evolution.engine import EvolutionEngine
from knowledge.base import KnowledgeBaseService
from manager.experiment_runner import ExperimentRequest, run_experiment_cycle

BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", BROKER_URL)
EXPERIMENT_QUEUE = os.getenv("CELERY_EXPERIMENT_QUEUE", "experiments")

celery_app = Celery(
    "lenxys_trader",
    broker=BROKER_URL,
    backend=RESULT_BACKEND,
)

celery_app.conf.task_routes = {
    "manager.tasks.run_experiment_cycle_task": {"queue": EXPERIMENT_QUEUE},
    "manager.tasks.run_autonomous_evolution": {"queue": EXPERIMENT_QUEUE},
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

