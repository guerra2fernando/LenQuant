<div align="center">
  <img src="logo.png" alt="LenQuant Logo" width="120" height="120">
</div>

# LenQuant — Autonomous Crypto Trading Platform

An intelligent, self-learning cryptocurrency trading system that uses machine learning to predict market movements, automatically execute trades, and continuously improve its strategies.

## 🎯 What This System Does

### Simple Explanation
LenQuant is like having an AI assistant that watches the crypto markets 24/7, learns from past price movements, predicts where prices might go, and can automatically buy or sell cryptocurrencies for you. It starts in "practice mode" (paper trading) so you can test it safely before using real money.

### Advanced Explanation
A production-ready autonomous trading platform featuring:
- **Multi-horizon ML forecasting** using ensemble models (LightGBM/RandomForest) trained on multiple timeframes (1m, 1h, 1d)
- **Strategy evolution engine** that automatically creates, tests, and improves trading strategies using genetic algorithms
- **Learning engine** with Bayesian optimization and meta-modeling to understand why successful strategies work
- **AI assistant** powered by LLMs (OpenAI/Anthropic) that explains decisions and provides trade recommendations
- **Exchange integration** via ccxt supporting 100+ exchanges (Binance, Coinbase, Kraken, etc.) with paper trading, testnet, and live trading modes
- **Risk management** with pre-trade checks, kill-switches, daily loss limits, and mandatory stop-loss enforcement
- **Full auditability** with immutable logs, proof-of-execution storage, and daily reconciliation

## ✨ Key Capabilities

### Trading Modes
- **Paper Trading**: Simulated trading with virtual money (no risk)
- **Testnet Trading**: Real exchange testnet (Binance testnet supported)
- **Live Trading**: Real money trading with comprehensive safety guards

### Automation Levels
- **Manual Mode**: You approve every trade
- **Semi-Automatic**: System suggests trades, you approve
- **Automatic Mode**: System trades automatically (with configurable limits and approvals for large trades)

