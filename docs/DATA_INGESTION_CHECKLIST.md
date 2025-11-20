# Data Ingestion Improvement - Implementation Checklist

Use this checklist to track implementation progress across all 5 phases.

---

## 🎯 Phase 1: Core Async Infrastructure ✅ COMPLETED

### Database Setup
- [x] **Clean existing data** (BEFORE starting implementation):
  - [ ] Backup users collection if needed (USER ACTION REQUIRED)
  - [ ] Drop `ohlcv` collection (USER ACTION REQUIRED BEFORE TESTING)
  - [ ] Drop `features` collection (USER ACTION REQUIRED BEFORE TESTING)
  - [ ] Drop `symbols` collection (will be reseeded) (USER ACTION REQUIRED BEFORE TESTING)
  - [ ] Drop `ingestion_jobs` collection (if exists) (USER ACTION REQUIRED BEFORE TESTING)
- [x] Create `db/startup.py` with automatic index creation function
- [x] Add indexes for `ingestion_jobs`:
  - [x] job_id (unique)
  - [x] parent_job_id
  - [x] status
  - [x] symbol + interval (compound)
  - [x] created_at (descending)
  - [x] job_type + status (compound)
- [x] Add indexes for `symbols`:
  - [x] symbol (unique)
  - [x] enabled
- [x] Update `api/main.py` to call `initialize_database()` on startup
- [ ] Test that indexes are created automatically when system starts (NEEDS TESTING)

### Backend - Celery Tasks
- [x] Create `ingest_symbol_interval_task` in `data_ingest/tasks.py`
- [x] Create `batch_ingest_task` in `data_ingest/tasks.py`
- [x] Add job status update logic (pending → in_progress → completed/failed)
- [x] Add error handling and retry logic
- [x] Add symbol metadata update after successful ingestion
- [ ] Test task execution with single symbol/interval (NEEDS TESTING)
- [ ] Test task execution with multiple symbols/intervals (NEEDS TESTING)
- [ ] Verify job status updates in MongoDB (NEEDS TESTING)

### Backend - API Endpoints
- [x] Create `api/routes/data_ingestion.py` file
- [x] Implement `POST /api/data-ingestion/start` endpoint
- [x] Implement `GET /api/data-ingestion/status/{job_id}` endpoint
- [x] Implement `GET /api/data-ingestion/status-batch/{parent_job_id}` endpoint
- [x] Implement `GET /api/data-ingestion/symbols-status` endpoint
- [x] Add Pydantic models for request/response validation
- [x] Register router in `api/main.py`
- [ ] Test all endpoints with Postman/curl (NEEDS TESTING)

### Backend - Bootstrap Update
- [x] Update `bootstrap_data` function in `api/routes/admin.py`
- [x] Change from synchronous to asynchronous execution
- [x] Return job_id immediately instead of waiting
- [x] Keep seed() functionality
- [x] Remove synchronous loops (for symbol/interval processing)
- [x] Response should include job_id for tracking
- [ ] Test new bootstrap flow (starts jobs and returns immediately) (NEEDS TESTING)

### Testing
- [x] Write unit tests for `ingest_symbol_interval_task`
- [x] Write unit tests for `batch_ingest_task`
- [ ] Write API integration tests for all new endpoints (PARTIAL - basic tests created)
- [ ] Test error scenarios (invalid symbols, network failures) (NEEDS TESTING)
- [ ] Test concurrent job execution (NEEDS TESTING)
- [ ] Load test with 10 symbols × 3 intervals (NEEDS TESTING)
- [ ] Verify all jobs complete successfully (NEEDS TESTING)

### Documentation
- [x] Add docstrings to all new functions
- [x] Document new API endpoints with proper examples
- [x] Update inline code comments for complex logic

---

## 🎯 Phase 2: Real-time Progress Tracking ✅ COMPLETED

### Enhanced Job Schema
- [x] Add `progress_details` field to job schema
  - [x] current_candle_timestamp
  - [x] expected_start_timestamp
  - [x] expected_end_timestamp
  - [x] candles_per_batch
  - [x] batches_completed
  - [x] batches_total
  - [x] estimated_completion_seconds
- [x] Add `steps` array for step-by-step tracking
- [x] Update task to include new fields (automatic via code)

