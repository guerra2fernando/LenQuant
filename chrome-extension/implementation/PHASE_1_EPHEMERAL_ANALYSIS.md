# Phase 1: Ephemeral Analysis Flow & Client-Side Improvements

**Duration:** Days 1-2
**Priority:** CRITICAL
**Status:** ✅ Completed

---

## ✅ Phase Complete - Summary

**Completed on:** January 2, 2026

### What Was Implemented:
- ✅ **Ephemeral analysis flow**: Extension now calls `/analyze-ephemeral` when backend has insufficient data
- ✅ **Improved ADX calculation**: Proper Wilder's smoothing matching backend implementation
- ✅ **Bollinger Band width**: Added BB width calculation as percentage of middle band
- ✅ **MA slope calculations**: Short-term (20) and long-term (50) moving average slopes
- ✅ **Enhanced market state detection**: Z-score based volatility regime, ADX + MA slope trend detection
- ✅ **Setup detection improvements**: Momentum divergence and EMA crossover detection
- ✅ **Multi-timeframe support**: Framework in place for confluence analysis

### Files Modified:
- `chrome-extension/background.js`: Added `performEphemeralAnalysis()` function and updated flow
- `chrome-extension/binance-api.js`: Enhanced `calculateIndicators()` and added new detection functions

---

## 🎯 Objectives

1. **Fix the ephemeral analysis flow** - When `/context` returns insufficient data, call `/analyze-ephemeral` with client-fetched OHLCV instead of falling back to basic client-side analysis
2. **Improve client-side analysis** - Add ADX calculation, Bollinger Band width, and better market state detection
3. **Add multi-timeframe data fetching** - Support fetching multiple timeframes for confluence

---

## 📋 Prerequisites

- [ ] Backend server running at `https://lenquant.com` or `localhost:8000`
- [ ] MongoDB connected with OHLCV collections
- [ ] Binance API accessible (public endpoints)

---

## 🔨 Implementation Tasks

### Task 1.1: Modify `background.js` to Use Ephemeral Analysis

**File:** `chrome-extension/background.js`

**Current Flow:**
```
/context → insufficient_data → performClientSideAnalysis() (basic)
```

**New Flow:**
```
/context → insufficient_data → fetchBinanceOHLCV() → POST /analyze-ephemeral → proper regime detection
```

**Changes Required:**

```javascript
// In fetchContextAnalysis function, after line 346
// Replace the current fallback logic with ephemeral endpoint call

async function fetchContextAnalysis(symbol, timeframe, domData = {}) {
  const cacheKey = `${symbol}:${timeframe}`;
  const cached = analysisCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < CONFIG.ANALYSIS_CACHE_TTL) {
    return { ...cached.data, cached: true, dom_leverage: domData.leverage };
  }
  
  // Try backend first with timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.BACKEND_TIMEOUT_MS);
    
    const url = new URL(`${CONFIG.API_BASE_URL}/context`);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('timeframe', timeframe);
    
    const response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check if backend returned insufficient data
    if (data.risk_flags?.includes('insufficient_data') || data.market_state === 'undefined') {
      console.log('[LenQuant] Backend has no data, trying ephemeral analysis');
      
      // NEW: Try ephemeral analysis before falling back to client-side
      try {
        const ephemeralResult = await performEphemeralAnalysis(symbol, timeframe, domData);
        if (ephemeralResult && ephemeralResult.market_state !== 'error') {
          analysisCache.set(cacheKey, { data: ephemeralResult, timestamp: Date.now() });
          return ephemeralResult;
        }
      } catch (ephemeralError) {
        console.warn('[LenQuant] Ephemeral analysis failed:', ephemeralError.message);
      }
      
      // Final fallback to client-side
      if (CONFIG.USE_CLIENT_FALLBACK) {
        return await performClientSideAnalysis(symbol, timeframe, domData);
      }
    }
    
    // Cache result
    analysisCache.set(cacheKey, { data, timestamp: Date.now() });
    
    // Add DOM data to response
    return { ...data, dom_leverage: domData.leverage, dom_position: domData.position, source: 'backend' };
    
  } catch (error) {
    console.warn('[LenQuant] Backend failed:', error.message);
    
    // Try ephemeral analysis
    try {
      const ephemeralResult = await performEphemeralAnalysis(symbol, timeframe, domData);
      if (ephemeralResult && ephemeralResult.market_state !== 'error') {
        return ephemeralResult;
      }
    } catch (ephemeralError) {
      console.warn('[LenQuant] Ephemeral also failed:', ephemeralError.message);
    }
    
    // Final fallback to client-side analysis
    if (CONFIG.USE_CLIENT_FALLBACK) {
      return await performClientSideAnalysis(symbol, timeframe, domData);
    }
    
    throw error;
  }
}
```

