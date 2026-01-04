/**
 * DOM extraction utilities for Binance Futures
 * Handles extraction of leverage, positions, symbol, timeframe, etc.
 */

import { logger } from '../shared/logger.js';

// Selector configurations per exchange (future-proofing)
const BINANCE_SELECTORS = {
  symbol: [
    '[class*="symbol-title"]',
    '[class*="symbolTitle"]',
    '[class*="contractName"]',
    'h1[class*="symbol"]',
  ],
  timeframe: [
    '[class*="timeframe"] button.active',
    '[class*="interval"] .active',
    'button[class*="selected"][class*="interval"]',
  ],
  leverage: [
    'button[class*="leverage"]',
    'div[class*="leverage"] button',
    '[class*="contractLeverage"]',
  ],
  marginType: [
    '[class*="margin-type"]',
    '[class*="marginType"]',
  ],
  position: [
    '[class*="position-row"]',
    '[class*="positionItem"]',
  ],
};

class DOMExtractor {
  constructor(exchange = 'binance') {
    this.exchange = exchange;
    this.selectors = BINANCE_SELECTORS;
    this.cache = new Map();
    this.cacheTTL = 2000; // 2 seconds
  }

  /**
   * Get cached or fresh element
   */
  getElement(key, fallbackSelectors = []) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.time < this.cacheTTL) {
      if (document.body.contains(cached.element)) {
        return cached.element;
      }
    }

    const selectors = this.selectors[key] || fallbackSelectors;
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          this.cache.set(key, { element, time: Date.now() });
          return element;
        }
      } catch (e) {
        // Invalid selector, continue
      }
    }

    return null;
  }

  /**
   * Extract current symbol (e.g., BTCUSDT)
   */
  extractSymbol() {
    // Try direct selector
    const symbolEl = this.getElement('symbol');
    if (symbolEl) {
      const text = symbolEl.textContent?.trim();
      const match = text?.match(/([A-Z0-9]+USDT?)/);
      if (match) {
        logger.log('dom', 'Found symbol via selector:', match[1]);
        return match[1];
      }
    }

    // Try URL
    const urlMatch = window.location.pathname.match(/futures\/([A-Z0-9]+)/i);
    if (urlMatch) {
      logger.log('dom', 'Found symbol via URL:', urlMatch[1].toUpperCase());
      return urlMatch[1].toUpperCase();
    }

    // Try document title
    const titleMatch = document.title.match(/([A-Z0-9]+USDT?)/);
    if (titleMatch) {
      return titleMatch[1];
    }

    return null;
  }

  /**
   * Extract current timeframe (e.g., 1h, 4h, 1d)
   */
  extractTimeframe() {
    const tfEl = this.getElement('timeframe');
    if (tfEl) {
      const text = tfEl.textContent?.trim().toLowerCase();
      if (/^\d+[mhdw]$/.test(text)) {
        logger.log('dom', 'Found timeframe:', text);
        return text;
      }
    }

    // Fallback: Look for active interval button
    const intervalBtns = document.querySelectorAll('[class*="interval"] button');
    for (const btn of intervalBtns) {
      if (btn.classList.contains('active') || btn.getAttribute('aria-selected') === 'true') {
        const text = btn.textContent?.trim().toLowerCase();
        if (/^\d+[mhdw]$/.test(text)) {
          return text;
        }
      }
    }

    return '1h'; // Default
  }

  /**
   * Extract current leverage setting
   */
  extractLeverage() {
    // Priority 1: Dedicated leverage element
    const leverageEl = this.getElement('leverage');
    if (leverageEl) {
      const text = leverageEl.textContent?.trim();
      const match = text?.match(/(\d+)[xX]/);
      if (match) {
        const lev = parseInt(match[1], 10);
        if (lev >= 1 && lev <= 125) {
          logger.log('dom', 'Found leverage via selector:', lev);
          return lev;
        }
      }
    }

    // Priority 2: Button with XXx pattern
    const buttons = document.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      const text = btn.textContent?.trim();
      if (text && /^\d{1,3}[xX]$/.test(text)) {
        const lev = parseInt(text.match(/^(\d{1,3})/)[1], 10);
        if (lev >= 1 && lev <= 125) {
          logger.log('dom', 'Found leverage via button:', lev);
          return lev;
        }
      }
    }

    // Priority 3: Text content search (expensive, use sparingly)
    return this.extractLeverageFromText();
  }

  extractLeverageFromText() {
    // Limit scope to order form area
    const orderForm = document.querySelector('[class*="orderForm"], [class*="trade-form"]');
    if (!orderForm) return null;

    const walker = document.createTreeWalker(
      orderForm,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      if (text && /^\d{1,3}[xX]$/.test(text)) {
        const lev = parseInt(text.match(/^(\d{1,3})/)[1], 10);
        if (lev >= 1 && lev <= 125) {
          logger.log('dom', 'Found leverage via text walk:', lev);
          return lev;
        }
      }
    }

    return null;
  }

  /**
   * Extract margin type (Cross/Isolated)
   */
  extractMarginType() {
    const marginEl = this.getElement('marginType');
    if (marginEl) {
      const text = marginEl.textContent?.toLowerCase();
      if (text?.includes('cross')) return 'cross';
      if (text?.includes('isolated')) return 'isolated';
    }
    return 'cross'; // Default
  }

  /**
   * Extract open positions
   */
  extractPositions() {
    const positions = [];
    const positionEls = document.querySelectorAll('[class*="position-row"], [class*="positionItem"]');

    positionEls.forEach(el => {
      const symbolMatch = el.textContent?.match(/([A-Z0-9]+USDT?)/);
      const sizeMatch = el.textContent?.match(/([\d.]+)\s*(?:USDT|USD)/);
      const pnlMatch = el.textContent?.match(/([+-]?[\d.]+%?)\s*PNL/i);

      if (symbolMatch) {
        positions.push({
          symbol: symbolMatch[1],
          size: sizeMatch ? parseFloat(sizeMatch[1]) : null,
          pnl: pnlMatch ? pnlMatch[1] : null,
        });
      }
    });

    return positions;
  }

  /**
   * Get all context data in one call
   */
  extractContext() {
    return {
      symbol: this.extractSymbol(),
      timeframe: this.extractTimeframe(),
      leverage: this.extractLeverage(),
      marginType: this.extractMarginType(),
      positions: this.extractPositions(),
      exchange: this.exchange,
      market: 'futures',
      contract: 'PERP',
      timestamp: Date.now(),
    };
  }

  /**
   * Invalidate cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export const domExtractor = new DOMExtractor('binance');
export { DOMExtractor };