### Progress Callbacks
- [x] Modify `fetch_symbol_interval` to accept progress callback
- [x] Implement progress callback in `ingest_symbol_interval_task`
- [x] Update job document on each batch completion
- [x] Calculate and update progress percentage
- [x] Calculate time remaining estimate
- [ ] Test progress updates are smooth and accurate (NEEDS TESTING)

### Real-time Endpoints
- [x] Decide on SSE vs WebSocket (chose SSE for simplicity)
- [x] Implement `GET /api/data-ingestion/stream-status/{job_id}` (SSE)
- [x] Implement `GET /api/data-ingestion/stream-batch-status/{parent_job_id}` (SSE)
- [ ] Test streaming with browser EventSource API (NEEDS TESTING)
- [x] Verify connection closes on job completion
- [x] Handle client disconnection gracefully

### Enhanced Metrics
- [x] Track records_expected calculation
- [x] Track batches_completed vs batches_total
- [x] Add timestamp for each progress update
- [x] Log progress to file for debugging
- [ ] Add progress metrics to monitoring system (FUTURE ENHANCEMENT)

### Progress Utilities (`data_ingest/progress_utils.py`)
- [x] Create utility module for progress calculations
- [x] `calculate_expected_batches()` - estimate number of batches
- [x] `calculate_expected_records()` - estimate number of records
- [x] `calculate_progress_percentage()` - compute progress by phase
- [x] `estimate_time_remaining()` - ETA calculation
- [x] `format_time_remaining()` - human-readable time format
- [x] `calculate_data_quality_score()` - data completeness metric
- [x] `get_progress_summary()` - formatted progress summary

### Testing
- [x] Create unit tests for progress utilities
- [x] Create tests for progress callback integration
- [x] Create tests for task progress tracking
- [x] Create tests for SSE endpoints structure
- [x] Create tests for enhanced job schema
- [ ] Test progress updates with small dataset (1 day) (NEEDS INTEGRATION TESTING)
- [ ] Test progress updates with large dataset (30 days) (NEEDS INTEGRATION TESTING)
- [ ] Verify time estimates are accurate (NEEDS INTEGRATION TESTING)
- [ ] Test SSE connection stability (NEEDS INTEGRATION TESTING)
- [ ] Test multiple concurrent connections (NEEDS INTEGRATION TESTING)
- [ ] Verify progress persists on worker restart (NEEDS INTEGRATION TESTING)

---

## 🎯 Phase 3: UI/UX Improvements ✅ COMPLETED

### React Components
- [x] Create `web/next-app/components/DataIngestionDashboard.tsx`
  - [x] Overall progress card
  - [x] Individual job cards (inline)
  - [x] Status icons (pending, in_progress, completed, failed)
  - [x] Progress bars
  - [x] Error display
  - [x] Retry buttons
- [x] Create `JobCard` component (inline in DataIngestionDashboard)
- [x] Add TypeScript interfaces for job data (`types/data-ingestion.ts`)
- [x] Style with Tailwind/CSS
- [x] Make responsive for mobile
- [x] Real-time updates via SSE (Server-Sent Events)

### Update get-started.tsx
- [x] Update handleRunBootstrap to use new bootstrap API
- [x] After starting bootstrap, redirect to settings page with job_id param
- [x] Route: `/settings?section=data-ingestion&job_id={job_id}`
- [x] Remove complex polling/dashboard logic from get-started
- [x] Simplified loading state during redirect
- [ ] Test redirect works correctly (NEEDS TESTING)

### Create Data Ingestion Section in Settings Page
- [x] Add "Data Ingestion" tab/section in settings (both Easy and Advanced modes)
- [x] Read `job_id` from URL query params (supports both 'section' and 'tab' params)
- [x] Show DataIngestionDashboard when job_id exists
- [x] Show symbol management UI when no active job
- [x] Add "Refresh Data" button per symbol
- [x] Add "Refresh All" button for bulk refresh
- [x] Show last updated timestamp for each symbol/interval
- [x] Show data quality indicators (quality score, record counts, feature counts)
- [x] Add ability to manually trigger ingestion for specific symbols
- [x] Symbol freshness indicators (fresh, aging, stale)
- [ ] Test that users can always access this page to check status (NEEDS TESTING)