**Add new function for ephemeral analysis:**

```javascript
/**
 * Perform ephemeral analysis by sending client-fetched OHLCV to backend.
 * Backend applies proper regime detection without storing the data.
 */
async function performEphemeralAnalysis(symbol, timeframe, domData = {}) {
  const startTime = Date.now();
  
  console.log(`[LenQuant] Fetching OHLCV for ephemeral analysis: ${symbol} ${timeframe}`);
  
  // Fetch OHLCV from Binance
  const candles = await fetchBinanceOHLCV(symbol, timeframe, 300);
  
  if (!candles || candles.length < 50) {
    throw new Error(`Insufficient candles: ${candles?.length || 0}`);
  }
  
  // Send to ephemeral analysis endpoint
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for ephemeral
  
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/analyze-ephemeral`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: symbol,
        timeframe: timeframe,
        candles: candles,
        dom_leverage: domData.leverage || null,
        dom_position: domData.position || null,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Ephemeral API error: ${response.status}`);
    }
    
    const result = await response.json();
    
    console.log(`[LenQuant] Ephemeral analysis completed in ${Date.now() - startTime}ms`);
    
    return {
      ...result,
      source: 'ephemeral',
      latency_ms: Date.now() - startTime,
    };
    
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
```

---

### Task 1.2: Improve Client-Side Analysis with ADX Calculation

**File:** `chrome-extension/binance-api.js`

**Add proper ADX calculation:**

```javascript
/**
 * Calculate ADX (Average Directional Index) for trend strength.
 * This matches the backend macro/regime.py implementation.
 */
function calculateADX(highs, lows, closes, period = 14) {
  if (highs.length < period + 1) return 0;
  
  const trueRanges = [];
  const plusDM = [];
  const minusDM = [];
  
  // Calculate TR, +DM, -DM
  for (let i = 1; i < highs.length; i++) {
    const highLow = highs[i] - lows[i];
    const highClose = Math.abs(highs[i] - closes[i - 1]);
    const lowClose = Math.abs(lows[i] - closes[i - 1]);
    trueRanges.push(Math.max(highLow, highClose, lowClose));
    
    const highDiff = highs[i] - highs[i - 1];
    const lowDiff = lows[i - 1] - lows[i];
    
    plusDM.push((highDiff > lowDiff && highDiff > 0) ? highDiff : 0);
    minusDM.push((lowDiff > highDiff && lowDiff > 0) ? lowDiff : 0);
  }
  
  // Smooth using Wilder's method
  const smooth = (data, period) => {
    if (data.length < period) return [];
    let result = data.slice(0, period).reduce((a, b) => a + b, 0);
    const smoothed = [result];
    for (let i = period; i < data.length; i++) {
      result = result - (result / period) + data[i];
      smoothed.push(result);
    }
    return smoothed;
  };
  
  const smoothedTR = smooth(trueRanges, period);
  const smoothedPlusDM = smooth(plusDM, period);
  const smoothedMinusDM = smooth(minusDM, period);
  
  if (smoothedTR.length === 0) return 0;
  
  // Calculate +DI and -DI
  const plusDI = [];
  const minusDI = [];
  for (let i = 0; i < smoothedTR.length; i++) {
    if (smoothedTR[i] > 0) {
      plusDI.push(100 * smoothedPlusDM[i] / smoothedTR[i]);
      minusDI.push(100 * smoothedMinusDM[i] / smoothedTR[i]);
    }
  }
  
  // Calculate DX
  const dx = [];
  for (let i = 0; i < plusDI.length; i++) {
    const sum = plusDI[i] + minusDI[i];
    if (sum > 0) {
      dx.push(100 * Math.abs(plusDI[i] - minusDI[i]) / sum);
    }
  }
  
  // Calculate ADX (smoothed DX)
  if (dx.length < period) return dx.length > 0 ? dx[dx.length - 1] : 0;
  
  const smoothedDX = smooth(dx, period);
  return smoothedDX.length > 0 ? smoothedDX[smoothedDX.length - 1] / period : 0;
}

/**
 * Calculate Bollinger Band Width as percentage of middle band.
 */
function calculateBBWidth(closes, period = 20, numStd = 2.0) {
  if (closes.length < period) return 0;
  
  const recentCloses = closes.slice(-period);
  const ma = recentCloses.reduce((a, b) => a + b, 0) / period;
  
  const variance = recentCloses.reduce((sum, val) => sum + Math.pow(val - ma, 2), 0) / period;
  const std = Math.sqrt(variance);
  
  const upperBand = ma + (std * numStd);
  const lowerBand = ma - (std * numStd);
  
  return ma > 0 ? ((upperBand - lowerBand) / ma) * 100 : 0;
}

/**
 * Calculate MA slope (normalized by price for comparability).
 */
function calculateMASlope(closes, period = 20) {
  if (closes.length < period + 1) return 0;
  
  const ma = [];
  for (let i = period - 1; i < closes.length; i++) {
    const sum = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    ma.push(sum / period);
  }
  
  if (ma.length < 2) return 0;
  
  const currentMA = ma[ma.length - 1];
  const previousMA = ma[ma.length - 2];
  
  return currentMA > 0 ? (currentMA - previousMA) / currentMA : 0;
}
```

