# Data Retention System

This system automatically manages your cryptocurrency market data to prevent unlimited database growth while preserving all data needed for AI model training.

## Overview

The system implements a **3-tier retention policy**:

- **Tier 1** (90 days): Full resolution data (1m, 1h, 1d) - Active trading and model training
- **Tier 2** (365 days): Medium resolution data (1h, 1d) - Backtesting and analysis
- **Tier 3** (10 years): Low resolution data (1d) - Long-term trend analysis

**Storage Estimate**: ~46GB for 30 cryptocurrencies (vs. unlimited growth without this system)

## Quick Setup

Run the complete setup script:

```bash
python scripts/setup_data_retention_system.py
```

This will:
- Create MongoDB TTL indexes for automatic cleanup
- Run initial data cleanup
- Set up automated maintenance tasks

## Manual Testing

Test the data retention system:

```bash
# Run maintenance manually
python -m manager.tasks run_data_retention_maintenance

# Check data statistics
python -c "from data_ingest.retention import get_data_stats; print(get_data_stats(['BTC/USD', 'ETH/USDT']))"
```

## Automated Operation

Start Celery Beat for scheduled maintenance:

```bash
# Terminal 1: Start Celery Beat (scheduler)
celery -A celery_beat_config beat --loglevel=info

# Terminal 2: Start Celery Worker (task processor)
celery -A manager.tasks worker --loglevel=info --concurrency=2
```

Scheduled tasks:
- **Data retention maintenance**: Daily at 2:00 AM
- **Learning cycle**: Every 4 hours
- **Daily reconciliation**: Daily at 6:00 AM
- **Data fetching**: Every hour
- **Feature generation**: Every 2 hours

## Web Interface

Configure retention settings in the web UI:
1. Switch to **Advanced Mode** in settings
2. Go to **Data Retention** tab
3. Adjust tier durations and cleanup intervals
4. View storage estimates

## Environment Variables

Override default settings:

```bash
# Retention periods
DATA_RETENTION_TIER1_DAYS=90
DATA_RETENTION_TIER2_DAYS=365
DATA_RETENTION_TIER3_DAYS=3650

# Maintenance settings
DATA_RETENTION_CLEANUP_INTERVAL_HOURS=24
DATA_RETENTION_BATCH_SIZE=10000
```

## Monitoring

Check logs for maintenance activity:

```bash
# View recent maintenance logs
tail -f logs/data_retention.log

# Check current data statistics
python -c "
from data_ingest.retention import get_data_stats, DataRetentionConfig
config = DataRetentionConfig.from_env()
stats = get_data_stats(['BTC/USD'])
print('Data retention config:', config)
print('Current stats:', stats)
"
```

## Technical Details

### TTL Indexes

MongoDB automatically deletes data based on timestamps:
- `ohlcv.tier1_ttl`: Expires minute data older than tier1_days
- `ohlcv.tier2_ttl`: Expires hourly data older than tier2_days
- `features` collections have matching TTL indexes

### Downsampling

Before data expires, it's automatically downsampled:
- Minute data → Hourly aggregates (7 days before expiration)
- Hourly data → Daily aggregates (7 days before expiration)

This ensures no data loss during transitions between tiers.

### Safety Features

- **Grace period**: Downsampling occurs 7 days before expiration
- **Data validation**: Only creates aggregates with sufficient source data
- **Error handling**: Individual symbol failures don't stop batch processing
- **Monitoring**: All operations are logged with statistics

## Troubleshooting

### No TTL indexes created
```bash
# Check MongoDB permissions
# Ensure MongoDB user has createIndex permission
```

### Tasks not running
```bash
# Check Celery Beat is running
ps aux | grep celery

# Check Redis is running
redis-cli ping
```

### High memory usage
```bash
# Reduce batch size
DATA_RETENTION_BATCH_SIZE=5000
```

### Data loss concerns
- **No data is permanently deleted** without downsampling first
- All operations are logged
- Test on a single symbol first: `python -m data_ingest.retention cleanup_old_data ['BTC/USD'], config`

## Performance Impact

- **Storage**: Reduces database size by ~80%
- **Query speed**: Faster queries on smaller datasets
- **Memory**: Lower memory usage for data processing
- **Backup time**: Smaller backups, faster restores

The system runs maintenance during low-usage hours and processes data in batches to minimize performance impact.
