/**
 * LenQuant - Client-side Binance API Fetcher
 * 
 * Fetches OHLCV data directly from Binance public API.
 * No API key required for public endpoints.
 * This allows the extension to work independently without
 * requiring LenQuant backend to have pre-collected data.
 */

const BINANCE_FUTURES_API = 'https://fapi.binance.com';

// Timeframe mappings
const TIMEFRAME_MAP = {
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '2h': '2h',
  '4h': '4h',
  '6h': '6h',
  '12h': '12h',
  '1d': '1d',
  '1w': '1w',
};

/**
 * Fetch OHLCV candles from Binance Futures API.
 * 
 * @param {string} symbol - Trading pair (e.g., "BTCUSDT")
 * @param {string} interval - Timeframe (e.g., "1m", "5m")
 * @param {number} limit - Number of candles (max 1500)
 * @returns {Promise<Array>} Array of candle objects
 */
async function fetchBinanceOHLCV(symbol, interval = '1m', limit = 300) {
  const mappedInterval = TIMEFRAME_MAP[interval] || interval;
  
  const url = new URL(`${BINANCE_FUTURES_API}/fapi/v1/klines`);
  url.searchParams.set('symbol', symbol.replace('/', '').toUpperCase());
  url.searchParams.set('interval', mappedInterval);
  url.searchParams.set('limit', Math.min(limit, 1500).toString());
  
  try {
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Convert Binance format to standard OHLCV
    // Binance returns: [openTime, open, high, low, close, volume, closeTime, ...]
    return data.map(candle => ({
      timestamp: candle[0],
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
    }));
    
  } catch (error) {
    console.error('[LenQuant] Binance OHLCV fetch error:', error);
    throw error;
  }
}

/**
 * Fetch current mark price for a symbol.
 * 
 * @param {string} symbol - Trading pair
 * @returns {Promise<Object>} Mark price info
 */
async function fetchMarkPrice(symbol) {
  const url = new URL(`${BINANCE_FUTURES_API}/fapi/v1/premiumIndex`);
  url.searchParams.set('symbol', symbol.replace('/', '').toUpperCase());
  
  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    
    const data = await response.json();
    return {
      symbol: data.symbol,
      markPrice: parseFloat(data.markPrice),
      indexPrice: parseFloat(data.indexPrice),
      fundingRate: parseFloat(data.lastFundingRate),
    };
  } catch (error) {
    console.error('[LenQuant] Mark price fetch error:', error);
    return null;
  }
}

/**
 * Fetch 24h ticker data for a symbol.
 * 
 * @param {string} symbol - Trading pair
 * @returns {Promise<Object>} 24h stats
 */
async function fetch24hStats(symbol) {
  const url = new URL(`${BINANCE_FUTURES_API}/fapi/v1/ticker/24hr`);
  url.searchParams.set('symbol', symbol.replace('/', '').toUpperCase());
  
  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    
    const data = await response.json();
    return {
      symbol: data.symbol,
      priceChange: parseFloat(data.priceChange),
      priceChangePercent: parseFloat(data.priceChangePercent),
      highPrice: parseFloat(data.highPrice),
      lowPrice: parseFloat(data.lowPrice),
      volume: parseFloat(data.volume),
      quoteVolume: parseFloat(data.quoteVolume),
    };
  } catch (error) {
    console.error('[LenQuant] 24h stats fetch error:', error);
    return null;
  }
}

/**
 * Fetch order book depth.
 * 
 * @param {string} symbol - Trading pair
 * @param {number} limit - Depth limit (5, 10, 20, 50, 100, 500, 1000)
 * @returns {Promise<Object>} Order book data
 */
async function fetchOrderBook(symbol, limit = 20) {
  const url = new URL(`${BINANCE_FUTURES_API}/fapi/v1/depth`);
  url.searchParams.set('symbol', symbol.replace('/', '').toUpperCase());
  url.searchParams.set('limit', limit.toString());
  
  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    
    const data = await response.json();
    
    // Calculate spread
    const bestBid = parseFloat(data.bids[0]?.[0] || 0);
    const bestAsk = parseFloat(data.asks[0]?.[0] || 0);
    const spread = bestAsk - bestBid;
    const spreadPct = bestBid > 0 ? (spread / bestBid) * 100 : 0;
    
    return {
      bids: data.bids.slice(0, 10).map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) })),
      asks: data.asks.slice(0, 10).map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) })),
      bestBid,
      bestAsk,
      spread,
      spreadPct: spreadPct.toFixed(4),
    };
  } catch (error) {
    console.error('[LenQuant] Order book fetch error:', error);
    return null;
  }
}

