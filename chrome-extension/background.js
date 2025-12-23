/**
 * LenQuant Binance Assistant - Background Service Worker
 * 
 * Handles:
 * - API communication with LenQuant backend
 * - WebSocket connection management
 * - Event logging buffer
 * - Chrome extension messaging
 */

// Default Configuration (production URLs)
const DEFAULT_CONFIG = {
  API_BASE_URL: 'https://lenquant.com/api/extension',
  WS_URL: 'wss://lenquant.com/ws/extension',
  EVENT_BUFFER_SIZE: 100,
  EVENT_FLUSH_INTERVAL: 5000, // 5 seconds
  ANALYSIS_CACHE_TTL: 3000,   // 3 seconds
  BEHAVIOR_CHECK_INTERVAL: 60000, // 1 minute
};

// Active configuration (updated from storage)
let CONFIG = { ...DEFAULT_CONFIG };

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

// API Calls
async function fetchContextAnalysis(symbol, timeframe) {
  const cacheKey = `${symbol}:${timeframe}`;
  const cached = analysisCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < CONFIG.ANALYSIS_CACHE_TTL) {
    return { ...cached.data, cached: true };
  }
  
  try {
    const url = new URL(`${CONFIG.API_BASE_URL}/context`);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('timeframe', timeframe);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Cache result
    analysisCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });
    
    return data;
    
  } catch (error) {
    console.error('[LenQuant] Context analysis error:', error);
    throw error;
  }
}

async function fetchExplanation(context, fastAnalysis) {
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context,
        fast_analysis: fastAnalysis,
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
      
    case 'CONTEXT_CHANGED':
      bufferEvent({
        type: 'context_changed',
        symbol: message.symbol,
        timeframe: message.timeframe,
        payload: message.context,
      });
      
      // Also subscribe to WebSocket updates
      subscribeSymbol(message.symbol);
      
      // Fetch analysis
      try {
        const analysis = await fetchContextAnalysis(
          message.symbol,
          message.timeframe
        );
        
        // Store analysis count
        incrementStat('analysesCount');
        
        return { analysis, cooldown: cooldownState };
      } catch (error) {
        return { error: error.message };
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
          message.fastAnalysis
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

// Initialize
initSession();
connectWebSocket();

console.log('[LenQuant] Background service worker initialized');

