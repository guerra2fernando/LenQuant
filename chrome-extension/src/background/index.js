/**
 * Background script entry point - modularized
 */

import { logger } from '../shared/logger.js';
import { CONFIG, loadConfig } from '../shared/config.js';
import { getGoogleClientId } from '../shared/oauth.js';
import { fetchJSON } from '../shared/api-helpers.js';

// Initialize logger and config
logger.init();
loadConfig().then(() => {
  logger.info('background', 'Configuration loaded');
});

// Track active tabs with exchange info
const activeTabs = new Map(); // tabId -> { exchange, symbol, lastUpdate }

/**
 * Handle Google OAuth authentication
 */
async function handleGoogleAuth() {
  try {
    const clientId = await getGoogleClientId();
    if (!clientId) {
      throw new Error('Google OAuth not configured');
    }

    // Generate redirect URL for this extension
    const redirectUrl = chrome.identity.getRedirectURL();

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
    const authResult = await fetchJSON(`${CONFIG.API_BASE_URL}/auth/google`, {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken }),
    });

    if (authResult.success) {
      // Store auth token
      await chrome.storage.local.set({
        authToken: authResult.data.token,
        userInfo: authResult.data.user,
      });

      logger.info('auth', 'Google authentication successful');
      return { success: true, user: authResult.data.user };
    } else {
      logger.error('auth', 'Backend authentication failed:', authResult.error);
      return { success: false, message: authResult.error };
    }

  } catch (error) {
    logger.error('auth', 'Google authentication error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Handle context change from content script
 */
async function handleContextChanged(request, sender) {
  try {
    logger.log('background', 'Context changed:', request.symbol, request.timeframe);

    // Track tab info
    if (sender.tab) {
      activeTabs.set(sender.tab.id, {
        exchange: request.context?.exchange || 'unknown',
        symbol: request.symbol,
        lastUpdate: Date.now(),
      });
    }

    // Get auth token
    const result = await chrome.storage.local.get('authToken');
    const authToken = result.authToken;

    if (!authToken) {
      return {
        analysis: {
          signal: 'wait',
          confidence: 0,
          reason: 'Please sign in to access analysis',
          source: 'client'
        }
      };
    }

    // Check for cooldown
    const cooldownResult = await chrome.storage.local.get('lastAnalysisTime');
    const lastAnalysisTime = cooldownResult.lastAnalysisTime || 0;
    const timeSinceLastAnalysis = Date.now() - lastAnalysisTime;
    const cooldownPeriod = 30000; // 30 seconds

    if (timeSinceLastAnalysis < cooldownPeriod) {
      const remainingTime = Math.ceil((cooldownPeriod - timeSinceLastAnalysis) / 1000);
      return {
        cooldown: {
          active: true,
          remainingSeconds: remainingTime,
          message: `Please wait ${remainingTime} seconds before requesting another analysis`
        }
      };
    }

    // Fetch analysis from backend
    const analysisResult = await fetchJSON(`${CONFIG.API_BASE_URL}/analysis`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        symbol: request.symbol,
        timeframe: request.timeframe,
        context: request.context,
        domData: request.domData,
      }),
    });

    if (analysisResult.success) {
      // Update last analysis time
      await chrome.storage.local.set({ lastAnalysisTime: Date.now() });

      logger.info('background', 'Analysis successful for:', request.symbol);
      return { analysis: analysisResult.data };
    } else {
      logger.warn('background', 'Analysis failed:', analysisResult.error);

      // Return client-side fallback if available
      if (CONFIG.USE_CLIENT_FALLBACK) {
        const fallbackAnalysis = generateFallbackAnalysis(request);
        return { analysis: { ...fallbackAnalysis, source: 'client' } };
      }

      return {
        analysis: {
          signal: 'wait',
          confidence: 0,
          reason: 'Analysis temporarily unavailable',
          source: 'client'
        }
      };
    }

  } catch (error) {
    logger.error('background', 'Context change error:', error);
    return {
      analysis: {
        signal: 'wait',
        confidence: 0,
        reason: 'Analysis error occurred',
        source: 'client'
      }
    };
  }
}

/**
 * Generate fallback analysis when backend is unavailable
 */
function generateFallbackAnalysis(request) {
  // Simple client-side analysis based on basic rules
  const { symbol, timeframe } = request;

  // Mock analysis - in real implementation this would use technical indicators
  const signals = ['buy', 'wait', 'caution'];
  const randomSignal = signals[Math.floor(Math.random() * signals.length)];
  const randomConfidence = Math.floor(Math.random() * 40) + 30; // 30-70%

  return {
    signal: randomSignal,
    confidence: randomConfidence,
    reason: `Client-side analysis for ${symbol} (${timeframe})`,
    leverage_recommendation: { min: 5, max: 15 },
    risk_flags: [],
  };
}

/**
 * Handle screenshot capture
 */
async function handleScreenshotCapture() {
  try {
    const screenshot = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    return { screenshot };
  } catch (error) {
    logger.error('background', 'Screenshot capture error:', error);
    return { error: error.message };
  }
}

/**
 * Handle behavior alerts
 */
