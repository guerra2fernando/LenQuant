/**
 * LenQuant Binance Assistant - Background Service Worker
 *
 * Handles:
 * - API communication with LenQuant backend
 * - WebSocket connection management
 * - Event logging buffer
 * - Chrome extension messaging
 */

// Polyfill process for browser environment
if (typeof process === 'undefined') {
  self.process = { env: {} };
}

// Default Configuration (production URLs)
const DEFAULT_CONFIG = {
  API_BASE_URL: 'https://lenquant.com/api/extension',
  WS_URL: 'wss://lenquant.com/ws/extension',
  BINANCE_FUTURES_API: 'https://fapi.binance.com',
  EVENT_BUFFER_SIZE: 100,
  EVENT_FLUSH_INTERVAL: 5000, // 5 seconds
  ANALYSIS_CACHE_TTL: 3000,   // 3 seconds
  BEHAVIOR_CHECK_INTERVAL: 60000, // 1 minute
  BACKEND_TIMEOUT_MS: 3000,   // Timeout for backend requests
  USE_CLIENT_FALLBACK: true,  // Enable client-side analysis fallback
};

// Active configuration (updated from storage)
let CONFIG = { ...DEFAULT_CONFIG };

// ============================================================================
// Google Analytics 4 for Chrome Extension using Measurement Protocol
// ============================================================================

const GA_MEASUREMENT_ID = 'G-H85MS707JE';
let GA_API_SECRET = ''; // Will be fetched from backend

class ExtensionAnalytics {
  constructor() {
    this.clientId = this.getOrCreateClientId();
    this.sessionId = this.generateSessionId();
    this.userId = null;
    this.initialized = false;
    this.initPromise = this.initialize();
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Try to load from chrome.storage first
      const result = await chrome.storage.local.get(['ga_api_secret']);
      if (result.ga_api_secret) {
        GA_API_SECRET = result.ga_api_secret;
        this.initialized = true;
        console.log('[GA] Loaded API secret from storage');
        return;
      }

      // Wait for settings to be loaded before accessing CONFIG
      let attempts = 0;
      while (!CONFIG.API_BASE_URL && attempts < 50) { // Wait up to 5 seconds
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!CONFIG.API_BASE_URL) {
        console.warn('[GA] CONFIG not loaded, skipping backend fetch');
        this.initialized = true;
        return;
      }

      // Fetch from backend if not in storage
      const response = await fetch(`${CONFIG.API_BASE_URL}/config/ga-secret`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        GA_API_SECRET = data.ga_api_secret || '';
        // Store for future use
        await chrome.storage.local.set({ ga_api_secret: GA_API_SECRET });
        console.log('[GA] Fetched and stored API secret from backend');
      } else {
        console.warn('[GA] Failed to fetch API secret from backend:', response.status);
      }
    } catch (error) {
      console.warn('[GA] Error initializing analytics:', error);
    }

