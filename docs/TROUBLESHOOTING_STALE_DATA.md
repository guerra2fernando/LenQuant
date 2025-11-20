# Troubleshooting Stale Market Data

## Problem: Chart Shows Old Data (Weeks/Months Old)

If your trading terminal shows candles from several days or weeks ago instead of recent data, here's how to diagnose and fix it.

---

## Quick Diagnosis

### Run the Diagnostic Script

```bash
cd LenQuant
python scripts/diagnose_stale_data.py
```

This script will show you:
1. The actual timestamp of the newest candle in your database for each symbol/interval
2. How old that data is (in days/hours)
3. What the exchange API currently returns
4. Specific recommendations for your situation

---

## Common Causes & Solutions

### 1. **Data Was Never Fetched or Only Partial Data Exists**

**Symptoms:**
- Fresh install or first time setup
- Database has very little data
- Some intervals work, others don't

**Solution:**
```bash
# Fetch last 30 days of data for all enabled symbols
cd LenQuant
python -m data_ingest.fetcher --symbol BTC/USD --interval 1m --lookback-days 30
python -m data_ingest.fetcher --symbol BTC/USD --interval 1h --lookback-days 90
python -m data_ingest.fetcher --symbol BTC/USD --interval 1d --lookback-days 365

# Or use the UI: Settings > Data Management > Refresh All
```

### 2. **Celery Workers Not Running (Scheduled Fetches Don't Work)**

**Symptoms:**
- Data was fresh after initial setup but hasn't updated since
- Manual refresh works, but auto-refresh doesn't
- Data gets progressively older day by day

**Check if workers are running:**
```bash
# Check Celery worker
celery -A celery_config inspect active

# Check Celery beat (scheduler)
ps aux | grep "celery.*beat"
```

**Solution - Start the workers:**
```bash
# Terminal 1: Start Celery worker
cd LenQuant
celery -A celery_config worker -Q data,features,default -l info

# Terminal 2: Start Celery beat (scheduler for hourly refreshes)
cd LenQuant
celery -A celery_config beat -l info

# Or use Docker:
cd LenQuant/docker
docker-compose up -d celery-worker celery-beat
```

### 3. **Exchange Symbol Format Mismatch**

**Symptoms:**
- Some symbols work (like `BTC/USDT`) but others don't (like `BTC/USD`)
- Error logs mention "symbol not found" or 404 errors
- Fresh data for popular pairs, but not for others

**Diagnosis:**
```python
import ccxt
exchange = ccxt.binance()
markets = exchange.load_markets()

# Check if your symbol exists
print('BTC/USD' in markets)   # Might be False
print('BTC/USDT' in markets)  # Likely True

# See all BTC pairs
btc_pairs = [s for s in markets.keys() if s.startswith('BTC/')]
print(btc_pairs)
```

**Solution:**
- Use the correct symbol format for your exchange (e.g., `BTC/USDT` not `BTC/USD` for Binance)
- Update your `DEFAULT_SYMBOLS` in `.env`
- Go to Settings > Data Management and add the correct symbols

### 4. **Timezone Confusion (Server in Different Timezone)**

**Symptoms:**
- Data appears to be "hours old" but not days
- The "aging" badge shows even though you just refreshed
- Timestamps in UI don't match your local time

**Understanding:**
- All candle timestamps are stored in **UTC**
- The UI compares UTC timestamps to calculate freshness
- Your server timezone (Singapore) doesn't affect data freshness calculation

**Check if this is the issue:**
```bash
# Run diagnostic - it will show if data is truly stale or just timezone confusion
python scripts/diagnose_stale_data.py
```

**Note:** After our fix, the freshness badge now shows the timestamp of the **actual candle data**, not when you last ran the ingestion job. So if the exchange doesn't have recent data, it will correctly show as "Stale".

### 5. **Exchange Rate Limiting**

**Symptoms:**
- Data fetching seems to stop midway
- Logs show "Rate limit exceeded" errors
- Only partial data is fetched

**Solution:**
```bash
# Adjust rate limit in .env
echo "EXCHANGE_RATE_LIMIT_PER_MINUTE=600" >> .env

# Or fetch with smaller batches
python -m data_ingest.fetcher --symbol BTC/USD --interval 1m --lookback-days 7 --limit 500
```

### 6. **Exchange API Down or Unreachable**

**Symptoms:**
- No symbols get updated
- Network errors in logs
- Diagnostic script shows exchange connection failures

