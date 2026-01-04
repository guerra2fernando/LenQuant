/**
 * Observes exchange DOM for context changes (symbol, timeframe, etc.)
 */

import { logger } from '../shared/logger.js';
import { CONFIG } from '../shared/config.js';

class ContextObserver {
  constructor(options = {}) {
    this.exchange = options.exchange;
    this.onContextChange = options.onContextChange || (() => {});
    this.throttleMs = options.throttleMs || CONFIG.OBSERVER_THROTTLE_MS;

    this.observers = [];
    this.lastContext = null;
    this.lastUpdate = 0;
    this.pendingUpdate = null;
  }

  start() {
    logger.info('observer', 'Starting context observation');

    // Main observer for trading area
    this.observeTradePanel();

    // Observer for navigation/SPA changes
    this.observeNavigation();

    // Initial context capture
    this.captureContext();
  }

  stop() {
    logger.info('observer', 'Stopping context observation');
    this.observers.forEach(obs => obs.disconnect());
    this.observers = [];

    if (this.pendingUpdate) {
      clearTimeout(this.pendingUpdate);
      this.pendingUpdate = null;
    }
  }

  observeTradePanel() {
    // Find trade panel container
    const tradePanelSelectors = [
      '[class*="trade-panel"]',
      '[class*="orderForm"]',
      '[class*="tradingPanel"]',
      'main',
    ];

    let container = null;
    for (const selector of tradePanelSelectors) {
      container = document.querySelector(selector);
      if (container) break;
    }

    if (!container) {
      logger.warn('observer', 'Trade panel not found, observing body');
      container = document.body;
    }

    const observer = new MutationObserver(this.handleMutations.bind(this));

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    this.observers.push(observer);
    logger.log('observer', 'Observing container:', container.className?.slice(0, 50));
  }

  observeNavigation() {
    // Watch for URL changes (SPA navigation)
    let lastUrl = window.location.href;

    const navObserver = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        logger.log('observer', 'URL changed:', lastUrl);

        // Re-capture after short delay
        setTimeout(() => this.captureContext(), 500);
      }
    });

    navObserver.observe(document.body, {
      childList: true,
      subtree: false,
    });

    this.observers.push(navObserver);

    // Also listen for popstate
    window.addEventListener('popstate', () => {
      logger.log('observer', 'Popstate event');
      setTimeout(() => this.captureContext(), 500);
    });
  }

  handleMutations(mutations) {
    // Filter out irrelevant mutations
    const hasRelevantChange = mutations.some(m => {
      const target = m.target;
      const className = target.className || '';

      // Skip high-frequency updates
      if (className.includes('price') && !className.includes('entry')) return false;
      if (className.includes('depth')) return false;
      if (className.includes('orderbook')) return false;
      if (className.includes('chart')) return false;

      return true;
    });

    if (!hasRelevantChange) return;

    // Throttle updates
    this.scheduleCapture();
  }

  scheduleCapture() {
    const now = Date.now();

    if (now - this.lastUpdate >= this.throttleMs) {
      this.captureContext();
    } else if (!this.pendingUpdate) {
      this.pendingUpdate = setTimeout(() => {
        this.pendingUpdate = null;
        this.captureContext();
      }, this.throttleMs - (now - this.lastUpdate));
    }
  }

  captureContext() {
    this.lastUpdate = Date.now();

    const context = this.exchange.extractContext();

    // Check if context actually changed
    const contextKey = this.getContextKey(context);
    const lastKey = this.getContextKey(this.lastContext);

    if (contextKey !== lastKey) {
      logger.log('observer', 'Context changed:', context);
      this.lastContext = context;
      this.onContextChange(context);
    }
  }

  getContextKey(context) {
    if (!context) return '';
    return `${context.symbol}:${context.timeframe}:${context.leverage}`;
  }

  // Force context update
  forceUpdate() {
    this.lastContext = null;
    this.captureContext();
  }

  getCurrentContext() {
    return this.lastContext || this.exchange.extractContext();
  }
}

export { ContextObserver };
