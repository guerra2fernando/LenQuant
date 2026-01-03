# LenQuant Chrome Extension — Technical Implementation Plan

**Version:** 3.0 (Corrected Assessment)  
**Last Updated:** January 2026  
**Status:** Extended Sprint (6-12 Days) for Full Value

---

## 🔍 Reality Check

After deep codebase analysis and clarification about server deployment, here's what's working and what needs implementation.

**Important:** ML models and training artifacts exist on the production server, not in the local codebase. The system IS functional for ingested symbols.

---

## 📊 What's Working on the Server

### ✅ FULLY FUNCTIONAL (On Server)

| Component | Location | Status |
|-----------|----------|--------|
| **ML Model Training** | `models/train_horizon.py` | ✅ Running on server, models trained for ingested symbols |
| **Ensemble Predictions** | `models/ensemble.py` | ✅ Works for symbols with trained models |
| **Regime Detection** | `macro/regime.py` | ✅ SOLID - Uses ADX, BB width, MA slopes, volatility z-scores with hysteresis |
| **Extension Analyzer** | `extension/analyzer.py` | ✅ GOOD - Uses RegimeDetector, confidence scoring, regime-aware leverage |
| **LLM Integration** | `assistant/llm_worker.py` | ✅ REAL - OpenAI/Gemini for trade explanations |
| **Risk Manager** | `exec/risk_manager.py` | ✅ FUNCTIONAL - Regime-aware position sizing |
| **API Endpoints** | `api/routes/extension.py` | ✅ COMPLETE - Context, ephemeral, explain, journal, behavioral |
| **Strategy Evolution** | `evolution/` | ✅ Running on server for strategy optimization |

### ⚠️ CURRENT LIMITATION

| Issue | Impact |
|-------|--------|
| **Only ~10 symbols ingested** | ML models can only work effectively for these 10 symbols. Other symbols fall back to basic analysis or ephemeral mode. |

### ⚠️ CLIENT-SIDE FALLBACK (Intentionally Basic)

| Feature | Reality |
|---------|---------|
| Client-side analysis | Basic EMA/RSI/ATR — designed as fallback when backend unavailable |
| Setup detection | 3 patterns: pullback_continuation, range_breakout, compression_breakout |
| Risk flags | Simple thresholds — full analysis happens on backend |

**Note:** Client-side is a fallback by design. The real value is in the backend analysis.

---

## 🎯 Core Problem: Limited Symbol Coverage

The backend is fully functional with trained ML models. The main limitation is that only ~10 symbols have been ingested, which limits ML effectiveness for the hundreds of other Binance Futures pairs.

### Mode 1: Backend-Powered (Full ML Analysis)

When `GET /api/extension/context` succeeds with data (symbol is ingested):
- Uses `macro/regime.py` RegimeDetector (proper ADX + MA slopes + BB width)
- Applies trained ML models for predictions
- Uses `exec/risk_manager.py` regime multipliers
- Returns confidence-scored analysis with setup detection
- Uses `features/indicators.py` for technical analysis

**This mode works well for ingested symbols.** The regime detection in `macro/regime.py` is solid:

```python
# macro/regime.py - This is REAL technical analysis, not hype:
- ADX (Average Directional Index) for trend strength
- ADX threshold: 25 (trending) / 40 (strong trend)
- MA slope threshold: 0.001 (normalized by price)
- Volatility z-score with historical context
- Hysteresis to prevent regime oscillation (3-bar confirmation)
- Bollinger Band width for volatility detection
```

### Mode 2: Client-Side Fallback (BASIC)

When backend fails or symbol not in database:
- Fetches public OHLCV from Binance
- Calculates: EMA9, EMA21, RSI14, ATR
- Trend detection: `if (ema9 > ema21 * 1.002) trendDirection = 'up'`
- Market state: Simple rules based on EMA alignment + ATR

**This mode IS basic.** The other AI was correct about client-side analysis.

---

## 🚨 Main Challenge: Symbol Coverage

**Current state:** Only ~10 symbols ingested on the server with full OHLCV data and trained models.

**Impact:** 
- Full ML-powered backend analysis works for: BTC/USDT, ETH/USDT, and ~8 others
- Other symbols (100+ on Binance Futures) need ephemeral analysis or fall back to client-side
- ML models need more data diversity to generalize well across all cryptos

