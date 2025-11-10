# 🧠 Autonomous Quant Trading System — Complete Roadmap

**A Self-Evolving Multi-Agent Crypto Research & Trading Platform**

## 📘 Overview

This system is a modular AI-driven trading laboratory that evolves from raw data ingestion to autonomous, self-improving strategy research. It unites machine learning, explainability, autonomous experimentation, and a human-in-the-loop promotion layer to safely manage trading agents.

The platform progresses through 7 distinct phases (0-6), each building upon the previous:

- **Phases 0-1:** Data infrastructure + ML forecasting models
- **Phases 2-3:** Strategy evolution + learning engine
- **Phase 4:** AI assistant for human interaction
- **Phase 5:** Live trading with guard rails
- **Phase 6:** Full autonomous evolution

---

## 🎯 Core Objectives

1. **Autonomous Operation** – system continuously trades, analyzes, and learns with minimal human input
2. **Explainable Intelligence** – every decision is recorded, scored, and interpretable
3. **Evolutionary Adaptation** – creates, tests, and promotes better strategies automatically
4. **Safety & Auditability** – nothing critical executes live without human confirmation; all logs are immutable
5. **Scalability** – modular Python backend (FastAPI + Celery + MongoDB) with Next.js frontend
6. **Unified Product Experience** – every phase ships matching backend services and Tailwind + shadcn-powered frontend modules with light/dark theme support

---

## 🏗️ System Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                  User Dashboard (Next.js)                      │
│      Real-time metrics • Evolution Lab • Manual controls       │
└────────────────────────────┬──────────────────────────────────┘
                             │ REST / WebSocket
                             ▼
┌───────────────────────────────────────────────────────────────┐
│                      FastAPI Gateway                           │
│            Auth • Endpoints: /data, /strategy, /evolution      │
└─────────┬────────────────────────────────────┬────────────────┘
          │                                     │
          ▼                                     ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│  Data & Model Layer     │         │  Trading Engine Layer   │
│  • Data ingestion       │         │  • Execution engine     │
│  • Feature generation   │         │  • Risk manager         │
│  • Model training       │         │  • Backtester           │
│  • Model registry       │         │  • Live runner          │
└────────┬────────────────┘         └────────┬────────────────┘
         │                                    │
         └──────────────┬─────────────────────┘
                        ▼
┌───────────────────────────────────────────────────────────────┐
│           Evolution & Knowledge Layer                          │
│   evolution/engine • mutator • evaluator • promoter            │
│   ai/hypothesis_agent • knowledge/base                         │
└────────────────────────────┬──────────────────────────────────┘
                             ▼
