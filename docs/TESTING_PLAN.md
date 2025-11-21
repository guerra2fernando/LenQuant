# LenQuant System Testing Plan

## Overview
This document provides a comprehensive testing plan for the LenQuant autonomous crypto trading platform. It covers all user flows, features, and integration points to ensure system reliability, security, and performance.

---

## Testing Environment Setup

### Prerequisites
- [ ] Local development environment running
- [ ] Testnet exchange account configured (Binance testnet recommended)
- [ ] Paper trading mode enabled by default
- [ ] MongoDB with test data populated
- [ ] Redis running for Celery tasks
- [ ] All environment variables configured in `.env`

### Test Accounts
- [ ] Admin test account
- [ ] Regular user test account (Easy Mode)
- [ ] Advanced user test account (Advanced Mode)
- [ ] Read-only user test account

### Test Data Requirements
- [ ] Historical price data for at least 3 symbols (e.g., BTC/USDT, ETH/USDT, SOL/USDT)
- [ ] At least 30 days of 1-minute data
- [ ] At least 90 days of 1-hour data
- [ ] At least 180 days of 1-day data
- [ ] Sample trained models in database
- [ ] Sample evolved strategies in database

---

## 1. Authentication & User Management

### 1.1 User Registration & Login
**Test Cases:**
- [ ] Register new user with valid credentials
- [ ] Attempt registration with existing email (should fail)
- [ ] Register with invalid email format (should fail)
- [ ] Register with weak password (should fail)
- [ ] Login with valid credentials
- [ ] Login with invalid credentials (should fail)
- [ ] Login with correct email but wrong password (should fail)
- [ ] Logout functionality
- [ ] Session persistence across page refreshes

**API Endpoints to Test:**
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

**Expected Results:**
- JWT token received on successful login
- Token stored in cookies/localStorage
- Protected routes redirect to login when unauthenticated
- User session maintains across page refreshes

---

## 2. Initial Setup & Onboarding

### 2.1 Get Started Page
**Test Cases:**
- [ ] Access Get Started page as new user
- [ ] View system status indicators
- [ ] Click "Bootstrap Historical Data" button
- [ ] Monitor data ingestion progress
- [ ] Verify data ingestion completion notification
- [ ] Proceed to next step after data ready
- [ ] Navigate to Dashboard after setup complete

**User Flow:**
1. New user logs in for first time
2. Automatically redirected to Get Started page
3. See checklist of setup steps
4. Bootstrap data for default symbols
5. Wait for completion (or navigate away and return)
6. Mark setup as complete
7. Redirected to Dashboard

**Validation:**
- [ ] Database contains historical data for default symbols
- [ ] Data gaps are identified and logged
- [ ] Progress indicators update in real-time
- [ ] User can navigate away and return without losing progress

---

## 3. Dashboard & Overview

### 3.1 Main Dashboard (Easy Mode)
**Test Cases:**
- [ ] View 6 main sections: Overview, Forecasts & Insights, Trading, Evolution Lab, Assistant, Settings
- [ ] Each section shows appropriate summary cards
- [ ] Navigation between sections works
- [ ] Tooltips display helpful information
- [ ] Quick actions are visible and functional
- [ ] System status indicators show current state

**Widgets to Test:**
- [ ] Account balance widget (shows correct balance)
- [ ] Recent predictions widget
- [ ] Active strategies count
- [ ] Recent trades list
- [ ] System health indicators
- [ ] Quick action buttons

### 3.2 Main Dashboard (Advanced Mode)
**Test Cases:**
- [ ] Toggle to Advanced Mode from header
- [ ] All technical sections visible
- [ ] Additional analytics available
- [ ] Direct access to all features
- [ ] Technical terminology displayed
- [ ] Performance metrics visible

**Toggle Behavior:**
- [ ] Easy ↔ Advanced mode toggle works
- [ ] Setting persists across sessions
- [ ] UI adapts appropriately to selected mode
- [ ] No data loss when switching modes

---

## 4. Data Ingestion & Market Data

### 4.1 Data Ingestion Configuration
**Test Cases:**
- [ ] Navigate to Settings → Data Ingestion
- [ ] View list of enabled symbols
- [ ] Add new symbol for tracking
- [ ] Remove symbol from tracking
- [ ] Configure data retention policies
- [ ] Trigger manual data fetch
- [ ] View data freshness indicators
- [ ] Check for data gaps

**API Endpoints to Test:**
- `GET /api/data-ingestion/symbols`
- `POST /api/data-ingestion/symbols`
- `DELETE /api/data-ingestion/symbols/{symbol}`
- `POST /api/data-ingestion/fetch`
- `GET /api/data-ingestion/status`
- `GET /api/data-ingestion/gaps`

