# Phase 6: Testing, Validation & Bug Fixes

**Duration:** Days 8-10  
**Priority:** CRITICAL  
**Status:** Not Started

---

## 🎯 Objectives

1. **End-to-end testing** - Full user journey from install to payment
2. **Backend API testing** - All extension endpoints validated
3. **Extension functionality testing** - All features work correctly
4. **Cross-browser testing** - Works on Chrome, Edge, Brave
5. **Performance testing** - Latency and memory within limits

---

## 📋 Prerequisites

- [ ] Phases 1-5 completed
- [ ] Stripe test mode configured
- [ ] MongoDB with test data
- [ ] Extension loaded in Chrome

---

## 🔨 Test Suites

### Test Suite 6.1: Backend API Tests

**File:** `tests/test_extension_api.py` (NEW)

```python
"""
Integration tests for Chrome extension API endpoints.

Run with: pytest tests/test_extension_api.py -v
"""
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any

import pytest
import requests

# Test configuration
BASE_URL = "http://localhost:8000/api/extension"
TEST_EMAIL = f"test_{int(time.time())}@example.com"
TEST_DEVICE_ID = None
TEST_LICENSE_TOKEN = None


class TestContextEndpoint:
    """Tests for /context endpoint."""
    
    def test_context_with_known_symbol(self):
        """Test context analysis for a known symbol."""
        response = requests.get(
            f"{BASE_URL}/context",
            params={"symbol": "BTCUSDT", "timeframe": "1m"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert "trade_allowed" in data
        assert "market_state" in data
        assert "suggested_leverage_band" in data
        assert "latency_ms" in data
        
        # Validate market state is valid
        valid_states = ["trend", "trend_volatile", "range", "chop", "undefined", "error"]
        assert data["market_state"] in valid_states
        
        # Validate leverage band format
        assert isinstance(data["suggested_leverage_band"], list)
        assert len(data["suggested_leverage_band"]) == 2
        
        # Validate latency is reasonable
        assert data["latency_ms"] < 1000  # Should be under 1 second
    
    def test_context_with_unknown_symbol(self):
        """Test context returns insufficient_data for unknown symbol."""
        response = requests.get(
            f"{BASE_URL}/context",
            params={"symbol": "UNKNOWNUSDT", "timeframe": "1m"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should indicate insufficient data
        assert "insufficient_data" in data.get("risk_flags", []) or data["market_state"] == "undefined"


class TestEphemeralEndpoint:
    """Tests for /analyze-ephemeral endpoint."""
    
    def _get_candles_from_binance(self, symbol: str = "BTCUSDT", limit: int = 100) -> list:
        """Fetch real candles from Binance."""
        response = requests.get(
            "https://fapi.binance.com/fapi/v1/klines",
            params={"symbol": symbol, "interval": "1m", "limit": limit}
        )
        
        return [
            {
                "timestamp": c[0],
                "open": float(c[1]),
                "high": float(c[2]),
                "low": float(c[3]),
                "close": float(c[4]),
                "volume": float(c[5]),
            }
            for c in response.json()
        ]
    
    def test_ephemeral_with_valid_candles(self):
        """Test ephemeral analysis with real Binance data."""
        candles = self._get_candles_from_binance(limit=300)
        
        response = requests.post(
            f"{BASE_URL}/analyze-ephemeral",
            json={
                "symbol": "BTCUSDT",
                "timeframe": "1m",
                "candles": candles,
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate source is ephemeral
        assert data.get("source") == "ephemeral"
        
        # Validate analysis is complete
        assert "market_state" in data
        assert "trend_direction" in data
        assert "suggested_leverage_band" in data
        
        # Should have regime features
        assert "regime_features" in data
        assert "adx" in data["regime_features"]
    
    def test_ephemeral_with_insufficient_candles(self):
        """Test ephemeral rejects insufficient data."""
        candles = self._get_candles_from_binance(limit=20)
        
        response = requests.post(
            f"{BASE_URL}/analyze-ephemeral",
            json={
                "symbol": "BTCUSDT",
                "timeframe": "1m",
                "candles": candles,
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["trade_allowed"] == False
        assert "insufficient_data" in data.get("risk_flags", [])


class TestMTFEndpoint:
    """Tests for /analyze-mtf endpoint."""
    
    def test_mtf_analysis(self):
        """Test multi-timeframe analysis."""
        response = requests.post(
            f"{BASE_URL}/analyze-mtf",
            json={
                "symbol": "BTCUSDT",
                "timeframes": ["5m", "1h", "4h"],
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate structure
        assert "confluence" in data
        assert "confluence_score" in data
        assert "timeframes" in data
        
        # Validate confluence is valid
        assert data["confluence"] in ["high", "medium", "low"]
        
        # Validate all timeframes present
        for tf in ["5m", "1h", "4h"]:
            assert tf in data["timeframes"]


class TestAuthEndpoints:
    """Tests for authentication endpoints."""
    
    def test_registration(self):
        """Test user registration."""
        global TEST_DEVICE_ID, TEST_LICENSE_TOKEN
        
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json={"email": TEST_EMAIL}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["tier"] == "trial"
        assert "device_id" in data
        assert "license_token" in data
        assert "trial_ends_at" in data
        
        # Save for later tests
        TEST_DEVICE_ID = data["device_id"]
        TEST_LICENSE_TOKEN = data["license_token"]
    
    def test_validation(self):
        """Test license validation."""
        # Ensure we have registration data
        if not TEST_DEVICE_ID:
            self.test_registration()
        
        response = requests.post(
            f"{BASE_URL}/auth/validate",
            json={
                "email": TEST_EMAIL,
                "device_id": TEST_DEVICE_ID,
                "license_token": TEST_LICENSE_TOKEN,
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["valid"] == True
        assert data["tier"] == "trial"
        assert "analysis" in data["features"]
    
    def test_duplicate_registration(self):
        """Test that re-registering returns existing license."""
        if not TEST_DEVICE_ID:
            self.test_registration()
        
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json={"email": TEST_EMAIL}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return same device_id
        assert data["device_id"] == TEST_DEVICE_ID


class TestExplainEndpoint:
    """Tests for /explain endpoint."""
    
    def test_explain_with_context(self):
        """Test AI explanation generation."""
        # First get context
        context_response = requests.get(
            f"{BASE_URL}/context",
            params={"symbol": "BTCUSDT", "timeframe": "1m"}
        )
        fast_analysis = context_response.json()
        
        # Request explanation
        response = requests.post(
            f"{BASE_URL}/explain",
            json={
                "context": {
                    "symbol": "BTCUSDT",
                    "timeframe": "1m",
                    "exchange": "binance",
                    "market": "futures",
                },
                "fast_analysis": fast_analysis,
                "trade_levels": {
                    "bias": "LONG",
                    "entry_zone": "95000 - 95500",
                    "stop_loss": "94000",
                    "take_profit_1": "97000",
                },
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate response
        assert "trade_plan" in data
        assert "reasoning" in data
        assert "latency_ms" in data


class TestBehaviorEndpoints:
    """Tests for behavior analysis endpoints."""
    
    def test_behavior_analyze(self):
        """Test behavior analysis."""
        response = requests.get(
            f"{BASE_URL}/behavior/analyze",
            params={"session_id": "test_session_123"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "alerts" in data
        assert "in_cooldown" in data
    
    def test_cooldown_flow(self):
        """Test cooldown start and check."""
        session_id = f"test_session_{int(time.time())}"
        
        # Start cooldown
        start_response = requests.post(
            f"{BASE_URL}/behavior/cooldown",
            params={
                "session_id": session_id,
                "minutes": 5,
                "reason": "Test cooldown",
            }
        )
        
        assert start_response.status_code == 200
        
        # Check cooldown status
        check_response = requests.get(
            f"{BASE_URL}/behavior/cooldown",
            params={"session_id": session_id}
        )
        
        assert check_response.status_code == 200
        data = check_response.json()
        
        assert data["active"] == True
        assert data["remaining_min"] > 0
        assert data["remaining_min"] <= 5


class TestPerformance:
    """Performance tests."""
    
    def test_context_latency(self):
        """Test context endpoint latency."""
        latencies = []
        
        for _ in range(10):
            start = time.time()
            response = requests.get(
                f"{BASE_URL}/context",
                params={"symbol": "BTCUSDT", "timeframe": "1m"}
            )
            latencies.append((time.time() - start) * 1000)
        
        avg_latency = sum(latencies) / len(latencies)
        max_latency = max(latencies)
        
        print(f"Average latency: {avg_latency:.0f}ms")
        print(f"Max latency: {max_latency:.0f}ms")
        
        # Target: <500ms average, <1000ms max
        assert avg_latency < 500, f"Average latency too high: {avg_latency}ms"
        assert max_latency < 1000, f"Max latency too high: {max_latency}ms"
    
    def test_ephemeral_latency(self):
        """Test ephemeral endpoint latency."""
        # Fetch candles once
        candles_response = requests.get(
            "https://fapi.binance.com/fapi/v1/klines",
            params={"symbol": "BTCUSDT", "interval": "1m", "limit": 300}
        )
        candles = [
            {
                "timestamp": c[0],
                "open": float(c[1]),
                "high": float(c[2]),
                "low": float(c[3]),
                "close": float(c[4]),
                "volume": float(c[5]),
            }
            for c in candles_response.json()
        ]
        
        latencies = []
        
        for _ in range(5):
            start = time.time()
            response = requests.post(
                f"{BASE_URL}/analyze-ephemeral",
                json={
                    "symbol": "BTCUSDT",
                    "timeframe": "1m",
                    "candles": candles,
                }
            )
            latencies.append((time.time() - start) * 1000)
        
        avg_latency = sum(latencies) / len(latencies)
        
        print(f"Ephemeral average latency: {avg_latency:.0f}ms")
        
        # Target: <1500ms average
        assert avg_latency < 1500, f"Ephemeral latency too high: {avg_latency}ms"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
```