/**
 * Calculate basic technical indicators from OHLCV data.
 * Client-side calculation for when backend is unavailable.
 * 
 * @param {Array} candles - OHLCV candles
 * @returns {Object} Calculated indicators
 */
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
  
  /**
   * Calculate ADX (Average Directional Index) for trend strength.
   * This matches the backend macro/regime.py implementation.
   */
  const adx = (highs, lows, closes, period = 14) => {
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
  };
  
  const currentPrice = closes[closes.length - 1];
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const currentATR = atr(highs, lows, closes, 14);
  const atrPct = (currentATR / currentPrice) * 100;

  // NEW: Proper ADX calculation
  const adxValue = adx(highs, lows, closes, 14);

  // NEW: Bollinger Band width calculation
  const bbWidth = (() => {
    if (closes.length < 20) return 0;
    const recentCloses = closes.slice(-20);
    const ma = recentCloses.reduce((a, b) => a + b, 0) / 20;
    const variance = recentCloses.reduce((sum, val) => sum + Math.pow(val - ma, 2), 0) / 20;
    const std = Math.sqrt(variance);
    const upperBand = ma + (std * 2.0);
    const lowerBand = ma - (std * 2.0);
    return ma > 0 ? ((upperBand - lowerBand) / ma) * 100 : 0;
  })();

  // NEW: MA slope calculations
  const maSlopeShort = (() => {
    if (closes.length < 21) return 0;
    const ma = [];
    for (let i = 19; i < closes.length; i++) {
      const sum = closes.slice(i - 19, i + 1).reduce((a, b) => a + b, 0);
      ma.push(sum / 20);
    }
    if (ma.length < 2) return 0;
    const currentMA = ma[ma.length - 1];
    const previousMA = ma[ma.length - 2];
    return currentMA > 0 ? (currentMA - previousMA) / currentMA : 0;
  })();

  const maSlopeLong = (() => {
    if (closes.length < 51) return 0;
    const ma = [];
    for (let i = 49; i < closes.length; i++) {
      const sum = closes.slice(i - 49, i + 1).reduce((a, b) => a + b, 0);
      ma.push(sum / 50);
    }
    if (ma.length < 2) return 0;
    const currentMA = ma[ma.length - 1];
    const previousMA = ma[ma.length - 2];
    return currentMA > 0 ? (currentMA - previousMA) / currentMA : 0;
  })();
  
  // IMPROVED: Trend direction using ADX + MA slopes (matches backend)
  let trendDirection = 'sideways';
  if (adxValue > 25) {
    if (maSlopeShort > 0.001 && maSlopeLong > 0.001) {
      trendDirection = 'up';
    } else if (maSlopeShort < -0.001 && maSlopeLong < -0.001) {
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
    ma_slope_short: maSlopeShort,
    ma_slope_long: maSlopeLong,
    volatility_std: volatilityStd,
    trend_direction: trendDirection,
    volatility_regime: volatilityRegime,
    market_state: marketState,
    volume_ratio: volumeRatio,
    price: currentPrice,
    ema_alignment: ema9 > ema21 ? 'bullish' : ema9 < ema21 ? 'bearish' : 'neutral',
  };
}

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

/**
 * Perform client-side analysis when backend is unavailable.
 *
 * @param {string} symbol - Trading pair
 * @param {string} timeframe - Chart interval
 * @param {Object} domData - Data extracted from DOM (leverage, etc.)
 * @returns {Promise<Object>} Analysis result
 */
