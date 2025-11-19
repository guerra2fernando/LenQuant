#!/bin/bash
# Quick test script for Regime UI Integration
# This script helps verify that regime data is available and the UI can display it

set -e

echo "================================"
echo "Regime UI Integration Test"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_BASE="${API_BASE:-http://localhost:8000}"
FRONTEND_BASE="${FRONTEND_BASE:-http://localhost:3000}"

echo "Testing backend API..."
echo "API Base: $API_BASE"
echo ""

# Test 1: API Health
echo "1. Checking API health..."
if curl -s "$API_BASE/api/status" | grep -q "ok"; then
    echo -e "${GREEN}✓ API is healthy${NC}"
else
    echo -e "${RED}✗ API is not responding${NC}"
    exit 1
fi
echo ""

# Test 2: Regime endpoint exists
echo "2. Checking regime endpoint..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/macro/regime?symbol=BTC%2FUSDT&interval=1h")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Regime endpoint is accessible${NC}"
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${YELLOW}⚠ Regime endpoint exists but no data found${NC}"
    echo "  Run: python scripts/backfill_regimes.py --all-symbols --interval 1h"
else
    echo -e "${RED}✗ Regime endpoint returned HTTP $HTTP_CODE${NC}"
fi
echo ""

# Test 3: Regime data structure
echo "3. Fetching regime data for BTC/USDT..."
REGIME_DATA=$(curl -s "$API_BASE/api/macro/regime?symbol=BTC%2FUSDT&interval=1h")

if echo "$REGIME_DATA" | grep -q "trend_regime"; then
    echo -e "${GREEN}✓ Regime data structure is correct${NC}"
    
    # Extract and display regime info
    TREND=$(echo "$REGIME_DATA" | grep -o '"trend_regime":"[^"]*"' | cut -d'"' -f4)
    VOLATILITY=$(echo "$REGIME_DATA" | grep -o '"volatility_regime":"[^"]*"' | cut -d'"' -f4)
    CONFIDENCE=$(echo "$REGIME_DATA" | grep -o '"confidence":[0-9.]*' | cut -d':' -f2)
    
    echo "  Trend: $TREND"
    echo "  Volatility: $VOLATILITY"
    echo "  Confidence: $CONFIDENCE"
else
    echo -e "${YELLOW}⚠ Regime data not available or invalid format${NC}"
    echo "  Response: $REGIME_DATA"
    echo ""
    echo "  To populate regime data, run:"
    echo "  python scripts/backfill_regimes.py --all-symbols --interval 1h"
fi
echo ""

# Test 4: Multiple symbols batch
echo "4. Testing batch regime query..."
BATCH_DATA=$(curl -s "$API_BASE/api/macro/regimes/batch?symbols=BTC/USDT,ETH/USDT&interval=1h")

if echo "$BATCH_DATA" | grep -q "regimes"; then
    COUNT=$(echo "$BATCH_DATA" | grep -o "trend_regime" | wc -l)
    echo -e "${GREEN}✓ Batch query works (returned $COUNT regimes)${NC}"
else
    echo -e "${YELLOW}⚠ Batch query returned no data${NC}"
fi
echo ""

# Test 5: Frontend check
echo "5. Checking frontend..."
if curl -s -o /dev/null "$FRONTEND_BASE"; then
    echo -e "${GREEN}✓ Frontend is running at $FRONTEND_BASE${NC}"
    echo ""
    echo "  Visit these pages to see regime UI:"
    echo "  - Dashboard: $FRONTEND_BASE/"
    echo "  - Insights:  $FRONTEND_BASE/insights"
else
    echo -e "${YELLOW}⚠ Frontend is not running${NC}"
    echo "  Start it with: cd web/next-app && npm run dev"
fi
echo ""

# Summary
echo "================================"
echo "Test Summary"
echo "================================"
echo ""
echo "If all checks passed, you should see:"
echo "1. Market Regime card on the main dashboard"
echo "2. Market Conditions card on the insights page"
echo "3. Regime info updating every 60 seconds"
echo ""
echo "If regime data is missing, run:"
echo "  python scripts/backfill_regimes.py --all-symbols --interval 1h --limit 1000"
echo ""
echo "Then refresh your browser to see the regime UI."
echo ""