---

### Test Suite 6.2: Extension Functional Tests

**File:** `chrome-extension/tests/functional_tests.md`

```markdown
# Extension Functional Test Checklist

Run these tests manually in Chrome with the extension loaded.

## Installation Tests

- [ ] Extension installs without errors
- [ ] Extension icon appears in Chrome toolbar
- [ ] Popup opens when clicking extension icon
- [ ] Options page opens from popup link

## Panel Tests

- [ ] Panel appears on Binance Futures page
- [ ] Panel can be dragged
- [ ] Panel position persists after page refresh
- [ ] Panel can be collapsed
- [ ] Panel can be closed
- [ ] Panel can be reopened via popup

## Analysis Tests

- [ ] Symbol is detected from URL
- [ ] Timeframe is detected from chart
- [ ] Analysis runs automatically on page load
- [ ] Refresh button triggers new analysis
- [ ] Market state displays correctly
- [ ] Grade displays correctly (A/B/C/D)
- [ ] Setup candidates display when detected
- [ ] Risk flags display when present
- [ ] Leverage band displays correctly

## Source Detection Tests

- [ ] Backend analysis shows "Live" in footer
- [ ] Ephemeral analysis shows "Ephemeral" in footer
- [ ] Client-side fallback shows "Client" in footer
- [ ] Cached results show "Cached" in footer

## Leverage Detection Tests

- [ ] User's current leverage is detected from DOM
- [ ] Leverage warning shows when above recommended
- [ ] Leverage OK shows when within range
- [ ] Leverage conservative shows when below range

## Quick Action Info Tests

- [ ] Quick action section appears for tradeable conditions
- [ ] Bias shows correctly (LONG/SHORT/WAIT)
- [ ] Entry zone calculates from current price
- [ ] Stop loss calculates from ATR
- [ ] Take profit levels calculate correctly
- [ ] Section hides for choppy/undefined markets

## Explain Feature Tests

- [ ] Explain button is clickable
- [ ] Loading state shows during request
- [ ] Explanation panel opens with result
- [ ] Trade plan displays correctly
- [ ] Reasoning displays correctly
- [ ] Provider and latency shown
- [ ] Close button works

## Bookmark Feature Tests

- [ ] Bookmark button opens prompt
- [ ] Bookmark saved shows confirmation
- [ ] Bookmark button resets after save

## Cooldown Feature Tests

- [ ] Take Break button opens prompt
- [ ] Entering minutes starts cooldown
- [ ] Cooldown overlay appears
- [ ] Countdown timer updates
- [ ] End Cooldown button works
- [ ] Cooldown persists on page refresh

## Behavioral Alerts Tests

- [ ] Alerts appear in panel
- [ ] Critical alerts are styled differently
- [ ] Dismiss button removes alert
- [ ] Auto-dismiss works for info alerts

## Authentication Tests

- [ ] Registration modal appears for new users
- [ ] Email validation works
- [ ] Registration creates license
- [ ] License persists in chrome.storage
- [ ] Validation on extension restart works

## Feature Gating Tests (Expired/Free tier)

- [ ] Explain button shows paywall
- [ ] Paywall displays upgrade options
- [ ] Plan buttons work
- [ ] Maybe Later closes paywall

## Trial Tests

- [ ] Trial banner shows for trial users
- [ ] Trial countdown displays correctly
- [ ] Upgrade button in banner works
- [ ] Banner dismisses on X click

## MTF Section Tests

- [ ] MTF section displays
- [ ] Refresh button works
- [ ] All timeframes show results
- [ ] Confluence score displays
- [ ] Recommendation displays
- [ ] Bias color coding correct

## Performance Tests

- [ ] Analysis completes in <3 seconds
- [ ] Panel renders without lag
- [ ] Auto-refresh doesn't cause memory leak
- [ ] Multiple page switches work smoothly

## Error Handling Tests

- [ ] Offline shows appropriate message
- [ ] API errors show error state
- [ ] Recovery works when back online
- [ ] No console errors during normal use
```

