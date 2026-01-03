# Phase 4: Stripe Integration & Feature Gating

**Duration:** Days 5-7
**Priority:** HIGH
**Status:** ✅ Completed

---

## 🎯 Objectives

1. **Create Stripe checkout flow** - Generate checkout sessions for Pro/Premium plans
2. **Handle Stripe webhooks** - Process subscription events (created, canceled, renewed)
3. **Implement feature gating** - Block Pro features for free/expired users
4. **Add upgrade prompts** - Show paywall when accessing locked features

---

## 📋 Prerequisites

- [x] Phase 3 completed (authentication working)
- [ ] Stripe account created (test mode)
- [ ] Products configured in Stripe Dashboard
- [x] Environment variables set

---

## 🔨 Implementation Tasks

### Task 4.1: Configure Stripe Products ✅

**Stripe Dashboard Setup:**

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → Products
2. Create products:

| Product | Price ID Pattern | Monthly | Yearly |
|---------|------------------|---------|--------|
| LenQuant Pro | `price_pro_monthly`, `price_pro_yearly` | $19.99 | $149.00 |
| LenQuant Premium | `price_premium_monthly`, `price_premium_yearly` | $39.99 | $299.00 |

3. Note down the Price IDs

**Environment Variables:**

```bash
# Add to .env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Price IDs from Stripe Dashboard
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_YEARLY=price_xxx
STRIPE_PRICE_PREMIUM_MONTHLY=price_xxx
STRIPE_PRICE_PREMIUM_YEARLY=price_xxx

# URLs
STRIPE_SUCCESS_URL=https://lenquant.com/extension/payment-success
STRIPE_CANCEL_URL=https://lenquant.com/extension/payment-canceled
```

---

### Task 4.2: Create Stripe Integration Module ✅

**File:** `api/routes/ext_stripe.py` (NEW)