    this.initialized = true;
  }

  getOrCreateClientId() {
    let clientId = chrome.storage.local.get(['ga_client_id']).then(result => {
      if (result.ga_client_id) {
        return result.ga_client_id;
      } else {
        const newClientId = this.generateUUID();
        chrome.storage.local.set({ ga_client_id: newClientId });
        return newClientId;
      }
    });
    return clientId;
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  generateSessionId() {
    return Date.now().toString();
  }

  setUserId(userId) {
    this.userId = userId;
  }

  async sendEvent(eventName, parameters = {}) {
    // Wait for initialization
    await this.initPromise;

    if (!GA_API_SECRET) {
      console.log('[GA Debug]', eventName, parameters);
      return;
    }

    const clientId = await this.clientId;
    const payload = {
      client_id: clientId,
      events: [{
        name: eventName,
        params: {
          session_id: this.sessionId,
          engagement_time_msec: 100,
          ...parameters
        }
      }]
    };

    if (this.userId) {
      payload.user_id = this.userId;
    }

    try {
      // Send GA event through backend proxy to avoid CORS issues
      const response = await fetch(`${CONFIG.API_BASE_URL}/analytics/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          measurement_id: GA_MEASUREMENT_ID,
          events: [payload]  // Wrap in events array as expected by our endpoint
        })
      });

      if (!response.ok) {
        console.warn('GA event failed:', response.status);
      }
    } catch (error) {
      console.warn('GA event error:', error);
    }
  }
}

const extensionAnalytics = new ExtensionAnalytics();

// ============================================================================
// Client-Side Binance API (Fallback when backend unavailable)
// ============================================================================

/**
 * Fetch OHLCV directly from Binance API.
 */
async function fetchBinanceOHLCV(symbol, interval = '1m', limit = 300) {
  const url = new URL(`${CONFIG.BINANCE_FUTURES_API}/fapi/v1/klines`);
  url.searchParams.set('symbol', symbol.replace('/', '').toUpperCase());
  url.searchParams.set('interval', interval);
  url.searchParams.set('limit', Math.min(limit, 1500).toString());
  
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Binance API error: ${response.status}`);
  
  const data = await response.json();
  return data.map(candle => ({
    timestamp: candle[0],
    open: parseFloat(candle[1]),
    high: parseFloat(candle[2]),
    low: parseFloat(candle[3]),
    close: parseFloat(candle[4]),
    volume: parseFloat(candle[5]),
  }));
}

/**
 * Calculate basic indicators from OHLCV.
 */
function calculateIndicatorsFromCandles(candles) {
  if (!candles || candles.length < 50) return null;
  
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);
  
  // EMA
  const ema = (data, period) => {
    const k = 2 / (period + 1);
    let result = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < data.length; i++) {
      result = data[i] * k + result * (1 - k);
    }
    return result;
  };
  
  // SMA
  const sma = (data, period) => data.slice(-period).reduce((a, b) => a + b, 0) / Math.min(period, data.length);
  
  // RSI
  const rsi = (data, period = 14) => {
    const changes = [];
    for (let i = 1; i < data.length; i++) changes.push(data[i] - data[i - 1]);
    const recent = changes.slice(-period);
    const gains = recent.filter(c => c > 0);
    const losses = recent.filter(c => c < 0).map(c => Math.abs(c));
    const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / period : 0;
    const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / period : 0.0001;
    return 100 - (100 / (1 + avgGain / avgLoss));
  };
  
  // ATR
  const atr = () => {
    const trs = [];
    for (let i = 1; i < highs.length; i++) {
      trs.push(Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      ));
    }
    return sma(trs, 14);
  };
  
  const price = closes[closes.length - 1];
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const currentATR = atr();
  const atrPct = (currentATR / price) * 100;
  const rsiValue = rsi(closes);
  
  // Trend direction
  let trendDirection = 'sideways';
  if (ema9 > ema21 * 1.002) trendDirection = 'up';
  else if (ema9 < ema21 * 0.998) trendDirection = 'down';
  
  // Volatility regime
  let volatilityRegime = 'normal';
  if (atrPct > 3.0) volatilityRegime = 'high';
  else if (atrPct < 1.0) volatilityRegime = 'low';
  
  // Market state
  let marketState = 'range';
  if (trendDirection !== 'sideways' && atrPct > 1.5) {
    marketState = volatilityRegime === 'high' ? 'trend_volatile' : 'trend';
  } else if (volatilityRegime === 'high') {
    marketState = 'chop';
  }
  
  return {
    ema_9: ema9, ema_21: ema21, rsi_14: rsiValue,
    atr: currentATR, atr_pct: atrPct,
    trend_direction: trendDirection,
    volatility_regime: volatilityRegime,
    market_state: marketState,
    price,
    volume_ratio: volumes[volumes.length - 1] / sma(volumes, 20),
    ema_alignment: ema9 > ema21 ? 'bullish' : ema9 < ema21 ? 'bearish' : 'neutral',
  };
}

/**
 * Perform client-side analysis when backend is unavailable.
 */
