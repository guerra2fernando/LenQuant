# LenQuant Chrome Extension — Standalone Monetization Plan

**Version:** 1.0  
**Last Updated:** January 2026  
**Status:** Planning & Documentation

---

## 📋 Executive Summary

This document outlines a comprehensive plan to transform the LenQuant Binance Futures Assistant Chrome Extension into a **standalone monetizable product** that can be distributed via the Chrome Web Store. The extension will operate independently while maintaining backward compatibility with the full LenQuant platform.

### Key Goals

1. **Standalone Operation**: Users can download from Chrome Store, open Binance, login, and use immediately
2. **Subscription Model**: Free trial (3 days) → Paid plans (monthly/yearly via Stripe)
3. **No Binance API Required**: Real-time analysis without users providing exchange API keys
4. **Optional Full Features**: Users can optionally connect to LenQuant for advanced features
5. **Monetization**: Revenue from standalone users while maintaining free tier for full platform users

---

## 🏗️ Architecture Overview

### Current Architecture (Integrated Mode)

```
┌─────────────────────────────────────────────────────────────────┐
│                     CURRENT SETUP                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐     ┌──────────────────────────────────┐  │
│  │ Chrome Extension │────▶│     LenQuant Backend             │  │
│  │                  │     │  ─────────────────────────────── │  │
│  │ • DOM Extraction │     │  • MongoDB (all data)            │  │
│  │ • UI Panel       │     │  • ML Models                     │  │
│  │ • Client Analysis│     │  • Journal & Reports             │  │
│  └──────────────────┘     │  • User Binance API Keys         │  │
│         │                 │  • Trade Sync                    │  │
│         │ Fallback        └──────────────────────────────────┘  │
│         ▼                                                        │
│  ┌──────────────────┐                                           │
│  │  Binance API     │  (Public endpoints for OHLCV)             │
│  │  (No auth req.)  │                                           │
│  └──────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### New Architecture (Standalone + Integrated Modes)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NEW SETUP (DUAL MODE)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     Chrome Extension (Enhanced)                       │   │
│  │  ────────────────────────────────────────────────────────────────── │   │
│  │  • DOM Extraction (leverage, position, symbol, timeframe)            │   │
│  │  • Client-Side Analysis (local indicators, regime detection)         │   │
│  │  • UI Panel (grades, signals, quick actions)                         │   │
│  │  • Local Storage (settings, session data, local journal)             │   │
│  │  • Subscription Management (license validation, paywall UI)          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│              │                    │                        │                 │
│              │                    │                        │                 │
│   ┌──────────┼────────────────────┼────────────────────────┼──────────┐     │
│   │ TIER 1   │         TIER 2     │            TIER 3      │          │     │
│   │ (Free)   ▼         (Paid)     ▼           (Premium)    ▼          │     │
│   └──────────┬────────────────────┬────────────────────────┬──────────┘     │
│              │                    │                        │                 │
│  ┌───────────▼───────┐ ┌─────────▼─────────┐ ┌────────────▼──────────────┐  │
│  │  Binance Public   │ │  LenQuant Lite    │ │   LenQuant Full Backend   │  │
│  │     API           │ │    Backend        │ │                           │  │
│  │ ───────────────── │ │ ───────────────── │ │ ─────────────────────────│  │
│  │ • OHLCV Data      │ │ • Auth/License    │ │ • All Lite Features       │  │
│  │ • Mark Price      │ │ • AI Explanations │ │ • ML Models               │  │
│  │ • 24h Stats       │ │ • Cloud Journal   │ │ • Strategy Evolution      │  │
│  │ • Order Book      │ │ • Basic Reports   │ │ • Trade Sync (via API)    │  │
│  └───────────────────┘ │ • Stripe Billing  │ │ • Advanced Analytics      │  │
│                        └───────────────────┘ │ • Portfolio Optimization  │  │
│                                              └───────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 💰 Subscription Tiers

### Tier 1: Free Trial (3 Days)

**Target:** New users exploring the extension

| Feature | Included |
|---------|----------|
| Real-time market analysis | ✅ Full access |
| Grade & signal display | ✅ A-D grades, Buy/Sell signals |
| Leverage recommendations | ✅ Dynamic bands |
| Risk flag warnings | ✅ All flags |
| Quick trade info (entry/SL/TP) | ✅ Calculated locally |
| Behavioral alerts | ⚠️ Basic only (no history) |
| AI Explanations | ❌ Locked (shows paywall) |
| Cloud Journal | ❌ Locked |
| Performance Reports | ❌ Locked |
| Sessions | Unlimited during trial |

**Limitations:**
- 3-day trial countdown displayed in panel footer
- "Upgrade to Pro" button prominently displayed
- AI Explain button shows paywall modal

### Tier 2: Pro Plan ($9.99/month or $79/year)

**Target:** Active traders who want AI assistance

| Feature | Included |
|---------|----------|
| All Free features | ✅ |
| AI-powered trade explanations | ✅ Unlimited |
| Cloud journal (events, bookmarks) | ✅ 30-day history |
| Daily performance summary | ✅ |
| Behavioral analysis (full) | ✅ Pattern detection |
| Cooldown system | ✅ Tracked in cloud |
| CoinGecko sentiment integration | ✅ |
| Priority support | ✅ Email |

### Tier 3: Premium Plan ($24.99/month or $199/year)

**Target:** Serious traders, power users

| Feature | Included |
|---------|----------|
| All Pro features | ✅ |
| Extended journal history | ✅ 365-day history |
| Weekly & monthly reports | ✅ |
| Performance analytics dashboard | ✅ |
| Trade sync (via Binance API) | ✅ Optional |
| Multi-symbol monitoring | ✅ Up to 10 symbols |
| Advanced AI (GPT-4 level) | ✅ |
| Discord community access | ✅ |
| 1-on-1 onboarding call | ✅ Once |

### Tier 4: LenQuant Platform (Existing)

**Target:** Users who want the full autonomous trading platform

| Feature | Included |
|---------|----------|
| All Premium features | ✅ |
| Full LenQuant platform access | ✅ |
| ML models & predictions | ✅ |
| Strategy evolution | ✅ |
| Paper/testnet/live trading | ✅ |
| Portfolio optimization | ✅ |
| Extension included free | ✅ |

---

## 🔧 Implementation Phases

### Phase 1: Authentication & License System (Week 1-2)

#### 1.1 Backend: LenQuant Lite Service

Create a lightweight authentication and licensing service:

```python
# api/extension_auth/routes.py

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
import jwt
import stripe