async function handleBehaviorCheck() {
  try {
    // Get stored behavior data
    const result = await chrome.storage.local.get(['behaviorData', 'lastBehaviorCheck']);
    const behaviorData = result.behaviorData || [];
    const lastCheck = result.lastBehaviorCheck || 0;

    // Check if it's time for behavior analysis (every hour)
    const hourMs = 60 * 60 * 1000;
    if (Date.now() - lastCheck < hourMs) {
      return { alerts: [] };
    }

    // Analyze behavior patterns
    const alerts = analyzeBehaviorPatterns(behaviorData);

    // Update last check time
    await chrome.storage.local.set({ lastBehaviorCheck: Date.now() });

    return { alerts };
  } catch (error) {
    logger.error('background', 'Behavior check error:', error);
    return { alerts: [] };
  }
}

/**
 * Analyze behavior patterns for alerts
 */
function analyzeBehaviorPatterns(behaviorData) {
  const alerts = [];

  // Example: Check for overtrading
  const recentTrades = behaviorData.filter(item =>
    item.type === 'trade' &&
    Date.now() - item.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
  );

  if (recentTrades.length > 10) {
    alerts.push({
      type: 'overtrading',
      level: 'warning',
      message: 'High trading frequency detected. Consider taking a break.',
      icon: '⚠️'
    });
  }

  // Example: Check for large losses
  const recentLosses = behaviorData.filter(item =>
    item.type === 'loss' &&
    item.amount > 100 &&
    Date.now() - item.timestamp < 7 * 24 * 60 * 60 * 1000 // Last week
  );

  if (recentLosses.length > 3) {
    alerts.push({
      type: 'losses',
      level: 'caution',
      message: 'Multiple large losses detected. Review risk management.',
      icon: '📉'
    });
  }

  return alerts;
}

/**
 * Handle MTF analysis request
 */
async function handleGetMTFAnalysis(request) {
  try {
    const { symbol, timeframes } = request;

    // Get auth token
    const result = await chrome.storage.local.get('authToken');
    const authToken = result.authToken;

    if (!authToken) {
      return { error: 'Not authenticated' };
    }

    // Fetch MTF analysis from backend
    const analysisResult = await fetchJSON(`${CONFIG.API_BASE_URL}/analysis/mtf`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        symbol,
        timeframes,
      }),
    });

    if (analysisResult.success) {
      return analysisResult.data;
    } else {
      logger.warn('background', 'MTF analysis failed:', analysisResult.error);
      return { error: analysisResult.error };
    }
  } catch (error) {
    logger.error('background', 'MTF analysis error:', error);
    return { error: 'MTF analysis failed' };
  }
}

/**
 * Clean up closed tabs
 */
function cleanupClosedTabs() {
  chrome.tabs.onRemoved.addListener((tabId) => {
    activeTabs.delete(tabId);
  });
}

/**
 * Broadcast message to specific exchange tabs
 */
async function broadcastToExchange(exchange, message) {
  for (const [tabId, info] of activeTabs) {
    if (info.exchange === exchange) {
      try {
        await chrome.tabs.sendMessage(tabId, message);
      } catch (e) {
        // Tab might be closed
        activeTabs.delete(tabId);
      }
    }
  }
}

/**
 * Find active tab for specific exchange
 */
async function getActiveExchangeTab(exchange) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (activeTab && activeTabs.has(activeTab.id)) {
    const info = activeTabs.get(activeTab.id);
    if (!exchange || info.exchange === exchange) {
      return activeTab;
    }
  }

  // Find any tab with matching exchange
  for (const [tabId, info] of activeTabs) {
    if (!exchange || info.exchange === exchange) {
      return { id: tabId };
    }
  }

  return null;
}

/**
 * Get session ID
 */
function handleGetSession() {
  // Generate or retrieve session ID
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return { sessionId };
}

/**
 * Main message handler
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logger.log('background', 'Message received:', request.type);

  switch (request.type) {
    case 'GOOGLE_AUTH':
      handleGoogleAuth().then(sendResponse);
      return true; // Keep channel open for async

    case 'CONTEXT_CHANGED':
      handleContextChanged(request).then(sendResponse);
      return true;

    case 'CAPTURE_SCREENSHOT':
      handleScreenshotCapture().then(sendResponse);
      return true;

    case 'CHECK_BEHAVIOR':
      handleBehaviorCheck().then(sendResponse);
      return true;

    case 'GET_MTF_ANALYSIS':
      handleGetMTFAnalysis(request).then(sendResponse);
      return true;

    case 'GET_SESSION':
      sendResponse(handleGetSession());
      break;

    default:
      logger.warn('background', 'Unknown message type:', request.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

/**
 * Handle extension installation/update
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    logger.info('background', 'Extension installed');
    // Set default settings
    chrome.storage.sync.set({
      settings: {
        autoShow: true,
        debugMode: false,
      }
    });
  } else if (details.reason === 'update') {
    logger.info('background', 'Extension updated');
  }
});

/**
 * Handle storage changes for settings
 */
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.settings) {
    logger.log('background', 'Settings changed, reloading config');
    loadConfig();
  }
});

// Initialize tab cleanup
cleanupClosedTabs();

logger.info('background', 'Background script initialized');