```python
"""
Stripe integration for Chrome extension payments.

Provides:
- Checkout session creation
- Subscription management
- Webhook handling
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import stripe
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr

from db.client import get_database_name, mongo_client

logger = logging.getLogger(__name__)

router = APIRouter()

# Configure Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# Configuration
COLLECTION = "extension_users"
PRICE_MAP = {
    "pro_monthly": os.getenv("STRIPE_PRICE_PRO_MONTHLY"),
    "pro_yearly": os.getenv("STRIPE_PRICE_PRO_YEARLY"),
    "premium_monthly": os.getenv("STRIPE_PRICE_PREMIUM_MONTHLY"),
    "premium_yearly": os.getenv("STRIPE_PRICE_PREMIUM_YEARLY"),
}

PLAN_TO_TIER = {
    "pro_monthly": "pro",
    "pro_yearly": "pro",
    "premium_monthly": "premium",
    "premium_yearly": "premium",
}

SUCCESS_URL = os.getenv("STRIPE_SUCCESS_URL", "https://lenquant.com/extension/payment-success")
CANCEL_URL = os.getenv("STRIPE_CANCEL_URL", "https://lenquant.com/extension/payment-canceled")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")


def _utcnow() -> datetime:
    return datetime.utcnow().replace(tzinfo=timezone.utc)


# ============================================================================
# Request/Response Models
# ============================================================================


class CheckoutRequest(BaseModel):
    """Request to create checkout session."""
    email: str
    device_id: str
    plan: str  # pro_monthly, pro_yearly, premium_monthly, premium_yearly


class CheckoutResponse(BaseModel):
    """Checkout session response."""
    checkout_url: str
    session_id: str


class PortalRequest(BaseModel):
    """Request to access billing portal."""
    email: str
    device_id: str


class PortalResponse(BaseModel):
    """Billing portal response."""
    portal_url: str


# ============================================================================
# Checkout & Portal
# ============================================================================


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout_session(payload: CheckoutRequest) -> Dict[str, Any]:
    """
    Create Stripe checkout session for subscription.
    
    Returns URL to redirect user to Stripe-hosted checkout.
    """
    if not stripe.api_key:
        raise HTTPException(500, "Stripe not configured")
    
    if payload.plan not in PRICE_MAP:
        raise HTTPException(400, f"Invalid plan: {payload.plan}")
    
    price_id = PRICE_MAP[payload.plan]
    if not price_id:
        raise HTTPException(500, f"Price not configured for plan: {payload.plan}")
    
    logger.info("Creating checkout for %s: plan=%s", payload.email, payload.plan)
    
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Find or create customer
        user = db[COLLECTION].find_one({
            "email": payload.email.lower(),
            "device_id": payload.device_id,
        })
        
        if not user:
            raise HTTPException(404, "User not found. Please register first.")
        
        # Get or create Stripe customer
        customer_id = user.get("subscription", {}).get("stripe_customer_id")
        
        if not customer_id:
            # Create Stripe customer
            customer = stripe.Customer.create(
                email=payload.email.lower(),
                metadata={
                    "device_id": payload.device_id,
                    "source": "chrome_extension",
                },
            )
            customer_id = customer.id
            
            # Save customer ID
            db[COLLECTION].update_one(
                {"_id": user["_id"]},
                {"$set": {
                    "subscription.stripe_customer_id": customer_id,
                    "updated_at": _utcnow(),
                }}
            )
        
        # Create checkout session
        try:
            session = stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=["card"],
                line_items=[{
                    "price": price_id,
                    "quantity": 1,
                }],
                mode="subscription",
                success_url=f"{SUCCESS_URL}?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=CANCEL_URL,
                metadata={
                    "email": payload.email.lower(),
                    "device_id": payload.device_id,
                    "plan": payload.plan,
                },
                subscription_data={
                    "metadata": {
                        "email": payload.email.lower(),
                        "device_id": payload.device_id,
                        "plan": payload.plan,
                    },
                },
            )
            
            logger.info("Checkout session created: %s", session.id)
            
            return {
                "checkout_url": session.url,
                "session_id": session.id,
            }
            
        except stripe.error.StripeError as e:
            logger.error("Stripe checkout error: %s", e)
            raise HTTPException(400, f"Payment error: {str(e)}")


@router.post("/portal", response_model=PortalResponse)
def create_portal_session(payload: PortalRequest) -> Dict[str, Any]:
    """
    Create Stripe billing portal session.
    
    Allows users to manage subscription, update payment, cancel.
    """
    if not stripe.api_key:
        raise HTTPException(500, "Stripe not configured")
    
    with mongo_client() as client:
        db = client[get_database_name()]
        
        user = db[COLLECTION].find_one({
            "email": payload.email.lower(),
            "device_id": payload.device_id,
        })
        
        if not user:
            raise HTTPException(404, "User not found")
        
        customer_id = user.get("subscription", {}).get("stripe_customer_id")
        
        if not customer_id:
            raise HTTPException(400, "No billing information found")
        
        try:
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=f"{SUCCESS_URL}?from=portal",
            )
            
            return {"portal_url": session.url}
            
        except stripe.error.StripeError as e:
            logger.error("Stripe portal error: %s", e)
            raise HTTPException(400, f"Portal error: {str(e)}")


@router.get("/subscription")
def get_subscription_status(
    email: str = Query(...),
    device_id: str = Query(...),
) -> Dict[str, Any]:
    """
    Get current subscription status.
    """
    with mongo_client() as client:
        db = client[get_database_name()]
        
        user = db[COLLECTION].find_one({
            "email": email.lower(),
            "device_id": device_id,
        })
        
        if not user:
            raise HTTPException(404, "User not found")
        
        subscription = user.get("subscription", {})
        
        return {
            "tier": user.get("tier", "free"),
            "plan": subscription.get("plan"),
            "status": subscription.get("status"),
            "current_period_end": subscription.get("current_period_end"),
            "cancel_at_period_end": subscription.get("cancel_at_period_end", False),
        }


# ============================================================================
# Webhooks
# ============================================================================


@router.post("/webhook")
async def handle_stripe_webhook(request: Request) -> Dict[str, Any]:
    """
    Handle Stripe webhook events.
    
    Events handled:
    - checkout.session.completed: Subscription created
    - customer.subscription.updated: Subscription changed
    - customer.subscription.deleted: Subscription canceled
    - invoice.payment_succeeded: Payment successful
    - invoice.payment_failed: Payment failed
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    if not WEBHOOK_SECRET:
        logger.warning("Webhook secret not configured")
        # In development, process without signature verification
        try:
            event = stripe.Event.construct_from(
                stripe.util.json.loads(payload), 
                stripe.api_key
            )
        except Exception as e:
            raise HTTPException(400, f"Invalid payload: {e}")
    else:
        # Verify signature
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, WEBHOOK_SECRET
            )
        except stripe.error.SignatureVerificationError:
            logger.error("Invalid webhook signature")
            raise HTTPException(400, "Invalid signature")
        except Exception as e:
            raise HTTPException(400, f"Webhook error: {e}")
    
    logger.info("Stripe webhook received: %s", event.type)
    
    # Handle events
    if event.type == "checkout.session.completed":
        await _handle_checkout_completed(event.data.object)
    
    elif event.type == "customer.subscription.updated":
        await _handle_subscription_updated(event.data.object)
    
    elif event.type == "customer.subscription.deleted":
        await _handle_subscription_deleted(event.data.object)
    
    elif event.type == "invoice.payment_succeeded":
        await _handle_payment_succeeded(event.data.object)
    
    elif event.type == "invoice.payment_failed":
        await _handle_payment_failed(event.data.object)
    
    return {"received": True}


async def _handle_checkout_completed(session: Any) -> None:
    """Handle successful checkout."""
    logger.info("Checkout completed: %s", session.id)
    
    metadata = session.get("metadata", {})
    email = metadata.get("email")
    device_id = metadata.get("device_id")
    plan = metadata.get("plan")
    
    if not email or not plan:
        logger.warning("Missing metadata in checkout session")
        return
    
    tier = PLAN_TO_TIER.get(plan, "pro")
    subscription_id = session.get("subscription")
    customer_id = session.get("customer")
    
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Get subscription details
        sub_details = stripe.Subscription.retrieve(subscription_id) if subscription_id else None
        
        update_data = {
            "tier": tier,
            "subscription.stripe_subscription_id": subscription_id,
            "subscription.stripe_customer_id": customer_id,
            "subscription.plan": plan,
            "subscription.status": "active",
            "subscription.current_period_end": (
                datetime.fromtimestamp(sub_details.current_period_end, tz=timezone.utc)
                if sub_details else None
            ),
            "features": _get_features_for_tier(tier),
            "updated_at": _utcnow(),
        }
        
        result = db[COLLECTION].update_one(
            {"email": email.lower()},
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            logger.info("User %s upgraded to %s", email, tier)
        else:
            logger.warning("User %s not found for upgrade", email)


async def _handle_subscription_updated(subscription: Any) -> None:
    """Handle subscription update."""
    customer_id = subscription.get("customer")
    status = subscription.get("status")
    
    logger.info("Subscription updated: customer=%s status=%s", customer_id, status)
    
    with mongo_client() as client:
        db = client[get_database_name()]
        
        update_data = {
            "subscription.status": status,
            "subscription.current_period_end": datetime.fromtimestamp(
                subscription.current_period_end, tz=timezone.utc
            ),
            "subscription.cancel_at_period_end": subscription.get("cancel_at_period_end", False),
            "updated_at": _utcnow(),
        }
        
        # If subscription not active, downgrade tier
        if status not in ["active", "trialing"]:
            update_data["tier"] = "expired"
            update_data["features"] = _get_features_for_tier("expired")
        
        db[COLLECTION].update_one(
            {"subscription.stripe_customer_id": customer_id},
            {"$set": update_data}
        )


async def _handle_subscription_deleted(subscription: Any) -> None:
    """Handle subscription cancellation."""
    customer_id = subscription.get("customer")
    
    logger.info("Subscription deleted: customer=%s", customer_id)
    
    with mongo_client() as client:
        db = client[get_database_name()]
        
        db[COLLECTION].update_one(
            {"subscription.stripe_customer_id": customer_id},
            {"$set": {
                "tier": "expired",
                "subscription.status": "canceled",
                "features": _get_features_for_tier("expired"),
                "updated_at": _utcnow(),
            }}
        )


async def _handle_payment_succeeded(invoice: Any) -> None:
    """Handle successful payment (renewal)."""
    customer_id = invoice.get("customer")
    logger.info("Payment succeeded: customer=%s", customer_id)
    
    # Subscription will be updated via subscription.updated event


async def _handle_payment_failed(invoice: Any) -> None:
    """Handle failed payment."""
    customer_id = invoice.get("customer")
    logger.warning("Payment failed: customer=%s", customer_id)
    
    # Send notification, subscription.updated will handle status change


def _get_features_for_tier(tier: str) -> list:
    """Get features list for a tier."""
    features = {
        "free": ["basic_analysis"],
        "expired": ["basic_analysis"],
        "trial": ["analysis", "ai_explain", "cloud_journal", "mtf_analysis", "behavioral"],
        "pro": ["analysis", "ai_explain", "cloud_journal", "mtf_analysis", "behavioral"],
        "premium": ["analysis", "ai_explain", "cloud_journal", "mtf_analysis", "behavioral",
                    "trade_sync", "extended_journal", "priority_support"],
    }
    return features.get(tier, ["basic_analysis"])
```

