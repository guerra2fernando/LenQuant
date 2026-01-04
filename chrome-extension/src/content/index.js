/**
 * Content script entry point - modularized
 */

import { logger } from '../shared/logger.js';
import { loadConfig } from '../shared/config.js';
import { ContextObserver } from './context-observer.js';
import { TradingPanel } from './panel/index.js';
import { detectExchange } from '../exchanges/registry.js';
import { applyExchangeTheme } from '../shared/themes.js';

// Global state
let currentContext = {
  symbol: null,
  timeframe: null,
  leverage: null,
  position: null,
};
let currentAnalysis = null;
let contextObserver = null;
let tradingPanel = null;

// Auto-explain tracking
let lastAutoExplainKey = null;
let lastAutoExplainTime = 0;

// Initialize logger
logger.init();

// Initialize configuration
loadConfig().then(() => {
  logger.info('content', 'Configuration loaded');
});

/**
 * Handle context changes from observer
 */
function handleContextChange(context) {
  currentContext = { ...currentContext, ...context };
  logger.log('content', 'Context updated:', currentContext);

  // Trigger analysis if context has symbol
  if (currentContext.symbol) {
    triggerAnalysis();
  }
}

/**
 * Trigger analysis with current context
 */
async function triggerAnalysis() {
  if (!currentContext.symbol) {
    logger.warn('content', 'No symbol available for analysis');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CONTEXT_CHANGED',
      symbol: currentContext.symbol,
      timeframe: currentContext.timeframe || '1h',
      context: currentContext,
    });

    if (response.analysis) {
      currentAnalysis = response.analysis;
      tradingPanel?.updateAnalysis(response.analysis);
      logger.info('content', 'Analysis updated');
    }

    if (response.cooldown?.active) {
      // Handle cooldown display
      logger.log('content', 'Analysis cooldown active');
    }
    if (response.cooldown?.active) {
      // Handle cooldown display
      logger.log('content', 'Analysis cooldown active');
    }
  } catch (error) {
    logger.error('content', 'Analysis error:', error);
    tradingPanel?.showError('Analysis failed');
  }
}

/**
 * Initialize the content script
 */
async function init() {
  logger.info('content', 'Initializing modular content script');

  try {
    // Detect exchange
    const exchange = detectExchange();

    if (!exchange) {
      logger.log('content', 'Unsupported exchange');
      return;
    }

    logger.log('content', `Detected: ${exchange.displayName}`);

    // Apply exchange theme
    applyExchangeTheme(exchange.name);

    // Initialize context observer with exchange-specific extractors
    contextObserver = new ContextObserver({
      exchange,
      onContextChange: handleContextChange,
    });
    contextObserver.start();

    // Initialize trading panel with exchange
    tradingPanel = new TradingPanel({
      exchange,
      onExplainClick: () => handleExplainClick(),
      onBookmarkClick: () => handleBookmarkClick(),
      onSyncClick: () => handleSyncClick(),
      onBreakClick: () => handleBreakClick(),
    });
    await tradingPanel.inject();

    // Check auto-show setting
    const result = await chrome.storage.sync.get('settings');
    const settings = result.settings || {};
    const shouldAutoShow = settings.autoShow !== false;

    if (!shouldAutoShow) {
      tradingPanel.hide();
    }

    // Initial analysis trigger
    setTimeout(() => {
      if (currentContext.symbol) {
        triggerAnalysis();
      }
    }, 1000);

    logger.info('content', 'Initialization complete');
  } catch (error) {
    logger.error('content', 'Initialization error:', error);
  }

  // Handle auto-explain
  maybeAutoExplain();
}

/**
 * Check and trigger auto-explain for high grade setups
 */
async function maybeAutoExplain() {
  if (!currentAnalysis) return;

  // Check setting
  const result = await chrome.storage.sync.get('settings');
  const settings = result.settings || {};

  if (!settings.autoExplain) {
    return;
  }

  // Only for high grades
  const grade = currentAnalysis.grade?.toUpperCase();
  if (!['A', 'B'].includes(grade)) {
    return;
  }

  // Check if user has access
  const licenseResult = await chrome.storage.local.get('license');
  const license = licenseResult.license;

  if (!['trial', 'pro', 'premium'].includes(license?.tier)) {
    return;
  }

  // Avoid duplicate explanations
  const contextKey = `${currentContext.symbol}:${currentContext.timeframe}`;
  if (lastAutoExplainKey === contextKey) {
    return;
  }
  lastAutoExplainKey = contextKey;

  // Rate limit - one auto-explain per 5 minutes
  const now = Date.now();
  if (now - lastAutoExplainTime < 300000) {
    return;
  }
  lastAutoExplainTime = now;

  logger.log('content', 'Auto-explaining grade', grade, 'setup');

  // Request explanation
  handleExplainClick();
}

/**
 * Panel action handlers
 */
function handleExplainClick() {
  if (!currentAnalysis) return;

  chrome.runtime.sendMessage({
    type: 'EXPLAIN_ANALYSIS',
    analysis: currentAnalysis,
    context: currentContext,
  });
}

function handleBookmarkClick() {
  if (!currentAnalysis || !currentContext.symbol) return;

  chrome.runtime.sendMessage({
    type: 'BOOKMARK_SETUP',
    analysis: currentAnalysis,
    context: currentContext,
  });
}

function handleSyncClick() {
  if (!currentAnalysis || !currentContext.symbol) return;

  chrome.runtime.sendMessage({
    type: 'SYNC_TRADE',
    analysis: currentAnalysis,
    context: currentContext,
  });
}

function handleBreakClick() {
  chrome.runtime.sendMessage({
    type: 'TAKE_BREAK',
    context: currentContext,
  });
}

/**
 * Message handler for external communication
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'TRIGGER_ANALYSIS':
      triggerAnalysis().then(() => sendResponse({ success: true }));
      return true; // Keep channel open for async response

    case 'SHOW_PANEL':
      tradingPanel?.show();
      sendResponse({ success: true });
      break;

    case 'HIDE_PANEL':
      tradingPanel?.hide();
      sendResponse({ success: true });
      break;

    case 'GET_CONTEXT':
      sendResponse({
        success: true,
        context: currentContext,
        analysis: currentAnalysis
      });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