### Notifications Integration
- [x] `notify_ingestion_complete` exists in `monitor/notification_service.py`
- [x] `notify_ingestion_failed` exists in `monitor/notification_service.py`
- [x] Functions are called from Celery tasks (from Phase 1)
- [ ] Test notifications appear in UI (NEEDS TESTING - currently logs only)
- [ ] Add notification preferences (opt-in/out) (FUTURE ENHANCEMENT)
- [ ] Add email notifications (optional) (FUTURE ENHANCEMENT)

### Data Freshness Indicators
- [x] Create `DataFreshnessBadge` component
- [x] Create `SymbolFreshnessIndicator` component
- [x] Show last updated time on settings page
- [x] Show "Stale data" warning if > 24 hours old
- [x] Color-code by freshness (green=fresh, yellow=aging, red=stale)
- [x] Added to DataIngestionTab
- [ ] Add to other relevant pages (dashboard, insights, etc.) (FUTURE ENHANCEMENT)

### Testing
- [ ] Test UI with mock data (NEEDS TESTING)
- [ ] Test full flow end-to-end (NEEDS TESTING)
- [ ] Test responsive design on mobile (NEEDS TESTING)
- [ ] Test with slow network (throttling) (NEEDS TESTING)
- [ ] Test error states display correctly (NEEDS TESTING)
- [ ] User acceptance testing (NEEDS TESTING)
- [ ] Accessibility testing (NEEDS TESTING)

---

## 🎯 Phase 4: Essential Resilience & Data Quality ✅ COMPLETED

**Goal**: Ensure data integrity, handle failures gracefully, and prevent system issues

### 4.1 Enhanced Retry Logic ✅
- [x] Basic retry endpoint exists (`POST /api/data-ingestion/retry/{job_id}`) ✅ Phase 1
- [x] Add retry_count increment and max_retries (3) enforcement
- [x] Add `POST /api/data-ingestion/retry-batch/{parent_job_id}` for bulk retry
- [x] Add "Retry All Failed" button in UI (DataIngestionDashboard)
- [ ] Test retry with network failures, invalid symbols, exchange errors (NEEDS TESTING)
**Estimated Time**: 1 day ✅ COMPLETED

### 4.2 Rate Limiting & Exchange Safety ✅
- [x] Add rate limiting in `data_ingest/fetcher.py`:
  - [x] Binance: 1200 requests/minute (weight-based)
  - [x] Add configurable `requests_per_minute` setting (EXCHANGE_RATE_LIMIT_PER_MINUTE env var)
  - [x] Implement token bucket algorithm in `RateLimiter` class
- [x] Handle 429 (rate limit) responses with exponential backoff
- [x] Integrated rate limiter into `_fetch_with_retry` helper function
- [ ] Test with high-frequency requests to verify limiting works (NEEDS TESTING)
**Estimated Time**: 1 day ✅ COMPLETED
**Why Essential**: Prevents exchange API bans that would break entire system

### 4.3 Data Gap Detection ✅
- [x] Create `data_ingest/gap_detector.py` module
- [x] Implement `detect_data_gaps(symbol, interval)`:
  - [x] Query MongoDB for all candles, sort by timestamp
  - [x] Calculate expected interval between candles
  - [x] Identify gaps > 2.5× expected interval (configurable threshold)
  - [x] Return list of gap periods: DataGap objects with start, end, missing_candles
- [x] Add `GET /api/data-ingestion/gaps/{symbol}/{interval}` endpoint
- [x] Add `GET /api/data-ingestion/gaps` endpoint for all symbols
- [x] Implement `detect_recent_data_gaps()` for faster checking of recent data
- [ ] Add "Check Gaps" button in UI per symbol (FUTURE ENHANCEMENT)
- [ ] Display gaps in DataIngestionTab with "Fill Gap" buttons (FUTURE ENHANCEMENT)
- [ ] Test with intentionally incomplete data (NEEDS TESTING)
**Estimated Time**: 1 day ✅ COMPLETED
**Why Essential**: Ensures data completeness for accurate trading signals

