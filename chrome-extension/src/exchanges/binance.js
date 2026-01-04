import { ExchangeInterface } from './interface.js';

export class BinanceExchange extends ExchangeInterface {
  constructor() {
    super();
    this.name = 'binance';
    this.displayName = 'Binance Futures';
    this.urlPatterns = [
      'https://www.binance.com/*/futures/*',
    ];
    this.apiBase = 'https://fapi.binance.com';

    this.selectors = {
      symbol: ['[class*="symbol-title"]', '[class*="symbolTitle"]'],
      timeframe: ['[class*="timeframe"] button.active', '[class*="interval"] .active'],
      leverage: ['button[class*="leverage"]', 'div[class*="leverage"] button'],
      marginType: ['[class*="margin-type"]', '[class*="marginType"]'],
      position: ['[class*="position-row"]', '[class*="positionItem"]'],
    };
  }

  extractSymbol() {
    for (const selector of this.selectors.symbol) {
      const el = document.querySelector(selector);
      if (el) {
        const match = el.textContent?.match(/([A-Z0-9]+USDT?)/);
        if (match) return match[1];
      }
    }
    // URL fallback
    const urlMatch = window.location.pathname.match(/futures\/([A-Z0-9]+)/i);
    return urlMatch ? urlMatch[1].toUpperCase() : null;
  }

  extractTimeframe() {
    for (const selector of this.selectors.timeframe) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim().toLowerCase();
        if (/^\d+[mhdw]$/.test(text)) return text;
      }
    }
    return '1h';
  }

  extractLeverage() {
    // Priority selectors
    for (const selector of this.selectors.leverage) {
      const el = document.querySelector(selector);
      if (el) {
        const match = el.textContent?.match(/(\d+)[xX]/);
        if (match) {
          const lev = parseInt(match[1], 10);
          if (lev >= 1 && lev <= 125) return lev;
        }
      }
    }

    // Button scan
    const buttons = document.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      if (/^\d{1,3}[xX]$/.test(btn.textContent?.trim())) {
        return parseInt(btn.textContent.match(/\d+/)[0], 10);
      }
    }

    return null;
  }

  extractMarginType() {
    for (const selector of this.selectors.marginType) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.toLowerCase();
        if (text?.includes('cross')) return 'cross';
        if (text?.includes('isolated')) return 'isolated';
      }
    }
    return 'cross';
  }

  extractPositions() {
    const positions = [];
    for (const selector of this.selectors.position) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const symbolMatch = el.textContent?.match(/([A-Z0-9]+USDT?)/);
        if (symbolMatch) {
          positions.push({ symbol: symbolMatch[1] });
        }
      });
    }
    return positions;
  }

  getOHLCVEndpoint(symbol, timeframe, limit = 300) {
    const interval = this.normalizeTimeframe(timeframe);
    return `${this.apiBase}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  }

  parseOHLCVResponse(response) {
    return response.map(candle => ({
      timestamp: candle[0],
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
    }));
  }

  normalizeTimeframe(tf) {
    // Binance uses lowercase: 1m, 5m, 15m, 1h, 4h, 1d
    return tf.toLowerCase();
  }
}
