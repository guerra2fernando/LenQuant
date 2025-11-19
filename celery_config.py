"""Centralized Celery configuration for all workers and beat."""
from __future__ import annotations

import os
from celery import Celery
from celery.schedules import crontab

# Get configuration from environment variables with sensible defaults
BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", BROKER_URL)

# Create centralized Celery app
celery_app = Celery(
    "cryptotrader",
    broker=BROKER_URL,
    backend=RESULT_BACKEND,
)

# Celery configuration
celery_app.conf.update(
    # Broker connection settings
    broker_connection_retry_on_startup=True,  # Fix for Celery 6.0+ deprecation warning

    # Task routing
    task_routes={
        # Manager tasks
        "manager.tasks.run_experiment_cycle_task": {"queue": "experiments"},
        "manager.tasks.run_autonomous_evolution": {"queue": "experiments"},
        "manager.tasks.run_daily_reconciliation": {"queue": "maintenance"},
        "manager.tasks.run_data_retention_maintenance": {"queue": "maintenance"},
        "manager.tasks.run_daily_reconciliation_task": {"queue": "maintenance"},

        # Data ingest tasks
        "data_ingest.tasks.fetch_recent_data": {"queue": "data"},

        # Feature tasks
        "features.tasks.generate_features": {"queue": "data"},
    },

    # Beat schedule (for when used with beat)
    beat_schedule={
        # Data retention maintenance - runs daily at 2 AM
        'data-retention-maintenance': {
            'task': 'manager.tasks.run_data_retention_maintenance_task',
            'schedule': crontab(hour=2, minute=0),  # Daily at 2:00 AM
        },

        # Learning cycle - runs every 4 hours
        'intraday-learning-cycle': {
            'task': 'manager.tasks.run_autonomous_evolution',
            'schedule': crontab(minute=0, hour='*/4'),  # Every 4 hours
        },

        # Daily reconciliation - runs daily at 6 AM
        'daily-reconciliation': {
            'task': 'manager.tasks.run_daily_reconciliation_task',
            'schedule': crontab(hour=6, minute=0),  # Daily at 6:00 AM
        },

        # Data fetching - runs every hour
        'hourly-data-fetch': {
            'task': 'data_ingest.tasks.fetch_recent_data',
            'schedule': crontab(minute=0, hour='*'),  # Every hour
        },

        # Feature generation - runs every 2 hours
        'feature-generation': {
            'task': 'features.tasks.generate_features',
            'schedule': crontab(minute=0, hour='*/2'),  # Every 2 hours
        },
    },

    # Beat configuration
    beat_schedule_filename='celerybeat-schedule',
    beat_max_loop_interval=300,  # 5 minutes

    # Timezone (optional, defaults to UTC)
    timezone='UTC',
)
