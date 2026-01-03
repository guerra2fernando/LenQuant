# Phase 2: Symbol Coverage Expansion & ML Model Training

**Duration:** Days 2-4  
**Priority:** HIGH  
**Status:** ✅ Completed

---

## 🎯 Objectives

1. **Expand symbol ingestion** - Add top 50 Binance Futures pairs to the database
2. **Train ML models** - Run model training for all ingested symbols across multiple horizons
3. **Verify ephemeral works well** - Ensure symbols NOT ingested still get proper analysis via ephemeral
4. **Add multi-timeframe confluence** - Backend support for MTF analysis

---

## 📋 Prerequisites

- [ ] Phase 1 completed (ephemeral analysis working)
- [ ] Server access (SSH or direct access)
- [ ] MongoDB running with sufficient storage (~10GB for 50 symbols)
- [ ] Environment variables configured

---

## 🔨 Implementation Tasks

### Task 2.1: Expand Symbol Ingestion ⏸️ (Handled Server-Side)

**Status:** Skipped - User handles server-side data ingestion for 50+ symbols.

---

### Task 2.2: Train ML Models for All Symbols

**Training Script:**

```bash
#!/bin/bash
# File: scripts/train_all_symbols.sh

# Horizons to train
HORIZONS=("1m" "5m" "1h" "4h")

# Get symbols from environment or use default
SYMBOLS=${DEFAULT_SYMBOLS:-"BTC/USDT,ETH/USDT,SOL/USDT"}

# Convert to array
IFS=',' read -ra SYMBOL_ARRAY <<< "$SYMBOLS"

echo "Training models for ${#SYMBOL_ARRAY[@]} symbols across ${#HORIZONS[@]} horizons"
echo "Total training jobs: $((${#SYMBOL_ARRAY[@]} * ${#HORIZONS[@]}))"
echo ""

for symbol in "${SYMBOL_ARRAY[@]}"; do
    for horizon in "${HORIZONS[@]}"; do
        echo "Training: $symbol @ $horizon"
        python -m models.train_horizon \
            --symbol "$symbol" \
            --horizon "$horizon" \
            --algorithm lgbm \
            --promote \
            2>&1 | tail -3
        
        # Check if training succeeded
        if [ $? -eq 0 ]; then
            echo "  ✓ Success"
        else
            echo "  ✗ Failed"
        fi
    done
done

echo ""
echo "Training complete. Verifying models..."

# Verify models exist
python -c "
from db.client import get_database_name, mongo_client

with mongo_client() as client:
    db = client[get_database_name()]
    models = list(db['models'].find({}, {'symbol': 1, 'horizon': 1, 'created_at': 1}).sort('created_at', -1))
    print(f'Total models in database: {len(models)}')
    
    # Show latest by symbol/horizon
    seen = set()
    for m in models:
        key = (m['symbol'], m['horizon'])
        if key not in seen:
            print(f\"  {m['symbol']} @ {m['horizon']}\")
            seen.add(key)
"
```

**Run training:**

```bash
chmod +x scripts/train_all_symbols.sh
./scripts/train_all_symbols.sh
```

---

### Task 2.3: Create Multi-Timeframe Analysis Endpoint ✅

**File:** `api/routes/extension.py`

**Add new endpoint after line 333:**