┌───────────────────────────────────────────────────────────────┐
│              Storage & Infrastructure                          │
│  MongoDB (genomes, runs, logs) • Redis • Celery • Docker      │
└───────────────────────────────────────────────────────────────┘
```

---

## 📋 Phase Breakdown

### Phase 0 — Foundations (Quick Wins)

**Goal:** Get minute/hour/day historical data in MongoDB, compute features, run simple strategies in a simulator, and produce daily reports + a tiny Next.js dashboard.

**Key Deliverables:**
- ✅ Historical OHLCV data pipeline (ccxt → MongoDB)
- ✅ Feature engineering (EMA, RSI, MACD, volatility)
- ✅ Simple backtester with virtual accounts
- ✅ FastAPI + Next.js dashboard
- ✅ Daily reports generation
- ✅ Tailwind + shadcn dashboard covering bootstrap workflow, strategies table, revamped reports hub with artifact links, and a persistent light/dark toggle + settings page storing auto-refresh preferences

**Tech Stack:** Python 3.11+, MongoDB, FastAPI, Next.js, ccxt, pandas-ta, pytest

**Duration:** 1-2 weeks

**See:** [`p0.md`](./p0.md) for full details

---

### Phase 1 — Multi-horizon Forecast + Ensemble

**Goal:** Build separate forecasting models for multiple horizons (1m, 1h, 1d) and wrap them into an ensemble manager that produces signals + confidence.

**Key Deliverables:**
- ✅ Target construction for each horizon (future returns)
- ✅ Train LightGBM/RandomForest per horizon
- ✅ Model registry in MongoDB with metrics
- ✅ Forecast API (`/api/forecast`)
- ✅ Ensemble manager combining multiple models
- ✅ Integration with backtester
- ✅ Forecast Studio frontend (forecasts explorer + model registry) built with Tailwind + shadcn, responsive and theme-aware

**New Dependencies:** LightGBM, XGBoost, joblib, SHAP

**Duration:** 2-3 weeks

**See:** [`p1.md`](./p1.md) for full details

---

### Phase 2 — Strategy Genome & Multi-Account Experimentation

**Goal:** Represent strategies as genomes, run parallel simulations across virtual accounts, evaluate them, mutate top performers, and produce daily leaderboards.

**Key Deliverables:**
- ✅ Strategy genome schema (params, rules, risk settings)
- ✅ Evolver (mutation & crossover)
- ✅ Experiment runner (parallel backtests)
- ✅ Metrics: ROI, Sharpe, drawdown, forecast alignment
- ✅ Daily leaderboard generation
- ✅ Basic AI assistant for strategy comparison
- ✅ Evolution Lab UI (leaderboards, scatter plots, lineage graph) using shared Tailwind + shadcn components

**Duration:** 2-3 weeks

**See:** [`p2.md`](./p2.md) for full details

---

### Phase 3 — Learning & Mutation Engine

**Goal:** Make the system self-improving by learning why winners win, using Bayesian optimization to generate new strategies, and dynamically reallocating capital.

**Key Deliverables:**
- ✅ Meta-model predicting fitness from genome features
- ✅ Bayesian optimizer for strategy search
- ✅ Capital allocator (portfolio optimization)
- ✅ Overfitting detector (walk-forward decay)
- ✅ Learning loop scheduler (daily/weekly)
- ✅ Learning Insights Hub frontend showing meta-model feature importances, allocator decisions, overfitting alerts (light/dark)

**New Dependencies:** optuna, scikit-optimize, cvxpy

**Duration:** 2-3 weeks

**See:** [`p3.md`](./p3.md) for full details

---

### Phase 4 — Personal Assistant + Conversational Analysis

**Goal:** Build the user-facing AI assistant that explains system decisions, provides trade recommendations with approval flows, and maintains audit trails.

**Key Deliverables:**
- ✅ Conversational chat UI (Next.js)
- ✅ LLM-backed explanations (grounded in data)
- ✅ Trade recommendation objects with approval flows
- ✅ Evidence retrieval system
- ✅ Audit trail for all decisions
- ✅ Two-step confirmation for sensitive actions
- ✅ Assistant workspace polished with Tailwind + shadcn, theme toggle, responsive chat + approvals

**New Dependencies:** LLM provider (OpenAI/Anthropic or local), vector DB (optional)

**Duration:** 2-3 weeks

**See:** [`p4.md`](./p4.md) for full details

---

### Phase 5 — Exchange Integration & Real Trading

**Goal:** Connect to exchanges (starting with Binance testnet), implement robust execution, risk controls, and full auditability for paper → live trading.

**Key Deliverables:**
- ✅ Exchange connectors (ccxt + exchange SDKs)
- ✅ Order manager (lifecycle, fills, reconciliation)
- ✅ Risk manager (pre-trade checks, kill-switch)
- ✅ Paper trading mode
- ✅ Proof-of-execution storage
- ✅ Real-time monitoring & alerting
- ✅ Daily reconciliation
- ✅ Trading Control Center frontend (positions, orders, risk gauges, approval modals) with Tailwind + shadcn light/dark support

**Security Focus:** API key management, 2FA, limited permissions, audit logs

**Duration:** 3-4 weeks

**See:** [`p5.md`](./p5.md) for full details

---

### Phase 6 — Adaptive Intelligence & Strategy Evolution

**Goal:** Transform the system into a fully autonomous trading researcher that observes performance, mutates strategies, discovers new signals, and continuously improves.

**Key Deliverables:**
- ✅ Autonomous experimentation framework
- ✅ Evolution engine (observe → select → mutate → simulate → evaluate → promote)
- ✅ Knowledge base storing learnings
- ✅ Hypothesis agent (LLM reasoning)
- ✅ Evolution dashboard with lineage visualization
- ✅ Weekly insight reports
- ✅ Autonomous Evolution Dashboard frontend (experiment board, knowledge timeline, controls) styled with Tailwind + shadcn themes

**Duration:** 3-4 weeks

**See:** [`p6.md`](./p6.md) for full details

---

## 🖥️ Frontend Roadmap by Phase

| Phase | New / Updated Pages | Key Components | Settings Surface | Backend APIs Consumed |
|-------|---------------------|----------------|------------------|-----------------------|
| **P0** | `/`, `/strategies`, `/reports`, `/reports/[date]`, `/settings` | `BootstrapForm`, `CoverageTable`, `StrategySparkline`, `ReportList`, `ThemeToggle` | `/settings` (local storage; future `/api/settings`) | `/api/status`, `/api/admin/overview`, `/api/admin/bootstrap`, `/api/run/sim`, `/api/reports` |
| **P1** | `/forecasts`, `/models/registry`, dashboard forecast cards | `ForecastTabs`, `ForecastTable`, `ModelRegistryTable`, `ModelDetailsDrawer`, `EnsembleSignalCard` | `/settings` → `/api/settings/models` | `/api/forecast`, `/api/forecast/batch`, `/api/models/registry`, `/api/models/{id}`, `/api/models/retrain`, `/api/settings/models` |
| **P2** | `/evolution`, `/settings/experiments`, strategies comparison | `EvolutionLeaderboardTable`, `FitnessScatterChart`, `LineageGraph`, `MutationQueueDrawer`, `GenomeComparisonPanel` | `/settings/experiments` | `/api/leaderboard/today`, `/api/strategies/genomes`, `/api/experiments/queue`, `/api/strategies/{id}`, `/api/strategies/promote`, `/api/experiments/run`, `/api/settings/experiments` |
| **P3** | `/insights`, `/settings/learning`, evolution sidebar | `InsightsTabs`, `FeatureImportanceHeatmap`, `AllocatorAllocationChart`, `OverfitAlertTable`, `KnowledgeSummaryCard` | `/settings/learning` | `/api/learning/meta-model`, `/api/learning/allocator`, `/api/learning/overfit`, `/api/knowledge/latest`, `/api/settings/learning` |
| **P4** | `/assistant`, `/assistant/evidence/[id]`, `/settings/assistant` | `ChatTranscript`, `RecommendationCard`, `ApprovalModal`, `EvidenceDrawer`, `NotificationCenter` | `/settings/assistant` | `/api/assistant/query`, `/api/assistant/history`, `/api/assistant/recommendations`, `/api/assistant/evidence/{id}`, `/api/settings/assistant`, `/api/audit/assistant` |
| **P5** | `/trading`, `/risk`, `/settings/trading`, assistant handoff | `TradingTabs`, `PositionsTable`, `OrderBlotter`, `RiskGaugeCard`, `ApprovalWizard`, `KillSwitchPanel` | `/settings/trading` | `/api/trading/positions`, `/api/trading/orders`, `/api/trading/fills`, `/ws/trading`, `/api/risk/summary`, `/api/admin/kill-switch`, `/api/settings/trading`, `/api/audit/trading` |
| **P6** | `/evolution/autonomy`, `/knowledge`, `/settings/autonomy` | `ExperimentKanbanBoard`, `SchedulerStatusBadge`, `KnowledgeTimeline`, `AutonomyAlertDrawer`, `SafetyGuardSummary` | `/settings/autonomy` | `/api/evolution/experiments`, `/api/evolution/promote`, `/api/evolution/schedulers`, `/ws/evolution`, `/api/knowledge/search`, `/api/settings/autonomy` |

---

## 🔗 Phase Dependencies

```
Phase 0 (Foundations)
    ↓
