# Macro Analysis Package

## Overview
The macro analysis package provides market regime detection, sentiment analysis, and cross-asset correlation capabilities to enhance trading strategies with market context awareness.

## Current Status: Phase 1 Complete ✅

### Phase 1: Market Regime Detection Foundation
**Completed:** November 2025

#### Components Built
1. **Core Regime Detection (`regime.py`)**
   - `RegimeDetector` class with configurable thresholds
   - Technical indicators: ATR, ADX, Bollinger Band width, MA slopes
   - Trend regime classification: TRENDING_UP, TRENDING_DOWN, SIDEWAYS, UNDEFINED
   - Volatility regime classification: HIGH_VOLATILITY, LOW_VOLATILITY, NORMAL_VOLATILITY, UNDEFINED
   - Confidence scoring (0.0-1.0) based on indicator clarity
   - Z-score normalization for volatility using historical context
   - MongoDB integration for regime storage and retrieval

2. **API Endpoints (`api/routes/macro.py`)**
   - `GET /api/macro/regime?symbol={symbol}` - Get current/historical regime with smart caching
   - `GET /api/macro/regimes/batch` - Batch queries for multiple symbols
   - `GET /api/macro/regimes/history/{symbol}` - Historical regime transitions

3. **Data Management**
   - MongoDB collection: `macro_regimes` with 4 indexes
   - Backfill script: `scripts/backfill_regimes.py` for historical data population
   - Support for single symbol or all-symbols processing

4. **Testing**
   - Comprehensive unit tests: `tests/test_macro_regime.py`
   - 15+ test cases covering all major components
   - Edge case handling (NaN values, insufficient data)
   - Synthetic data validation

## Quick Start

### API Usage

```bash
# Get current regime for a symbol
curl "http://localhost:8000/api/macro/regime?symbol=BTC/USD&interval=1h"

# Response:
{
  "symbol": "BTC/USD",
  "timestamp": "2024-11-12T10:00:00",
  "trend_regime": "TRENDING_UP",
  "volatility_regime": "NORMAL_VOLATILITY",
  "confidence": 0.75,
  "features": {
    "atr": 250.5,
    "atr_pct": 2.3,
    "adx": 35.2,
    "bb_width": 3.8,
    "ma_slope_short": 0.0025,
    "ma_slope_long": 0.0018,
    "volatility_std": 0.028
  }
}

# Batch query multiple symbols
curl "http://localhost:8000/api/macro/regimes/batch?symbols=BTC/USD,ETH/USDT&interval=1h"

# Get historical regimes
curl "http://localhost:8000/api/macro/regimes/history/BTC/USD?limit=100"
```

### Backfill Historical Data

```bash
# Backfill specific symbols
python scripts/backfill_regimes.py --symbols BTC/USD,ETH/USDT --interval 1h --limit 1000

# Backfill all symbols in database
python scripts/backfill_regimes.py --all-symbols --interval 1h

# Force overwrite existing regimes
python scripts/backfill_regimes.py --symbols BTC/USD --interval 1h --force
```

### Python Usage

```python
from macro.regime import RegimeDetector, TrendRegime, VolatilityRegime

# Initialize detector
detector = RegimeDetector(
    adx_threshold=25.0,
    hysteresis_bars=3,
    lookback_period=100
)

# Classify current market state
regime = detector.classify_market_state(
    symbol="BTC/USD",
    interval="1h"
)

print(f"Trend: {regime.trend_regime.value}")
print(f"Volatility: {regime.volatility_regime.value}")
print(f"Confidence: {regime.confidence:.2f}")

# Store regime in database
detector.store_regime(regime)

# Retrieve latest regime from cache
cached_regime = detector.get_latest_regime("BTC/USD")
```

## Regime Classification Logic

### Trend Regimes

1. **TRENDING_UP**
   - ADX > 25 (strong trend)
   - Both short and long MA slopes positive
   - Confidence increases with ADX strength

2. **TRENDING_DOWN**
   - ADX > 25 (strong trend)
   - Both short and long MA slopes negative
   - Confidence increases with ADX strength