router = APIRouter(prefix="/api/ext-auth", tags=["extension-auth"])

# --- License Management ---

@router.post("/register")
async def register_extension_user(email: str, device_id: str):
    """
    Register a new extension user.
    Creates account with 3-day free trial.
    """
    user = await db.extension_users.find_one({"email": email})
    
    if not user:
        trial_ends = datetime.utcnow() + timedelta(days=3)
        user = {
            "email": email,
            "device_id": device_id,
            "tier": "trial",
            "trial_ends": trial_ends,
            "subscription_id": None,
            "created_at": datetime.utcnow(),
        }
        await db.extension_users.insert_one(user)
    
    # Generate license token
    token = generate_license_token(user)
    return {"token": token, "tier": user["tier"], "trial_ends": trial_ends}


@router.post("/validate")
async def validate_license(token: str):
    """
    Validate extension license token.
    Called on extension startup and periodically.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user = await db.extension_users.find_one({"email": payload["email"]})
        
        if not user:
            return {"valid": False, "reason": "User not found"}
        
        # Check trial expiry
        if user["tier"] == "trial":
            if datetime.utcnow() > user["trial_ends"]:
                return {
                    "valid": False, 
                    "reason": "trial_expired",
                    "upgrade_url": f"{STRIPE_CHECKOUT_URL}?email={user['email']}"
                }
        
        # Check subscription status
        if user["tier"] in ["pro", "premium"]:
            if user.get("subscription_status") != "active":
                return {"valid": False, "reason": "subscription_inactive"}
        
        return {
            "valid": True,
            "tier": user["tier"],
            "features": get_tier_features(user["tier"]),
            "expires_at": user.get("subscription_end") or user.get("trial_ends"),
        }
        
    except jwt.ExpiredSignatureError:
        return {"valid": False, "reason": "token_expired"}


@router.post("/stripe-webhook")
async def handle_stripe_webhook(request: Request):
    """Handle Stripe subscription events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    event = stripe.Webhook.construct_event(
        payload, sig_header, STRIPE_WEBHOOK_SECRET
    )
    
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        email = session["customer_email"]
        plan = session["metadata"]["plan"]  # "pro" or "premium"
        
        await db.extension_users.update_one(
            {"email": email},
            {"$set": {
                "tier": plan,
                "subscription_id": session["subscription"],
                "subscription_status": "active",
                "subscription_start": datetime.utcnow(),
            }}
        )
    
    elif event["type"] == "customer.subscription.deleted":
        subscription_id = event["data"]["object"]["id"]
        await db.extension_users.update_one(
            {"subscription_id": subscription_id},
            {"$set": {"tier": "expired", "subscription_status": "cancelled"}}
        )
    
    return {"status": "ok"}