Phase 1 (ML Models) ← requires Phase 0 data & features
    ↓
Phase 2 (Strategy Genome) ← requires Phase 0 backtester + Phase 1 forecasts
    ↓
Phase 3 (Learning Engine) ← requires Phase 2 genome framework
    ↓
Phase 4 (AI Assistant) ← requires Phases 1-3 for data to explain
    ↓
Phase 5 (Live Trading) ← requires Phase 4 approval flows
    ↓
Phase 6 (Evolution) ← requires all previous phases for full autonomy
```

### Key Dependencies:

| Phase | Depends On | Reason |
|-------|-----------|---------|
| P1 | P0 | Needs historical data and features |
| P2 | P0, P1 | Needs backtester and forecast models |
| P3 | P2 | Needs genome framework to optimize |
| P4 | P1, P2, P3 | Needs data/metrics/strategies to explain |
| P5 | P4 | Needs approval flows before live trading |
| P6 | P0-P5 | Needs complete system for autonomous operation |

---

## 🗄️ Data Model (MongoDB Collections)

| Collection | Purpose |
|------------|---------|
| `ohlcv` | Raw price data (OHLCV candles) |
| `features` | Computed indicators and features |
| `sim_runs` | Backtest and simulation results |
| `daily_reports` | Generated daily summaries |
| `models.registry` | ML model metadata and paths |
| `strategies` | Strategy genomes and fitness scores |
| `evolution_results` | Evolution cycle outcomes |
| `knowledge_base` | Weekly learnings and insights |
| `trade_logs` | Live/paper trade execution records |
| `audit_logs` | All assistant interactions and decisions |
| `orders` | Exchange order lifecycle tracking |

---

## 🧰 Tech Stack Summary

| Layer | Technology |
|-------|------------|
| **Backend** | Python 3.11, FastAPI, Celery, Redis, MongoDB |
| **Frontend** | React, Next.js, Tailwind CSS, shadcn/ui, next-themes |
| **ML/AI** | LightGBM, XGBoost, scikit-learn, PyTorch (optional) |
| **Data** | ccxt, pandas, numpy, pandas-ta |
| **LLM** | OpenAI/Anthropic or local (llama.cpp, Ollama) |
| **Optimization** | optuna, cvxpy, scipy |
| **Compute** | Docker, docker-compose |
| **Monitoring** | Grafana, Prometheus (optional), Slack/Telegram alerts |
| **Deployment** | Docker, Nginx, PM2 |

---

## ⏱️ Timeline Estimate

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 0 | 1-2 weeks | 2 weeks |
| Phase 1 | 2-3 weeks | 5 weeks |
| Phase 2 | 2-3 weeks | 8 weeks |
| Phase 3 | 2-3 weeks | 11 weeks |
| Phase 4 | 2-3 weeks | 14 weeks |
| Phase 5 | 3-4 weeks | 18 weeks |
| Phase 6 | 3-4 weeks | 22 weeks |

**Total Estimated Time:** 18-22 weeks (~4-5 months) for full system

---

## 🔒 Safety & Risk Management

### Built-in Safeguards:

1. **Paper-first policy** – all new strategies start in paper mode
2. **Testnet → micro-live → full-live** progression
3. **Kill-switch** – immediate halt of all trading
4. **Pre-trade checks** – balance, exposure, daily loss limits
5. **Human approval** required for:
   - Large trades (> threshold)
   - Enabling auto-mode
   - Promoting strategies to live
6. **Audit trails** – immutable logs of all decisions
7. **Reconciliation** – daily exchange vs internal ledger checks
8. **Overfitting detection** – automatic flagging of degraded performance
9. **Rollback capability** – restore previous working configurations

---

## 📊 Key Metrics Tracked

| Category | Metrics |
|----------|---------|
| **Data** | Latency, coverage, anomalies |
| **Models** | RMSE, MAE, directional accuracy, Sharpe |
| **Strategies** | ROI, Sharpe, drawdown, hit rate, exposure |
| **Evolution** | Generation count, win rate, lineage depth |
| **System** | Uptime, task latency, error rates |
| **Trading** | PnL, fills, slippage, reconciliation accuracy |

---

## 🚀 Getting Started

### Prerequisites:

- Python 3.11+
- Node.js 18+
- MongoDB 6+ (local or Atlas)
- Docker & docker-compose (recommended)

### Quick Start:

```bash
# Clone repository
git clone <repo-url>
cd lenxys-trader

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start with Docker
docker-compose up --build