**Validation:**
- [ ] New symbols start fetching data
- [ ] Removed symbols stop fetching
- [ ] Data retention policies are applied
- [ ] Gaps are detected and reported
- [ ] Manual fetch completes successfully

### 4.2 Real-Time Market Data
**Test Cases:**
- [ ] Subscribe to real-time price updates via WebSocket
- [ ] Verify prices update in real-time on Market page
- [ ] Test WebSocket reconnection on disconnect
- [ ] Multiple simultaneous symbol subscriptions
- [ ] Unsubscribe when navigating away

**WebSocket Endpoint:**
- `WS /ws/prices/{symbol}`

**Validation:**
- [ ] Prices update every second
- [ ] No data loss during connection issues
- [ ] WebSocket automatically reconnects
- [ ] UI shows connection status

### 4.3 Data Quality Checks
**Test Cases:**
- [ ] Run data freshness check script
- [ ] Verify all symbols have recent data (< 24 hours old)
- [ ] Check for duplicate entries
- [ ] Validate data completeness (no missing candles)
- [ ] Verify technical indicators calculate correctly

**Scripts to Run:**
```bash
python scripts/check_data_freshness.py
python scripts/diagnose_data_ingestion.py
python scripts/diagnose_stale_data.py
```

---

## 5. Forecasting & Predictions

### 5.1 View Forecasts
**Test Cases:**
- [ ] Navigate to Forecasts & Insights page
- [ ] View predictions for all tracked symbols
- [ ] Filter by symbol
- [ ] Filter by timeframe (1m, 1h, 1d)
- [ ] View prediction confidence scores
- [ ] See historical prediction accuracy
- [ ] View model used for each prediction

**API Endpoints to Test:**
- `GET /api/forecast/latest`
- `GET /api/forecast/symbol/{symbol}`
- `GET /api/forecast/accuracy`
- `GET /api/forecast/history`

**Validation:**
- [ ] Predictions show direction (up/down/neutral)
- [ ] Confidence scores between 0-1
- [ ] Timestamp shows when prediction was made
- [ ] Historical accuracy metrics displayed

### 5.2 Model Registry
**Test Cases:**
- [ ] Navigate to Models → Registry
- [ ] View list of all trained models
- [ ] Filter by symbol, horizon, algorithm
- [ ] View model performance metrics
- [ ] See model training history
- [ ] Trigger manual model retraining
- [ ] Delete old/underperforming models

**API Endpoints to Test:**
- `GET /api/models`
- `GET /api/models/{model_id}`
- `POST /api/models/train`
- `DELETE /api/models/{model_id}`
- `GET /api/models/performance`

**Validation:**
- [ ] Models show training date, algorithm, performance
- [ ] Retraining triggers successfully
- [ ] Old models can be deleted
- [ ] Active models marked clearly

### 5.3 Model Training
**Test Cases:**
- [ ] Trigger training for a specific symbol
- [ ] Monitor training progress
- [ ] Training completes successfully
- [ ] New model appears in registry
- [ ] Model metrics updated
- [ ] Model automatically used for predictions

**Training Parameters:**
- [ ] Test with different algorithms (LightGBM, RandomForest)
- [ ] Test with different horizons (1m, 1h, 1d)
- [ ] Test with different train/test splits

**Validation:**
- [ ] Training completes without errors
- [ ] Model achieves reasonable accuracy (>50%)
- [ ] Model saved to database correctly
- [ ] Predictions use new model

---

## 6. Strategy Evolution

### 6.1 Evolution Lab
**Test Cases:**
- [ ] Navigate to Evolution Lab
- [ ] View current evolution experiments
- [ ] Create new evolution experiment
- [ ] Configure evolution parameters (population size, generations, mutation rate)
- [ ] Start evolution run
- [ ] Monitor evolution progress via WebSocket
- [ ] View top-performing strategies from evolution
- [ ] Promote strategy to production

**API Endpoints to Test:**
- `GET /api/evolution/experiments`
- `POST /api/evolution/experiments`
- `GET /api/evolution/experiments/{id}`
- `POST /api/evolution/experiments/{id}/start`
- `DELETE /api/evolution/experiments/{id}`
- `GET /api/evolution/leaderboard`

**WebSocket Endpoint:**
- `WS /ws/evolution`

**Validation:**
- [ ] Evolution runs complete successfully
- [ ] Progress updates in real-time
- [ ] Top strategies identified
- [ ] Performance metrics calculated correctly

### 6.2 Strategy Management
**Test Cases:**
- [ ] Navigate to Analytics → Strategies
- [ ] View all strategies (evolved + manual)
- [ ] Filter by performance, date, status
- [ ] View strategy details (parameters, backtests)
- [ ] Enable/disable strategy for trading
- [ ] Clone strategy with modifications
- [ ] Delete underperforming strategy
- [ ] View strategy lineage (parent/children)