```python
# ============================================================================
# Multi-Timeframe Analysis
# ============================================================================


class MTFAnalysisRequest(BaseModel):
    """Request for multi-timeframe analysis."""
    symbol: str
    timeframes: List[str] = Field(default=["5m", "1h", "4h"])


class MTFAnalysisResponse(BaseModel):
    """Response with multi-timeframe analysis."""
    symbol: str
    timeframes: Dict[str, Dict[str, Any]]
    confluence: str  # "high", "medium", "low"
    confluence_score: float
    recommended_bias: str  # "long", "short", "neutral"
    recommendation: str
    latency_ms: int


@router.post("/analyze-mtf", response_model=MTFAnalysisResponse)
def analyze_multi_timeframe(payload: MTFAnalysisRequest) -> Dict[str, Any]:
    """
    Multi-timeframe confluence analysis.
    
    Analyzes the symbol across multiple timeframes and calculates
    confluence score to determine alignment.
    
    High confluence = all timeframes agree on direction
    Low confluence = timeframes disagree
    """
    import time
    start_time = time.time()
    
    logger.info("MTF analysis: %s across %s", payload.symbol, payload.timeframes)
    
    analyzer = get_analyzer()
    results = {}
    
    for tf in payload.timeframes:
        try:
            result = analyzer.analyze(payload.symbol, tf, use_cache=True)
            results[tf] = result.to_dict()
        except Exception as exc:
            logger.warning("MTF analysis failed for %s %s: %s", payload.symbol, tf, exc)
            results[tf] = {"error": str(exc), "market_state": "error"}
    
    # Calculate confluence
    valid_results = [r for r in results.values() if r.get("market_state") != "error"]
    
    if len(valid_results) < 2:
        confluence = "low"
        confluence_score = 0.0
        recommended_bias = "neutral"
        recommendation = "Insufficient data for multi-timeframe analysis"
    else:
        # Count trend directions
        trend_counts = {"up": 0, "down": 0, "sideways": 0, None: 0}
        for r in valid_results:
            td = r.get("trend_direction")
            trend_counts[td] = trend_counts.get(td, 0) + 1
        
        # Find dominant trend
        max_trend = max(trend_counts.items(), key=lambda x: x[1])
        dominant_trend = max_trend[0]
        dominant_count = max_trend[1]
        
        # Calculate confluence score
        total_valid = len(valid_results)
        confluence_score = dominant_count / total_valid if total_valid > 0 else 0
        
        # Classify confluence
        if confluence_score >= 0.8:
            confluence = "high"
        elif confluence_score >= 0.5:
            confluence = "medium"
        else:
            confluence = "low"
        
        # Recommended bias
        if dominant_trend == "up" and confluence_score >= 0.6:
            recommended_bias = "long"
        elif dominant_trend == "down" and confluence_score >= 0.6:
            recommended_bias = "short"
        else:
            recommended_bias = "neutral"
        
        # Build recommendation
        if confluence == "high":
            if recommended_bias == "long":
                recommendation = f"Strong bullish confluence ({int(confluence_score*100)}%). All timeframes trending up. Consider long entries on pullbacks."
            elif recommended_bias == "short":
                recommendation = f"Strong bearish confluence ({int(confluence_score*100)}%). All timeframes trending down. Consider short entries on rallies."
            else:
                recommendation = "Strong confluence but sideways. Wait for breakout direction."
        elif confluence == "medium":
            recommendation = f"Mixed signals ({int(confluence_score*100)}% agreement). Higher timeframes may override lower. Wait for alignment."
        else:
            recommendation = "Low confluence - timeframes disagree. Avoid trading or use very tight risk."
    
    latency_ms = int((time.time() - start_time) * 1000)
    
    return {
        "symbol": payload.symbol,
        "timeframes": results,
        "confluence": confluence,
        "confluence_score": round(confluence_score, 2),
        "recommended_bias": recommended_bias,
        "recommendation": recommendation,
        "latency_ms": latency_ms,
    }
```

---

### Task 2.4: Add MTF Support to Extension ✅

**File:** `chrome-extension/background.js`

**Add MTF analysis function:**

```javascript
/**
 * Fetch multi-timeframe analysis from backend.
 */
async function fetchMTFAnalysis(symbol, timeframes = ['5m', '1h', '4h']) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout for MTF
    
    const response = await fetch(`${CONFIG.API_BASE_URL}/analyze-mtf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: symbol,
        timeframes: timeframes,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`MTF API error: ${response.status}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('[LenQuant] MTF analysis error:', error);
    return null;
  }
}
```

**Add message handler:**

```javascript
// In handleMessage function, add new case:

case 'REQUEST_MTF_ANALYSIS':
  try {
    const mtfResult = await fetchMTFAnalysis(
      message.symbol,
      message.timeframes || ['5m', '1h', '4h']
    );
    return { mtf: mtfResult };
  } catch (error) {
    return { error: error.message };
  }
```

---

### Task 2.5: Update Extension Panel for MTF Display ✅

**File:** `chrome-extension/content.js`

**Add MTF section to panel template (in TradingPanel.getTemplate()):**

```html
<div class="lq-mtf-section" style="display: none;">
  <div class="lq-mtf-header">
    <span class="lq-mtf-title">📊 Multi-Timeframe</span>
    <button class="lq-btn-icon lq-mtf-refresh" title="Refresh MTF">↻</button>
  </div>
  <div class="lq-mtf-confluence">
    <span class="lq-mtf-confluence-label">Confluence:</span>
    <span class="lq-mtf-confluence-value">--</span>
  </div>
  <div class="lq-mtf-grid"></div>
  <div class="lq-mtf-recommendation"></div>
</div>
```

**Add MTF update function:**