### 4.4 Automatic Backfilling ✅
- [x] Create `backfill_gaps_task` in `data_ingest/tasks.py`
- [x] Add to Celery beat schedule: daily at 3 AM
- [x] Logic implemented:
  - [x] For each enabled symbol + interval
  - [x] Detect gaps using gap_detector
  - [x] If gaps found, create backfill job
  - [x] Track backfill_reason: "scheduled_gap_check"
- [x] Add backfill metadata to job document (gap_start, gap_end, missing_candles)
- [x] Backfill uses same notification system as regular ingestion
- [ ] Test by creating gaps manually, then running backfill task (NEEDS TESTING)
**Estimated Time**: 1 day ✅ COMPLETED
**Why Essential**: Automatic data quality maintenance without manual intervention

### 4.5 Basic Health Monitoring ✅
- [x] Add `GET /api/data-ingestion/health` endpoint:
  - [x] Check Celery workers are running (via inspect.active())
  - [x] Check Redis connectivity (via Celery broker ping)
  - [x] Check MongoDB connectivity (via ping command)
  - [x] Return: {status: "healthy"|"degraded"|"down", components: {...}, metrics: {...}, issues: [...]}
- [x] Add health check to settings page (SystemHealthBadge component)
- [x] Health badge shows detailed status when clicked (expandable)
- [x] Add basic metrics tracking:
  - [x] Jobs completed in last 24h
  - [x] Jobs failed in last 24h
  - [x] Average job duration
  - [x] Failed job rate (%)
- [x] Issue detection logic (high failure rate, stuck jobs, component failures)
**Estimated Time**: 0.5 days ✅ COMPLETED
**Why Essential**: Quickly identify when system is broken before users report issues

### Testing
- [ ] Integration test: Retry failed job, verify it completes (NEEDS TESTING)
- [ ] Integration test: Trigger rate limit, verify backoff works (NEEDS TESTING)
- [ ] Integration test: Create data gap, detect it, backfill it, verify data restored (NEEDS TESTING)
- [ ] Manual test: Run system for 24h, check backfill runs correctly (NEEDS TESTING)
- [ ] Stress test: 20 symbols × 3 intervals = 60 jobs at once (NEEDS TESTING)
**Estimated Time**: 1 day

**Total Phase 4 Time**: 5.5 days ✅ IMPLEMENTATION COMPLETED (Testing Pending)

---

## 🎯 Phase 5: Polish & Optimization (OPTIONAL - As Needed) 📊

**Goal**: Improve performance and scalability only if bottlenecks are identified

### 5.1 Performance Baseline
- [ ] Measure current system performance:
  - Time to ingest 30 days of 1m data for 1 symbol
  - Time to ingest 10 symbols × 3 intervals
  - Database query times for status endpoints
  - API response times under load
- [ ] Document baseline metrics
**Estimated Time**: 0.5 days

### 5.2 Database Query Optimization (If Needed)
- [ ] Run `explain()` on slow queries in MongoDB
- [ ] Verify all indexes are being used
- [ ] Add compound indexes if needed:
  - `(symbol, interval, timestamp)` for range queries
  - `(status, created_at)` for dashboard queries
- [ ] Test query performance improvements
**Estimated Time**: 0.5 days
**When**: Only if queries > 100ms consistently

### 5.3 Parallel Worker Scaling (If Needed)
- [ ] Configure multiple Celery workers (already supported):
  - Worker 1: data queue
  - Worker 2: data queue
  - Worker 3: experiments queue
- [ ] Test with 2-4 workers handling 50+ symbols
- [ ] Measure throughput improvement
**Estimated Time**: 0.5 days
**When**: Only if single worker is bottleneck (CPU at 100%)

### 5.4 Caching (If Needed)
- [ ] Add Redis caching for `/api/data-ingestion/symbols-status`:
  - Cache for 30 seconds
  - Invalidate on job completion
- [ ] Measure cache hit rate and latency improvement
**Estimated Time**: 1 day
**When**: Only if symbols-status endpoint > 200ms response time

### 5.5 Load Testing & Capacity Planning
- [ ] Create load test script (Locust or k6)
- [ ] Test scenarios:
  - 10 concurrent users viewing progress
  - 50 SSE connections active
  - 100 symbols × 6 intervals ingestion
