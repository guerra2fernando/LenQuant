import { BinanceExchange } from './binance.js';
// import { BybitExchange } from './bybit.js';
// import { OKXExchange } from './okx.js';

const exchanges = {
  binance: new BinanceExchange(),
  // bybit: new BybitExchange(),
  // okx: new OKXExchange(),
};

/**
 * Detect current exchange from URL
 */
export function detectExchange() {
  const url = window.location.href;

  for (const [name, exchange] of Object.entries(exchanges)) {
    for (const pattern of exchange.urlPatterns) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      if (regex.test(url)) {
        return exchange;
      }
    }
  }

  return null;
}

/**
 * Get exchange by name
 */
export function getExchange(name) {
  return exchanges[name] || null;
}

/**
 * Get all supported exchanges
 */
export function getSupportedExchanges() {
  return Object.keys(exchanges);
}