async function performClientSideAnalysis(symbol, timeframe, domData = {}) {
  const startTime = Date.now();
  
  try {
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
        reason: `Insufficient data for ${symbol}. Only ${candles?.length || 0} candles.`,
        latency_ms: Date.now() - startTime,
        source: 'client',
        dom_leverage: domData.leverage || null,
      };
    }
    
    const indicators = calculateIndicatorsFromCandles(candles);
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
    if (indicators.trend_direction !== 'sideways') {
      const emaZone = [Math.min(indicators.ema_9, indicators.ema_21), Math.max(indicators.ema_9, indicators.ema_21)];
      const zoneWidth = emaZone[1] - emaZone[0];
      if (indicators.price >= emaZone[0] - zoneWidth * 0.5 && indicators.price <= emaZone[1] + zoneWidth * 0.5) {
        setupCandidates.push('pullback_continuation');
      }
    }
    
    // Risk flags
    const riskFlags = [];
    if (indicators.volume_ratio < 0.3) riskFlags.push('low_volume');
    if (indicators.atr_pct > 5.0) riskFlags.push('extreme_volatility');
    if (indicators.rsi_14 > 80) riskFlags.push('overbought');
    if (indicators.rsi_14 < 20) riskFlags.push('oversold');
    
    // Leverage band
    let maxLev = 20;
    if (indicators.volatility_regime === 'high') maxLev = 8;
    else if (indicators.atr_pct > 3.0) maxLev = 10;
    else if (indicators.atr_pct > 2.0) maxLev = 15;
    if (indicators.market_state === 'chop') maxLev = 5;
    const minLev = Math.max(1, Math.floor(maxLev / 3));
    
    const tradeAllowed = indicators.market_state !== 'chop' && 
                         indicators.market_state !== 'undefined' &&
                         !riskFlags.includes('extreme_volatility');
    
    // Build reason
    const stateDesc = {
      trend: 'Clean trending market',
      trend_volatile: 'Trending with elevated volatility',
      range: 'Ranging market',
      chop: 'Choppy/uncertain conditions',
    };
    let reason = stateDesc[indicators.market_state] || indicators.market_state;
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
      suggested_leverage_band: [minLev, maxLev],
      confidence_pattern: Math.round((100 - Math.abs(indicators.rsi_14 - 50)) * 0.8),
      reason,
      regime_features: {
        atr: indicators.atr,
        atr_pct: indicators.atr_pct,
        ema_alignment: indicators.ema_alignment,
        rsi_14: indicators.rsi_14,
      },
      latency_ms: Date.now() - startTime,
      source: 'client',
      cached: false,
      dom_leverage: domData.leverage || null,
      dom_position: domData.position || null,
    };
    
  } catch (error) {
    console.error('[LenQuant] Client-side analysis error:', error);
    return {
      trade_allowed: false,
      market_state: 'error',
      risk_flags: ['api_error'],
      suggested_leverage_band: [1, 5],
      reason: `Analysis failed: ${error.message}`,
      latency_ms: Date.now() - startTime,
      source: 'client',
    };
  }
}

// State
let sessionId = null;
let eventBuffer = [];
let analysisCache = new Map();
let wsConnection = null;
let cooldownState = null;
let lastBehaviorCheck = 0;
let settingsLoaded = false;

// Load settings from storage
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get('settings');
    if (result.settings) {
      const apiUrl = result.settings.apiUrl || 'https://lenquant.com';
      const wsUrl = result.settings.wsUrl || 'wss://lenquant.com';
      
      // Normalize URLs - ensure they end properly
      const normalizedApiUrl = apiUrl.replace(/\/$/, '');
      const normalizedWsUrl = wsUrl.replace(/\/$/, '');
      
      CONFIG.API_BASE_URL = `${normalizedApiUrl}/api/extension`;
      CONFIG.WS_URL = `${normalizedWsUrl}/ws/extension`;
      
      console.log('[LenQuant] Settings loaded:', { 
        apiUrl: CONFIG.API_BASE_URL, 
        wsUrl: CONFIG.WS_URL 
      });
    }
    settingsLoaded = true;
  } catch (error) {
    console.error('[LenQuant] Failed to load settings:', error);
    settingsLoaded = true;
  }
}

// Initialize settings on startup
loadSettings();

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.settings) {
    console.log('[LenQuant] Settings changed, reloading...');
    loadSettings().then(() => {
      // Reconnect WebSocket with new settings if URL changed
      if (wsConnection) {
        wsConnection.close();
        wsConnection = null;
      }
      setTimeout(connectWebSocket, 1000);
    });
  }
});

// Initialize session
function initSession() {
  sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log('[LenQuant] Session initialized:', sessionId);
  return sessionId;
}

// API Calls with Hybrid Mode (Backend First, Client Fallback)
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
    console.warn('[LenQuant] Backend failed, trying ephemeral analysis:', error.message);

    // Try ephemeral analysis first
    try {
      const ephemeralResult = await performEphemeralAnalysis(symbol, timeframe, domData);
      if (ephemeralResult && ephemeralResult.market_state !== 'error') {
        analysisCache.set(cacheKey, { data: ephemeralResult, timestamp: Date.now() });
        return ephemeralResult;
      }
    } catch (ephemeralError) {
      console.warn('[LenQuant] Ephemeral analysis failed:', ephemeralError.message);
    }

    // Final fallback to client-side analysis
    if (CONFIG.USE_CLIENT_FALLBACK) {
      try {
        return await performClientSideAnalysis(symbol, timeframe, domData);
      } catch (clientError) {
        console.error('[LenQuant] Client-side also failed:', clientError);
        throw clientError;
      }
    }

    throw error;
  }
}