- [ ] Document system capacity limits
- [ ] Create scaling recommendations
**Estimated Time**: 1 day
**When**: Before production launch or when expecting high load

**Total Phase 5 Time**: 3.5 days (only if needed)

---

## 🚀 Deployment Checklist

### Pre-deployment
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Migration scripts tested on staging
- [ ] Rollback plan documented

### Staging Deployment
- [ ] Deploy to staging environment
- [ ] Run migration scripts
- [ ] Test full flow on staging
- [ ] Performance test on staging
- [ ] Fix any issues found

### Production Deployment
- [ ] Schedule maintenance window (if needed)
- [ ] Backup production database
- [ ] Deploy backend changes
- [ ] Run migration scripts
- [ ] Deploy frontend changes
- [ ] Verify Celery workers restart correctly
- [ ] Smoke test critical paths
- [ ] Monitor error logs
- [ ] Monitor system metrics
- [ ] Test with real users

### Post-deployment
- [ ] Monitor for 24 hours
- [ ] Check error rates
- [ ] Check job completion rates
- [ ] Gather user feedback
- [ ] Address any issues
- [ ] Update documentation with lessons learned

---

## 📊 Metrics to Track

### Technical Metrics
- [ ] Average ingestion time per symbol/interval
- [ ] Job success rate (target: >98%)
- [ ] Job failure rate (target: <2%)
- [ ] API response times (target: <100ms)
- [ ] Database query times
- [ ] Celery queue depth
- [ ] Worker utilization

### Business Metrics
- [ ] Time to first data (target: <30 seconds)
- [ ] Bootstrap completion rate (target: >95%)
- [ ] User satisfaction score
- [ ] Support tickets related to ingestion
- [ ] Data coverage (% of expected data present)

---

## 🐛 Known Issues & Workarounds

_Document issues as they arise during implementation_

### Issue 1: [Title]
- **Description**: 
- **Workaround**: 
- **Permanent Fix**: 
- **Status**: 

---

## 📝 Notes & Learnings

_Document important learnings during implementation_

---

## ✅ Sign-off

### Phase 1 Complete ✅
- [x] All features implemented
- [x] Basic tests created
- [x] Documentation complete
- [ ] Deployed to production
- [ ] Tested end-to-end
- [x] Signed off by: Engineering Team, Date: Nov 20, 2025

### Phase 2 Complete ✅
- [x] All features implemented
- [x] Unit tests created
- [x] Documentation complete
- [ ] Deployed to production
- [ ] Integration tested
- [x] Signed off by: Engineering Team, Date: Nov 20, 2025

### Phase 3 Complete ✅
- [x] All features implemented
- [ ] UI tests created (needs testing)
- [x] Documentation complete
- [ ] Deployed to production
- [ ] User acceptance tested
- [x] Signed off by: Engineering Team, Date: Nov 20, 2025

### Phase 4 Complete ✅
- [x] All features implemented
- [ ] All tests passing (integration tests pending)
- [x] Documentation updated
- [ ] Deployed to production
- [ ] Production monitoring active
- [x] Signed off by: Engineering Team, Date: Nov 20, 2025

### Phase 5 Complete (OPTIONAL - Only If Needed)
- [ ] Baseline measurements documented
- [ ] Bottlenecks identified
- [ ] Optimizations implemented
- [ ] Performance improvements verified
- [ ] Signed off by: _____________ Date: _______

---

## 🎉 Production Readiness Criteria

**System is production-ready after Phase 4 completion when:**

- ✅ Async data ingestion working reliably
- ✅ Real-time progress visible to users
- ✅ UI dashboard functional and responsive
- ✅ Rate limiting prevents exchange API bans
- ✅ Data gaps automatically detected and filled
- ✅ Failed jobs can be easily retried
- ✅ Health monitoring shows system status
- ✅ 95%+ data completeness across symbols
- ✅ Average ingestion time < 5 minutes per symbol
- ✅ Success rate > 95% for ingestion jobs

**Phase 5 is only needed if:**
- ❌ Performance issues observed in production
- ❌ System cannot handle expected load
- ❌ Database queries consistently slow
- ❌ Need to scale beyond 50 symbols

---