---

### Test Suite 6.3: Stripe Integration Tests

**File:** `tests/test_stripe_integration.py` (NEW)

```python
"""
Stripe integration tests (use test mode).

Run with: pytest tests/test_stripe_integration.py -v
"""
import os
import time

import pytest
import requests
import stripe

# Test configuration
BASE_URL = "http://localhost:8000/api/extension"
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")


class TestStripeCheckout:
    """Tests for Stripe checkout flow."""
    
    @pytest.fixture
    def registered_user(self):
        """Create a test user."""
        email = f"stripe_test_{int(time.time())}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json={"email": email}
        )
        
        data = response.json()
        return {
            "email": email,
            "device_id": data["device_id"],
        }
    
    def test_checkout_session_creation(self, registered_user):
        """Test checkout session is created."""
        response = requests.post(
            f"{BASE_URL}/stripe/checkout",
            json={
                "email": registered_user["email"],
                "device_id": registered_user["device_id"],
                "plan": "pro_monthly",
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "checkout_url" in data
        assert "session_id" in data
        assert data["checkout_url"].startswith("https://checkout.stripe.com")
    
    def test_checkout_invalid_plan(self, registered_user):
        """Test checkout rejects invalid plan."""
        response = requests.post(
            f"{BASE_URL}/stripe/checkout",
            json={
                "email": registered_user["email"],
                "device_id": registered_user["device_id"],
                "plan": "invalid_plan",
            }
        )
        
        assert response.status_code == 400
    
    def test_checkout_unregistered_user(self):
        """Test checkout fails for unregistered user."""
        response = requests.post(
            f"{BASE_URL}/stripe/checkout",
            json={
                "email": "nonexistent@example.com",
                "device_id": "fake_device",
                "plan": "pro_monthly",
            }
        )
        
        assert response.status_code == 404


class TestSubscriptionStatus:
    """Tests for subscription status endpoint."""
    
    @pytest.fixture
    def registered_user(self):
        """Create a test user."""
        email = f"sub_test_{int(time.time())}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json={"email": email}
        )
        
        data = response.json()
        return {
            "email": email,
            "device_id": data["device_id"],
        }
    
    def test_subscription_status_trial(self, registered_user):
        """Test subscription status for trial user."""
        response = requests.get(
            f"{BASE_URL}/stripe/subscription",
            params={
                "email": registered_user["email"],
                "device_id": registered_user["device_id"],
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["tier"] == "trial"
        assert data["plan"] is None


# Note: Webhook tests require Stripe CLI for local testing
# Run: stripe listen --forward-to localhost:8000/api/extension/stripe/webhook
```