**API Endpoints to Test:**
- `GET /api/strategies`
- `GET /api/strategies/{id}`
- `PUT /api/strategies/{id}`
- `POST /api/strategies/{id}/enable`
- `POST /api/strategies/{id}/disable`
- `DELETE /api/strategies/{id}`

**Validation:**
- [ ] Strategies show complete parameters
- [ ] Backtested performance accurate
- [ ] Enabled strategies used for trading
- [ ] Disabled strategies not used

### 6.3 Strategy Backtesting
**Test Cases:**
- [ ] Select a strategy to backtest
- [ ] Configure backtest parameters (date range, initial capital)
- [ ] Run backtest
- [ ] View backtest results (ROI, Sharpe, drawdown)
- [ ] Compare multiple strategies
- [ ] Export backtest results

**Validation:**
- [ ] Backtest completes successfully
- [ ] Results match expected calculations
- [ ] Visualizations render correctly
- [ ] Can compare multiple backtests

---

## 7. Learning Engine

### 7.1 Learning Insights
**Test Cases:**
- [ ] Navigate to Analytics → Learning Insights
- [ ] View meta-learning progress
- [ ] See what the system has learned
- [ ] View Bayesian optimization results
- [ ] See feature importance analysis
- [ ] View knowledge base entries
- [ ] Monitor overfitting alerts

**API Endpoints to Test:**
- `GET /api/learning/insights`
- `GET /api/learning/meta-model`
- `GET /api/learning/feature-importance`
- `GET /api/knowledge`

**Validation:**
- [ ] Insights update as system learns
- [ ] Feature importance rankings reasonable
- [ ] Knowledge base grows over time
- [ ] Overfitting detected and alerted

### 7.2 Knowledge Base
**Test Cases:**
- [ ] Navigate to Knowledge page
- [ ] View all knowledge entries
- [ ] Filter by category (market, strategy, technical)
- [ ] Search knowledge base
- [ ] View knowledge details
- [ ] Add manual knowledge entry
- [ ] Delete outdated knowledge

**API Endpoints to Test:**
- `GET /api/knowledge`
- `POST /api/knowledge`
- `GET /api/knowledge/{id}`
- `DELETE /api/knowledge/{id}`

### 7.3 Portfolio Allocation
**Test Cases:**
- [ ] View current portfolio allocation
- [ ] See allocation recommendations
- [ ] Manually adjust allocations
- [ ] Apply recommended allocations
- [ ] Monitor allocation performance

**Validation:**
- [ ] Allocations sum to 100%
- [ ] Recommendations based on strategy performance
- [ ] Changes take effect immediately

---

## 8. AI Assistant

### 8.1 Chat Interface
**Test Cases:**
- [ ] Navigate to Assistant page
- [ ] Start new conversation
- [ ] Ask general question about system
- [ ] Ask about specific prediction
- [ ] Request trade recommendation
- [ ] Ask about recent trade
- [ ] Request explanation of strategy
- [ ] View conversation history

**API Endpoints to Test:**
- `POST /api/assistant/chat`
- `GET /api/assistant/conversations`
- `GET /api/assistant/conversations/{id}`
- `DELETE /api/assistant/conversations/{id}`

**Sample Questions to Test:**
- "Should I buy BTC right now?"
- "Why did the last trade lose money?"
- "What is the current market trend?"
- "Explain how the RandomForest model works"
- "What are the top strategies this week?"

**Validation:**
- [ ] Assistant responds with relevant information
- [ ] Responses include evidence/citations
- [ ] Trade recommendations include reasoning
- [ ] Conversation context maintained

### 8.2 Trade Recommendations
**Test Cases:**
- [ ] Request trade recommendation from assistant
- [ ] View recommendation with evidence
- [ ] Click "View Evidence" button
- [ ] Navigate to evidence page
- [ ] See detailed breakdown of recommendation
- [ ] Approve recommendation (converts to trade)
- [ ] Reject recommendation

**Validation:**
- [ ] Recommendations include: symbol, direction, size, confidence
- [ ] Evidence shows: model predictions, strategy signals, risk checks
- [ ] Approved recommendations create pending trades
- [ ] Rejected recommendations logged

### 8.3 Action Management
**Test Cases:**
- [ ] View pending actions from assistant
- [ ] Approve trade action
- [ ] Reject trade action
- [ ] View action history
- [ ] Filter actions by status

**API Endpoints to Test:**
- `GET /api/assistant/actions`
- `POST /api/assistant/actions/{id}/approve`
- `POST /api/assistant/actions/{id}/reject`

---

## 9. Trading Execution

