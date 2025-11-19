# Starting the CryptoTrader System

Complete guide to starting the backend, frontend, pulling crypto data, and beginning trading operations.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Starting the Backend](#starting-the-backend)
4. [Starting the Frontend](#starting-the-frontend)
5. [Pulling Crypto Data](#pulling-crypto-data)
6. [Starting Trading Operations](#starting-trading-operations)
7. [Verification & Testing](#verification--testing)
8. [Common Issues & Solutions](#common-issues--solutions)

---

## Prerequisites

### Required Software

Before starting, ensure you have the following installed:

#### 1. Python 3.11+
**Check if installed:**
```bash
python --version
```

**Install if needed:**
- **Windows**: Download from [python.org](https://www.python.org/downloads/)
- **macOS**: `brew install python@3.11`
- **Linux**: `sudo apt install python3.11 python3.11-venv`

#### 2. Node.js 18+
**Check if installed:**
```bash
node --version
```

**Install if needed:**
- **Windows/macOS/Linux**: Download from [nodejs.org](https://nodejs.org/)
- **Alternative**: Use [nvm](https://github.com/nvm-sh/nvm) (recommended)

#### 3. MongoDB 6+

**Option A: Docker (Easiest)**
```bash
docker pull mongo:8.2
docker run -d -p 27017:27017 --name cryptotrader-mongo mongo:8.2
```

**Option B: Local Installation**
- **Windows**: Download from [mongodb.com](https://www.mongodb.com/try/download/community)
- **macOS**: `brew install mongodb-community`
- **Linux**: Follow [MongoDB installation guide](https://www.mongodb.com/docs/manual/administration/install-on-linux/)

**Option C: MongoDB Atlas (Cloud)**
1. Create free account at [mongodb.com/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster (M0)
3. Get connection string (e.g., `mongodb+srv://user:pass@cluster.mongodb.net/cryptotrader`)

#### 4. Redis 6+

**Option A: Docker (Easiest)**
```bash
docker pull redis:7.2-alpine
docker run -d -p 6379:6379 --name cryptotrader-redis redis:7.2-alpine
```

**Option B: Local Installation**
- **Windows**: Use [Redis for Windows](https://github.com/microsoftarchive/redis/releases) or WSL
- **macOS**: `brew install redis`
- **Linux**: `sudo apt install redis-server`

**Option C: Cloud Redis**
- Use [Redis Cloud](https://redis.com/try-free/) (free tier available)
- Or [Upstash](https://upstash.com/) (serverless Redis)

---

## Initial Setup

### Step 1: Clone and Navigate to Project

```bash
# If not already cloned
git clone <your-repo-url>
cd lenxys-trader
```

### Step 2: Configure Environment Variables

```bash
# Copy example environment file
cp env.example .env
```

Now edit the `.env` file with your configuration:

```bash
# Open with your preferred editor
notepad .env        # Windows
nano .env           # Linux/macOS
```

**Required Configuration:**

```env
# Database
MONGO_URI=mongodb://localhost:27017/cryptotrader
# If using Atlas: mongodb+srv://user:password@cluster.mongodb.net/cryptotrader

# Background Workers
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
CELERY_EXPERIMENT_QUEUE=experiments

# Trading Symbols (customize as needed)
DEFAULT_SYMBOLS=BTC/USDT,ETH/USDT,SOL/USDT,BNB/USDT,DCR/USDT

# Data Collection Intervals
FEATURE_INTERVALS=1m,1h,1d

# Exchange API Keys (Optional for data collection, required for trading)
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_api_secret_here

# AI Assistant (Optional)
ASSISTANT_LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_key_here
OPENAI_MODEL=gpt-4o-mini

# Reports
REPORT_OUTPUT_DIR=reports/output
```

**Important Notes:**
- Leave `BINANCE_API_KEY` empty initially if just collecting data
- For paper trading, API keys are optional
- For live trading, API keys are mandatory

### Step 3: Install Python Dependencies

```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
```

### Step 4: Install Frontend Dependencies

```bash
cd web/next-app
npm install
cd ../..
```

### Step 5: Verify Services are Running

**Check MongoDB:**
```bash
# Try to connect
mongosh mongodb://localhost:27017/cryptotrader
# Or if using Atlas, use your connection string
```

**Check Redis:**
```bash
# Windows (if installed locally)
redis-cli ping
# Should return: PONG

# Or test connection with Python
python -c "import redis; r = redis.Redis(host='localhost', port=6379); print(r.ping())"
```

---

## Starting the Backend

The backend consists of three components that need to run simultaneously:

### Component 1: FastAPI Server

This is the main API server that handles all HTTP requests.

**Open Terminal 1:**

```bash
# Make sure you're in the project root
cd /path/to/lenxys-trader

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Start FastAPI server
cd api
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using StatReload
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**Test the API:**
```bash
# In a new terminal
curl http://localhost:8000/api/status
# Should return: {"status":"ok"}
```

### Component 2: Celery Worker

This handles background tasks like model training and strategy evolution.

**Open Terminal 2:**

```bash
# Navigate to project root
cd /path/to/lenxys-trader

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Start Celery worker
celery -A manager.tasks:celery_app worker --loglevel=info --pool=solo
```

**Note for Windows Users:**
- Add `--pool=solo` flag as Celery on Windows doesn't support the default pool
- Alternatively, use WSL (Windows Subsystem for Linux)

**Expected Output:**
```
 -------------- celery@HOSTNAME v5.3.4
---- **** -----
--- * ***  * -- Windows-10.0.26100 2024-11-19 10:00:00
-- * - **** ---
- ** ---------- [config]
- ** ---------- .> app:         cryptotrader:0x...
- ** ---------- .> transport:   redis://localhost:6379/0
- ** ---------- .> results:     redis://localhost:6379/0
- *** --- * --- .> concurrency: 4 (solo)
-- ******* ---- .> task events: OFF
--- ***** -----
 -------------- [queues]
                .> celery           exchange=celery(direct) key=celery

[tasks]
  . manager.tasks.run_training
  . manager.tasks.run_evolution
  . manager.tasks.run_learning_cycle

[2024-11-19 10:00:00,000: INFO/MainProcess] Connected to redis://localhost:6379/0
[2024-11-19 10:00:00,100: INFO/MainProcess] mingle: searching for neighbors
[2024-11-19 10:00:01,150: INFO/MainProcess] mingle: all alone
[2024-11-19 10:00:01,200: INFO/MainProcess] celery@HOSTNAME ready.
```

### Component 3: Redis & MongoDB

These should already be running from the prerequisites setup.

**Verify they're running:**

```bash
# Check Redis
redis-cli ping

# Check MongoDB
mongosh --eval "db.serverStatus().ok"
```

### Alternative: Using Docker Compose (All-in-One)

If you have Docker installed, you can start everything at once:

```bash
# Navigate to docker directory
cd docker

# Start all services
docker-compose up --build

# To run in background (detached mode)
docker-compose up -d --build
```

**This starts:**
- MongoDB
- Redis
- FastAPI backend
- Celery worker
- Next.js frontend

**View logs:**
```bash
docker-compose logs -f
```

**Stop all services:**
```bash
docker-compose down
```

---

## Starting the Frontend

**Open Terminal 3:**

```bash
# Navigate to frontend directory
cd /path/to/lenxys-trader/web/next-app

# Start development server
npm run dev
```

**Expected Output:**
```
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
event - compiled client and server successfully in 2.5s (565 modules)
```

**Access the Dashboard:**
1. Open browser
2. Navigate to `http://localhost:3000`
3. You should see the CryptoTrader dashboard

**For Production Build:**
```bash
# Build the application
npm run build

# Start production server
npm start
```

---

## Pulling Crypto Data

Now that the system is running, you need to populate it with historical cryptocurrency data.

### Method 1: Using the Web Interface (Easiest)

1. **Open Dashboard**: Navigate to `http://localhost:3000`
2. **Go to "Get Started" Page**: Click on "Get Started" in the navigation
3. **Bootstrap Data**: Follow the guided workflow to:
   - Select symbols to track
   - Choose timeframes (1m, 1h, 1d)
   - Set lookback period (e.g., 90 days)
   - Click "Start Data Collection"

### Method 2: Using Python Scripts (Recommended for Initial Load)

**Step 1: Seed Symbols**

This registers the trading pairs you want to track:

```bash
# Make sure virtual environment is activated
cd /path/to/lenxys-trader

# Seed default symbols from .env
python scripts/seed_symbols.py
```

**Expected Output:**
```
Seeded 5 symbols.
```

**Step 2: Fetch Historical Data**

This downloads price data from exchanges:

```bash
# Fetch all configured symbols and intervals
python -m data_ingest.fetcher

# Fetch specific symbol
python -m data_ingest.fetcher --symbol BTC/USDT --interval 1h --lookback-days 90

# Fetch with custom parameters
python -m data_ingest.fetcher \
  --symbol ETH/USDT \
  --interval 1d \
  --lookback-days 365 \
  --limit 1000
```

**Expected Output:**
```
2024-11-19 10:00:00 INFO Fetching BTC/USDT 1m candles (batch=1000, lookback_days=90)
2024-11-19 10:00:02 INFO Stored 129600 candles for BTC/USDT 1m
2024-11-19 10:00:02 INFO Fetching BTC/USDT 1h candles (batch=1000, lookback_days=90)
2024-11-19 10:00:04 INFO Stored 2160 candles for BTC/USDT 1h
2024-11-19 10:00:04 INFO Fetching BTC/USDT 1d candles (batch=1000, lookback_days=90)
2024-11-19 10:00:05 INFO Stored 90 candles for BTC/USDT 1d
2024-11-19 10:00:05 INFO Completed ingestion: 131850 total candles upserted
```

**Parameters Explained:**
- `--symbol`: Trading pair (e.g., BTC/USDT, ETH/USDT)
- `--interval`: Timeframe (1m, 5m, 15m, 1h, 4h, 1d)
- `--lookback-days`: How many days of history to fetch
- `--limit`: Max candles per API call (default: 1000)
- `--since`: UNIX timestamp (ms) to start from

**Step 3: Schedule Continuous Data Collection**

To keep data updated, set up a scheduled job:

**Option A: Using Cron (Linux/macOS)**
```bash
# Edit crontab
crontab -e

# Add this line to fetch data every hour
0 * * * * cd /path/to/lenxys-trader && /path/to/.venv/bin/python -m data_ingest.fetcher
```

**Option B: Using Task Scheduler (Windows)**
1. Open Task Scheduler
2. Create Basic Task
3. Name: "CryptoTrader Data Fetch"
4. Trigger: Daily, repeat every 1 hour
5. Action: Start a program
   - Program: `C:\path\to\.venv\Scripts\python.exe`
   - Arguments: `-m data_ingest.fetcher`
   - Start in: `C:\path\to\lenxys-trader`

**Option C: Using the Built-in Scheduler**
```bash
# The script in data_ingest/schedule_fetch.sh can be used
chmod +x data_ingest/schedule_fetch.sh
./data_ingest/schedule_fetch.sh
```

### Method 3: Using the API

You can also trigger data collection via API calls:

```bash
# Trigger data collection for a specific symbol
curl -X POST http://localhost:8000/api/admin/ingest \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTC/USDT", "interval": "1h", "lookback_days": 30}'
```

### Verify Data Collection

**Using MongoDB Shell:**
```bash
mongosh mongodb://localhost:27017/cryptotrader

# Count total candles
db.ohlcv.countDocuments()

# Check latest candles for BTC/USDT
db.ohlcv.find({symbol: "BTC/USDT", interval: "1h"}).sort({timestamp: -1}).limit(5)

# Check data coverage
db.ohlcv.aggregate([
  {$group: {
    _id: {symbol: "$symbol", interval: "$interval"},
    count: {$sum: 1},
    earliest: {$min: "$timestamp"},
    latest: {$max: "$timestamp"}
  }}
])
```

**Using the API:**
```bash
# Check available symbols
curl http://localhost:8000/api/admin/symbols

# Check data status
curl http://localhost:8000/api/admin/data-status
```

**Using the Dashboard:**
1. Go to `http://localhost:3000`
2. Navigate to "Analytics" or "Forecasts"
3. Check if data is displayed for your symbols

---

## Starting Trading Operations

Now that you have data, you can begin trading operations. **Always start with paper trading!**

### Step 1: Configure Trading Settings

**Via Web Interface:**

1. **Open Settings**: Navigate to `http://localhost:3000/settings`
2. **Go to Trading Tab**: Click "Trading" in the settings menu
3. **Configure Account Mode**:
   - Start with **"Paper Trading"** (simulated, no real money)
   - After testing, try **"Testnet"** (Binance testnet with fake money)
   - Finally, **"Live Trading"** (real money, high risk)

4. **Set Risk Limits**:
   ```
   Daily Loss Limit: $100 (or your comfort level)
   Max Position Size: $500
   Max Total Exposure: $1000
   Stop Loss: 2% (mandatory)
   ```

5. **Configure Exchange**:
   - Exchange: Binance (or your preferred exchange)
   - API Key: (enter your key)
   - API Secret: (enter your secret)
   - Enable Testnet: ✓ (for testing)

6. **Save Settings**

**Via Environment File:**

Edit `.env` file:
```env
# Exchange credentials
BINANCE_API_KEY=your_key_here
BINANCE_API_SECRET=your_secret_here

# Account mode (paper, testnet, live)
TRADING_MODE=paper

# Risk limits
DAILY_LOSS_LIMIT_USD=100
MAX_POSITION_SIZE_USD=500
MAX_TOTAL_EXPOSURE_USD=1000
STOP_LOSS_PCT=2.0
```

### Step 2: Train Machine Learning Models

Before trading, train models to predict price movements:

**Option A: Via Web Interface**
1. Go to `http://localhost:3000/models`
2. Click "Train New Model"
3. Select:
   - Symbol: BTC/USDT
   - Horizon: 1h
   - Algorithm: LightGBM
4. Click "Start Training"
5. Wait for completion (check status on Models page)

**Option B: Via API**
```bash
curl -X POST http://localhost:8000/api/models/train \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USDT",
    "horizon": "1h",
    "algorithm": "lightgbm",
    "lookback_days": 90
  }'
```

**Option C: Via Script**
```bash
# Train models for all symbols and horizons
python scripts/run_retraining.py

# This will train models for:
# - All symbols in DEFAULT_SYMBOLS
# - All intervals in FEATURE_INTERVALS
# - Using both LightGBM and RandomForest
```

**Expected Output:**
```
Training model for BTC/USDT 1h...
Features shape: (2160, 45)
Training set: 1728 samples
Test set: 432 samples
Model accuracy: 0.573
Model saved: model_BTC-USDT_1h_lightgbm_20241119.pkl
```

**Monitor Training:**
- Check `http://localhost:3000/models/registry` for model status
- Training takes 5-30 minutes depending on data size
- Models are automatically versioned and stored

### Step 3: Generate Trading Strategies

**Option A: Manual Strategy Creation**
1. Go to `http://localhost:3000/strategies`
2. Click "Create Strategy"
3. Configure parameters:
   ```
   Name: Momentum Strategy
   Entry Signal: RSI < 30 and MACD crossover
   Exit Signal: RSI > 70 or stop loss
   Position Size: 2% of portfolio
   Stop Loss: 2%
   Take Profit: 5%
   ```
4. Save strategy

**Option B: Automated Strategy Evolution**
```bash
# Run strategy evolution (genetic algorithm)
python scripts/run_experiments.py --generations 10 --population 50

# This will:
# - Generate random strategies
# - Backtest them on historical data
# - Evolve the best performers
# - Save top strategies to database
```

**Expected Output:**
```
Generation 1: Best fitness = 0.15 (15% return)
Generation 2: Best fitness = 0.22 (22% return)
Generation 3: Best fitness = 0.28 (28% return)
...
Generation 10: Best fitness = 0.45 (45% return)
Top 10 strategies saved to database
```

**View Strategy Leaderboard:**
- Go to `http://localhost:3000/evolution`
- See top-performing strategies
- Review backtest results
- Enable strategies for live trading

### Step 4: Enable Automated Trading

**Important: Start with Manual/Semi-Automatic Mode**

1. **Set Automation Level**:
   - Go to `http://localhost:3000/settings/trading`
   - Choose automation mode:
     - **Manual**: You approve every trade
     - **Semi-Automatic**: System suggests, you approve
     - **Automatic**: System trades automatically

2. **Configure Approval Thresholds**:
   ```
   Require approval for trades > $100
   Require approval for positions > 5% of portfolio
   Auto-approve small trades (< $50)
   ```

3. **Enable Kill Switch** (Emergency Stop):
   - Go to `http://localhost:3000/risk`
   - Enable kill switch
   - Set trigger conditions (e.g., 5% daily loss)

4. **Start Trading**:
   - Go to `http://localhost:3000/trading`
   - Click "Enable Automatic Trading"
   - Confirm safety acknowledgment
   - Monitor trades in real-time

### Step 5: Monitor Trading Activity

**Real-Time Monitoring:**

1. **Trading Dashboard**: `http://localhost:3000/trading`
   - View open positions
   - See pending orders
   - Monitor P&L (profit/loss)

2. **Risk Dashboard**: `http://localhost:3000/risk`
   - Current exposure
   - Risk metrics (VaR, drawdown)
   - Daily loss tracking
   - Kill switch status

3. **AI Assistant**: `http://localhost:3000/assistant`
   - Ask questions: "Why did you buy BTC?"
   - Get recommendations: "Should I sell ETH now?"
   - Request explanations: "Explain my current positions"

**Log Files:**
```bash
# View trading logs
tail -f logs/trading.log

# View model predictions
tail -f logs/forecasts.log

# View all activity
tail -f logs/system.log
```

**Alerts & Notifications:**
- Check notification center (bell icon in dashboard)
- Receive alerts for:
  - Large trades executed
  - Stop losses triggered
  - Daily loss limit approaching
  - Model retraining completed
  - Strategy performance alerts

### Step 6: Using the AI Assistant for Trading

The AI assistant can help make trading decisions:

1. **Ask for Recommendations**:
   ```
   "Should I buy BTC right now?"
   "What's the outlook for ETH?"
   "Which assets should I trade today?"
   ```

2. **Request Analysis**:
   ```
   "Analyze BTC/USDT 1h chart"
   "What indicators are bullish for SOL?"
   "Show me top opportunities"
   ```

3. **Get Trade Approval**:
   ```
   "I want to buy 0.1 BTC, what do you think?"
   "Approve trade: Buy ETH $500"
   ```

4. **Review Past Decisions**:
   ```
   "Why did we close the SOL position?"
   "Show me trades from yesterday"
   "Explain the BNB trade at 10:30"
   ```

**Access Assistant:**
- Web: `http://localhost:3000/assistant`
- API: `POST http://localhost:8000/api/assistant/chat`

---

## Verification & Testing

### Health Checks

**1. API Health:**
```bash
curl http://localhost:8000/api/status
# Expected: {"status":"ok"}
```

**2. Frontend Health:**
```bash
curl http://localhost:3000
# Should return HTML content
```

**3. Database Health:**
```bash
# Check MongoDB
mongosh --eval "db.serverStatus().ok" mongodb://localhost:27017/cryptotrader

# Check Redis
redis-cli ping
```

**4. Worker Health:**
```bash
# Check Celery worker status
celery -A manager.tasks:celery_app inspect active
```

### Functional Tests

**1. Data Collection Test:**
```bash
# Fetch small dataset
python -m data_ingest.fetcher --symbol BTC/USDT --interval 1h --lookback-days 1

# Verify in database
mongosh mongodb://localhost:27017/cryptotrader --eval "db.ohlcv.countDocuments({symbol:'BTC/USDT'})"
```

**2. Model Training Test:**
```bash
# Train a quick model
curl -X POST http://localhost:8000/api/models/train \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTC/USDT", "horizon": "1h", "algorithm": "lightgbm"}'

# Check model status
curl http://localhost:8000/api/models/list
```

**3. Forecast Test:**
```bash
# Generate forecast
curl http://localhost:8000/api/forecast/BTC-USDT?horizon=1h

# Should return prediction data
```

**4. Paper Trade Test:**
```bash
# Execute paper trade
curl -X POST http://localhost:8000/api/trading/order \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USDT",
    "side": "buy",
    "amount": 0.001,
    "order_type": "market",
    "account_mode": "paper"
  }'

# Check positions
curl http://localhost:8000/api/trading/positions
```

### End-to-End Test

Complete workflow test:

```bash
# 1. Seed symbols
python scripts/seed_symbols.py

# 2. Fetch 7 days of data
python -m data_ingest.fetcher --lookback-days 7

# 3. Train model
python scripts/run_retraining.py

# 4. Generate strategies
python scripts/run_experiments.py --generations 5

# 5. Run learning cycle
python scripts/run_learning_cycle.py

# 6. Check everything via API
curl http://localhost:8000/api/status
curl http://localhost:8000/api/models/list
curl http://localhost:8000/api/strategies
curl http://localhost:8000/api/forecast/BTC-USDT
```

---

## Common Issues & Solutions

### Issue 1: Backend Won't Start

**Error:** `ModuleNotFoundError: No module named 'fastapi'`

**Solution:**
```bash
# Ensure virtual environment is activated
source .venv/bin/activate  # macOS/Linux
.venv\Scripts\activate     # Windows

# Reinstall dependencies
pip install -r requirements.txt
```

### Issue 2: Frontend Won't Start

**Error:** `Error: Cannot find module 'next'`

**Solution:**
```bash
cd web/next-app
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Issue 3: MongoDB Connection Failed

**Error:** `pymongo.errors.ServerSelectionTimeoutError`

**Solution:**
```bash
# Check if MongoDB is running
# For local installation:
sudo systemctl status mongod  # Linux
brew services list | grep mongodb  # macOS

# Start MongoDB if not running:
sudo systemctl start mongod  # Linux
brew services start mongodb-community  # macOS

# For Docker:
docker ps | grep mongo
docker start cryptotrader-mongo
```

### Issue 4: Redis Connection Failed

**Error:** `redis.exceptions.ConnectionError`

**Solution:**
```bash
# Check Redis status
redis-cli ping

# If not running, start it:
sudo systemctl start redis  # Linux
brew services start redis  # macOS
docker start cryptotrader-redis  # Docker
```

### Issue 5: No Data Being Fetched

**Error:** `No candles returned for BTC/USDT`

**Solution:**
```bash
# Check symbol format (must match exchange format)
# Binance uses: BTC/USDT, ETH/USDT
# Coinbase uses: BTC-USD, ETH-USD

# Check exchange connectivity
python -c "import ccxt; exchange = ccxt.binance(); print(exchange.fetch_ticker('BTC/USDT'))"

# Check if symbol is available on exchange
python -c "import ccxt; exchange = ccxt.binance(); markets = exchange.load_markets(); print('BTC/USDT' in markets)"
```

### Issue 6: Model Training Fails

**Error:** `ValueError: not enough samples`

**Solution:**
```bash
# Need more historical data
python -m data_ingest.fetcher --symbol BTC/USDT --interval 1h --lookback-days 90

# Check data availability
mongosh cryptotrader --eval "db.ohlcv.countDocuments({symbol:'BTC/USDT', interval:'1h'})"
# Should have at least 2160 documents (90 days * 24 hours)
```

### Issue 7: Celery Worker Not Processing Tasks

**Error:** Tasks stuck in pending state

**Solution:**
```bash
# On Windows, use solo pool
celery -A manager.tasks:celery_app worker --loglevel=info --pool=solo

# Check if worker is connected
celery -A manager.tasks:celery_app inspect active

# Purge stuck tasks
celery -A manager.tasks:celery_app purge

# Restart worker
# Ctrl+C to stop, then restart
```

### Issue 8: Port Already in Use

**Error:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
# Find process using the port
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux:
lsof -ti:3000 | xargs kill -9

# Or use different port:
PORT=3001 npm run dev
```

### Issue 9: API Key Invalid

**Error:** `ccxt.AuthenticationError: Invalid API Key`

**Solution:**
1. Check API key in `.env` file
2. Ensure no extra spaces or newlines
3. Verify key permissions on exchange:
   - Read permission required for data
   - Trade permission required for live trading
4. Check if IP whitelist is set on exchange
5. Test with testnet first:
   ```env
   BINANCE_TESTNET=true
   BINANCE_TESTNET_API_KEY=your_testnet_key
   BINANCE_TESTNET_API_SECRET=your_testnet_secret
   ```

### Issue 10: Out of Memory

**Error:** `MemoryError` or system freezes

**Solution:**
```bash
# Reduce batch size in data fetching
python -m data_ingest.fetcher --limit 500

# Reduce model training data window
# Edit model training to use last 30 days instead of 90

# Increase system swap space (Linux):
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Use Docker with memory limits:
docker-compose up --build --scale worker=1 --memory="2g"
```

---

## Quick Reference Commands

### Starting Everything (Manual)

```bash
# Terminal 1: MongoDB (if not using Docker)
mongod

# Terminal 2: Redis (if not using Docker)
redis-server

# Terminal 3: Backend API
cd lenxys-trader
source .venv/bin/activate
cd api && uvicorn main:app --reload

# Terminal 4: Celery Worker
cd lenxys-trader
source .venv/bin/activate
celery -A manager.tasks:celery_app worker --loglevel=info

# Terminal 5: Frontend
cd lenxys-trader/web/next-app
npm run dev
```

### Starting Everything (Docker)

```bash
cd lenxys-trader/docker
docker-compose up -d
```

### Data Operations

```bash
# Initial data load (90 days)
python -m data_ingest.fetcher --lookback-days 90

# Update data (last 2 days)
python -m data_ingest.fetcher --lookback-days 2

# Specific symbol and timeframe
python -m data_ingest.fetcher --symbol BTC/USDT --interval 1h --lookback-days 30
```

### Model Operations

```bash
# Train all models
python scripts/run_retraining.py

# View models
curl http://localhost:8000/api/models/list

# Get forecast
curl http://localhost:8000/api/forecast/BTC-USDT?horizon=1h
```

### Trading Operations

```bash
# View positions
curl http://localhost:8000/api/trading/positions

# View orders
curl http://localhost:8000/api/trading/orders

# View account balance
curl http://localhost:8000/api/trading/balance

# Emergency stop all trading
curl -X POST http://localhost:8000/api/risk/kill-switch
```

---

## Next Steps

1. ✅ **System Running**: All components started
2. ✅ **Data Collected**: Historical price data loaded
3. ✅ **Models Trained**: ML models ready
4. ✅ **Trading Active**: Paper trading enabled

**Now You Can:**

- **Monitor**: Watch trades and predictions in dashboard
- **Learn**: Review AI assistant explanations
- **Optimize**: Use evolution lab to discover better strategies
- **Scale**: Add more symbols and timeframes
- **Deploy**: Move to testnet, then eventually live trading

**Recommended Reading:**
- `docs/INFRASTRUCTURE.md` - Deploy for 24/7 operation
- `docs/TESTING_REGIME_UI.md` - Test market regime features
- `docs/macro_analysis_integration.md` - Advanced macro analysis

---

**🎉 Congratulations! Your CryptoTrader system is now fully operational.**

For deployment and 24/7 operation, see [INFRASTRUCTURE.md](./INFRASTRUCTURE.md).

