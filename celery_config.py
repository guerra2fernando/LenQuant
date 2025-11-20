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

    # Redis-specific connection resilience settings
    broker_transport_options={
        'master_name': 'mymaster',  # For Redis Sentinel (if used)
        'socket_timeout': 30,
        'socket_connect_timeout': 30,
        'socket_keepalive': True,
        'socket_keepalive_options': {'TCP_KEEPIDLE': 60, 'TCP_KEEPINTVL': 30, 'TCP_KEEPCNT': 3},
        'health_check_interval': 30,
        'visibility_timeout': 3600,  # 1 hour - how long before task is considered lost
    },

    # Result backend connection resilience
    result_backend_transport_options={
        'socket_timeout': 30,
        'socket_connect_timeout': 30,
        'socket_keepalive': True,
        'socket_keepalive_options': {'TCP_KEEPIDLE': 60, 'TCP_KEEPINTVL': 30, 'TCP_KEEPCNT': 3},
        'health_check_interval': 30,
    },

    # Task routing
    task_routes={
        # Manager tasks
        "manager.tasks.run_experiment_cycle_task": {"queue": "experiments"},
        "manager.tasks.run_autonomous_evolution": {"queue": "experiments"},
        "manager.tasks.run_daily_reconciliation": {"queue": "maintenance"},
        "manager.tasks.run_data_retention_maintenance": {"queue": "maintenance"},
        "manager.tasks.run_daily_reconciliation_task": {"queue": "maintenance"},
        "manager.tasks.cache_portfolio_snapshot": {"queue": "maintenance"},

        # Data ingest tasks
        "data_ingest.tasks.fetch_recent_data": {"queue": "data"},
        "data_ingest.tasks.ingest_symbol_interval": {"queue": "data"},
        "data_ingest.tasks.batch_ingest": {"queue": "data"},
        "data_ingest.tasks.backfill_gaps": {"queue": "data"},

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

        # Gap detection and backfilling - runs daily at 3 AM
        'backfill-gaps': {
            'task': 'data_ingest.tasks.backfill_gaps',
            'schedule': crontab(hour=3, minute=0),  # Daily at 3:00 AM
        },

        # Portfolio snapshot caching - runs every 10 seconds (Phase 4)
        'cache-portfolio-every-10-seconds': {
            'task': 'manager.tasks.cache_portfolio_snapshot',
            'schedule': 10.0,  # Every 10 seconds
            'options': {
                'queue': 'maintenance',
                'expires': 15,  # Expire if not executed within 15 seconds
            },
        },
    },

    # Beat configuration
    beat_schedule_filename='celerybeat-schedule',
    beat_max_loop_interval=300,  # 5 minutes

    # Timezone (optional, defaults to UTC)
    timezone='UTC',

    # Worker settings for better resilience
    worker_prefetch_multiplier=1,  # Prevent task starvation
    worker_max_tasks_per_child=1000,  # Restart worker processes periodically
    worker_disable_rate_limits=False,

    # Task settings
    task_acks_late=True,  # Tasks are acknowledged after completion
    task_reject_on_worker_lost=True,  # Re-queue tasks if worker dies
)

# Import all task modules to ensure they are registered
# This is critical for task discovery by workers
import data_ingest.tasks  # noqa: E402
import features.tasks  # noqa: E402
import manager.tasks  # noqa: E402