### 9.1 Paper Trading Mode
**Test Cases:**
- [ ] Ensure system starts in paper trading mode
- [ ] Navigate to Trading page
- [ ] View simulated account balance
- [ ] Place manual market order
- [ ] Place manual limit order
- [ ] View order status
- [ ] Cancel pending order
- [ ] View trade history
- [ ] Check balance updates after trade

**API Endpoints to Test:**
- `GET /api/trading/account`
- `POST /api/trading/orders`
- `GET /api/trading/orders`
- `GET /api/trading/orders/{id}`
- `DELETE /api/trading/orders/{id}`
- `GET /api/trading/positions`
- `GET /api/trading/history`

**Validation:**
- [ ] Orders execute in simulation
- [ ] No real exchange calls made
- [ ] Balance updates correctly
- [ ] Trade history recorded
- [ ] No actual money at risk

### 9.2 Exchange Connection
**Test Cases:**
- [ ] Navigate to Settings → Trading
- [ ] Select exchange (Binance, Coinbase, etc.)
- [ ] Enter API credentials
- [ ] Test connection
- [ ] View account balance from exchange
- [ ] Enable testnet mode
- [ ] Switch between paper/testnet/live modes
- [ ] Verify mode indicator in header

**API Endpoints to Test:**
- `GET /api/exchange/list`
- `POST /api/exchange/connect`
- `GET /api/exchange/test`
- `GET /api/exchange/balance`

**Validation:**
- [ ] Connection successful with valid credentials
- [ ] Connection fails with invalid credentials
- [ ] Balance retrieved from exchange
- [ ] Mode switches correctly

### 9.3 Manual Trading
**Test Cases:**
- [ ] Place market buy order
- [ ] Place market sell order
- [ ] Place limit buy order
- [ ] Place limit sell order
- [ ] Place stop-loss order
- [ ] Place take-profit order
- [ ] Cancel pending order
- [ ] Modify pending order
- [ ] View real-time order status

**Order Types to Test:**
- [ ] Market orders (immediate execution)
- [ ] Limit orders (execute at specific price)
- [ ] Stop-loss orders (risk management)
- [ ] Take-profit orders (profit taking)

**Validation:**
- [ ] Orders submitted successfully
- [ ] Order status updates in real-time
- [ ] Filled orders update balance
- [ ] Cancelled orders don't execute
- [ ] Partial fills handled correctly

### 9.4 Automatic Trading
**Test Cases:**
- [ ] Navigate to Settings → Trading
- [ ] Enable automatic trading mode
- [ ] Set maximum trade size
- [ ] Set approval threshold
- [ ] Wait for system-generated trade
- [ ] Verify trade executed automatically
- [ ] Verify large trades require approval
- [ ] Disable automatic trading
- [ ] Verify no more auto trades

**Validation:**
- [ ] Auto trades execute within limits
- [ ] Large trades pause for approval
- [ ] Risk checks performed before trade
- [ ] All trades logged to audit trail

### 9.5 WebSocket Trading Updates
**Test Cases:**
- [ ] Connect to trading WebSocket
- [ ] Place order
- [ ] Verify real-time status updates
- [ ] Monitor order fill notifications
- [ ] Test reconnection on disconnect

**WebSocket Endpoint:**
- `WS /ws/trading`

**Validation:**
- [ ] Real-time updates received
- [ ] Updates match database state
- [ ] Connection stable
- [ ] Reconnects automatically

---

## 10. Risk Management

### 10.1 Risk Limits
**Test Cases:**
- [ ] Navigate to Risk Management page
- [ ] View current risk metrics
- [ ] Set daily loss limit
- [ ] Set position size limit
- [ ] Set maximum exposure limit
- [ ] Attempt trade exceeding limits (should block)
- [ ] Verify limit breach alerts

**API Endpoints to Test:**
- `GET /api/risk/metrics`
- `GET /api/risk/limits`
- `PUT /api/risk/limits`
- `POST /api/risk/check`

**Limit Types to Test:**
- [ ] Daily loss limit (% or fixed amount)
- [ ] Position size limit (max per trade)
- [ ] Exposure limit (max total at risk)
- [ ] Drawdown limit (stop if DD exceeds threshold)

**Validation:**
- [ ] Trades blocked when limits exceeded
- [ ] Alerts sent on limit approach
- [ ] Limits reset daily/weekly as configured
- [ ] Manual override requires admin approval

### 10.2 Kill Switch
**Test Cases:**
- [ ] Enable kill switch
- [ ] Verify all pending orders cancelled
- [ ] Verify all positions closed
- [ ] Verify no new trades can be placed
- [ ] Disable kill switch
- [ ] Verify trading can resume

**Validation:**
- [ ] Kill switch activates immediately
- [ ] All open orders cancelled
- [ ] Positions closed at market price
- [ ] System enters safe mode
- [ ] Notification sent to user