# Or manually:
# Terminal 1: Start MongoDB
mongod

# Terminal 2: Start FastAPI
cd api && uvicorn main:app --reload

# Terminal 3: Start Next.js
cd web/next-app && npm run dev
```

### Phase 0 Initial Setup:

1. Seed database with symbols: `python scripts/seed_symbols.py`
2. Fetch historical data: `python data_ingest/fetcher.py --symbol BTC/USDT --days 30`
3. Compute features: `python features/features.py`
4. Run first backtest: `python simulator/runner.py`
5. Access dashboard: `http://localhost:3000`

---

## 📚 Documentation Structure

- **`p0.md`** – Phase 0: Foundations
- **`p1.md`** – Phase 1: Multi-horizon Forecast
- **`p2.md`** – Phase 2: Strategy Genome
- **`p3.md`** – Phase 3: Learning Engine
- **`p4.md`** – Phase 4: AI Assistant
- **`p5.md`** – Phase 5: Live Trading
- **`p6.md`** – Phase 6: Evolution
- **`full.md`** – This complete overview

---

## ⚠️ Important Notes & Gaps

### Logical Progression Notes:

1. **Phase 3 before Phase 4**: The learning engine (P3) is placed before the AI assistant (P4). This makes sense because the assistant needs mature strategies and learnings to explain. However, some users might want conversational insights earlier.