async function fetchExplanation(context, fastAnalysis, tradeLevels = null) {
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context,
        fast_analysis: fastAnalysis,
        trade_levels: tradeLevels,
        recent_behavior: null,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error('[LenQuant] Explanation error:', error);
    throw error;
  }
}

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

async function analyzeBehavior() {
  if (!sessionId) return null;
  
  try {
    const url = new URL(`${CONFIG.API_BASE_URL}/behavior/analyze`);
    url.searchParams.set('session_id', sessionId);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Update cooldown state
    if (result.in_cooldown) {
      cooldownState = {
        active: true,
        remainingMin: result.cooldown_remaining_min,
      };
    } else {
      cooldownState = null;
    }
    
    return result;
    
  } catch (error) {
    console.error('[LenQuant] Behavior analysis error:', error);
    return null;
  }
}

async function startCooldown(minutes, reason) {
  if (!sessionId) return null;
  
  try {
    const url = new URL(`${CONFIG.API_BASE_URL}/behavior/cooldown`);
    url.searchParams.set('session_id', sessionId);
    url.searchParams.set('minutes', minutes.toString());
    if (reason) {
      url.searchParams.set('reason', reason);
    }
    
    const response = await fetch(url.toString(), { method: 'POST' });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const result = await response.json();
    
    cooldownState = {
      active: true,
      endsAt: result.ends_at,
      remainingMin: result.duration_min,
    };
    
    return result;
    
  } catch (error) {
    console.error('[LenQuant] Start cooldown error:', error);
    return null;
  }
}

async function checkCooldownStatus() {
  if (!sessionId) return null;
  
  try {
    const url = new URL(`${CONFIG.API_BASE_URL}/behavior/cooldown`);
    url.searchParams.set('session_id', sessionId);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.active) {
      cooldownState = {
        active: true,
        remainingMin: result.remaining_min,
        endsAt: result.ends_at,
        reason: result.reason,
      };
    } else {
      cooldownState = null;
    }
    
    return result;
    
  } catch (error) {
    console.error('[LenQuant] Cooldown check error:', error);
    return null;
  }
}

async function syncTrades(mode = 'testnet') {
  if (!sessionId) return null;
  
  try {
    const url = new URL(`${CONFIG.API_BASE_URL}/sync`);
    url.searchParams.set('mode', mode);
    url.searchParams.set('session_id', sessionId);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('[LenQuant] Sync error:', error);
    return null;
  }
}

async function getDailyReport(date) {
  try {
    const url = new URL(`${CONFIG.API_BASE_URL}/report`);
    if (date) {
      url.searchParams.set('date', date);
    }
    url.searchParams.set('session_id', sessionId);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('[LenQuant] Report error:', error);
    return null;
  }
}

async function getPerformanceAnalytics(days = 30) {
  try {
    const url = new URL(`${CONFIG.API_BASE_URL}/analytics`);
    url.searchParams.set('days', days.toString());
    url.searchParams.set('session_id', sessionId);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('[LenQuant] Analytics error:', error);
    return null;
  }
}

// Event Logging
function bufferEvent(event) {
  eventBuffer.push({
    ...event,
    timestamp: Date.now(),
  });
  
  // Flush if buffer is full
  if (eventBuffer.length >= CONFIG.EVENT_BUFFER_SIZE) {
    flushEvents();
  }
}

async function flushEvents() {
  if (eventBuffer.length === 0 || !sessionId) return;
  
  const events = [...eventBuffer];
  eventBuffer = [];
  
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/journal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        events,
      }),
    });
    
    if (!response.ok) {
      console.error('[LenQuant] Event flush failed:', response.status);
      // Re-add events to buffer on failure
      eventBuffer = [...events, ...eventBuffer];
    }
    
  } catch (error) {
    console.error('[LenQuant] Event flush error:', error);
    eventBuffer = [...events, ...eventBuffer];
  }
}

// Periodic event flush
setInterval(flushEvents, CONFIG.EVENT_FLUSH_INTERVAL);