### 10.3 Stop-Loss Enforcement
**Test Cases:**
- [ ] Place trade without stop-loss (should require or auto-add)
- [ ] Place trade with stop-loss
- [ ] Verify stop-loss triggered when price hits level
- [ ] Verify position closed automatically
- [ ] Test trailing stop-loss

**Validation:**
- [ ] Stop-loss mandatory for all trades
- [ ] Stop-loss triggers correctly
- [ ] Position closed at or near stop price
- [ ] Loss limited as expected

### 10.4 Pre-Trade Risk Checks
**Test Cases:**
- [ ] Attempt trade with insufficient balance
- [ ] Attempt trade exceeding position size limit
- [ ] Attempt trade exceeding exposure limit
- [ ] Attempt trade violating correlation limits
- [ ] View risk check results before trade

**Pre-Trade Checks:**
- [ ] Balance check
- [ ] Position size check
- [ ] Exposure check
- [ ] Correlation check
- [ ] Volatility check
- [ ] Market hours check

**Validation:**
- [ ] All checks pass for valid trade
- [ ] Trade blocked if any check fails
- [ ] Clear error message shown
- [ ] Risk report generated

---

## 11. Analytics & Reports

### 11.1 Overview Analytics
**Test Cases:**
- [ ] Navigate to Analytics → Overview
- [ ] View portfolio performance chart
- [ ] See win rate statistics
- [ ] View profit/loss breakdown
- [ ] See trade distribution
- [ ] Filter by date range
- [ ] Export analytics data

**Metrics to Verify:**
- [ ] Total P&L
- [ ] Win rate (% profitable trades)
- [ ] Average win vs average loss
- [ ] Sharpe ratio
- [ ] Maximum drawdown
- [ ] Current drawdown

### 11.2 Strategy Performance
**Test Cases:**
- [ ] View strategy performance comparison
- [ ] See individual strategy metrics
- [ ] Compare strategies side-by-side
- [ ] View strategy contribution to portfolio
- [ ] Identify underperforming strategies

### 11.3 Daily Reports
**Test Cases:**
- [ ] Navigate to Reports page
- [ ] View list of daily reports
- [ ] Open today's report
- [ ] View report sections: summary, trades, performance, risk
- [ ] Download report as PDF
- [ ] Email report to user

**API Endpoints to Test:**
- `GET /api/reports`
- `GET /api/reports/{date}`
- `GET /api/reports/{date}/pdf`
- `POST /api/reports/{date}/email`

**Validation:**
- [ ] Report generated daily automatically
- [ ] All metrics accurate
- [ ] Charts and tables render correctly
- [ ] PDF export works
- [ ] Email delivery successful

### 11.4 Leaderboard
**Test Cases:**
- [ ] Navigate to Leaderboard page
- [ ] View top strategies by performance
- [ ] Filter by timeframe (day, week, month, all)
- [ ] Filter by strategy type (manual, evolved, meta)
- [ ] View strategy details from leaderboard

**API Endpoints to Test:**
- `GET /api/leaderboard`
- `GET /api/leaderboard/strategies`
- `GET /api/leaderboard/models`

---

## 12. Settings & Configuration

### 12.1 General Settings
**Test Cases:**
- [ ] Navigate to Settings → General
- [ ] Change display name
- [ ] Change email
- [ ] Change password
- [ ] Toggle Easy/Advanced mode preference
- [ ] Set default symbol
- [ ] Set default timeframe
- [ ] Save settings
- [ ] Verify settings persist

**API Endpoints to Test:**
- `GET /api/settings/user`
- `PUT /api/settings/user`

### 12.2 Trading Settings
**Test Cases:**
- [ ] Configure trading mode (paper/testnet/live)
- [ ] Set default order type
- [ ] Set default position size
- [ ] Enable/disable automatic trading
- [ ] Set approval thresholds
- [ ] Configure stop-loss defaults
- [ ] Configure take-profit defaults

**API Endpoints to Test:**
- `GET /api/settings/trading`
- `PUT /api/settings/trading`

### 12.3 Notification Settings
**Test Cases:**
- [ ] Navigate to Settings → Notifications
- [ ] Enable/disable notification types
- [ ] Set notification frequency
- [ ] Test email notifications
- [ ] Test browser notifications
- [ ] Configure alert thresholds

**Notification Types:**
- [ ] Trade executions
- [ ] Risk limit breaches
- [ ] Model training completion
- [ ] Evolution experiment results
- [ ] Daily reports
- [ ] System alerts

**API Endpoints to Test:**
- `GET /api/settings/notifications`
- `PUT /api/settings/notifications`