2. **Risk Management**: Risk controls are primarily introduced in Phase 5 (live trading), but basic risk parameters exist in Phase 0's simulator. This is intentional but should be clear.

3. **Model Retraining**: Introduced in Phase 1 but enhanced significantly in Phase 6 with autonomous learning. The progression is logical but Phase 1's retraining is more manual.

4. **LLM Integration**: First appears in Phase 2 (basic assistant) but is fully fleshed out in Phase 4. Users should be aware that early phases have limited AI explanations.

### Potential Gaps:

1. **Data Quality Monitoring**: Not explicitly covered until later phases. Consider adding data validation early in Phase 0.

2. **Cost Management**: No explicit discussion of API costs, compute costs, or LLM costs across phases.

3. **Disaster Recovery**: Backup and recovery procedures not detailed until Phase 5.

4. **Multi-exchange Support**: Phase 5 starts with Binance testnet. Expanding to other exchanges not covered.

5. **Regulatory Compliance**: Audit logs exist but no explicit regulatory reporting or tax considerations.

6. **Team Collaboration**: System designed for single user. Multi-user access control not addressed.

---

## 🎯 Success Criteria

The system is considered complete when:

- ✅ Data pipeline continuously ingests multi-timeframe OHLCV data
- ✅ ML models trained and evaluated for 1m, 1h, 1d horizons
- ✅ Strategy genomes autonomously mutate and improve
- ✅ AI assistant explains all decisions with evidence
- ✅ Live trading operational with all safety guards active
- ✅ Evolution engine produces weekly insights
- ✅ All logs auditable and reconciliation < 0.1% error
- ✅ System operates 24/7 with minimal human intervention
- ✅ Positive risk-adjusted returns demonstrated over 90 days

---

## 🔮 Future Enhancements (Post-Phase 6)

- **Phase 7:** Macro & on-chain awareness (sentiment, funding rates, blockchain metrics)
- **Phase 8:** Multi-strategy portfolio meta-allocator
- **Phase 9:** Distributed evolution grid (thousands of parallel experiments)
- **Phase 10:** Cross-exchange arbitrage
- **Phase 11:** Options and derivatives strategies
- **Phase 12:** Community strategy marketplace

---

## 📞 Support & Contribution

For questions, issues, or contributions, please refer to:
- GitHub Issues
- Documentation wiki
- Community Discord (if applicable)

---

**Built with ❤️ for autonomous quantitative trading**