**Solutions Available:**
1. **Ephemeral Analysis** - Backend endpoint exists (`/analyze-ephemeral`) to analyze any symbol on-demand
2. **Expand Ingestion** - Add more symbols to the server for full ML coverage

---

## 🔨 What ACTUALLY Needs to Be Built

### Phase 1: Make Backend Value Accessible (Days 1-2)

#### 1.1 Fix Ephemeral Analysis Flow

**Problem:** Extension falls back to basic client-side when symbol not in DB.

**Solution in `background.js`:**

When `/context` returns `insufficient_data`:
1. Fetch OHLCV using existing `fetchBinanceOHLCV()` function
2. POST to `/api/extension/analyze-ephemeral` with client-fetched candles
3. Backend applies REAL regime detection to the data
4. Return backend-quality analysis (not client-side fallback)

**Backend already supports this:**
```python
# api/routes/extension.py line ~200
@router.post("/analyze-ephemeral")
def analyze_ephemeral(payload: EphemeralAnalysisRequest) -> Dict[str, Any]:
    # Uses RegimeDetector on provided OHLCV data
    # This endpoint EXISTS but extension doesn't use it!
```

**Extension changes needed:**
- Modify `REQUEST_ANALYSIS` handler in `background.js`
- Add timeout: 5 seconds for ephemeral (vs 2 seconds for context)
- Only fall back to client-side if ephemeral also fails

#### 1.2 Improve Setup Detection

**Current (basic):**
- Pullback: Price near EMA zone
- Range breakout: Price near 20-bar high/low
- Compression: BB width < 70% of average

**Improved (still not pattern recognition, but better):**
- Add: Momentum divergence (price vs RSI direction)
- Add: Volume confirmation for breakouts
- Add: EMA crossover recency (recent cross = stronger signal)
- Add: Multiple timeframe confluence check

**Location:** `extension/analyzer.py` `_detect_setups()` method

### Phase 2: Expand Symbol Coverage (Days 2-4)

**Note:** ML models are already trained on the server for existing ~10 symbols. This phase is about expanding coverage.

#### 2.1 Add More Symbols to Server

**Current:** ~10 symbols ingested with trained models
**Challenge:** ML needs more symbol diversity to generalize across all cryptos
**Target:** Top 30-50 Binance Futures pairs

**On the server:**
```bash
# Add more symbols to ingestion
export DEFAULT_SYMBOLS="BTC/USDT,ETH/USDT,SOL/USDT,XRP/USDT,DOGE/USDT,..." 

# Run ingestion for new symbols
python -m data_ingest.main --lookback-days 90

# Train models for new symbols
python -m models.train_horizon --symbol SOL/USDT --horizon 1h --algorithm lgbm --promote
```

#### 2.2 Ensure Ephemeral Analysis Works Well

For symbols NOT ingested, the extension should use ephemeral analysis:
- Extension fetches OHLCV from Binance public API
- Sends to `/analyze-ephemeral` endpoint
- Backend applies regime detection (no ML predictions, but proper technical analysis)

**Ephemeral provides:** Regime detection, leverage recommendations, setup detection
**Ephemeral lacks:** Trained ML predictions (since no historical training data for that symbol)

### Phase 3: Authentication & Monetization (Days 4-6)

#### 3.1 Extension Authentication

**Create `api/routes/ext_auth.py`:**

| Endpoint | Purpose |
|----------|---------|
| `POST /register` | Email → Generate trial token |
| `POST /validate` | Validate token, return tier/features |
| `POST /checkout` | Create Stripe checkout session |
| `POST /webhook` | Handle Stripe webhooks |

**Database collection:** `extension_users`

```javascript
{
  "_id": ObjectId,
  "email": "user@example.com",
  "device_id": "dev_xxx",
  "tier": "trial|pro|premium|expired",
  "trial_ends": ISODate,
  "features": ["analysis", "ai_explain", "cloud_journal"],
  "stripe_customer_id": null,
  "created_at": ISODate
}
```

#### 3.2 Feature Gating

**Free trial - 3 days:**
- Basic analysis (client-side only)
- No AI explanations
- No cloud journal