---

### Test Suite 6.4: Cross-Browser Tests

**File:** `chrome-extension/tests/cross_browser.md`

```markdown
# Cross-Browser Test Checklist

## Chrome (Primary)

- [ ] Extension loads correctly
- [ ] All features work
- [ ] No console errors

## Edge (Chromium-based)

- [ ] Extension loads from Chrome Web Store
- [ ] Panel displays correctly
- [ ] Analysis works
- [ ] Authentication works

## Brave

- [ ] Extension loads from Chrome Web Store
- [ ] Brave Shields don't block functionality
- [ ] Analysis works with shields down
- [ ] WebSocket connects (if used)

## Opera GX

- [ ] Extension loads from Chrome Web Store
- [ ] Panel displays correctly
- [ ] No conflicts with Opera features

## Known Issues

Document any browser-specific issues found:

| Browser | Issue | Workaround |
|---------|-------|------------|
| | | |
```

---

## ✅ Validation Checklist

### API Validation

```bash
# Run all API tests
cd /path/to/LenQuant
pytest tests/test_extension_api.py -v --tb=short

# Expected: All tests pass
```

### Extension Validation

```bash
# Build extension for testing
cd chrome-extension

# Check for linting errors (if ESLint configured)
npx eslint *.js

# Check manifest is valid
cat manifest.json | python -m json.tool > /dev/null && echo "Manifest valid"
```