### 12.4 Data Retention Settings
**Test Cases:**
- [ ] Configure data retention policies
- [ ] Set retention period for candles
- [ ] Set retention period for trades
- [ ] Set retention period for logs
- [ ] Apply retention policies
- [ ] Verify old data deleted

---

## 13. Notifications

### 13.1 Notification Center
**Test Cases:**
- [ ] Click notification bell icon
- [ ] View notification dropdown
- [ ] See unread count
- [ ] Mark notification as read
- [ ] Mark all as read
- [ ] Delete notification
- [ ] Click notification to navigate to related page

**API Endpoints to Test:**
- `GET /api/notifications`
- `PUT /api/notifications/{id}/read`
- `PUT /api/notifications/read-all`
- `DELETE /api/notifications/{id}`

### 13.2 Real-Time Notifications
**Test Cases:**
- [ ] Connect to notification WebSocket
- [ ] Trigger event (e.g., place trade)
- [ ] Verify notification received in real-time
- [ ] Verify bell icon updates with new count
- [ ] Test with multiple browser tabs

**WebSocket Endpoint:**
- `WS /ws/notifications?token={jwt}`

**Validation:**
- [ ] Notifications arrive immediately
- [ ] Unread count updates
- [ ] No duplicate notifications
- [ ] Works across multiple tabs

---

## 14. Admin Features

### 14.1 User Management (Admin Only)
**Test Cases:**
- [ ] Log in as admin user
- [ ] Navigate to Admin page
- [ ] View all users
- [ ] Create new user
- [ ] Edit user details
- [ ] Disable user account
- [ ] Delete user account
- [ ] View user activity logs