```

#### 1.2 Extension: License Management

Add license checking to the extension:

```javascript
// license-manager.js (new file)

const LICENSE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
const AUTH_ENDPOINT = 'https://lenquant.com/api/ext-auth';

class LicenseManager {
  constructor() {
    this.license = null;
    this.checkInterval = null;
  }
  
  async initialize() {
    // Try to load existing license from storage
    const stored = await chrome.storage.sync.get(['license', 'userEmail']);
    
    if (stored.license) {
      const validation = await this.validateLicense(stored.license);
      if (validation.valid) {
        this.license = validation;
        this.startPeriodicCheck();
        return validation;
      }
    }
    
    // No valid license - show registration
    return { valid: false, reason: 'no_license' };
  }
  
  async register(email) {
    const deviceId = await this.getDeviceId();
    
    const response = await fetch(`${AUTH_ENDPOINT}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, device_id: deviceId }),
    });
    
    if (!response.ok) throw new Error('Registration failed');
    
    const data = await response.json();
    await chrome.storage.sync.set({ 
      license: data.token,
      userEmail: email,
    });
    
    this.license = data;
    this.startPeriodicCheck();
    return data;
  }
  
  async validateLicense(token) {
    try {
      const response = await fetch(`${AUTH_ENDPOINT}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      
      return await response.json();
    } catch (error) {
      // Offline - use cached license with grace period
      return { valid: true, tier: 'offline', features: this.getOfflineFeatures() };
    }
  }
  
  isFeatureAvailable(featureName) {
    if (!this.license || !this.license.valid) return false;
    return this.license.features?.includes(featureName) || false;
  }
  
  getTier() {
    return this.license?.tier || 'none';
  }
  
  getTrialDaysRemaining() {
    if (this.license?.tier !== 'trial') return null;
    const expiresAt = new Date(this.license.expires_at);
    const now = new Date();
    return Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)));
  }
  
  async getDeviceId() {
    let { deviceId } = await chrome.storage.local.get('deviceId');
    if (!deviceId) {
      deviceId = `dev_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
      await chrome.storage.local.set({ deviceId });
    }
    return deviceId;
  }
  
  startPeriodicCheck() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkInterval = setInterval(() => this.validateLicense(), LICENSE_CHECK_INTERVAL);
  }
  
  getOfflineFeatures() {
    // Grace period features when offline
    return ['analysis', 'grades', 'leverage', 'risk_flags', 'quick_info'];
  }
}

const licenseManager = new LicenseManager();
export default licenseManager;
```

#### 1.3 Extension: Paywall UI

Create paywall modal for locked features:

```javascript
// paywall.js (new file)

function showPaywall(feature, tier) {
  const overlay = document.createElement('div');
  overlay.id = 'lq-paywall-overlay';
  overlay.innerHTML = `
    <div class="lq-paywall-modal">
      <div class="lq-paywall-header">
        <span class="lq-paywall-icon">🔒</span>
        <h2>Upgrade to ${tier === 'pro' ? 'Pro' : 'Premium'}</h2>
      </div>
      
      <div class="lq-paywall-feature">
        <p>This feature requires a <strong>${tier}</strong> subscription:</p>
        <div class="lq-feature-name">${getFeatureName(feature)}</div>
      </div>
      
      <div class="lq-paywall-pricing">
        <div class="lq-plan lq-plan-pro ${tier === 'pro' ? 'recommended' : ''}">
          <h3>Pro</h3>
          <div class="lq-price">$9.99<span>/month</span></div>
          <ul>
            <li>✅ AI Trade Explanations</li>
            <li>✅ Cloud Journal</li>
            <li>✅ Daily Reports</li>
            <li>✅ Behavioral Analysis</li>
          </ul>
          <button class="lq-btn lq-btn-upgrade" data-plan="pro">
            Upgrade to Pro
          </button>
          <div class="lq-yearly">or $79/year (save 34%)</div>
        </div>
        
        <div class="lq-plan lq-plan-premium ${tier === 'premium' ? 'recommended' : ''}">
          <h3>Premium</h3>
          <div class="lq-price">$24.99<span>/month</span></div>
          <ul>
            <li>✅ Everything in Pro</li>
            <li>✅ Trade Sync</li>
            <li>✅ Advanced Analytics</li>
            <li>✅ Multi-Symbol</li>
          </ul>
          <button class="lq-btn lq-btn-upgrade" data-plan="premium">
            Upgrade to Premium
          </button>
          <div class="lq-yearly">or $199/year (save 33%)</div>
        </div>
      </div>
      
      <button class="lq-paywall-close">Maybe Later</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Event listeners
  overlay.querySelectorAll('.lq-btn-upgrade').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = btn.dataset.plan;
      openStripeCheckout(plan);
    });
  });
  
  overlay.querySelector('.lq-paywall-close').addEventListener('click', () => {
    overlay.remove();
  });
}