---

### Task 4.3: Register Stripe Routes ✅

**File:** `api/main.py`

```python
# Add to imports
from api.routes import ext_stripe

# Add to router includes
app.include_router(ext_stripe.router, prefix="/api/extension/stripe", tags=["Extension Stripe"])
```

---

### Task 4.4: Add Feature Gating to Extension ✅

**File:** `chrome-extension/feature-gate.js` (NEW)

```javascript
/**
 * Feature gating for LenQuant extension.
 * 
 * Checks user tier before allowing access to Pro features.
 */

class FeatureGate {
  constructor(licenseManager, authUI) {
    this.licenseManager = licenseManager;
    this.authUI = authUI;
  }
  
  /**
   * Check if user can access a feature.
   * Shows paywall if not.
   * 
   * @param {string} feature - Feature to check
   * @param {Function} callback - Called with true if access granted
   * @returns {boolean} - True if user has access
   */
  async checkAccess(feature, callback) {
    // Ensure license is validated
    if (!this.licenseManager.license) {
      await this.licenseManager.init();
    }
    
    // Check if user has feature
    if (this.licenseManager.hasFeature(feature)) {
      if (callback) callback(true);
      return true;
    }
    
    // User doesn't have access - show appropriate UI
    const tier = this.licenseManager.getTier();
    
    if (!tier || tier === 'free' || tier === 'expired') {
      // Show paywall with upgrade options
      this.authUI.showPaywall(feature, async (plan) => {
        // User selected a plan - redirect to checkout
        await this._createCheckout(plan);
      });
    } else if (tier === 'trial') {
      // Trial user - show trial-specific message
      this.authUI.showPaywall(feature, async (plan) => {
        await this._createCheckout(plan);
      });
    }
    
    if (callback) callback(false);
    return false;
  }
  
  /**
   * Wrap a function to require a feature.
   */
  requireFeature(feature, fn) {
    return async (...args) => {
      const hasAccess = await this.checkAccess(feature);
      if (hasAccess) {
        return fn(...args);
      }
      return null;
    };
  }
  
  /**
   * Create checkout session and redirect.
   */
  async _createCheckout(plan) {
    const license = this.licenseManager.license;
    
    if (!license) {
      // Not logged in - show registration first
      this.authUI.showRegistrationModal();
      return;
    }
    
    try {
      const response = await fetch(`${this.licenseManager.apiBaseUrl}/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: license.email,
          device_id: license.device_id,
          plan: plan,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('[LenQuant] Checkout error:', error);
        alert('Failed to create checkout. Please try again.');
        return;
      }
      
      const result = await response.json();
      
      // Open Stripe checkout in new tab
      chrome.tabs.create({ url: result.checkout_url });
      
    } catch (error) {
      console.error('[LenQuant] Checkout error:', error);
      alert('Failed to create checkout. Please try again.');
    }
  }
  
  /**
   * Open billing portal.
   */
  async openBillingPortal() {
    const license = this.licenseManager.license;
    
    if (!license) {
      this.authUI.showRegistrationModal();
      return;
    }
    
    try {
      const response = await fetch(`${this.licenseManager.apiBaseUrl}/stripe/portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: license.email,
          device_id: license.device_id,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('[LenQuant] Portal error:', error);
        alert('No billing information found. Please upgrade first.');
        return;
      }
      
      const result = await response.json();
      chrome.tabs.create({ url: result.portal_url });
      
    } catch (error) {
      console.error('[LenQuant] Portal error:', error);
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FeatureGate };
}
```

---

### Task 4.5: Integrate Feature Gating in Content Script ✅

**File:** `chrome-extension/content.js`

**Update explain button handler:**

```javascript
// In TradingPanel.attachEventListeners()

// Explain button - gated feature
const explainBtn = this.container.querySelector('.lq-btn-explain');
explainBtn.addEventListener('click', async () => {
  // Check feature access
  const hasAccess = await featureGate.checkAccess('ai_explain');
  if (!hasAccess) return;
  
  // Proceed with explanation
  this.requestExplanation();
});
```

**Update panel initialization to show trial banner:**

```javascript
// In init() function, after license validation

if (licenseManager.getTier() === 'trial') {
  const trial = licenseManager.getTrialRemaining();
  if (trial && trial.hours < 72) {
    authUI.showTrialBanner(trial.hours);
  }
}
```

---

### Task 4.6: Add Payment Success Page ✅

**File:** `web/next-app/pages/extension/payment-success/page.tsx` (NEW)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  
  useEffect(() => {
    if (sessionId) {
      // Verify session with backend
      fetch(`/api/extension/stripe/verify-session?session_id=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setStatus('success');
          } else {
            setStatus('error');
          }
        })
        .catch(() => setStatus('error'));
    } else {
      setStatus('success'); // Coming from portal
    }
  }, [sessionId]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
      <div className="bg-gray-800 rounded-2xl p-8 max-w-md text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white">Processing...</h1>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-2xl font-bold text-white mb-2">Welcome to LenQuant Pro!</h1>
            <p className="text-gray-400 mb-6">
              Your subscription is now active. Return to the extension to start using Pro features.
            </p>
            <div className="bg-gray-700 rounded-lg p-4 text-left">
              <h3 className="text-yellow-500 font-semibold mb-2">What's next?</h3>
              <ul className="text-gray-300 text-sm space-y-2">
                <li>✅ AI-powered trade explanations</li>
                <li>✅ Multi-timeframe confluence</li>
                <li>✅ Cloud journal (30 days)</li>
                <li>✅ Behavioral guardrails</li>
              </ul>
            </div>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-gray-400 mb-6">
              Please contact support if you were charged but don't see Pro features activated.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
```

---

## ✅ Test Cases

### Test 4.1: Checkout Session Creation

```bash
# Create checkout session (use real user from registration)
curl -X POST "http://localhost:8000/api/extension/stripe/checkout" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "device_id": "dev_xxx", "plan": "pro_monthly"}' \
  | python -m json.tool

# Expected: checkout_url starts with https://checkout.stripe.com
```

### Test 4.2: Webhook Handling

```bash
# Use Stripe CLI to test webhooks
stripe listen --forward-to localhost:8000/api/extension/stripe/webhook

# In another terminal, trigger a test event
stripe trigger checkout.session.completed

# Check user was upgraded
python -c "
from db.client import get_database_name, mongo_client
with mongo_client() as client:
    db = client[get_database_name()]
    user = db['extension_users'].find_one({'email': 'test@example.com'})
    print(f\"Tier: {user.get('tier')}\")
    print(f\"Status: {user.get('subscription', {}).get('status')}\")
"
```

### Test 4.3: Feature Gating in Extension

```javascript
// Manual test in browser console

// Should return false and show paywall
await featureGate.checkAccess('ai_explain');

// Verify paywall appeared
document.querySelector('.lq-paywall-modal') !== null // Should be true
```

---

## 📊 Validation Criteria

| Criteria | Target | Validation Method |
|----------|--------|-------------------|
| Checkout creates Stripe session | Yes | Check response URL |
| Webhook upgrades user tier | Yes | Query DB after webhook |
| Feature gate blocks free users | Yes | Test explain button |
| Paywall shows upgrade options | Yes | Visual inspection |
| Portal access works | Yes | Test billing portal |

---

## 📁 Files Created/Modified ✅

| File | Type | Description |
|------|------|-------------|
| `api/routes/ext_stripe.py` | NEW ✅ | Stripe endpoints |
| `api/main.py` | MODIFY ✅ | Include Stripe router |
| `chrome-extension/feature-gate.js` | NEW ✅ | Client-side feature gating |
| `chrome-extension/content.js` | MODIFY ✅ | Add feature checks |
| `web/next-app/pages/extension/payment-success/page.tsx` | NEW ✅ | Payment success page |
| `requirements.txt` | MODIFY ✅ | Add Stripe dependency |
| `env.example` | MODIFY ✅ | Add Stripe keys |
| `chrome-extension/manifest.json` | MODIFY ✅ | Include feature gating scripts |

---

## 🔗 Next Phase Prerequisites ✅

Phase 5 requires:
- [x] Checkout flow working end-to-end
- [x] Webhook processing verified
- [x] Feature gating blocking correctly
- [ ] Upgrade flow tested in Stripe test mode

---

*Complete this phase before moving to Phase 5: UI/UX Polish & Multi-Timeframe Analysis*

