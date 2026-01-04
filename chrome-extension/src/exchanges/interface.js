/**
 * Exchange interface - all exchange implementations must follow this contract
 */
export class ExchangeInterface {
  constructor() {
    if (new.target === ExchangeInterface) {
      throw new Error('ExchangeInterface is abstract');
    }

    this.name = 'unknown';
    this.displayName = 'Unknown Exchange';
    this.urlPatterns = [];
  }

  // DOM Extraction
  extractSymbol() { throw new Error('Not implemented'); }
  extractTimeframe() { throw new Error('Not implemented'); }
  extractLeverage() { throw new Error('Not implemented'); }
  extractMarginType() { throw new Error('Not implemented'); }
  extractPositions() { throw new Error('Not implemented'); }

  // Context
  extractContext() {
    return {
      symbol: this.extractSymbol(),
      timeframe: this.extractTimeframe(),
      leverage: this.extractLeverage(),
      marginType: this.extractMarginType(),
      positions: this.extractPositions(),
      exchange: this.name,
      market: 'futures',
      timestamp: Date.now(),
    };
  }

  // API
  getOHLCVEndpoint(symbol, timeframe, limit) { throw new Error('Not implemented'); }
  parseOHLCVResponse(response) { throw new Error('Not implemented'); }

  // Utility
  normalizeSymbol(symbol) { return symbol; }
  normalizeTimeframe(timeframe) { return timeframe; }
}