function openStripeCheckout(plan) {
  const checkoutUrl = `https://lenquant.com/checkout?plan=${plan}&source=extension`;
  chrome.tabs.create({ url: checkoutUrl });
}

function getFeatureName(feature) {
  const names = {
    'ai_explain': '🔍 AI-Powered Trade Explanations',
    'cloud_journal': '📔 Cloud Journal & History',
    'reports': '📊 Performance Reports',
    'trade_sync': '🔄 Binance Trade Sync',
    'analytics': '📈 Advanced Analytics',
    'multi_symbol': '📋 Multi-Symbol Monitoring',
  };
  return names[feature] || feature;
}
```

### Phase 2: Cloud Journal for Standalone Users (Week 2-3)

#### 2.1 Backend: Lightweight Journal Service

```python
# api/extension_journal/routes.py

@router.post("/events")
async def log_extension_events(
    request: JournalEventsRequest,
    user: ExtUser = Depends(get_extension_user)
):
    """
    Store journal events for extension users.
    Standalone users: events stored with extension-specific schema.
    Full platform users: redirected to main journal.
    """
    # Check tier
    if user.tier == "trial" or user.tier == "expired":
        raise HTTPException(403, "Journal requires Pro or Premium subscription")
    
    # Store events
    events = []
    for event in request.events:
        events.append({
            "user_id": str(user.id),
            "type": event.type,
            "symbol": event.symbol,
            "timeframe": event.timeframe,
            "payload": event.payload,
            "timestamp": event.timestamp or datetime.utcnow(),
            "source": "extension",
        })
    
    await db.extension_journal.insert_many(events)
    return {"stored": len(events)}


@router.get("/events")
async def get_extension_events(
    days: int = 7,
    symbol: str = None,
    user: ExtUser = Depends(get_extension_user)
):
    """Retrieve journal events for extension user."""
    # Apply tier-based history limit
    max_days = {"pro": 30, "premium": 365}.get(user.tier, 7)
    days = min(days, max_days)
    
    query = {
        "user_id": str(user.id),
        "timestamp": {"$gte": datetime.utcnow() - timedelta(days=days)},
    }
    if symbol:
        query["symbol"] = symbol
    
    events = await db.extension_journal.find(query).sort("timestamp", -1).to_list(1000)
    return {"events": events}


@router.get("/report/daily")
async def get_daily_report(
    date: str = None,
    user: ExtUser = Depends(get_extension_user)
):
    """Generate daily performance summary."""
    if user.tier not in ["pro", "premium"]:
        raise HTTPException(403, "Reports require Pro subscription")
    
    target_date = datetime.strptime(date, "%Y-%m-%d") if date else datetime.utcnow()
    start = target_date.replace(hour=0, minute=0, second=0)
    end = start + timedelta(days=1)
    
    events = await db.extension_journal.find({
        "user_id": str(user.id),
        "timestamp": {"$gte": start, "$lt": end},
    }).to_list(None)
    
    # Aggregate report
    report = {
        "date": date or target_date.strftime("%Y-%m-%d"),
        "total_analyses": len([e for e in events if e["type"] == "context_changed"]),
        "bookmarks": len([e for e in events if e["type"] == "bookmark_added"]),
        "explains_requested": len([e for e in events if e["type"] == "explain_requested"]),
        "symbols_analyzed": list(set(e.get("symbol") for e in events if e.get("symbol"))),
        "alerts_shown": sum(1 for e in events if e["type"] == "behavior_alert"),
        "cooldowns_taken": sum(1 for e in events if e["type"] == "cooldown_started"),
    }
    
    return report
