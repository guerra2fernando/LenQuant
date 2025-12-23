# LenQuant Binance Futures Assistant

**Real-time AI Trading Coach for Binance Futures, Integrated with LenQuant**

Transform your trading with intelligent market analysis, behavioral guardrails, and comprehensive journaling—all within your Binance Futures interface.

---

## 🎯 Key Advantages

### ⚡ Real-Time Market Intelligence
- **Sub-500ms Analysis**: Instant market state classification (trending, ranging, choppy) without waiting
- **Regime-Aware Leverage**: Dynamic position sizing based on current market volatility and trend strength
- **Setup Detection**: Automatic identification of high-probability patterns (pullback continuation, breakouts, compression)
- **Risk Flags**: Immediate warnings for dangerous conditions (low volume, extreme volatility, overbought/oversold)

### 🧠 AI-Powered Trade Planning
- **On-Demand Explanations**: Get detailed trade plans with entry triggers, invalidation levels, and targets
- **Evidence-Based Analysis**: Every recommendation backed by technical indicators and regime data
- **Confidence Scoring**: Know exactly how strong each setup is before risking capital

### 🛡️ Behavioral Guardrails
- **Revenge Trading Detection**: Alerts when entering too quickly after a loss
- **Overtrading Prevention**: Tracks your trade frequency and warns when you're overactive
- **Chop Market Alerts**: Prevents costly entries in unfavorable conditions
- **Cooldown System**: Self-imposed or automatic breaks to reset emotional state

### 📊 Comprehensive Journaling & Analytics
- **Automatic Event Logging**: Every context change, analysis, and trade captured
- **Trade Sync**: Import actual trades from Binance Futures for complete accuracy
- **Performance Reports**: Daily, weekly, and monthly breakdowns with actionable insights
- **Equity Curves**: Track your growth with visual PnL progression
- **Pattern Performance**: See which setups work best for your trading style

### 🔄 Seamless Integration
- **Native Binance UI**: Panel blends perfectly with Binance's dark theme
- **Non-Intrusive**: Collapsible panel that stays out of your way until needed
- **Works on Production**: Connects directly to LenQuant servers at `lenquant.com`
- **Local Development**: Switch to `localhost:8000` for testing

---

## 🚀 Installation

### Step 1: Download the Extension
1. Clone or download the `chrome-extension/` folder from this repository

### Step 2: Load in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the `chrome-extension` folder

### Step 3: Generate Icons (Optional)
1. Open `chrome-extension/icons/generate-icons.html` in your browser
2. Click "Download All Icons"
3. Save the PNG files to the `icons/` folder
4. Reload the extension

### Step 4: Configure (Optional)
1. Click the extension icon → Settings (⚙️)
2. URLs are pre-configured for `https://lenquant.com`
3. For local development, change to `http://localhost:8000`

---

## 💻 Usage