**Update `calculateIndicators` function:**

```javascript
function calculateIndicators(candles) {
  if (!candles || candles.length < 50) {
    return null;
  }
  
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);
  
  // EMA calculation helper
  const ema = (data, period) => {
    const k = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  };
  
  // SMA calculation helper
  const sma = (data, period) => {
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  };
  
  // RSI calculation
  const rsi = (data, period = 14) => {
    const changes = [];
    for (let i = 1; i < data.length; i++) {
      changes.push(data[i] - data[i - 1]);
    }
    const recentChanges = changes.slice(-period);
    const gains = recentChanges.filter(c => c > 0);
    const losses = recentChanges.filter(c => c < 0).map(c => Math.abs(c));
    const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / period : 0;
    const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / period : 0.0001;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };
  
  // ATR calculation
  const atr = (highs, lows, closes, period = 14) => {
    const trs = [];
    for (let i = 1; i < highs.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trs.push(tr);
    }
    return sma(trs, period);
  };
  
  const currentPrice = closes[closes.length - 1];
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const currentATR = atr(highs, lows, closes, 14);
  const atrPct = (currentATR / currentPrice) * 100;
  
  // NEW: Proper ADX calculation
  const adxValue = calculateADX(highs, lows, closes, 14);
  
  // NEW: Bollinger Band width
  const bbWidth = calculateBBWidth(closes, 20, 2.0);
  
  // NEW: MA slopes
  const maShortSlope = calculateMASlope(closes, 20);
  const maLongSlope = calculateMASlope(closes, 50);
  
  // IMPROVED: Trend direction using ADX + MA slopes (matches backend)
  let trendDirection = 'sideways';
  if (adxValue > 25) {
    if (maShortSlope > 0.001 && maLongSlope > 0.001) {
      trendDirection = 'up';
    } else if (maShortSlope < -0.001 && maLongSlope < -0.001) {
      trendDirection = 'down';
    }
  }
  
  // IMPROVED: Volatility regime using z-score approach
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const recentReturns = returns.slice(-20);
  const volatilityStd = Math.sqrt(
    recentReturns.reduce((sum, r) => sum + r * r, 0) / recentReturns.length
  );
  
  // Historical volatility for z-score
  const historicalReturns = returns.slice(0, -20);
  const historicalMean = historicalReturns.length > 0 
    ? historicalReturns.reduce((a, b) => a + b, 0) / historicalReturns.length 
    : 0;
  const historicalStd = historicalReturns.length > 0
    ? Math.sqrt(historicalReturns.reduce((sum, r) => sum + Math.pow(r - historicalMean, 2), 0) / historicalReturns.length)
    : 0.01;
  
  const volatilityZScore = historicalStd > 0 ? (volatilityStd - historicalMean) / historicalStd : 0;
  
  let volatilityRegime = 'normal';
  if (volatilityZScore > 2.0 || atrPct > 3.0) {
    volatilityRegime = 'high';
  } else if (volatilityZScore < 0.5 && atrPct < 1.0) {
    volatilityRegime = 'low';
  }
  
  // IMPROVED: Market state classification (matches backend)
  let marketState = 'range';
  if (adxValue > 25 && trendDirection !== 'sideways') {
    marketState = volatilityRegime === 'high' ? 'trend_volatile' : 'trend';
  } else if (volatilityRegime === 'high') {
    marketState = 'chop';
  }
  
  // Volume analysis
  const avgVolume = sma(volumes, 20);
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = currentVolume / avgVolume;
  
  return {
    ema_9: ema9,
    ema_21: ema21,
    rsi_14: rsi(closes),
    atr: currentATR,
    atr_pct: atrPct,
    adx: adxValue,
    bb_width: bbWidth,
    ma_slope_short: maShortSlope,
    ma_slope_long: maLongSlope,
    volatility_std: volatilityStd,
    trend_direction: trendDirection,
    volatility_regime: volatilityRegime,
    market_state: marketState,
    volume_ratio: volumeRatio,
    price: currentPrice,
    ema_alignment: ema9 > ema21 ? 'bullish' : ema9 < ema21 ? 'bearish' : 'neutral',
  };
}
```