```

### Phase 3: Feature Gating in Extension (Week 3-4)

#### 3.1 Update Background Script

```javascript
// background.js - Updated with feature gating

import licenseManager from './license-manager.js';

// ... existing code ...

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'REQUEST_EXPLAIN':
      // Feature gating for AI Explain
      if (!licenseManager.isFeatureAvailable('ai_explain')) {
        return { 
          error: 'feature_locked', 
          feature: 'ai_explain',
          required_tier: 'pro',
        };
      }
      
      // Proceed with explanation request
      bufferEvent({
        type: 'explain_requested',
        symbol: message.context.symbol,
        timeframe: message.context.timeframe,
        payload: {},
      });
      
      try {
        const explanation = await fetchExplanation(message.context, message.fastAnalysis);
        return { explanation };
      } catch (error) {
        return { error: error.message };
      }
      
    case 'BOOKMARK':
      // Feature gating for cloud bookmarks
      if (!licenseManager.isFeatureAvailable('cloud_journal')) {
        // Store locally only
        await storeLocalBookmark(message);
        return { success: true, storage: 'local' };
      }
      
      // Store in cloud
      bufferEvent({
        type: 'bookmark_added',
        symbol: message.symbol,
        timeframe: message.timeframe,
        payload: { note: message.note },
      });
      return { success: true, storage: 'cloud' };
      
    case 'SYNC_TRADES':
      // Feature gating for trade sync
      if (!licenseManager.isFeatureAvailable('trade_sync')) {
        return { 
          error: 'feature_locked', 
          feature: 'trade_sync',
          required_tier: 'premium',
        };
      }
      
      // Check if user has provided Binance API keys
      const { binanceApiKey, binanceApiSecret } = await chrome.storage.sync.get([
        'binanceApiKey', 'binanceApiSecret'
      ]);
      
      if (!binanceApiKey || !binanceApiSecret) {
        return { error: 'no_api_keys', message: 'Please configure your Binance API keys in settings' };
      }
      
      const syncResult = await syncTrades(message.mode || 'live', binanceApiKey, binanceApiSecret);
      return syncResult || { error: 'Sync failed' };
      
    case 'GET_LICENSE_STATUS':
      return {
        tier: licenseManager.getTier(),
        valid: licenseManager.license?.valid,
        trialDaysRemaining: licenseManager.getTrialDaysRemaining(),
        features: licenseManager.license?.features || [],
      };
      
    // ... other cases ...
  }
}
```

#### 3.2 Update Content Script with License UI

```javascript
// content.js - Add license status display

function updatePanelFooter(licenseStatus) {
  const footer = panel.container.querySelector('.lq-footer');
  
  if (licenseStatus.tier === 'trial') {
    const daysLeft = licenseStatus.trialDaysRemaining;
    footer.innerHTML = `
      <span class="lq-trial-badge">
        ⏱️ Trial: ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left
      </span>
      <button class="lq-upgrade-btn" onclick="showPaywall('trial', 'pro')">
        Upgrade →
      </button>
    `;
  } else if (licenseStatus.tier === 'expired') {
    footer.innerHTML = `
      <span class="lq-expired-badge">
        ❌ Trial Expired
      </span>
      <button class="lq-upgrade-btn" onclick="showPaywall('expired', 'pro')">
        Upgrade Now
      </button>
    `;
  } else {
    footer.innerHTML = `
      <span class="lq-latency">--ms</span>
      <span class="lq-tier-badge lq-tier-${licenseStatus.tier}">
        ${licenseStatus.tier.toUpperCase()}
      </span>
    `;
  }
}
```

### Phase 4: Stripe Integration (Week 4-5)

#### 4.1 Stripe Setup

```javascript
// stripe-config.js

