# Phase 2A Runbook: Intraday Cohort Operations & Day-3 Promotion

This runbook provides step-by-step operational guidance for managing intraday cohorts, monitoring performance, and executing Day-3 promotions with proper risk controls.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Launching an Intraday Cohort](#launching-an-intraday-cohort)
3. [Monitoring Cohort Performance](#monitoring-cohort-performance)
4. [Day-3 Promotion Review Process](#day-3-promotion-review-process)
5. [Rollback Procedures](#rollback-procedures)
6. [Troubleshooting](#troubleshooting)
7. [API Reference](#api-reference)

---

## Prerequisites

### System Requirements

- **Backend API**: FastAPI server running with MongoDB connection
- **Database**: MongoDB with `sim_runs_intraday` and `cohort_summaries` collections indexed
- **Frontend**: Next.js web app accessible at `/trading/cohorts` and `/assistant`
- **Credentials**: Valid Binance API keys (testnet or live) configured in environment variables
- **Monitoring**: Prometheus + Grafana dashboards configured for cohort metrics

### Access Requirements

- **Operator Role**: Required for Day-3 promotion approval
- **Risk Role**: Optional for elevated guard rail overrides
- **MFA**: Required for live capital promotions

### Environment Variables

Ensure these are set in your `.env` file:

```bash
MONGO_URI=mongodb://localhost:27017
DATABASE_NAME=lenxys_trader
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret
BINANCE_TESTNET=true  # Set to false for live trading
```

---

## Launching an Intraday Cohort

### Via Assistant Page (Recommended for Operators)

1. Navigate to `/assistant`
2. Locate the **"Intraday automation"** section in the Quick Actions panel
3. Enter desired bankroll amount (e.g., `1000` for $1,000)
   - **Suggested ranges**: $50 (testing), $1,000 (standard), $10,000+ (scale)
4. Click **"Launch cohort"**
5. Wait for success notification with cohort ID
6. Navigate to `/trading/cohorts` to monitor the newly created cohort

**Expected Outcome:**
- 30 agents launched with equal bankroll allocation
- Cohort appears in the Recent Cohorts table
- Parent wallet initialized with specified bankroll

### Via API (For Automation/Scripts)

```bash
curl -X POST http://localhost:8000/api/experiments/cohorts/launch \
  -H "Content-Type: application/json" \
  -d '{
    "bankroll": 1000,
    "agent_count": 30,
    "allocation_policy": "equal",
    "leverage_ceiling": 5.0,
    "exposure_limit": 900,
    "symbol": "BTC/USDT",
    "interval": "1m",
    "horizon": "5m",
    "families": ["ema-cross", "rsi-scalper"],
    "mutations_per_parent": 2
  }'
```

**Response:**
```json
{
  "status": "launched",
  "cohort": {
    "cohort_id": "cohort-20250115-abc123",
    "bankroll": 1000,
    "agent_count": 30,
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

### Via Script

```bash
cd /path/to/lenxys-trader
python scripts/run_intraday_cohort.py --bankroll 1000 --agent-count 30 --allocation-policy equal
```

### Configuration Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| `bankroll` | Required | Shared capital pool (USD) |
| `agent_count` | 30 | Number of strategy agents to deploy |
| `allocation_policy` | "equal" | "equal" or "risk-weighted" |
| `leverage_ceiling` | 5.0 | Maximum leverage per agent |
| `exposure_limit` | = bankroll | Parent wallet aggregate exposure cap |
| `symbol` | BTC/USDT | Trading pair |
| `interval` | 1m | Market data sampling interval |
| `horizon` | 5m | Forecast horizon |
| `families` | ["ema-cross"] | Strategy families to include |

---

## Monitoring Cohort Performance

### Dashboard View

Navigate to **`/trading/cohorts`** to access the real-time dashboard.

#### Key Metrics to Monitor

1. **Bankroll Utilisation**
   - **Target**: < 90% utilization
   - **Action**: If utilization exceeds 95%, review agent allocations or increase bankroll

2. **Cohort PnL**
   - **Target**: Positive ROI within 6 hours for intraday cohorts
   - **Action**: If ROI < -5% after 4 hours, consider kill switch

3. **Guard Rail Progress**
   - **Target**: 100% (all checks passing) before Day-3 promotion
   - **Action**: Review failing checks in detail view

4. **Parent Drawdown**
   - **Target**: < 12% of starting bankroll
   - **Action**: If drawdown > 15%, halt cohort and investigate

5. **Leverage Breaches**
   - **Target**: 0 breaches
   - **Action**: If breaches occur, reduce leverage ceiling or review agent logic

#### Alert Feed

Monitor the **Alert Feed** panel for:
- `parent_drawdown_exceeded`: Parent wallet breach
- `leverage_breach`: Agent exceeded leverage ceiling
- `utilization_high`: Bankroll utilization > threshold
- `agent_failure`: Agent crashed or timed out

### Real-Time Updates

The dashboard auto-refreshes every 15 seconds. Click **"Refresh"** for manual updates.

### Detailed Agent View

1. Click a cohort row in the Recent Cohorts table
2. Review the **Evolution Leaderboard Table** showing:
   - Strategy ID
   - ROI
   - Sharpe ratio
   - Max drawdown
   - Confidence score
3. Select an agent to view **Strategy Snapshot** with:
   - Allocation
   - Trade count
   - Slippage
   - PnL breakdown

---

## Day-3 Promotion Review Process

### When to Promote

Promote a cohort to micro-live capital after **3 days** (or your configured policy window) if:
- ✅ All guard rails pass
- ✅ ROI consistently positive across multiple days
- ✅ No leverage breaches
- ✅ Drawdown < 12%
- ✅ Operator approval documented

### Step-by-Step Promotion

#### 1. Pre-Review Checklist

- [ ] Cohort has run for at least 24 hours (Day-3 standard)
- [ ] All guard rails show "Pass" status
- [ ] Best candidate has executed ≥ 6 trades
- [ ] Slippage < 1%
- [ ] Parent drawdown < 12%
- [ ] No high-severity alerts in feed

#### 2. Open Day-3 Promotion Modal

**Option A: From Cohorts Dashboard**
1. Navigate to `/trading/cohorts`
2. Select the target cohort
3. Scroll to **Promotion Guard Rails** section
4. Click **"Open Day-3 Modal"**

**Option B: From Trading Page**
1. Navigate to `/trading`
2. Select cohort from the **Day-3 Promotion** panel dropdown
3. Click **"Review Day-3 Promotion"**

**Option C: Via Assistant**
1. Navigate to `/assistant`
2. Click **"Review Day-3 promotion"** in Quick Actions
3. Redirects to `/trading?promo=latest`

#### 3. Review Guard Rails

The modal displays:
- **Guard Rails Summary**: X/7 checks passing
- **Individual Checks**:
  - ✅ **Minimum trades**: Candidate executed ≥ 6 trades
  - ✅ **Slippage tolerance**: Average slippage ≤ 1%
  - ✅ **Candidate drawdown**: ≤ 12% of parent bankroll
  - ✅ **Parent drawdown**: ≤ 12% of starting balance
  - ✅ **Utilization**: < 95% of bankroll
  - ✅ **No leverage breaches**: 0 recorded
  - ✅ **No high-severity alerts**: 0 critical/error alerts

**If any check fails:**
- Review the specific metric in detail
- Document reasoning if override is necessary
- Consult risk team for elevated approvals

#### 4. Review Candidate & Cohort Summary

- **Best Candidate**: Strategy ID, allocation, ROI, drawdown, trade count
- **Cohort Summary**: Total PnL, ROI, utilization, confidence score
- **Parent Wallet**: Starting bankroll, realized PnL, aggregate exposure, drawdown

#### 5. Configure Promotion Parameters

Adjust as needed (defaults are conservative):

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| **Bankroll slice (%)** | 5% | 1-100% | Fraction of cohort bankroll to allocate live |
| **Minimum allocation (USD)** | $50 | $10+ | Floor allocation regardless of percentage |
| **Minimum trade count** | 6 | 1+ | Required trades by candidate |
| **Max slippage (%)** | 1% | 0.1-20% | Maximum average slippage tolerance |
| **Max parent drawdown (%)** | 12% | 1-100% | Maximum tolerated parent drawdown |

**Example:**
- Cohort bankroll: $1,000
- Slice: 5% → $50 allocation
- If slice < $50, system uses min allocation floor

#### 6. Add Approval Notes (Optional)

Document:
- Operator name and role
- Any guard rail overrides
- Risk approval signatures (if required)
- Compliance notes for audit trail

Example:
```
Reviewed by Ops Team Lead on 2025-01-15.
All guard rails passed. Strategy ema-cross-gen5-003 shows 8.2% ROI
with 14 trades and 0.6% avg slippage. Approved for 5% slice ($50 live).
```

#### 7. Acknowledge Risks

- [ ] Check **"I acknowledge the guard rails and accept responsibility for the Day-3 promotion decision."**

#### 8. Submit Promotion

1. Click **"Promote"**
2. Wait for confirmation toast notification
3. Verify promotion recorded in:
   - `promotion_log` collection (MongoDB)
   - `TradingSettings` updated with micro-live budget
   - Audit events logged

**Expected Outcome:**
- Candidate strategy promoted to live allocation
- Live trades begin executing with allocated capital
- Promotion audit log entry created
- Alert notifications sent to Slack/Telegram (if configured)

---

## Rollback Procedures

### When to Rollback

Rollback a promotion if:
- 🚨 Live drawdown exceeds 15% within first 24 hours
- 🚨 Leverage breaches occur post-promotion
- 🚨 Slippage spikes above 3%
- 🚨 Market conditions change significantly (e.g., flash crash)
- 🚨 Strategy logic error detected

### Manual Rollback

#### Step 1: Disable Live Trading

```bash
curl -X POST http://localhost:8000/api/admin/kill-switch \
  -H "Content-Type: application/json" \
  -d '{
    "action": "arm",
    "reason": "Day-3 promotion rollback",
    "mode": "live"
  }'
```

#### Step 2: Update Trading Settings

```python
from db.client import mongo_client, get_database_name
from datetime import datetime

with mongo_client() as client:
    db = client[get_database_name()]
    db.trading_settings.update_one(
        {"strategy_id": "ema-cross-gen5-003"},
        {"$set": {
            "live_allocation_usd": 0.0,
            "status": "paused",
            "updated_at": datetime.utcnow(),
            "rollback_reason": "Manual rollback due to drawdown breach"
        }}
    )
```

#### Step 3: Log Rollback Event

```bash
curl -X POST http://localhost:8000/api/admin/audit-log \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "promotion_rollback",
    "cohort_id": "cohort-20250115-abc123",
    "strategy_id": "ema-cross-gen5-003",
    "reason": "Live drawdown exceeded 15%",
    "operator": "ops-lead",
    "timestamp": "2025-01-15T12:00:00Z"
  }'
```

#### Step 4: Notify Team

- Send alert to Slack/Telegram channel
- Update incident log
- Schedule post-mortem review

### Automatic Rollback (Future Phase 3A)

Automatic rollback will trigger when:
- Live drawdown > 15% within rollback timer window
- Aggregate utilization breaches hard stop
- Kill switch armed by risk manager

---

## Troubleshooting

### Issue: Cohort Launch Fails

**Symptoms:**
- API returns 500 error
- No cohort appears in dashboard

**Resolution:**
1. Check MongoDB connection:
   ```bash
   mongo --eval "db.adminCommand('ping')"
   ```
2. Verify indexes exist:
   ```bash
   python scripts/migrate_intraday_indexes.py
   ```
3. Check backend logs:
   ```bash
   tail -f logs/api.log | grep ERROR
   ```
4. Retry launch with smaller agent count (e.g., 10 agents)

### Issue: Guard Rails Not Updating

**Symptoms:**
- Guard rail checks show "Awaiting cohort analytics"
- Promotion preview empty

**Resolution:**
1. Verify cohort summary generated:
   ```python
   from db.client import mongo_client, get_database_name
   with mongo_client() as client:
       db = client[get_database_name()]
       summary = db.cohort_summaries.find_one({"cohort_id": "cohort-xxx"})
       print(summary)
   ```
2. If missing, manually trigger summary generation:
   ```bash
   python -m evaluation.metrics --cohort-id cohort-xxx --force
   ```
3. Check for feature cache invalidation issues:
   ```bash
   redis-cli KEYS "*cohort-xxx*"
   redis-cli DEL "features:cohort-xxx"
   ```

### Issue: High Bankroll Utilization

**Symptoms:**
- Utilization exceeds 95%
- Warning alerts in feed

**Resolution:**
1. Review agent allocations:
   ```bash
   curl http://localhost:8000/api/experiments/cohorts/{cohort_id}
   ```
2. Reduce agent count or increase bankroll
3. Switch to `risk-weighted` allocation policy
4. Pause low-performing agents:
   ```python
   # Manually pause agents with ROI < 0
   ```

### Issue: Promotion Modal Won't Open

**Symptoms:**
- Click "Open Day-3 Modal" → no response
- JavaScript console errors

**Resolution:**
1. Check browser console for errors
2. Verify cohort detail API responding:
   ```bash
   curl http://localhost:8000/api/experiments/cohorts/{cohort_id}
   ```
3. Clear browser cache and reload
4. Check for TypeScript/React errors in dev tools

### Issue: Assistant Launch Button Disabled

**Symptoms:**
- "Launch cohort" button grayed out

**Resolution:**
1. Verify bankroll input is valid number > 0
2. Check if launch is already in progress (button shows "Launching…")
3. Refresh page and retry
4. Check backend API health:
   ```bash
   curl http://localhost:8000/health
   ```

---

## API Reference

### Core Endpoints

#### Launch Intraday Cohort

```http
POST /api/experiments/cohorts/launch
Content-Type: application/json

{
  "bankroll": 1000,
  "agent_count": 30,
  "allocation_policy": "equal",
  "leverage_ceiling": 5.0
}

Response: 200 OK
{
  "status": "launched",
  "cohort": { ... }
}
```

#### List Cohorts

```http
GET /api/experiments/cohorts?page=1&page_size=10&date=2025-01-15

Response: 200 OK
{
  "cohorts": [ ... ],
  "pagination": { ... }
}
```

#### Get Cohort Detail

```http
GET /api/experiments/cohorts/{cohort_id}

Response: 200 OK
{
  "cohort": { ... },
  "summary": { ... },
  "parent": { ... },
  "promotion": { ... }
}
```

#### Promote Cohort

```http
POST /api/experiments/cohorts/{cohort_id}/promote
Content-Type: application/json

{
  "bankroll_slice_pct": 0.05,
  "min_allocation_usd": 50.0,
  "min_trade_count": 6,
  "max_slippage_pct": 0.01,
  "max_parent_drawdown": 0.12,
  "approval_notes": "Operator approval",
  "acknowledge_risks": true
}

Response: 200 OK
{
  "status": "candidate_selected",
  "result": { ... }
}
```

### Assistant Endpoints

#### Get Cohort Status (Lightweight)

```http
GET /api/assistant/cohorts/status?limit=3

Response: 200 OK
{
  "cohorts": [
    {
      "cohort_id": "cohort-001",
      "bankroll": 1000,
      "total_roi": 0.05,
      "confidence_score": 0.75
    }
  ],
  "count": 1
}
```

#### Check Promotion Readiness

```http
GET /api/assistant/cohorts/{cohort_id}/promotion-readiness

Response: 200 OK
{
  "cohort_id": "cohort-001",
  "ready": true,
  "passed_checks": 7,
  "total_checks": 7,
  "recommended_allocation": 50.0,
  "best_candidate_id": "ema-cross-gen5-003"
}
```

#### Get Bankroll Summary

```http
GET /api/assistant/cohorts/bankroll-summary

Response: 200 OK
{
  "cohort_count": 3,
  "total_bankroll_allocated": 3000.0,
  "total_pnl": 150.0,
  "avg_utilization_pct": 0.75,
  "lookback_days": 7
}
```

---

## Monitoring Dashboards

### Grafana Panels (if configured)

1. **Cohort Runtime**: Tracks execution time per cohort
2. **Failed Agent Count**: Monitors agent crashes
3. **Bankroll Utilization Heatmap**: Visualizes utilization trends
4. **API Latency**: Cohort detail endpoint response times

Access: `http://localhost:3000/d/lenxys-cohorts`

### Prometheus Metrics

- `cohort_runtime_seconds`: Histogram of cohort execution times
- `cohort_failed_agents_total`: Counter of failed agents
- `cohort_bankroll_utilization_ratio`: Gauge of utilization percentage
- `cohort_api_latency_seconds`: Histogram of API response times

---

## Best Practices

1. **Start Small**: Begin with $50-$100 bankroll for testing
2. **Monitor Daily**: Review cohorts within 6 hours of launch
3. **Document Approvals**: Always add notes in promotion modal
4. **Respect Guard Rails**: Override only with risk team sign-off
5. **Test Rollback**: Practice rollback procedures in testnet
6. **Audit Regularly**: Review promotion logs weekly
7. **Communicate**: Alert team before promoting to live capital

---

## Support

For issues not covered in this runbook:
- **Technical Support**: Open GitHub issue with logs
- **Operations Questions**: Contact ops team lead
- **Risk Concerns**: Escalate to risk management team

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-15  
**Next Review**: Phase 3A launch