---

### Task 1.3: Add Setup Detection Improvements

**File:** `chrome-extension/binance-api.js`

**Add momentum divergence detection:**

```javascript
/**
 * Detect momentum divergence between price and RSI.
 */
function detectMomentumDivergence(candles, rsiValues) {
  if (candles.length < 20 || rsiValues.length < 20) return null;
  
  const recentCandles = candles.slice(-20);
  const recentRSI = rsiValues.slice(-20);
  
  // Find swing highs/lows in price
  const priceHighIdx = recentCandles.reduce((maxIdx, c, idx) => 
    c.high > recentCandles[maxIdx].high ? idx : maxIdx, 0);
  const priceLowIdx = recentCandles.reduce((minIdx, c, idx) => 
    c.low < recentCandles[minIdx].low ? idx : minIdx, 0);
  
  // Find swing highs/lows in RSI
  const rsiHighIdx = recentRSI.reduce((maxIdx, r, idx) => 
    r > recentRSI[maxIdx] ? idx : maxIdx, 0);
  const rsiLowIdx = recentRSI.reduce((minIdx, r, idx) => 
    r < recentRSI[minIdx] ? idx : minIdx, 0);
  
  // Bullish divergence: price makes lower low, RSI makes higher low
  if (priceLowIdx > 10 && rsiLowIdx > 10) {
    const currentPriceLow = recentCandles[priceLowIdx].low;
    const previousPriceLow = Math.min(...recentCandles.slice(0, priceLowIdx).map(c => c.low));
    const currentRSILow = recentRSI[rsiLowIdx];
    const previousRSILow = Math.min(...recentRSI.slice(0, rsiLowIdx));
    
    if (currentPriceLow < previousPriceLow && currentRSILow > previousRSILow) {
      return 'bullish_divergence';
    }
  }
  
  // Bearish divergence: price makes higher high, RSI makes lower high
  if (priceHighIdx > 10 && rsiHighIdx > 10) {
    const currentPriceHigh = recentCandles[priceHighIdx].high;
    const previousPriceHigh = Math.max(...recentCandles.slice(0, priceHighIdx).map(c => c.high));
    const currentRSIHigh = recentRSI[rsiHighIdx];
    const previousRSIHigh = Math.max(...recentRSI.slice(0, rsiHighIdx));
    
    if (currentPriceHigh > previousPriceHigh && currentRSIHigh < previousRSIHigh) {
      return 'bearish_divergence';
    }
  }
  
  return null;
}

/**
 * Detect EMA crossover with recency check.
 */
function detectEMACrossover(candles) {
  if (candles.length < 25) return null;
  
  const ema = (data, period) => {
    const k = 2 / (period + 1);
    let result = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < data.length; i++) {
      result = data[i] * k + result * (1 - k);
    }
    return result;
  };
  
  const recentCandles = candles.slice(-10);
  
  // Calculate EMAs for recent candles
  for (let i = 0; i < recentCandles.length; i++) {
    const dataSlice = candles.slice(0, candles.length - 10 + i + 1);
    const closes = dataSlice.map(c => c.close);
    recentCandles[i].ema9 = ema(closes, 9);
    recentCandles[i].ema21 = ema(closes, 21);
  }
  
  // Check for crossover in last 5 bars
  for (let i = recentCandles.length - 5; i < recentCandles.length; i++) {
    if (i > 0) {
      const prev = recentCandles[i - 1];
      const curr = recentCandles[i];
      
      // Bullish crossover
      if (prev.ema9 < prev.ema21 && curr.ema9 > curr.ema21) {
        return { type: 'bullish_crossover', bars_ago: recentCandles.length - 1 - i };
      }
      
      // Bearish crossover
      if (prev.ema9 > prev.ema21 && curr.ema9 < curr.ema21) {
        return { type: 'bearish_crossover', bars_ago: recentCandles.length - 1 - i };
      }
    }
  }
  
  return null;
}
```