**API Endpoints to Test:**
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/{id}`
- `DELETE /api/admin/users/{id}`

### 14.2 System Monitoring
**Test Cases:**
- [ ] View system health metrics
- [ ] Monitor database size
- [ ] View Redis queue status
- [ ] Monitor Celery workers
- [ ] View API request logs
- [ ] Monitor error rates

**API Endpoints to Test:**
- `GET /api/system/health`
- `GET /api/system/metrics`
- `GET /api/system/logs`

---

## 15. Mobile Responsiveness

### 15.1 Mobile Layout
**Test Cases:**
- [ ] Access site on mobile device (or Chrome DevTools mobile view)
- [ ] Verify responsive navigation menu
- [ ] Test all pages on mobile
- [ ] Verify charts render correctly
- [ ] Test trading interface on mobile
- [ ] Verify forms are usable
- [ ] Test WebSocket connections on mobile

**Screen Sizes to Test:**
- [ ] Mobile (320px - 480px)
- [ ] Tablet (481px - 768px)
- [ ] Desktop (769px+)

---

## 16. Performance Testing

### 16.1 Page Load Performance
**Test Cases:**
- [ ] Measure initial page load time
- [ ] Measure time to interactive
- [ ] Test with slow 3G connection
- [ ] Test with fast 4G connection
- [ ] Monitor bundle size

**Performance Targets:**
- [ ] Initial load < 3 seconds
- [ ] Time to interactive < 5 seconds
- [ ] Subsequent page navigation < 1 second

### 16.2 API Performance
**Test Cases:**
- [ ] Measure API response times
- [ ] Test concurrent requests
- [ ] Test with large datasets
- [ ] Monitor database query performance

**Performance Targets:**
- [ ] API responses < 500ms (simple queries)
- [ ] API responses < 2s (complex queries)
- [ ] WebSocket latency < 100ms

### 16.3 Load Testing
**Test Cases:**
- [ ] Simulate 10 concurrent users
- [ ] Simulate 50 concurrent users
- [ ] Simulate 100 concurrent users
- [ ] Monitor server resources (CPU, memory)
- [ ] Identify bottlenecks

---

## 17. Security Testing

### 17.1 Authentication Security
**Test Cases:**
- [ ] Attempt to access protected routes without token
- [ ] Test with expired JWT token
- [ ] Test with invalid JWT token
- [ ] Test with manipulated JWT token
- [ ] Verify password hashing (bcrypt)
- [ ] Test password reset flow
- [ ] Test rate limiting on login attempts

### 17.2 API Security
**Test Cases:**
- [ ] Test CORS configuration
- [ ] Verify API key encryption
- [ ] Test SQL injection protection (NoSQL in this case)
- [ ] Test XSS protection
- [ ] Verify input validation
- [ ] Test authorization (user can only access own data)

### 17.3 Exchange API Security
**Test Cases:**
- [ ] Verify API keys stored encrypted
- [ ] Test with read-only API keys
- [ ] Verify API keys not exposed in logs
- [ ] Test API key revocation flow

---

## 18. Error Handling & Edge Cases

### 18.1 Network Errors
**Test Cases:**
- [ ] Disconnect internet during operation
- [ ] Verify graceful degradation
- [ ] Test auto-reconnect for WebSockets
- [ ] Test retry logic for failed API calls
- [ ] Verify user-friendly error messages

### 18.2 Data Errors
**Test Cases:**
- [ ] Handle missing price data
- [ ] Handle corrupted model files
- [ ] Handle NaN/Infinity in calculations
- [ ] Handle empty database collections
- [ ] Handle malformed API responses

### 18.3 Exchange Errors
**Test Cases:**
- [ ] Handle exchange downtime
- [ ] Handle API rate limit errors
- [ ] Handle insufficient balance errors
- [ ] Handle invalid symbol errors
- [ ] Handle order rejection errors

### 18.4 User Input Validation
**Test Cases:**
- [ ] Submit form with missing required fields
- [ ] Submit form with invalid data types
- [ ] Submit form with out-of-range values
- [ ] Submit form with malicious input (XSS attempts)
- [ ] Verify client-side and server-side validation

---

## 19. Integration Testing

### 19.1 End-to-End User Flows

#### Flow 1: Complete First-Time User Journey
```
1. Register new account
2. Login for first time
3. Redirected to Get Started
4. Bootstrap historical data
5. Wait for data ingestion completion
6. Navigate to Dashboard
7. Explore Forecasts page
8. Ask Assistant a question
9. View Trading page
10. Configure Settings
11. Enable paper trading
12. Place first manual trade
13. View trade in history
14. Check daily report
```

#### Flow 2: Enable and Use Automatic Trading
```
1. Login to existing account
2. Navigate to Settings → Trading
3. Configure exchange connection (testnet)
4. Test connection
5. Enable automatic trading
6. Set trade size limits
7. Set approval thresholds
8. Navigate to Trading page
9. Wait for system-generated trade
10. Approve pending trade
11. Monitor trade execution
12. View trade results
13. Check risk metrics
```

#### Flow 3: Strategy Evolution and Deployment
```
1. Navigate to Evolution Lab
2. Create new evolution experiment
3. Configure parameters
4. Start evolution
5. Monitor progress via WebSocket
6. Wait for completion
7. View top strategies
8. Select best strategy
9. View backtest results
10. Promote to production
11. Enable for trading
12. Monitor strategy performance
```

#### Flow 4: Model Training and Forecasting
```
1. Navigate to Models → Registry
2. Trigger model training for BTC/USDT
3. Monitor training progress
4. Wait for completion
5. View model metrics
6. Navigate to Forecasts
7. View new predictions using trained model
8. Ask Assistant to explain prediction
9. Use prediction to inform trade
```

#### Flow 5: Risk Management Workflow
```
1. Navigate to Risk Management
2. Set daily loss limit to 5%
3. Set position size limit to 10% of balance
4. Place trades normally
5. Attempt trade exceeding limits (should block)
6. Verify alert received
7. Trigger stop-loss by price movement
8. Verify position closed automatically
9. Enable kill switch
10. Verify all positions closed and orders cancelled
```

### 19.2 External System Integration
**Test Cases:**
- [ ] MongoDB connection
- [ ] Redis connection
- [ ] Celery task execution
- [ ] Exchange API integration (Binance testnet)
- [ ] OpenAI/Anthropic LLM API (for Assistant)

---

## 20. Regression Testing

### 20.1 Core Functionality Regression
**After Each Deployment:**
- [ ] Authentication works
- [ ] Data ingestion works
- [ ] Model training works
- [ ] Forecasts generate correctly
- [ ] Trading execution works
- [ ] Risk checks function
- [ ] Assistant responds
- [ ] WebSockets connect
- [ ] Notifications deliver
- [ ] Reports generate

### 20.2 Critical Path Testing
**Quick Smoke Test (15 minutes):**
1. [ ] Login successful
2. [ ] Dashboard loads
3. [ ] Forecasts page loads with data
4. [ ] Trading page loads
5. [ ] Place paper trade successfully
6. [ ] Assistant responds to question
7. [ ] Settings save correctly
8. [ ] Logout successful

---

## 21. Browser Compatibility

### 21.1 Desktop Browsers
**Test On:**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Features to Verify:**
- [ ] All pages render correctly
- [ ] WebSockets work
- [ ] Notifications work
- [ ] LocalStorage works
- [ ] Charts render
- [ ] Forms submit correctly

### 21.2 Mobile Browsers
**Test On:**
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Android Firefox

---

## 22. Documentation Testing

### 22.1 README Accuracy
**Test Cases:**
- [ ] Follow quick start instructions
- [ ] Verify all prerequisites listed
- [ ] Test all code examples
- [ ] Verify all commands work
- [ ] Check all links

### 22.2 API Documentation
**Test Cases:**
- [ ] Verify all endpoints documented
- [ ] Test example requests
- [ ] Verify response schemas
- [ ] Check error codes

---

## 23. Backup & Recovery

### 23.1 Data Backup
**Test Cases:**
- [ ] Create database backup
- [ ] Verify backup file created
- [ ] Test backup restoration
- [ ] Verify data integrity after restore

### 23.2 Disaster Recovery
**Test Cases:**
- [ ] Simulate database failure
- [ ] Restore from backup
- [ ] Verify system operational
- [ ] Check no data loss

---

## Testing Checklist Summary

### Pre-Deployment Checklist
- [ ] All critical paths tested
- [ ] All user flows tested
- [ ] Security tests passed
- [ ] Performance tests passed
- [ ] Browser compatibility verified
- [ ] Mobile responsiveness verified
- [ ] Error handling tested
- [ ] Integration tests passed
- [ ] Documentation updated
- [ ] Backup/recovery tested

### Daily Testing (Production)
- [ ] System health check
- [ ] Data ingestion running
- [ ] Model predictions generating
- [ ] Trading execution working
- [ ] Risk checks functioning
- [ ] Notifications delivering
- [ ] Reports generating
- [ ] No critical errors in logs

### Weekly Testing (Production)
- [ ] Full regression test suite
- [ ] Performance metrics review
- [ ] Security audit
- [ ] Database optimization
- [ ] Log review
- [ ] User feedback review

---

## Bug Reporting Template

When issues are found during testing, use this template:

```markdown
### Bug Report