**Pro ($19.99/mo):**
- Backend-powered analysis (regime detection)
- AI explanations (LLM integration)
- Cloud journal (30 days)

**Premium ($39.99/mo):**
- Everything in Pro
- Trade sync (Binance API integration)
- Extended journal (365 days)
- Multi-symbol monitoring

### Phase 4: Real Value Additions (Days 6-10)

#### 4.1 Multi-Timeframe Analysis

**Current:** Single timeframe analysis only.

**Add:**
- Query 3 timeframes (e.g., 1m, 5m, 1h, 4h)
- Calculate confluence score
- Show alignment/divergence in UI

**Implementation:**
```python
def analyze_multi_timeframe(symbol: str) -> Dict:
    timeframes = ["5m", "1h", "4h"]
    results = [analyzer.analyze(symbol, tf) for tf in timeframes]
    
    # Calculate confluence
    trend_agreement = all(r.trend_direction == results[0].trend_direction for r in results)
    
    return {
        "timeframes": {tf: r.to_dict() for tf, r in zip(timeframes, results)},
        "confluence": "high" if trend_agreement else "low",
        "recommended_action": "wait" if not trend_agreement else results[1].reason
    }
```

#### 4.2 Better Pattern Recognition (Optional, Complex)

If you want actual pattern recognition (not just simple rules):

**Option A: Rule-based patterns**
- Define: Higher high, higher low sequences
- Define: Flag/pennant compression ratios
- Define: Double top/bottom detection

**Option B: Use existing ML models for classification**
- Train classifier on labeled pattern data
- Would require labeled dataset creation

**Recommendation:** Start with rule-based. ML patterns are complex and require labeled data.

#### 4.3 Order Flow (Premium Only)

**Current:** No order book analysis.

**Add (requires Binance WebSocket):**
- Order book depth imbalance
- Large order detection
- Bid/ask wall alerts


---

## 📐 Revised Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ANALYSIS REQUEST FLOW                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   1. User navigates to any Binance Futures symbol                       │
│   2. Extension extracts: symbol, timeframe, leverage, position          │
│   3. GET /api/extension/context?symbol=BTCUSDT&timeframe=1m             │
│                                                                          │
│   Backend Decision Tree:                                                 │
│   ├── Symbol in database?                                                │
│   │   └── YES → Full analysis using RegimeDetector + RiskManager        │
│   │                                                                      │
│   └── Symbol NOT in database?                                            │
│       └── Return { status: "insufficient_data" }                         │
│                                                                          │
│   Extension on "insufficient_data":                                      │
│   ├── Fetch OHLCV from Binance public API                               │
│   ├── POST /api/extension/analyze-ephemeral (with OHLCV payload)        │
│   │   └── Backend applies RegimeDetector to provided data               │
│   │   └── Returns same quality as /context endpoint                     │
│   └── ONLY if ephemeral fails: Use basic client-side fallback           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ Implementation Checklist (6-12 Day Sprint)

### Days 1-2: Backend Value Accessibility

- [ ] **Fix ephemeral analysis flow in `background.js`**
  - Modify `REQUEST_ANALYSIS` to call `/analyze-ephemeral` when context fails
  - Add proper error handling and timeouts
  - Test with symbol not in database

- [ ] **Add multi-symbol support in `extension/analyzer.py`**
  - Create `analyze_ephemeral_from_ohlcv()` method
  - Ensure RegimeDetector works with any OHLCV data

- [ ] **Improve client-side fallback (if still needed)**
  - Add ADX calculation to `binance-api.js`
  - Add BB width calculation
  - Match a bit the backend analysis quality - not so much

### Days 2-4: Train ML Models

- [ ] **Run model training for existing symbols**
  ```bash
  python -m models.train_horizon --symbol BTC/USD --horizon 1h --algorithm lgbm --promote
  ```
  - Train for: 1m, 5m, 1h, 4h horizons
  - Train for all 10 existing symbols

- [ ] **Verify models are saved**
  - Check `learning/artifacts/` has .joblib files
  - Verify `models` collection in MongoDB has entries

- [ ] **Ingest additional symbols**
  - Add top 50 Binance Futures to DEFAULT_SYMBOLS
  - Run `python -m data_ingest.main`
  - Verify OHLCV data exists