// WebSocket Management
function connectWebSocket() {
  if (!sessionId) {
    initSession();
  }
  
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    return;
  }
  
  try {
    wsConnection = new WebSocket(`${CONFIG.WS_URL}/${sessionId}`);
    
    wsConnection.onopen = () => {
      console.log('[LenQuant] WebSocket connected');
    };
    
    wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (e) {
        console.error('[LenQuant] WS message parse error:', e);
      }
    };
    
    wsConnection.onclose = () => {
      console.log('[LenQuant] WebSocket disconnected');
      // Reconnect after delay
      setTimeout(connectWebSocket, 5000);
    };
    
    wsConnection.onerror = (error) => {
      console.error('[LenQuant] WebSocket error:', error);
    };
    
  } catch (error) {
    console.error('[LenQuant] WebSocket connection error:', error);
  }
}

function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'candle':
      // Forward to content script
      broadcastToTabs({ type: 'CANDLE_UPDATE', payload: data });
      break;
      
    case 'signal':
      broadcastToTabs({ type: 'SIGNAL_UPDATE', payload: data });
      break;
      
    case 'subscribed':
    case 'unsubscribed':
      console.log('[LenQuant] Subscription:', data.type, data.symbol);
      break;
      
    default:
      console.log('[LenQuant] Unknown WS message:', data.type);
  }
}

function subscribeSymbol(symbol, timeframes = ['1m', '5m']) {
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    wsConnection.send(JSON.stringify({
      action: 'subscribe',
      symbol,
      timeframes,
    }));
  }
}