1. **Navigate to Binance Futures**: Go to [Binance Futures](https://www.binance.com/en/futures/BTCUSDT)
2. **Panel Appears**: The LenQuant assistant panel shows on the right side
3. **Automatic Updates**: Change symbols or timeframes—analysis updates automatically

### Panel Components

| Component | Description |
|-----------|-------------|
| **Grade (A-D)** | Overall setup quality combining market state, confidence, and risk |
| **Market State** | Current regime: Trending ↗️, Ranging ↔️, or Choppy 🌊 |
| **Setup** | Detected pattern: pullback, breakout, compression, etc. |
| **Risk Flags** | Active warnings: low volume, extreme volatility, RSI extremes |
| **Leverage Band** | Recommended leverage range based on volatility + regime |
| **Regime Multiplier** | Position size adjustment (e.g., 80% in downtrends) |
| **Explain Button** | Request AI-powered trade plan with entry/stop/targets |
| **Bookmark Button** | Save current moment for later review |
| **Take Break Button** | Start self-imposed cooldown period |
| **Sync Button** | Import trades from Binance Futures |

---

## ⚙️ Configuration

### Production (Default)
The extension connects to `https://lenquant.com` by default. No configuration needed for production use.

### Local Development
1. Click extension icon → Settings (⚙️)
2. Set API URL: `http://localhost:8000`
3. Set WebSocket URL: `ws://localhost:8000`
4. Save settings

### Settings Options

| Setting | Description | Default |
|---------|-------------|---------|
| **API URL** | LenQuant backend URL | `https://lenquant.com` |
| **WebSocket URL** | Real-time streaming URL | `wss://lenquant.com` |
| **Show Panel on Load** | Auto-display panel | ✅ Enabled |
| **Behavior Alerts** | Enable/disable warnings | ✅ Enabled |
| **Auto-Explain** | Auto-request AI for A/B setups | ❌ Disabled |
| **Max Leverage** | Maximum display value | 20x |
| **Sound Alerts** | Audio for critical warnings | ❌ Disabled |

---

## 📡 API Endpoints

The extension communicates with these LenQuant API endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /api/extension/context` | Fast path analysis with regime multiplier |
| `GET /api/extension/leverage` | Dedicated leverage recommendation |
| `POST /api/extension/explain` | AI trade explanation |
| `POST /api/extension/journal` | Event logging |
| `GET /api/extension/journal/events` | Retrieve session events |
| `GET /api/extension/analyses` | Analysis history |
| `GET /api/extension/behavior/analyze` | Behavior analysis |
| `POST /api/extension/behavior/cooldown` | Start cooldown |
| `GET /api/extension/behavior/summary` | Behavior summary |
| `GET /api/extension/sync` | Sync trades from Binance |
| `GET /api/extension/positions` | Current open positions |
| `GET /api/extension/report` | Daily report |
| `GET /api/extension/report/weekly` | Weekly report |
| `GET /api/extension/report/monthly` | Monthly report |
| `GET /api/extension/analytics` | Performance analytics |
| `WS /ws/extension/{session_id}` | Real-time streaming |

---

## 🏗️ Architecture

### File Structure

```
chrome-extension/
├── manifest.json      # Extension manifest (MV3)
├── background.js      # Service worker - API & WebSocket
├── content.js         # DOM injection & observation
├── panel.css          # Panel styles (Binance dark theme)
├── popup.html/js      # Extension popup
├── options.html/js    # Settings page
└── icons/             # Extension icons
    └── generate-icons.html  # Icon generator tool
```

### Integration with LenQuant

The extension reuses these core LenQuant components:

| Component | Location | Usage |
|-----------|----------|-------|
| `RegimeDetector` | `macro/regime.py` | Market state classification |
| `Indicators` | `features/indicators.py` | EMA, RSI, MACD, ATR |
| `RiskManager` | `exec/risk_manager.py` | Leverage recommendations |
| `LLMWorker` | `assistant/llm_worker.py` | AI explanations |
| `DB Client` | `db/client.py` | MongoDB data access |

---

## 🔧 Development

### Running the Backend Locally

```bash
# Start LenQuant API
uvicorn api.main:app --reload --port 8000

# Ensure MongoDB is running
mongod --dbpath /your/db/path
```

### Debugging

1. **Content Script Logs**: Open DevTools (F12) on Binance page → Console → filter by `[LenQuant]`
2. **Background Script Logs**: `chrome://extensions` → LenQuant → "Inspect views: service worker"
3. **Network Requests**: DevTools → Network → filter by `lenquant.com` or `localhost:8000`

### Adding Custom Icons

1. Open `icons/generate-icons.html` in a browser
2. Download the generated PNG files
3. Add to `manifest.json`:

```json
"action": {
  "default_popup": "popup.html",
  "default_icon": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
},
"icons": {
  "16": "icons/icon16.png",
  "48": "icons/icon48.png",
  "128": "icons/icon128.png"
}
```

---

## 🔐 Security

- **No credential storage**: Exchange API keys are stored in LenQuant, not the extension
- **Session-based**: Each browser session gets a unique ID
- **CORS protected**: Only allows requests from Binance and LenQuant domains
- **Read-only sync**: Extension can only read trades, not execute them

---

## 📈 Performance

| Operation | Target Latency |
|-----------|----------------|
| Fast path analysis | ≤ 500ms |
| Panel update | ≤ 50ms |
| WebSocket latency | ≤ 100ms |
| AI explanation | ≤ 5s |
| Event logging | ≤ 200ms |

---

## 🤝 Support

- **Documentation**: See `docs/chrome-extension-integration.md` for full technical docs
- **Issues**: Report bugs via the LenQuant issue tracker
- **Updates**: Extension auto-syncs settings, but reload to get code updates

---

## 📝 License

Part of the LenQuant trading system. All rights reserved.