const STRIPE_CONFIG = {
  publishableKey: 'pk_live_...',  // From env
  products: {
    pro_monthly: 'price_...',
    pro_yearly: 'price_...',
    premium_monthly: 'price_...',
    premium_yearly: 'price_...',
  },
  successUrl: 'https://lenquant.com/extension/success',
  cancelUrl: 'https://lenquant.com/extension/cancel',
};
```

#### 4.2 Checkout Flow

```javascript
// checkout.js (on lenquant.com)

import { loadStripe } from '@stripe/stripe-js';

const stripe = await loadStripe(STRIPE_CONFIG.publishableKey);

async function createCheckoutSession(plan, email) {
  const response = await fetch('/api/ext-auth/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, email }),
  });
  
  const { sessionId } = await response.json();
  
  // Redirect to Stripe Checkout
  const result = await stripe.redirectToCheckout({ sessionId });
  
  if (result.error) {
    console.error(result.error.message);
  }
}
```

### Phase 5: Chrome Web Store Preparation (Week 5-6)

#### 5.1 Manifest Updates

```json
{
  "manifest_version": 3,
  "name": "LenQuant - AI Trading Assistant for Binance Futures",
  "version": "2.0.0",
  "description": "Real-time AI trading coach with market analysis, leverage recommendations, and behavioral guardrails. Free 3-day trial.",
  
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "identity"
  ],
  
  "host_permissions": [
    "https://www.binance.com/*",
    "https://fapi.binance.com/*",
    "https://api.binance.com/*",
    "https://lenquant.com/*",
    "https://api.coingecko.com/*"
  ],
  
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  
  "content_scripts": [
    {
      "matches": ["https://www.binance.com/*/futures/*"],
      "js": ["content.js"],
      "css": ["panel.css"],
      "run_at": "document_idle"
    }
  ],
  
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  
  "options_page": "options.html"
}
```

#### 5.2 Store Listing Assets

**Required:**
- Icon: 128x128 PNG
- Screenshots: 1280x800 or 640x400 (5-10)
- Promotional images: 440x280, 920x680, 1400x560

**Description (Short):**
```
AI-powered trading assistant for Binance Futures. Get real-time market analysis, 
optimal leverage recommendations, and AI trade explanations.
```

**Description (Full):**
```
🚀 LenQuant: Your AI Trading Coach for Binance Futures

Transform your trading with intelligent market analysis and behavioral guardrails.

⚡ REAL-TIME MARKET INTELLIGENCE
• Sub-500ms market state detection (trending, ranging, choppy)
• Dynamic leverage recommendations based on volatility
• Risk flag warnings (low volume, extreme volatility, overbought)
• Trade scoring with probability indicators

🔍 AI-POWERED TRADE PLANNING
• Get detailed trade plans with entry, stop-loss, and targets
• Evidence-based analysis backed by technical indicators
• Confidence scoring for every setup

🛡️ BEHAVIORAL GUARDRAILS
• Revenge trading detection
• Overtrading prevention
• Cooldown system for emotional breaks
• Chop market alerts

📊 QUICK TRADE INFO
• Instant bias detection (Long/Short/Wait)
• Entry zones, stop loss, and take profit levels
• Setup detection (pullback, breakout, compression)

💎 SUBSCRIPTION PLANS

FREE TRIAL (3 Days)
• Full market analysis
• Leverage recommendations
• Risk warnings

PRO ($9.99/month)
• AI trade explanations
• Cloud journal
• Daily reports
• Full behavioral analysis

PREMIUM ($24.99/month)
• Everything in Pro
• Trade sync with Binance
• Advanced analytics
• Extended history

🔒 SECURE & PRIVATE
• No Binance API keys required for basic features
• All analysis happens in real-time
• Your data stays with you

