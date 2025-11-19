"""Celery Beat configuration for scheduled tasks."""
from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

# Create Celery app for beat
app = Celery('cryptotrader')

# Configure beat schedule
app.conf.beat_schedule = {
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
}

app.conf.beat_schedule_filename = 'celerybeat-schedule'
app.conf.beat_max_loop_interval = 300  # 5 minutes

# Use Redis as broker and result backend
app.conf.broker_url = 'redis://localhost:6379/0'
app.conf.result_backend = 'redis://localhost:6379/0'

# Task routing
app.conf.task_routes = {
    'manager.tasks.run_data_retention_maintenance_task': {'queue': 'maintenance'},
    'manager.tasks.run_autonomous_evolution': {'queue': 'experiments'},
    'manager.tasks.run_daily_reconciliation_task': {'queue': 'maintenance'},
    'data_ingest.tasks.fetch_recent_data': {'queue': 'data'},
    'features.tasks.generate_features': {'queue': 'data'},
}

if __name__ == '__main__':
    # Run beat when executed directly
    app.start(['beat', '--loglevel=info'])