3. **SIDEWAYS**
   - ADX < 25 (weak trend)
   - MA slopes near zero or conflicting
   - Confidence increases as ADX decreases

4. **UNDEFINED**
   - Insufficient data or conflicting signals
   - NaN values in critical indicators
   - Low confidence (<0.3)

### Volatility Regimes

1. **HIGH_VOLATILITY**
   - Z-score > 2.0 (current volatility >> historical average)
   - OR ATR% > 3.0 (fallback without historical data)
   - Indicates elevated risk environment

2. **LOW_VOLATILITY**
   - |Z-score| < 0.5 (current volatility ≈ historical average)
   - OR ATR% < 1.0 (fallback without historical data)
   - Indicates calm, low-risk environment

3. **NORMAL_VOLATILITY**
   - Z-score between -0.5 and 2.0
   - Typical market conditions

4. **UNDEFINED**
   - Insufficient data or invalid values

## Technical Indicators

- **ATR (Average True Range):** Measures price volatility using 14-period rolling average
- **ADX (Average Directional Index):** Quantifies trend strength (0-100 scale)
- **Bollinger Band Width:** Range between upper/lower bands as % of middle band
- **MA Slopes:** Rate of change for 20-period and 50-period moving averages
- **Volatility Std Dev:** Rolling standard deviation of returns (20-period)

## Configuration

### RegimeDetector Parameters

```python
RegimeDetector(
    adx_threshold=25.0,           # Minimum ADX for trending market
    adx_strong_threshold=40.0,     # ADX level for high confidence
    ma_slope_threshold=0.001,      # Minimum slope for directional bias
    volatility_high_threshold=2.0, # Z-score for high volatility
    volatility_low_threshold=0.5,  # Z-score for low volatility
    hysteresis_bars=3,             # Bars to confirm regime transition
    lookback_period=100            # Historical bars for normalization
)
```

### MongoDB Indexes

```javascript
// Query latest regime by symbol
db.macro_regimes.createIndex({ symbol: 1, timestamp: -1 })

// Filter by trend regime
db.macro_regimes.createIndex({ trend_regime: 1, timestamp: -1 })

// Filter by volatility regime
db.macro_regimes.createIndex({ volatility_regime: 1, timestamp: -1 })

// Prevent duplicates
db.macro_regimes.createIndex({ symbol: 1, timestamp: 1 }, { unique: true })
```

## Running Tests

```bash
# Run macro regime tests
python -m pytest tests/test_macro_regime.py -v

# Run with coverage
python -m pytest tests/test_macro_regime.py --cov=macro --cov-report=html
```

## Next Steps: Phase 2

Phase 2 will integrate regime signals into the feature engineering pipeline:
- Add regime columns to feature frames
- Enable regime-based train/test splits
- Pass regime context to backtests
- Track regime-specific model performance

See `docs/macro_analysis_integration.md` for the complete roadmap.

## Architecture

```
macro/
├── __init__.py          # Package initialization
├── regime.py            # Regime detection engine (Phase 1) ✅
├── correlations.py      # Cross-asset correlations (Phase 5-6)
├── divergence.py        # Divergence detection (Phase 6)
├── signals.py           # Market structure signals (Phase 8)
├── sentiment/           # Sentiment analysis (Phase 10-12)
│   ├── scoring.py
│   ├── aggregator.py
│   └── buzz.py
└── sources/             # Data ingestion (Phase 7, 9, 11)
    ├── funding.py
    ├── open_interest.py
    ├── news.py
    ├── events.py
    └── social.py
```

## Contributing

When adding new regime detection logic:
1. Add technical indicator calculation methods to `RegimeDetector`
2. Update `RegimeFeatures` dataclass with new fields
3. Modify detection logic in `detect_trend_regime()` or `detect_volatility_regime()`
4. Add corresponding unit tests in `tests/test_macro_regime.py`
5. Update documentation and adjust thresholds based on backtest validation

## Support

For questions or issues related to macro analysis:
- Review the integration plan: `docs/macro_analysis_integration.md`
- Check API documentation: `http://localhost:8000/docs` (FastAPI auto-generated)
- Run tests to validate changes: `pytest tests/test_macro_regime.py`

