#!/usr/bin/env bash
# Setup automated cron jobs for LenQuant maintenance tasks
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$PROJECT_ROOT/scripts"
LOG_DIR="$PROJECT_ROOT/logs"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

echo "Setting up cron jobs for LenQuant maintenance..."

# Function to add cron job if it doesn't exist
add_cron_job() {
    local schedule="$1"
    local command="$2"
    local job="$schedule $command"

    # Check if job already exists
    if ! crontab -l 2>/dev/null | grep -F "$command" >/dev/null 2>&1; then
        (crontab -l 2>/dev/null; echo "$job") | crontab -
        echo "Added cron job: $job"
    else
        echo "Cron job already exists: $command"
    fi
}

# Data retention maintenance - runs daily at 2 AM
DATA_RETENTION_JOB="0 2 * * * cd $PROJECT_ROOT && python -m manager.tasks run_data_retention_maintenance >> $LOG_DIR/data_retention.log 2>&1"

# Learning cycle - runs every 4 hours
LEARNING_JOB="0 */4 * * * cd $PROJECT_ROOT && python -m manager.tasks run_intraday_learning_cycle >> $LOG_DIR/learning.log 2>&1"

# Daily reconciliation - runs daily at 6 AM
RECONCILIATION_JOB="0 6 * * * cd $PROJECT_ROOT && python -m manager.tasks run_daily_reconciliation >> $LOG_DIR/reconciliation.log 2>&1"

# Data fetching - runs every hour
DATA_FETCH_JOB="0 * * * * cd $PROJECT_ROOT && python -m data_ingest.fetcher --lookback-days 2 >> $LOG_DIR/data_fetch.log 2>&1"

# Feature generation - runs every 2 hours
FEATURE_GEN_JOB="0 */2 * * * cd $PROJECT_ROOT && python -m features.features >> $LOG_DIR/features.log 2>&1"

echo "Adding maintenance cron jobs..."

add_cron_job "0 2 * * *" "cd $PROJECT_ROOT && python -m manager.tasks run_data_retention_maintenance >> $LOG_DIR/data_retention.log 2>&1"
add_cron_job "0 */4 * * *" "cd $PROJECT_ROOT && python -m manager.tasks run_intraday_learning_cycle >> $LOG_DIR/learning.log 2>&1"
add_cron_job "0 6 * * *" "cd $PROJECT_ROOT && python -m manager.tasks run_daily_reconciliation >> $LOG_DIR/reconciliation.log 2>&1"
add_cron_job "0 * * * *" "cd $PROJECT_ROOT && python -m data_ingest.fetcher --lookback-days 2 >> $LOG_DIR/data_fetch.log 2>&1"
add_cron_job "0 */2 * * *" "cd $PROJECT_ROOT && python -m features.features >> $LOG_DIR/features.log 2>&1"

echo "Cron jobs setup complete!"
echo ""
echo "Current cron jobs:"
crontab -l
echo ""
echo "Log files will be written to: $LOG_DIR"
echo "Monitor logs with: tail -f $LOG_DIR/data_retention.log"