### Days 4-6: Authentication & Monetization

- [ ] **Create `api/routes/ext_auth.py`**
  - Registration endpoint
  - Validation endpoint
  - Stripe checkout

- [ ] **Add Stripe integration**
  - Products: pro_monthly, pro_yearly, premium_monthly, premium_yearly
  - Webhook handler for subscription events

- [ ] **Modify extension for licensing**
  - Add `license-manager.js`
  - Store license in `chrome.storage.sync`
  - Feature gating before API calls

- [ ] **Create paywall UI**
  - Modal for locked features
  - Trial countdown display
  - Stripe checkout redirect

### Days 6-8: Polish & Testing

- [ ] **Multi-timeframe analysis**
  - Add MTF endpoint to backend
  - Display in extension panel

- [ ] **Improved setup detection**
  - Add momentum divergence
  - Add volume confirmation

- [ ] **Full testing**
  - Test trial flow
  - Test feature gating
  - Test Stripe checkout (test mode)
  - Test ephemeral analysis for new symbols

### Days 8-10: Launch Prep

- [ ] **Chrome Store submission**
  - Update manifest.json
  - Create icons and screenshots
  - Write descriptions

- [ ] **Backend deployment**
  - Deploy with Stripe keys
  - Enable rate limiting
  - Monitor logs

---

## 🎯 Value Proposition

### What the Extension Provides

| Feature | Free (Client-Side) | Pro (Backend) |
|---------|-------------------|---------------|
| Trend detection | Basic EMA crossover | ADX + MA slopes + hysteresis |
| Volatility analysis | Simple ATR threshold | Z-score volatility + BB width |
| Leverage recommendation | ATR-based band | Regime-aware with multipliers |
| Setup detection | 3 basic patterns | Same 3, but with confidence scoring |
| ML predictions | ❌ None | ✅ For top coins (expanding weekly) |
| AI explanations | ❌ None | ✅ Real LLM integration |
| Risk flags | Simple thresholds | Same + regime context |

### Current Limitations

- ⚠️ **Limited ML coverage** - Only ~10 symbols have trained models; others use regime detection only
- ❌ **No advanced pattern recognition** - No head & shoulders, triangles, etc.
- ❌ **No order flow analysis** - No order book depth analysis
- ❌ **Single symbol analysis** - No multi-asset correlation

### Positioning

**What it is:**
> "Real-time market regime analysis with ML predictions (for supported symbols), leverage discipline, and behavioral guardrails"

The value is:
1. **Objectivity** - Removes emotional bias by showing market state
2. **ML-powered analysis** - Trained models for ingested symbols
3. **Discipline** - Leverage recommendations prevent over-leveraging
4. **Behavioral guardrails** - Revenge trading detection
5. **AI assistance** - LLM explanations provide trade context (Pro tier)

---

## 🔧 Configuration Required

### Environment Variables

```bash
# Database
MONGO_URI=mongodb://localhost:27017/cryptotrader

# Symbols & Intervals
DEFAULT_SYMBOLS=BTC/USDT,ETH/USDT,SOL/USDT,XRP/USDT,DOGE/USDT,...
FEATURE_INTERVALS=1m,5m,1h,4h

# LLM (for AI explanations)
ASSISTANT_LLM_PROVIDER=openai  # or google
OPENAI_API_KEY=sk-xxx

# Stripe
STRIPE_SECRET_KEY=sk_xxx
STRIPE_PUBLISHABLE_KEY=pk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Extension
EXT_LICENSE_SECRET=your-secret
EXT_TRIAL_DAYS=3
```

---

## 📊 Success Criteria (Honest Version)

| Metric | Target | Why This Matters |
|--------|--------|------------------|
| Ephemeral analysis success rate | >95% | Users get backend analysis for any symbol |
| Analysis latency (ephemeral) | <1500ms | Acceptable UX for ephemeral mode |
| Trial to paid conversion | >5% | Validates product-market fit |
| User retention (day 7) | >30% | Users find ongoing value |

---

*This document reflects the honest state of the codebase. The backend has genuine value in regime detection and LLM integration. The client-side fallback is basic by design. Focus on making backend analysis accessible for all symbols via ephemeral analysis.*