**Total Implementation Time (Phases 1-3)**: ~3 weeks

**Estimated Time to Production (Phase 4)**: +5.5 days

**Lessons Learned**: 
- Focus on essentials first, optimize later
- Manual refresh was already done in Phase 3, avoided duplicate work
- Rate limiting is critical, not optional
- Data quality (gaps/backfill) is essential for trading systems

**Next Steps After Phase 4**:
1. ⚠️ **FIX DEPLOYMENT BLOCKERS FIRST** (see below)
2. Deploy to production
3. Monitor system performance for 1-2 weeks
4. Only implement Phase 5 if bottlenecks appear
5. Gather user feedback and iterate

---

## 🚨 DEPLOYMENT BLOCKERS DISCOVERED (November 20, 2025)

### Critical Issues - Must Fix Before Deployment

- [ ] **❌ BLOCKER 1: Worker Command Wrong**
  - Current: `celery -A manager.tasks:celery_app worker --loglevel=info`
  - Should Be: `celery -A celery_config worker -Q data,experiments,maintenance --loglevel=info`
  - Impact: Worker won't process new ingestion tasks
  - Fix Location: `docker-compose.yml` line ~108

- [ ] **❌ BLOCKER 2: Beat Scheduler Missing**
  - Current: No beat service in docker-compose.yml
  - Should Be: Add beat service (see DATA_INGESTION_IMPROVEMENT.md for full config)
  - Impact: Scheduled backfill task won't run, no automatic gap detection
  - Fix Location: Add new service to `docker-compose.yml`

- [ ] **⚠️ BLOCKER 3: Database Not Cleaned**
  - Current: Old data exists in MongoDB
  - Should Be: Drop ohlcv, features, symbols, ingestion_jobs collections
  - Impact: Schema conflicts, index creation failures, confusing job status
  - Fix Location: Run MongoDB commands before deployment

- [ ] **⚠️ WARNING: celery_config.py Task Imports**
  - Verify: `celery_config.py` imports all task modules
  - Should Have: `import data_ingest.tasks`, `import features.tasks`, etc.
  - Impact: Tasks won't be discovered if not imported
  - Fix Location: `LenQuant/celery_config.py`

### Deployment Steps (After Fixing Blockers)

1. **Pre-Deployment** (Local/Staging)
   - [ ] Update docker-compose.yml with corrected worker command
   - [ ] Add beat service to docker-compose.yml
   - [ ] Verify celery_config.py imports all tasks
   - [ ] Test in local environment
   - [ ] Backup MongoDB (if has important data)

2. **Database Cleanup** (Server)
   ```javascript
   // In MongoDB shell BEFORE deployment
   use cryptotrader
   db.ohlcv.drop()
   db.features.drop()
   db.symbols.drop()
   db.ingestion_jobs.drop()
   // Keep: users collection
   ```

3. **Deploy** (Server)
   - [ ] Copy updated docker-compose.yml to server
   - [ ] Stop containers: `docker-compose down`
   - [ ] Rebuild: `docker-compose build`
   - [ ] Start: `docker-compose up -d`
   - [ ] Verify all services running: `docker-compose ps`

4. **Verify Deployment**
   - [ ] Check API logs: "Database initialization complete"
   - [ ] Check worker logs: Worker starting with queues
   - [ ] Check beat logs: Beat scheduler starting
   - [ ] Check Flower: Worker registered, queues visible
   - [ ] Check MongoDB: Indexes created

5. **Test Bootstrap Flow** (Frontend)
   - [ ] Login to web UI
   - [ ] Go to Get Started
   - [ ] Select 1 symbol, 1 interval, 1 day
   - [ ] Click "Start Setup"
   - [ ] Verify redirect to Settings → Data Ingestion
   - [ ] Watch real-time progress
   - [ ] Verify job completes
   - [ ] Check MongoDB: Data in ohlcv and features

6. **Monitor First 24 Hours**
   - [ ] Watch for errors in logs
   - [ ] Check worker task success rate in Flower
   - [ ] Verify scheduled tasks run (backfill at 3 AM)
   - [ ] Test manual refresh and retry buttons

**See DATA_INGESTION_IMPROVEMENT.md for full deployment guide and troubleshooting**

---