async function performClientSideAnalysis(symbol, timeframe, domData = {}) {
  const startTime = Date.now();
  
  try {
    // Fetch OHLCV data
    const candles = await fetchBinanceOHLCV(symbol, timeframe, 300);
    
    if (!candles || candles.length < 50) {
      return {
        trade_allowed: false,
        market_state: 'undefined',
        trend_direction: null,
        volatility_regime: 'UNDEFINED',
        setup_candidates: [],
        risk_flags: ['insufficient_data'],
        suggested_leverage_band: [1, 5],
        confidence_pattern: 0,
        reason: `Insufficient data for ${symbol}. Only ${candles?.length || 0} candles available.`,
        latency_ms: Date.now() - startTime,
        source: 'client',
        dom_leverage: domData.leverage || null,
      };
    }
    
    // Calculate indicators
    const indicators = calculateIndicators(candles);
    
    if (!indicators) {
      return {
        trade_allowed: false,
        market_state: 'error',
        risk_flags: ['calculation_error'],
        suggested_leverage_band: [1, 5],
        reason: 'Failed to calculate indicators',
        latency_ms: Date.now() - startTime,
        source: 'client',
      };
    }
    
    // Detect setups
    const setupCandidates = [];

    // Check for EMA crossover
    const crossover = detectEMACrossover(candles);
    if (crossover && crossover.bars_ago <= 2) {
      setupCandidates.push(crossover.type);
    }

    // Check for momentum divergence
    const divergence = detectMomentumDivergence(candles, candles.map(c => indicators.rsi_14));
    if (divergence) {
      setupCandidates.push(divergence);
    }

    // Pullback continuation (existing logic but improved)
    if (indicators.trend_direction !== 'sideways') {
      const emaZone = [Math.min(indicators.ema_9, indicators.ema_21), Math.max(indicators.ema_9, indicators.ema_21)];
      const zoneWidth = emaZone[1] - emaZone[0];
      if (indicators.price >= emaZone[0] - zoneWidth * 0.5 && indicators.price <= emaZone[1] + zoneWidth * 0.5) {
        setupCandidates.push('pullback_continuation');
      }
    }

    // Range breakout - check if near recent extremes
    const recentHighs = candles.slice(-20).map(c => c.high);
    const recentLows = candles.slice(-20).map(c => c.low);
    const high20 = Math.max(...recentHighs);
    const low20 = Math.min(...recentLows);
    const rangeSize = high20 - low20;
    if (rangeSize > 0 && indicators.market_state === 'range') {
      if ((high20 - indicators.price) / rangeSize < 0.1 || (indicators.price - low20) / rangeSize < 0.1) {
        setupCandidates.push('range_breakout');
      }
    }
    
    // Risk flags
    const riskFlags = [];
    if (indicators.volume_ratio < 0.3) riskFlags.push('low_volume');
    if (indicators.atr_pct > 5.0) riskFlags.push('extreme_volatility');
    if (indicators.rsi_14 > 80) riskFlags.push('overbought');
    if (indicators.rsi_14 < 20) riskFlags.push('oversold');
    
    // Calculate leverage band
    let maxLeverage = 20;
    if (indicators.volatility_regime === 'high') maxLeverage = Math.min(8, maxLeverage);
    else if (indicators.atr_pct > 3.0) maxLeverage = Math.min(10, maxLeverage);
    else if (indicators.atr_pct > 2.0) maxLeverage = Math.min(15, maxLeverage);
    if (indicators.market_state === 'chop') maxLeverage = Math.min(5, maxLeverage);
    
    const minLeverage = Math.max(1, Math.floor(maxLeverage / 3));
    
    // Trade allowed?
    const tradeAllowed = indicators.market_state !== 'chop' && 
                         indicators.market_state !== 'undefined' &&
                         !riskFlags.includes('extreme_volatility');
    
    // Build reason
    const stateDescriptions = {
      trend: 'Clean trending market',
      trend_volatile: 'Trending with elevated volatility',
      range: 'Ranging market',
      chop: 'Choppy/uncertain conditions',
    };
    let reason = stateDescriptions[indicators.market_state] || indicators.market_state;
    if (setupCandidates.length) reason += `. Setup: ${setupCandidates[0]}`;
    if (riskFlags.length) reason += `. Caution: ${riskFlags.slice(0, 2).join(', ')}`;
    if (!tradeAllowed) reason += '. Wait for better conditions';
    
    return {
      trade_allowed: tradeAllowed,
      market_state: indicators.market_state,
      trend_direction: indicators.trend_direction,
      volatility_regime: indicators.volatility_regime.toUpperCase() + '_VOLATILITY',
      setup_candidates: setupCandidates,
      risk_flags: riskFlags,
      suggested_leverage_band: [minLeverage, maxLeverage],
      confidence_pattern: Math.round((100 - Math.abs(indicators.rsi_14 - 50)) * 0.8),
      reason,
      regime_features: {
        atr: indicators.atr,
        atr_pct: indicators.atr_pct,
        adx: indicators.adx,
        bb_width: indicators.bb_width,
        ma_slope_short: indicators.ma_slope_short,
        ma_slope_long: indicators.ma_slope_long,
        volatility_std: indicators.volatility_std,
        ema_alignment: indicators.ema_alignment,
        rsi_14: indicators.rsi_14,
      },
      latency_ms: Date.now() - startTime,
      source: 'client',
      cached: false,
      // Include DOM data
      dom_leverage: domData.leverage || null,
      dom_position: domData.position || null,
    };
    
  } catch (error) {
    console.error('[LenQuant] Client-side analysis error:', error);
    return {
      trade_allowed: false,
      market_state: 'error',
      trend_direction: null,
      volatility_regime: 'UNDEFINED',
      setup_candidates: [],
      risk_flags: ['api_error'],
      suggested_leverage_band: [1, 5],
      confidence_pattern: 0,
      reason: `Analysis failed: ${error.message}`,
      latency_ms: Date.now() - startTime,
      source: 'client',
    };
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fetchBinanceOHLCV,
    fetchMarkPrice,
    fetch24hStats,
    fetchOrderBook,
    calculateIndicators,
    performClientSideAnalysis,
  };
}