// Message Handling from Content Script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => {
      console.error('[LenQuant] Message handler error:', error);
      sendResponse({ error: error.message });
    });
  
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'GET_SESSION':
      if (!sessionId) initSession();
      return { sessionId };
    
    case 'AUTHENTICATE_GOOGLE':
      // Handle Google OAuth in background script (chrome.identity only available here)
      try {
        const redirectUrl = chrome.identity.getRedirectURL();
        
        // Get Google Client ID from manifest or backend
        let clientId;
        const manifest = chrome.runtime.getManifest();
        if (manifest.oauth2 && manifest.oauth2.client_id) {
          clientId = manifest.oauth2.client_id;
        } else {
          // Fetch from backend
          const configResponse = await fetch(`${CONFIG.API_BASE_URL}/auth/config`);
          if (configResponse.ok) {
            const config = await configResponse.json();
            clientId = config.google_client_id;
          }
        }
        
        if (!clientId) {
          return { success: false, message: 'Google OAuth not configured' };
        }
        
        // Build OAuth URL
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUrl);
        authUrl.searchParams.set('response_type', 'token id_token');
        authUrl.searchParams.set('scope', 'email profile openid');
        authUrl.searchParams.set('nonce', Math.random().toString(36).substring(2));
        
        // Launch OAuth flow
        const responseUrl = await new Promise((resolve, reject) => {
          chrome.identity.launchWebAuthFlow(
            { url: authUrl.toString(), interactive: true },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(response);
              }
            }
          );
        });
        
        // Extract ID token from response URL
        const urlParams = new URLSearchParams(new URL(responseUrl).hash.substring(1));
        const idToken = urlParams.get('id_token');
        
        if (!idToken) {
          return { success: false, message: 'No ID token in OAuth response' };
        }
        
        // Send to backend for verification and registration
        const authResponse = await fetch(`${CONFIG.API_BASE_URL}/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            google_token: idToken,
            device_fingerprint: message.deviceFingerprint,
          }),
        });
        
        if (!authResponse.ok) {
          const error = await authResponse.json();
          return { success: false, message: error.detail || 'Google authentication failed' };
        }
        
        const result = await authResponse.json();
        
        if (result.success) {
          console.log('[LenQuant] Google OAuth successful:', result.email);
          return {
            success: true,
            message: result.message,
            license: {
              email: result.email,
              device_id: result.device_id,
              license_token: result.license_token,
              tier: result.tier,
              trial_ends_at: result.trial_ends_at,
              features: result.features,
              auth_method: result.auth_method,
              valid: true,
            },
          };
        }
        
        return { success: false, message: 'Authentication failed' };
        
      } catch (error) {
        console.error('[LenQuant] Google OAuth error:', error);
        return { success: false, message: error.message };
      }
      
    case 'CONTEXT_CHANGED':
      bufferEvent({
        type: 'context_changed',
        symbol: message.symbol,
        timeframe: message.timeframe,
        payload: { ...message.context, domData: message.domData },
      });
      
      // Also subscribe to WebSocket updates
      subscribeSymbol(message.symbol);
      
      // Fetch analysis with DOM data for hybrid mode
      try {
        const analysis = await fetchContextAnalysis(
          message.symbol,
          message.timeframe,
          message.domData || {}
        );
        
        // Store analysis count
        incrementStat('analysesCount');
        
        // Log if using client-side
        if (analysis.source === 'client') {
          console.log(`[LenQuant] Using client-side analysis for ${message.symbol}`);
        }
        
        return { analysis, cooldown: cooldownState };
      } catch (error) {
        console.error('[LenQuant] Analysis failed:', error);
        return { 
          error: error.message,
          analysis: {
            trade_allowed: false,
            market_state: 'error',
            risk_flags: ['connection_error'],
            suggested_leverage_band: [1, 5],
            reason: `Unable to analyze: ${error.message}`,
            source: 'error',
          }
        };
      }
      
    case 'REQUEST_EXPLAIN':
      bufferEvent({
        type: 'explain_requested',
        symbol: message.context.symbol,
        timeframe: message.context.timeframe,
        payload: {},
      });
      
      try {
        const explanation = await fetchExplanation(
          message.context,
          message.fastAnalysis,
          message.tradeLevels
        );
        return { explanation };
      } catch (error) {
        return { error: error.message };
      }
      
    case 'LOG_EVENT':
      bufferEvent(message.event);
      return { success: true };
      
    case 'CHECK_BEHAVIOR':
      const behaviorResult = await analyzeBehavior();
      if (behaviorResult && behaviorResult.alerts) {
        incrementStat('alertsCount', behaviorResult.alerts.length);
      }
      return behaviorResult || { alerts: [], in_cooldown: false };
      
    case 'BOOKMARK':
      bufferEvent({
        type: 'bookmark_added',
        symbol: message.symbol,
        timeframe: message.timeframe,
        payload: { note: message.note },
      });
      incrementStat('bookmarksCount');
      return { success: true };
      
    case 'START_COOLDOWN':
      const cooldownResult = await startCooldown(
        message.minutes || 15,
        message.reason
      );
      return cooldownResult || { error: 'Failed to start cooldown' };
      
    case 'CHECK_COOLDOWN':
      const cooldownStatus = await checkCooldownStatus();
      return cooldownStatus || { active: false };
      
    case 'SYNC_TRADES':
      const syncResult = await syncTrades(message.mode || 'testnet');
      return syncResult || { error: 'Sync failed' };
      
    case 'GET_REPORT':
      const report = await getDailyReport(message.date);
      return report || { error: 'Failed to get report' };
      
    case 'GET_ANALYTICS':
      const analytics = await getPerformanceAnalytics(message.days || 30);
      return analytics || { error: 'Failed to get analytics' };
    
    case 'CAPTURE_SCREENSHOT':
      try {
        // Capture visible tab as screenshot
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 70 });
          return { screenshot };
        }
        return { error: 'No active tab' };
      } catch (error) {
        console.error('[LenQuant] Screenshot capture error:', error);
        return { error: error.message };
      }

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

    default:
      console.warn('[LenQuant] Unknown message type:', message.type);
      return { error: 'Unknown message type' };
  }
}

// Stat tracking
async function incrementStat(key, amount = 1) {
  try {
    const result = await chrome.storage.local.get([key]);
    const current = result[key] || 0;
    await chrome.storage.local.set({ [key]: current + amount });
  } catch (error) {
    // Ignore storage errors
  }
}

// Broadcast to all tabs with content script
async function broadcastToTabs(message) {
  try {
    const tabs = await chrome.tabs.query({
      url: 'https://www.binance.com/en/futures/*'
    });
    
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, message);
      } catch (e) {
        // Tab might not have content script loaded
      }
    }
  } catch (error) {
    console.error('[LenQuant] Broadcast error:', error);
  }
}

// ============================================================================
// Chrome Extension Lifecycle Events
// ============================================================================

// Track extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  // Wait for analytics to initialize before sending events
  await extensionAnalytics.initPromise;

  if (details.reason === 'install') {
    await extensionAnalytics.sendEvent('extension_install', {
      method: 'chrome_web_store',
      extension_version: chrome.runtime.getManifest().version
    });
  } else if (details.reason === 'update') {
    await extensionAnalytics.sendEvent('extension_update', {
      previous_version: details.previousVersion,
      extension_version: chrome.runtime.getManifest().version
    });
  }
});

// Track extension startup
chrome.runtime.onStartup.addListener(async () => {
  // Wait for analytics to initialize before sending events
  await extensionAnalytics.initPromise;

  await extensionAnalytics.sendEvent('extension_startup', {
    extension_version: chrome.runtime.getManifest().version
  });
});

// ============================================================================
// Initialize
// ============================================================================

initSession();
connectWebSocket();

console.log('[LenQuant] Background service worker initialized');