**Check:**
```bash
# Test exchange connectivity
python scripts/test_exchange_markets.py

# Check if you can reach Binance
curl https://api.binance.com/api/v3/ping
```

**Solution:**
- Check your internet connection / firewall rules
- Verify exchange API is not down: https://status.binance.com/
- If using VPN, ensure it allows API access
- Try a different exchange in `.env`: `EXCHANGE_SOURCE=coinbase`

---

## Step-by-Step Fix Process

### Step 1: Run Diagnostic
```bash
python scripts/diagnose_stale_data.py
```

Look at the output and identify which scenario you're in.

### Step 2: Start Background Services (if not running)
```bash
# Check Redis
redis-cli ping
# Should return: PONG

# Start Celery if needed
celery -A celery_config worker -Q data,features,default -l info &
celery -A celery_config beat -l info &
```

### Step 3: Manually Fetch Recent Data
```bash
# Fetch last 30 days for main symbols
python -m data_ingest.fetcher --symbol BTC/USDT --interval 1m --lookback-days 30
python -m data_ingest.fetcher --symbol BTC/USDT --interval 1h --lookback-days 90
python -m data_ingest.fetcher --symbol ETH/USDT --interval 1m --lookback-days 30
```

### Step 4: Verify Fix
```bash
# Run diagnostic again
python scripts/diagnose_stale_data.py

# Should now show data is fresh (< 24 hours old)
```

### Step 5: Check UI
1. Go to Settings > Data Management
2. You should now see green "Fresh" badges
3. Go to Trading Terminal
4. Charts should show recent data

---

## Monitoring & Prevention

### Set Up Automated Monitoring

1. **Enable scheduled tasks** (hourly refresh):
   - Ensure Celery beat is running
   - Check `.env` has: `CELERY_BEAT_SCHEDULE_ENABLED=true`

2. **Monitor job status**:
   - Go to Settings > Data Management > View Progress
   - Check for failed jobs and retry them

3. **Check system health**:
   - Settings > System Health shows component status
   - Redis, MongoDB, and Celery workers should all be "healthy"

### Logging

Enable detailed logging in `.env`:
```bash
LOG_LEVEL=DEBUG
```

Check logs for ingestion errors:
```bash
# If using systemd
journalctl -u celery-worker -f

# If using Docker
docker logs -f lenquant-celery-worker

# If running manually
# Logs will appear in terminal where Celery is running
```

---

## Understanding Data Freshness in UI

After our fixes:

- **"Fresh" (Green)**: The newest candle in the database is < 2 hours old
- **"Aging" (Yellow)**: The newest candle is 2-24 hours old  
- **"Stale" (Red)**: The newest candle is > 24 hours old

**Important:** The freshness indicator now shows the **actual candle timestamp**, not when you last clicked "Refresh". This means:
- If you refresh but the exchange doesn't have recent data, it will still show "Stale"
- This is correct behavior - it accurately reflects data freshness
- Use the diagnostic script to verify if it's a real data issue or exchange limitation

---

## Getting Help

If you've tried everything above and still have issues:

1. Run the diagnostic and save output:
   ```bash
   python scripts/diagnose_stale_data.py > diagnosis.txt
   ```

2. Check Celery worker logs:
   ```bash
   celery -A celery_config inspect active > celery_status.txt
   ```

3. Check MongoDB for actual data:
   ```bash
   mongosh cryptotrader
   db.ohlcv.find({symbol: "BTC/USDT", interval: "1m"}).sort({timestamp: -1}).limit(5).pretty()
   ```

4. Share these outputs when asking for help.

---

## Changes Made to Fix Your Issue

1. **Fixed freshness calculation**: `last_updated` now uses the **newest candle timestamp** instead of ingestion job time
2. **Added `last_ingestion_at` field**: Tracks when the job actually ran (separate from data freshness)
3. **Fixed chart race condition**: Added safety checks to prevent `_internal_visibleRange` error
4. **Fixed "View Progress" button**: Now fetches recent jobs from API instead of localStorage
5. **Added diagnostic script**: `scripts/diagnose_stale_data.py` to identify exact issue
6. **Improved UI messaging**: Data Ingestion tab now clearly explains what "Fresh" means

---

## Prevention Checklist

- [ ] Celery worker is running
- [ ] Celery beat is running  
- [ ] Redis is accessible
- [ ] Exchange API is reachable
- [ ] Correct symbol format for your exchange
- [ ] Adequate rate limits configured
- [ ] Scheduled tasks are enabled in Celery beat config
- [ ] No firewall blocking API access