**Title:** [Brief description]

**Severity:** [Critical / High / Medium / Low]

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened]

**Environment:**
- Browser: 
- OS: 
- User Mode: Easy / Advanced
- Trading Mode: Paper / Testnet / Live

**Screenshots:**
[Attach if applicable]

**Console Errors:**
[Paste any error messages]

**Additional Notes:**
[Any other relevant information]
```

---

## Test Metrics to Track

### Quality Metrics
- Total test cases: [Count all checkboxes in this document]
- Tests passed: [Count]
- Tests failed: [Count]
- Tests skipped: [Count]
- Pass rate: [Passed / Total * 100%]

### Coverage Metrics
- API endpoint coverage: [Tested endpoints / Total endpoints * 100%]
- User flow coverage: [Tested flows / Total flows * 100%]
- Feature coverage: [Tested features / Total features * 100%]

### Performance Metrics
- Average page load time: [Measured]
- Average API response time: [Measured]
- WebSocket latency: [Measured]

### Defect Metrics
- Critical bugs found: [Count]
- High priority bugs: [Count]
- Medium priority bugs: [Count]
- Low priority bugs: [Count]
- Bugs fixed: [Count]

---

## Tools Recommended

### Testing Tools
- **Manual Testing:** Browser DevTools, Postman
- **API Testing:** Postman, Insomnia, curl
- **Performance Testing:** Lighthouse, WebPageTest
- **Load Testing:** Apache JMeter, Locust
- **Security Testing:** OWASP ZAP, Burp Suite
- **Browser Testing:** BrowserStack, LambdaTest
- **Monitoring:** Sentry, LogRocket

### Test Data Generation
- **Market Data:** Use historical data from exchange
- **User Data:** Faker.js for generating test users
- **Trade Data:** Scripted trade generator

---

## Testing Schedule

### Phase 1: Core Functionality (Week 1)
- Authentication & User Management
- Data Ingestion
- Dashboard & Navigation
- Settings Configuration

### Phase 2: Trading Features (Week 2)
- Paper Trading
- Manual Trading
- Risk Management
- Order Management

### Phase 3: ML & AI Features (Week 3)
- Model Training
- Forecasting
- Strategy Evolution
- AI Assistant

### Phase 4: Advanced Features (Week 4)
- Learning Engine
- Analytics & Reports
- Notifications
- WebSockets

### Phase 5: Integration & E2E (Week 5)
- End-to-end user flows
- External integrations
- Cross-feature testing
- Regression testing

### Phase 6: Performance & Security (Week 6)
- Performance testing
- Security audit
- Load testing
- Browser compatibility

---

## Sign-Off

### Testing Team Sign-Off
- [ ] QA Lead: __________________ Date: __________
- [ ] Developer: ________________ Date: __________
- [ ] Product Owner: ____________ Date: __________

### Deployment Approval
- [ ] All critical tests passed
- [ ] All high-priority bugs fixed
- [ ] Performance targets met
- [ ] Security requirements satisfied
- [ ] Documentation complete

**Approved for Deployment:** ☐ Yes ☐ No

**Approver:** __________________ Date: __________

---

## Notes & Observations

[Use this section to document any important findings, recommendations, or observations during testing]

---

**Document Version:** 1.0  
**Last Updated:** November 21, 2025  
**Next Review Date:** [Set based on project timeline]

