/**
 * Shared configuration for LenQuant extension
 */

export const CONFIG = {
  // API endpoints
  API_BASE_URL: 'https://lenquant.com/api/extension',
  WS_URL: 'wss://lenquant.com/ws/extension',
  BINANCE_FUTURES_API: 'https://fapi.binance.com',

  // Timeouts
  BACKEND_TIMEOUT_MS: 3000,
  ANALYSIS_CACHE_TTL: 3000,

  // Intervals
  BEHAVIOR_CHECK_INTERVAL: 60000,
  AUTO_REFRESH_INTERVAL: 30000,
  EVENT_FLUSH_INTERVAL: 5000,

  // UI
  PANEL_WIDTH: 320,
  DEBOUNCE_MS: 300,
  OBSERVER_THROTTLE_MS: 500,

  // Limits
  EVENT_BUFFER_SIZE: 100,
  MAX_OHLCV_CANDLES: 300,

  // Feature flags
  USE_CLIENT_FALLBACK: true,
  ENABLE_TUTORIAL: true,
  ENABLE_SOUND_ALERTS: false,
};

// Volatility regime thresholds
export const VOLATILITY_THRESHOLDS = {
  HIGH: 3.0,    // ATR% > 3.0 = high volatility
  LOW: 1.0,     // ATR% < 1.0 = low volatility
};

// Leverage recommendations based on volatility
export const LEVERAGE_BANDS = {
  high: { min: 1, max: 5 },
  normal: { min: 5, max: 15 },
  low: { min: 10, max: 25 },
};

// Grade calculation thresholds
export const GRADE_THRESHOLDS = {
  A: 80,
  B: 65,
  C: 50,
  D: 0,
};

// Feature definitions
export const FEATURES = {
  BASIC_ANALYSIS: 'basic_analysis',
  AI_EXPLAIN: 'ai_explain',
  MTF_ANALYSIS: 'mtf_analysis',
  TRADE_SYNC: 'trade_sync',
  CLOUD_JOURNAL: 'cloud_journal',
  BEHAVIOR_ALERTS: 'behavior_alerts',
};

// Tier definitions
export const TIERS = {
  FREE: 'free',
  TRIAL: 'trial',
  PRO: 'pro',
  PREMIUM: 'premium',
  EXPIRED: 'expired',
};

// Feature to tier mapping
export const TIER_FEATURES = {
  [TIERS.FREE]: [FEATURES.BASIC_ANALYSIS],
  [TIERS.TRIAL]: [
    FEATURES.BASIC_ANALYSIS,
    FEATURES.AI_EXPLAIN,
    FEATURES.MTF_ANALYSIS,
    FEATURES.BEHAVIOR_ALERTS,
    FEATURES.CLOUD_JOURNAL,
  ],
  [TIERS.PRO]: [
    FEATURES.BASIC_ANALYSIS,
    FEATURES.AI_EXPLAIN,
    FEATURES.MTF_ANALYSIS,
    FEATURES.BEHAVIOR_ALERTS,
    FEATURES.CLOUD_JOURNAL,
  ],
  [TIERS.PREMIUM]: [
    FEATURES.BASIC_ANALYSIS,
    FEATURES.AI_EXPLAIN,
    FEATURES.MTF_ANALYSIS,
    FEATURES.BEHAVIOR_ALERTS,
    FEATURES.CLOUD_JOURNAL,
    FEATURES.TRADE_SYNC,
  ],
};

// Load config overrides from storage
export async function loadConfig() {
  try {
    const result = await chrome.storage.sync.get('settings');
    const settings = result.settings || {};

    if (settings.apiUrl) {
      CONFIG.API_BASE_URL = settings.apiUrl.replace(/\/$/, '') + '/api/extension';
    }
    if (settings.wsUrl) {
      CONFIG.WS_URL = settings.wsUrl.replace(/^https?/, 'wss') + '/ws/extension';
    }

    return CONFIG;
  } catch (e) {
    console.error('[LenQuant] Failed to load config:', e);
    return CONFIG;
  }
}