### Supported Exchanges
The system uses the [ccxt library](https://github.com/ccxt/ccxt), which supports **100+ cryptocurrency exchanges**, including:
- **Binance** (spot, futures, testnet)
- **Coinbase Pro**
- **Kraken**
- **Bybit**
- **OKX**
- **And 95+ more exchanges**

You can connect to any exchange that ccxt supports by configuring your API credentials in the settings.

### Core Features

#### 📊 Data & Analytics
- Historical price data ingestion from exchanges
- Real-time market data processing
- Technical indicator calculation (EMA, RSI, MACD, volatility, etc.)
- Multi-timeframe analysis (1 minute, 1 hour, 1 day)

#### 🤖 Machine Learning
- Automated model training for price prediction
- Ensemble forecasting combining multiple models
- Model performance tracking and evaluation
- Automatic retraining on schedule
- SHAP explainability for model decisions

#### 🧬 Strategy Evolution
- Genetic algorithm-based strategy creation
- Automatic strategy mutation and crossover
- Parallel backtesting of thousands of strategies
- Performance leaderboards
- Strategy lineage tracking

#### 🧠 Learning Engine
- Meta-model that learns from successful strategies
- Bayesian optimization for strategy search
- Portfolio allocation optimization
- Overfitting detection and alerts
- Knowledge base storing system learnings

#### 💬 AI Assistant
- Conversational interface for asking questions
- Trade recommendations with evidence
- Explanations of system decisions
- Historical analysis and insights
- Approval workflows for trades

#### 🛡️ Risk Management
- Pre-trade risk checks (balance, exposure, limits)
- Daily loss limits
- Position size limits
- Global kill-switch (emergency stop)
- Stop-loss enforcement
- Real-time risk monitoring

#### 📈 Trading Execution
- Order management (limit, market orders)
- Partial fill handling
- Slippage protection
- Order reconciliation
- Real-time position tracking
- Trade audit logs

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB 6+ (local or Atlas)
- Docker & docker-compose (recommended)

### Installation

```bash
# Clone repository
git clone <repo-url>
cd lenxys-trader

# Set up environment
cp .env.example .env
# Edit .env with your configuration (MongoDB URI, API keys, etc.)

# Start with Docker
docker-compose up --build

# Or manually:
# Terminal 1: Start MongoDB
mongod

# Terminal 2: Start FastAPI backend
cd api && uvicorn main:app --reload

# Terminal 3: Start Next.js frontend
cd web/next-app && npm run dev
```

### Initial Setup

1. **Access the dashboard**: Open `http://localhost:3000`
2. **Choose your mode**: Switch between "Easy Mode" (guided) or "Advanced Mode" (full control)
3. **Set up data**: Use the "Get Started" page to bootstrap historical data
4. **Configure trading**: Go to Settings → Trading to set up your exchange connection
5. **Start with paper trading**: All trades default to paper mode until you enable live trading

## 📖 User Interface

The platform offers two modes:

### Easy Mode
- Simplified navigation (6 main sections)
- Plain language explanations
- Guided workflows
- Step-by-step trading flows
- Contextual help tooltips

### Advanced Mode
- Full technical interface
- All features accessible
- Direct controls
- Technical terminology
- Complete analytics

Switch between modes anytime using the toggle in the header.

## 🔧 Configuration

### Exchange Setup
1. Create API keys on your chosen exchange
2. Set appropriate permissions (read-only for testing, trading for live)
3. Add credentials to `.env` file or via Settings → Trading
4. Start with testnet/paper mode before going live

### Trading Settings
- Configure account modes (paper, testnet, live)
- Set risk limits (daily loss, position size, exposure)
- Enable/disable automatic trading
- Configure approval thresholds

### Model Training
- Set training schedules (daily, weekly)
- Choose algorithms (LightGBM, RandomForest)
- Configure horizons (1m, 1h, 1d)
- Set retraining triggers

## 📚 Documentation

### Getting Started
- **`docs/STARTING_SYSTEM.md`** — Complete guide to starting the system ⭐
- **`docs/AUTHENTICATION.md`** — Google OAuth setup for public deployment 🔒
- **`docs/AUTHENTICATION_PHASE1.md`** — Single-user authentication implementation
- **`docs/AUTHENTICATION_PHASE2.md`** — Multi-user authentication implementation
- **`docs/INFRASTRUCTURE.md`** — Production deployment and 24/7 operation

### System Documentation
- **`docs/full.md`** — Complete system overview
- **`docs/ux.md`** — User experience improvements and dual-mode interface
- **`docs/p0.md` through `docs/p6.md`** — Detailed feature documentation
- **`docs/fixes.md`** — Implementation status and fixes

## ❓ Frequently Asked Questions

### Can it trade by itself?
**Yes, with safety controls.** The system can trade automatically in "Automatic Mode," but:
- Large trades require your approval (configurable threshold)
- Daily loss limits automatically stop trading if exceeded
- You can enable a kill-switch to immediately halt all trading
- All trades are logged and auditable
- You can switch to manual or semi-automatic mode anytime

### Which places can I buy crypto through this?
**Any exchange supported by ccxt** (100+ exchanges). Popular options include:
- **Binance** (recommended for beginners, excellent testnet)
- **Coinbase Pro**
- **Kraken**
- **Bybit**
- **OKX**

The system uses the ccxt library, so if an exchange is listed in [ccxt's supported exchanges](https://docs.ccxt.com/#/README?id=supported-cryptocurrency-exchange-markets), you can connect to it. Just add your API credentials in Settings → Trading.

### Is it safe to use with real money?
**Yes, with proper setup.** The system includes multiple safety features:
- **Paper trading by default** — all trades start in simulation mode
- **Testnet support** — test with real exchange APIs using fake money
- **Risk limits** — daily loss limits, position size caps, exposure limits
- **Kill-switch** — emergency stop button that cancels all orders
- **Approval workflows** — large trades require manual approval
- **Audit logs** — every decision is recorded and traceable
- **Reconciliation** — daily checks ensure internal records match exchange records

**Important**: Always start with paper trading, then testnet, then small amounts in live trading. Never risk more than you can afford to lose.

### How does it predict prices?
The system uses **machine learning models** trained on historical price data:
- Multiple models analyze different timeframes (1 minute, 1 hour, 1 day)
- Models learn patterns from technical indicators (RSI, MACD, volatility, etc.)
- An ensemble combines predictions from all models for better accuracy
- Models are automatically retrained as new data arrives
- The system tracks prediction accuracy and adjusts accordingly

### Can I customize the trading strategies?
**Yes, extensively.** You can:
- Adjust risk parameters (stop-loss, take-profit, position sizes)
- Configure which indicators to use
- Set confidence thresholds for automatic trading
- Create custom strategy parameters
- Use the Evolution Lab to automatically discover new strategies
- Manually approve or reject strategy suggestions

### What happens if the system makes a bad trade?
**Multiple safeguards protect you:**
- **Stop-loss orders** automatically limit losses
- **Daily loss limits** pause trading if losses exceed your threshold
- **Position size limits** prevent oversized trades
- **Kill-switch** lets you immediately stop all trading
- **Paper trading mode** lets you test strategies without risk

You can review all trades in the Trading page and see detailed explanations in the Assistant.

### Does it work 24/7?
**Yes.** The system runs continuously:
- Monitors markets around the clock
- Executes trades automatically (if enabled)
- Retrains models on schedule
- Evolves new strategies in the background
- Sends alerts for important events

You can access the dashboard anytime to check status, review trades, or adjust settings.

### How much does it cost to run?
**Costs depend on usage:**
- **Self-hosted**: Free (your server costs)
- **Exchange fees**: Standard trading fees from your exchange
- **LLM costs**: Optional (for AI assistant) — uses OpenAI/Anthropic APIs
- **Data**: Free (uses exchange APIs)

No subscription fees — it's open source and self-hosted.

### Can I use it without coding knowledge?
**Yes, in Easy Mode.** The Easy Mode interface provides:
- Plain language explanations
- Guided workflows
- Step-by-step setup
- Visual indicators and tooltips
- Simplified trading flows

Advanced Mode is available for users who want full technical control.

### What cryptocurrencies can I trade?
**Any cryptocurrency pair available on your connected exchange.** Common pairs include:
- BTC/USDT, ETH/USDT, SOL/USDT
- And thousands of other pairs depending on your exchange

The system is symbol-agnostic — it works with any trading pair your exchange supports.

### How accurate are the predictions?
**Accuracy varies by market conditions and timeframe:**
- Short-term predictions (1 minute) are more volatile
- Longer-term predictions (1 day) tend to be more stable
- The system tracks accuracy metrics and shows confidence scores
- Models are continuously retrained to improve performance

**Important**: No prediction system is 100% accurate. Always use risk management (stop-losses, position sizing) and never risk more than you can afford to lose.

### Can I backtest strategies before using them?
**Yes, extensively.** The system includes:
- Built-in backtester for testing strategies on historical data
- Strategy comparison tools
- Performance metrics (ROI, Sharpe ratio, drawdown)
- Evolution Lab for automatically discovering strategies
- Paper trading for real-time testing without risk

### Is my data and API keys secure?
**Yes, with proper setup:**
- API keys stored in environment variables (never in code)
- Supports read-only API keys for testing
- All sensitive data encrypted in transit
- Audit logs track all API access
- You control where data is stored (local MongoDB or cloud)

**Best practice**: Use API keys with minimal required permissions, enable 2FA on your exchange account, and never share your `.env` file.

## 🎯 Next Steps

### For New Users
1. **Start with Easy Mode** — Use the guided interface to get familiar
2. **Set up paper trading** — Test the system risk-free
3. **Connect to testnet** — Use Binance testnet to test with real exchange APIs
4. **Review predictions** — Check the Forecasts/Insights page to see what the system predicts
5. **Try the Assistant** — Ask questions and get trade recommendations
6. **Enable automatic trading** — Start with small limits and manual approvals

### For Advanced Users
1. **Configure model training** — Set up automated retraining schedules
2. **Explore Evolution Lab** — Let the system discover new strategies
3. **Tune risk parameters** — Adjust limits based on your risk tolerance
4. **Set up monitoring** — Configure alerts for important events
5. **Review learning insights** — Understand what the system is learning
6. **Optimize portfolio allocation** — Use the allocator to balance strategies

### Development Roadmap
- **Multi-exchange arbitrage** — Trade across multiple exchanges
- **Options and derivatives** — Support for advanced trading instruments
- **On-chain data integration** — Incorporate blockchain metrics
- **Sentiment analysis** — Add social media and news sentiment
- **Mobile app** — Native mobile application
- **Community features** — Strategy sharing and marketplace

## 🛠️ Technical Stack

- **Backend**: Python 3.11, FastAPI, Celery, MongoDB, Redis
- **Frontend**: React, Next.js, Tailwind CSS, shadcn/ui
- **ML/AI**: LightGBM, XGBoost, scikit-learn, SHAP
- **Trading**: ccxt (100+ exchange support)
- **LLM**: OpenAI, Anthropic (configurable)
- **Deployment**: Docker, docker-compose

## 📊 System Status

The platform includes:
- ✅ Data ingestion and feature engineering
- ✅ Multi-horizon ML forecasting
- ✅ Strategy evolution engine
- ✅ Learning and optimization engine
- ✅ AI assistant with recommendations
- ✅ Exchange integration (paper, testnet, live)
- ✅ Risk management and safety guards
- ✅ Dual-mode user interface (Easy/Advanced)
- ✅ Comprehensive audit logging

## 🤝 Contributing

Contributions welcome! Please see the documentation in `docs/` for architecture details and development guidelines.

## ⚠️ Disclaimer

**Trading cryptocurrencies involves substantial risk of loss.** This software is provided as-is for educational and research purposes. Past performance does not guarantee future results. Always:
- Start with paper trading
- Use risk management (stop-losses, position sizing)
- Never risk more than you can afford to lose
- Understand that automated trading can amplify losses
- Comply with local regulations regarding cryptocurrency trading

## 📞 Support

For questions, issues, or contributions:
- Check the documentation in `docs/`
- Review the FAQ section above
- Open an issue on GitHub

---

**Built for autonomous quantitative trading with safety and transparency at its core.**