Works on Binance Futures. Just install, navigate to Binance Futures, and start 
trading with AI assistance!
```

---

## 📱 UI/UX Improvements for Standalone

### 5.1 Onboarding Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  FIRST-TIME USER FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Step 1: Welcome Screen                                     │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  🎯 Welcome to LenQuant                              │   │
│   │                                                       │   │
│   │  Your AI Trading Coach for Binance Futures           │   │
│   │                                                       │   │
│   │  ✅ Real-time market analysis                        │   │
│   │  ✅ Optimal leverage recommendations                 │   │
│   │  ✅ Behavioral guardrails                            │   │
│   │                                                       │   │
│   │  [Start 3-Day Free Trial]                            │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   Step 2: Email Registration                                 │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  📧 Enter your email to start                        │   │
│   │                                                       │   │
│   │  [________________________]                          │   │
│   │                                                       │   │
│   │  □ I agree to Terms of Service                       │   │
│   │  □ Receive trading tips (optional)                   │   │
│   │                                                       │   │
│   │  [Start Free Trial →]                                │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   Step 3: Tutorial Overlay                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Guided tour highlighting:                           │   │
│   │  1. Grade & Signal (what it means)                   │   │
│   │  2. Market State (trend/range/chop)                  │   │
│   │  3. Leverage Band (your current vs recommended)      │   │
│   │  4. Quick Trade Info (entry/SL/TP)                   │   │
│   │  5. Explain Button (AI analysis)                     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Panel Redesign for Standalone

```
┌─────────────────────────────────────────────────────────────┐
│ [TRIAL: 2 days left]                    LenQuant    [−][×] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           🚀 STRONG BUY  |  78%                       │  │
│  │           BTCUSDT • 1m                                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─────────────────────┐  ┌─────────────────────────────┐   │
│  │   Grade             │  │   Market State              │   │
│  │     [ A ]           │  │   📈 TRENDING UP            │   │
│  │                     │  │   Setup: Pullback           │   │
│  └─────────────────────┘  └─────────────────────────────┘   │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Leverage Band:  5x - 15x                             │  │
│  │  [████████████░░░░░░░░░░░░░░░░░░]                     │  │
│  │  Your leverage: 10x ✅                                │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  📊 Quick Trade Info                                  │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  Bias: 🟢 LONG         │   Wait: Ready               │  │
│  │  Entry: 43,250 - 43,400│   SL: 42,800 (-1.1%)        │  │
│  │  TP1: 43,900 (+1.5%)   │   TP2: 44,500 (+2.8%)       │  │
│  │                                                       │  │
│  │  ⚠️ Low volume - reduce size                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────┐ ┌──────────────────────────┐      │
│  │ 🔍 Explain 🔒        │ │ 📑 Bookmark              │      │
│  │ [Upgrade to unlock]  │ │                          │      │
│  └──────────────────────┘ └──────────────────────────┘      │
│                                                              │
│  ┌──────────────────────┐ ┌──────────────────────────┐      │
│  │ ⏸️ Take Break        │ │ 🔄 Sync 🔒               │      │
│  └──────────────────────┘ └──────────────────────────┘      │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  245ms  •  Client  •  [Upgrade to Pro →]                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Considerations

### 6.1 No Binance API Storage in Extension

For standalone users without trade sync:
- **No API keys stored** - all analysis uses public Binance endpoints
- **DOM extraction only** - reads UI elements, doesn't execute trades
- **Client-side analysis** - indicators calculated locally

### 6.2 Optional Binance API for Trade Sync

For Premium users who want trade sync:
- API keys stored in `chrome.storage.sync` (encrypted by Chrome)
- Keys sent to LenQuant backend only for sync operations
- Read-only API keys recommended (no trading permissions)
- Keys never logged or stored in backend

### 6.3 License Token Security

- JWT tokens with short expiry (7 days)
- Tokens refreshed on each validation
- Device ID binding to prevent sharing
- Rate limiting on validation endpoint

---

## 📊 Analytics & Metrics

### 7.1 Key Metrics to Track

| Metric | Description | Target |
|--------|-------------|--------|
| Trial Signups | New email registrations | 100/day |
| Trial-to-Paid | Conversion rate | >5% |
| Monthly Churn | Subscription cancellations | <8% |
| DAU | Daily active users | 1000+ |
| Feature Usage | Explain, Bookmark, Sync | Track per tier |
| ARPU | Average revenue per user | $15 |

### 7.2 Implementation

```javascript
// analytics.js

async function trackEvent(event, properties = {}) {
  const payload = {
    event,
    properties: {
      ...properties,
      tier: licenseManager.getTier(),
      timestamp: Date.now(),
      extension_version: chrome.runtime.getManifest().version,
    },
  };
  
  // Send to analytics endpoint
  try {
    await fetch('https://lenquant.com/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // Analytics failures should not block functionality
  }
}

// Track key events
trackEvent('extension_installed');
trackEvent('trial_started', { email });
trackEvent('feature_used', { feature: 'explain' });
trackEvent('paywall_shown', { feature: 'ai_explain' });
trackEvent('upgrade_clicked', { plan: 'pro' });
trackEvent('subscription_started', { plan: 'pro', billing: 'monthly' });
```