### Performance Validation

```python
# Quick performance check script
import requests
import statistics
import time

BASE_URL = "http://localhost:8000/api/extension"

# Context latency
latencies = []
for _ in range(20):
    start = time.time()
    requests.get(f"{BASE_URL}/context", params={"symbol": "BTCUSDT", "timeframe": "1m"})
    latencies.append((time.time() - start) * 1000)

print(f"Context Endpoint:")
print(f"  Mean: {statistics.mean(latencies):.0f}ms")
print(f"  Median: {statistics.median(latencies):.0f}ms")
print(f"  P95: {sorted(latencies)[int(len(latencies)*0.95)]:.0f}ms")

# Validation
assert statistics.mean(latencies) < 500, "Mean latency too high"
print("✓ Performance validation passed")
```

---

## 🐛 Bug Fix Template

When bugs are found, document them using this template:

```markdown
### Bug: [Title]

**Severity:** Critical / High / Medium / Low

**Steps to Reproduce:**
1. ...
2. ...
3. ...

**Expected Behavior:**
...

**Actual Behavior:**
...

**Fix:**
- File: `path/to/file`
- Changes: ...

**Verified:** [ ] Yes
```

---

## 📊 Test Results Summary

| Test Suite | Tests | Passed | Failed | Status |
|------------|-------|--------|--------|--------|
| API Tests | - | - | - | ⏳ |
| Functional Tests | - | - | - | ⏳ |
| Stripe Tests | - | - | - | ⏳ |
| Cross-Browser | - | - | - | ⏳ |
| Performance | - | - | - | ⏳ |

---

## 📁 Files Created

| File | Description |
|------|-------------|
| `tests/test_extension_api.py` | Backend API tests |
| `tests/test_stripe_integration.py` | Stripe integration tests |
| `chrome-extension/tests/functional_tests.md` | Manual test checklist |
| `chrome-extension/tests/cross_browser.md` | Cross-browser checklist |

---

## 🔗 Next Phase Prerequisites

Phase 7 requires:
- [ ] All API tests passing
- [ ] All critical bugs fixed
- [ ] Functional tests completed
- [ ] Performance within targets

---

*Complete this phase before moving to Phase 7: Chrome Store Submission*