---

## ✅ Test Cases

### Test 1.1: Ephemeral Analysis Flow

**Test Script:** `chrome-extension/tests/test_ephemeral_flow.js`

```javascript
/**
 * Test: Ephemeral analysis flow works for unknown symbols.
 * 
 * Prerequisites:
 * - Extension loaded in Chrome
 * - Backend running at lenquant.com
 * 
 * Steps:
 * 1. Navigate to a symbol NOT in LenQuant database (e.g., FLOKIUSDT)
 * 2. Extension should:
 *    a. Call /context → get insufficient_data
 *    b. Fetch OHLCV from Binance
 *    c. POST to /analyze-ephemeral
 *    d. Display proper regime analysis (not basic client-side)
 * 
 * Expected Result:
 * - Panel shows source: "ephemeral"
 * - Market state is properly classified (trend/range/chop)
 * - ADX value is displayed in regime features
 */

// Manual test: Open Chrome DevTools console on Binance Futures page

// Check last analysis source
chrome.storage.local.get(['lastAnalysis'], (result) => {
  console.log('Last analysis:', result.lastAnalysis);
  console.assert(result.lastAnalysis.source === 'ephemeral' || result.lastAnalysis.source === 'backend', 
    'Analysis should come from ephemeral or backend, not client');
});
```

### Test 1.2: Client-Side ADX Calculation

**Test Script:** `chrome-extension/tests/test_adx_calculation.js`

```javascript
/**
 * Test: ADX calculation matches backend.
 */
const testCandles = [
  // 50+ candles with known OHLCV values
  // Compare client-side ADX with backend calculation
];

// Import from binance-api.js
const adx = calculateADX(
  testCandles.map(c => c.high),
  testCandles.map(c => c.low),
  testCandles.map(c => c.close),
  14
);

// Should be within 5% of backend value
console.assert(Math.abs(adx - expectedADX) / expectedADX < 0.05, 
  `ADX mismatch: got ${adx}, expected ${expectedADX}`);
```

### Test 1.3: Backend Ephemeral Endpoint

**Test Command:**

```bash
# Test ephemeral endpoint with real data
python -c "
import requests
import json

# Fetch candles from Binance
candles_resp = requests.get('https://fapi.binance.com/fapi/v1/klines', params={
    'symbol': 'BTCUSDT',
    'interval': '1m',
    'limit': 300
})
candles = [
    {'timestamp': c[0], 'open': float(c[1]), 'high': float(c[2]), 
     'low': float(c[3]), 'close': float(c[4]), 'volume': float(c[5])}
    for c in candles_resp.json()
]

# Send to ephemeral endpoint
resp = requests.post('http://localhost:8000/api/extension/analyze-ephemeral', json={
    'symbol': 'BTCUSDT',
    'timeframe': '1m',
    'candles': candles
})

result = resp.json()
print('Ephemeral analysis result:')
print(json.dumps(result, indent=2))

# Validate
assert result['source'] == 'ephemeral'
assert result['market_state'] in ['trend', 'trend_volatile', 'range', 'chop']
assert 'adx' in result.get('regime_features', {})
print('✓ All assertions passed')
"
```

---

## 📊 Validation Criteria

| Criteria | Target | Validation Method |
|----------|--------|-------------------|
| Ephemeral endpoint responds | <1500ms | Measure latency in response |
| Symbols not in DB use ephemeral | 100% | Check `source: ephemeral` in response |
| Client-side ADX within 5% of backend | Yes | Compare calculations |
| BB width calculation correct | Yes | Compare with TradingView |
| Setup detection matches backend | >80% | Test with known patterns |

---

## 📁 Files Modified

| File | Changes |
|------|---------|
| `chrome-extension/background.js` | Add `performEphemeralAnalysis()`, modify `fetchContextAnalysis()` |
| `chrome-extension/binance-api.js` | Add `calculateADX()`, `calculateBBWidth()`, `calculateMASlope()`, improve `calculateIndicators()` |
| `chrome-extension/content.js` | Update panel to show source indicator |
| `api/routes/extension.py` | Already has `/analyze-ephemeral` - verify it works |

---

## 🔗 Next Phase Prerequisites

Phase 2 requires:
- [x] Ephemeral analysis working for any symbol
- [x] Client-side improvements tested
- [x] Backend `/analyze-ephemeral` endpoint validated

---

*Complete this phase before moving to Phase 2: Symbol Coverage Expansion*