---

## 🚀 Launch Checklist

### Pre-Launch

- [ ] Backend: Deploy LenQuant Lite API
- [ ] Backend: Configure Stripe products & webhooks
- [ ] Backend: Set up license management database
- [ ] Extension: Implement license manager
- [ ] Extension: Add paywall UI
- [ ] Extension: Feature gating for all premium features
- [ ] Extension: Update manifest for Chrome Web Store
- [ ] Extension: Create onboarding flow
- [ ] Testing: Full trial → paid flow
- [ ] Testing: License validation (online/offline)
- [ ] Testing: All feature gates
- [ ] Legal: Privacy policy update
- [ ] Legal: Terms of service update
- [ ] Marketing: Store listing assets

### Chrome Web Store Submission

- [ ] Create Chrome Web Store developer account ($5 fee)
- [ ] Upload extension ZIP
- [ ] Fill out store listing (description, screenshots)
- [ ] Set pricing (free with in-app purchases)
- [ ] Submit for review (allow 3-5 business days)

### Post-Launch

- [ ] Monitor conversion funnel
- [ ] Track error rates
- [ ] Respond to user feedback
- [ ] A/B test pricing and features
- [ ] Weekly performance review

---

## 📝 Development Timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1-2 | Auth & Licensing | Backend API, License Manager, JWT auth |
| 2-3 | Cloud Journal | Events API, Reports API, Storage |
| 3-4 | Feature Gating | Paywall UI, Feature checks, Local storage |
| 4-5 | Stripe Integration | Checkout, Webhooks, Subscription management |
| 5-6 | Chrome Store Prep | Manifest, Assets, Store listing |
| 6-7 | Testing & QA | Full flow testing, Bug fixes |
| 7-8 | Launch | Submit to store, Marketing, Monitoring |

---

## 💡 Future Enhancements

### Phase 2 (Post-Launch)

1. **Browser Support**: Firefox, Edge extensions
2. **Mobile App**: React Native companion app
3. **More Exchanges**: Bybit, OKX, Kraken overlays
4. **Social Features**: Leaderboards, strategy sharing
5. **Advanced AI**: Custom model training per user
6. **API Access**: REST API for power users

### Revenue Optimization

1. **Referral Program**: $5 credit for referrals
2. **Annual Discounts**: Promote yearly billing
3. **Team Plans**: Enterprise/team pricing
4. **Affiliate Program**: 20% commission for affiliates

---

## ❓ FAQ for Development

### Q: Can we use LenQuant backend for standalone users?

**A:** Yes, but we'll create a "LenQuant Lite" tier of endpoints specifically for extension users:
- `/api/ext-auth/*` - Authentication & licensing
- `/api/ext-journal/*` - Lightweight journal
- `/api/ext-explain/*` - AI explanations (metered)
- All other analysis uses public Binance API + client-side calculation

### Q: What about journal, reports, etc. without Binance API?

**A:** Standalone mode supports:
- **Local journal**: Events stored in browser (IndexedDB/chrome.storage)
- **Cloud journal** (Pro+): Events synced to LenQuant Lite backend
- **Analysis-based reports**: Based on viewed charts, not actual trades
- **Trade sync** (Premium only): Users can optionally add read-only Binance API keys

### Q: What do users need to configure?

**Minimal setup (Free/Trial):**
1. Install extension
2. Enter email for trial
3. Open Binance Futures → works immediately

**Full setup (Pro/Premium):**
1. Subscribe via Stripe
2. (Optional) Add Binance API keys for trade sync
3. (Optional) Configure notification preferences

### Q: How does this affect existing LenQuant platform users?

**A:** Platform users get the extension **free** as part of their subscription:
- Existing auth flows continue to work
- Full backend integration remains available
- No paywall for any features
- Extension detects platform subscription automatically

---

## 📞 Support & Escalation

**Technical Issues:**
- Extension bugs: GitHub Issues
- Backend API: Backend on-call

**Billing Issues:**
- Stripe dashboard for refunds
- support@lenquant.com for disputes

**User Success:**
- In-extension help chat
- Knowledge base articles
- Video tutorials

---

*Document maintained by LenQuant Team. Last updated: January 2026*

