"""Celery Beat configuration for scheduled tasks."""
from __future__ import annotations

from celery_config import celery_app

# Use the centralized Celery app
app = celery_app

if __name__ == '__main__':
    # Run beat when executed directly
    app.start(['beat', '--loglevel=info'])