```javascript
async function updateMTFSection(symbol) {
  if (!panel || !panel.container) return;
  
  const mtfSection = panel.container.querySelector('.lq-mtf-section');
  if (!mtfSection) return;
  
  mtfSection.style.display = 'block';
  
  const mtfGrid = mtfSection.querySelector('.lq-mtf-grid');
  mtfGrid.innerHTML = '<div class="lq-mtf-loading">Loading...</div>';
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'REQUEST_MTF_ANALYSIS',
      symbol: symbol,
      timeframes: ['5m', '1h', '4h'],
    });
    
    if (response.mtf) {
      const mtf = response.mtf;
      
      // Update confluence
      const confluenceValue = mtfSection.querySelector('.lq-mtf-confluence-value');
      confluenceValue.textContent = `${mtf.confluence.toUpperCase()} (${Math.round(mtf.confluence_score * 100)}%)`;
      confluenceValue.className = `lq-mtf-confluence-value confluence-${mtf.confluence}`;
      
      // Update grid
      let gridHTML = '';
      for (const [tf, result] of Object.entries(mtf.timeframes)) {
        const trend = result.trend_direction || 'sideways';
        const state = result.market_state || 'unknown';
        const trendIcon = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '↔️';
        
        gridHTML += `
          <div class="lq-mtf-item">
            <span class="lq-mtf-tf">${tf}</span>
            <span class="lq-mtf-trend ${trend}">${trendIcon}</span>
            <span class="lq-mtf-state">${state}</span>
          </div>
        `;
      }
      mtfGrid.innerHTML = gridHTML;
      
      // Update recommendation
      const recEl = mtfSection.querySelector('.lq-mtf-recommendation');
      recEl.textContent = mtf.recommendation;
      recEl.className = `lq-mtf-recommendation bias-${mtf.recommended_bias}`;
    }
    
  } catch (error) {
    console.error('[LenQuant] MTF update error:', error);
    mtfGrid.innerHTML = '<div class="lq-mtf-error">Failed to load</div>';
  }
}
```

---

## ✅ Test Cases

### Test 2.1: Symbol Ingestion Verification

```bash
# Verify all symbols are ingested with sufficient data
python -c "
from db.client import get_database_name, mongo_client
from datetime import datetime, timedelta

with mongo_client() as client:
    db = client[get_database_name()]
    
    required_symbols = [
        'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT',
        'ADA/USDT', 'AVAX/USDT', 'LINK/USDT', 'DOT/USDT', 'MATIC/USDT'
    ]
    
    errors = []
    for symbol in required_symbols:
        count = db['ohlcv'].count_documents({'symbol': symbol})
        if count < 100000:
            errors.append(f'{symbol}: only {count} candles (need 100k+)')
        else:
            print(f'✓ {symbol}: {count:,} candles')
    
    if errors:
        print('\\nErrors:')
        for e in errors:
            print(f'  ✗ {e}')
        exit(1)
    else:
        print('\\n✓ All symbols verified!')
"
```

### Test 2.2: Model Training Verification

```bash
# Verify models exist for key symbols
python -c "
from db.client import get_database_name, mongo_client

with mongo_client() as client:
    db = client[get_database_name()]
    
    required = [
        ('BTC/USDT', '1h'),
        ('ETH/USDT', '1h'),
        ('SOL/USDT', '1h'),
    ]
    
    for symbol, horizon in required:
        model = db['models'].find_one({
            'symbol': symbol,
            'horizon': horizon,
            'is_promoted': True
        })
        
        if model:
            print(f\"✓ {symbol} @ {horizon}: {model['algorithm']} (acc: {model.get('accuracy', 'N/A')})\")
        else:
            print(f\"✗ {symbol} @ {horizon}: NO MODEL FOUND\")
"
```

### Test 2.3: Backend Context Endpoint for Ingested Symbol

```bash
# Test that ingested symbols use backend analysis (not ephemeral)
curl -s "http://localhost:8000/api/extension/context?symbol=BTCUSDT&timeframe=1m" | python -m json.tool

# Expected: source should NOT be "ephemeral" for ingested symbols
```

### Test 2.4: MTF Endpoint Test

```bash
curl -X POST "http://localhost:8000/api/extension/analyze-mtf" \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTCUSDT", "timeframes": ["5m", "1h", "4h"]}' \
  | python -m json.tool

# Expected output includes:
# - confluence: "high" | "medium" | "low"
# - confluence_score: 0.0 - 1.0
# - timeframes with analysis for each
```

---

## 📊 Validation Criteria

| Criteria | Target | Validation Method |
|----------|--------|-------------------|
| Symbols ingested | 50+ | Query `db['ohlcv'].distinct('symbol')` |
| Candles per symbol | 100k+ | Count documents per symbol |
| Models trained | 10+ symbols × 4 horizons | Query `db['models'].count_documents({})` |
| Context endpoint uses backend for ingested | Yes | Check `source` in response |
| MTF confluence calculation | Accurate | Manual verification |
| MTF latency | <3000ms | Measure response time |

---

## 📁 Files Modified/Created

| File | Changes |
|------|---------|
| `api/routes/extension.py` | ✅ Add `/analyze-mtf` endpoint |
| `chrome-extension/background.js` | ✅ Add `fetchMTFAnalysis()` and message handler |
| `chrome-extension/content.js` | ✅ Add MTF panel section and update function |
| `chrome-extension/panel.css` | ✅ Add comprehensive MTF styling |

---

## 🔗 Next Phase Prerequisites

Phase 3 requires:
- [ ] At least 20 symbols ingested with data
- [ ] ML models trained for key symbols (BTC, ETH, SOL)
- [ ] MTF endpoint working
- [ ] Ephemeral analysis verified for non-ingested symbols

---

*Complete this phase before moving to Phase 3: Authentication & Licensing System*

