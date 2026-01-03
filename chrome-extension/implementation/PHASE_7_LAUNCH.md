# Phase 7: Chrome Store Submission & Launch

**Duration:** Days 10-12  
**Priority:** CRITICAL  
**Status:** Not Started

---

## 🎯 Objectives

1. **Prepare Chrome Store assets** - Icons, screenshots, descriptions
2. **Create privacy policy** - Required for Chrome Web Store
3. **Submit extension** - Complete Chrome Web Store listing
4. **Configure production** - Stripe live mode, production URLs
5. **Launch marketing** - Execute from MARKETING_LAUNCH_PLAN.md

---

## 📋 Prerequisites

- [ ] Phase 6 completed (all tests passing)
- [ ] All critical bugs fixed
- [ ] Stripe account with products ready
- [ ] Domain (lenquant.com) accessible
- [ ] Google Developer Account ($5 fee)

---

## 🔨 Implementation Tasks

### Task 7.1: Create Chrome Store Assets

#### Icons (Already Exist)

Verify icons exist and are correct:

```
chrome-extension/icons/
├── icon16.png   (16x16)
├── icon48.png   (48x48)
└── icon128.png  (128x128)
```

**Icon Requirements:**
- PNG format
- Square dimensions
- No transparency issues
- Clear at small sizes

#### Screenshots (Create 5)

**File locations:** Create `chrome-extension/store-assets/`

| Screenshot | Content | Size |
|------------|---------|------|
| `screenshot-1.png` | Main panel with trending market, grade A | 1280x800 |
| `screenshot-2.png` | Leverage recommendation with warning | 1280x800 |
| `screenshot-3.png` | AI explanation panel open | 1280x800 |
| `screenshot-4.png` | Behavioral alert showing | 1280x800 |
| `screenshot-5.png` | Settings/options page | 1280x800 |

**Screenshot Tips:**
- Use real Binance Futures page as background
- Show extension panel in action
- Highlight key features
- Use consistent symbol (BTC/USDT)
- Clean browser (no other extensions visible)

#### Promotional Images

| Image | Size | Purpose |
|-------|------|---------|
| `promo-small.png` | 440x280 | Small tile |
| `promo-large.png` | 1400x560 | Marquee (optional) |

---

### Task 7.2: Write Store Listing Copy

**File:** `chrome-extension/store-assets/listing.md`

```markdown
# Chrome Web Store Listing

## Extension Name
LenQuant - Trading Assistant for Binance Futures

## Short Description (132 characters max)
Real-time market regime analysis for Binance Futures. Leverage recommendations, AI explanations, behavioral guardrails.

## Detailed Description

🎯 OBJECTIVE MARKET ANALYSIS FOR BINANCE FUTURES

Stop trading on emotion. Get objective market conditions before every trade.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 REAL-TIME REGIME ANALYSIS
• Market state: Trending / Ranging / Choppy
• Trend direction with confidence scoring
• Volatility regime classification
• Works for ANY Binance Futures symbol

⚡ LEVERAGE RECOMMENDATIONS
• Regime-aware leverage bands
• Warns when your leverage is too high
• Adjusts recommendations based on volatility

🧠 AI-POWERED EXPLANATIONS (Pro)
• Click "Explain" for detailed trade context
• Powered by  GPT-5 / Gemini
• Entry considerations, risk factors, setup quality

🛡️ BEHAVIORAL GUARDRAILS
• Tracks your trading frequency
• Detects overtrading patterns
• Suggests breaks when you're tilted

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ FREE 3-DAY TRIAL — No credit card required
✅ No Binance API keys needed for analysis
✅ Works instantly on Binance Futures pages

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ DISCLAIMER: This is a decision support tool, not a signal service. It does not guarantee profits or make trading decisions for you. Trade responsibly.

## Category
Productivity

## Language
English

## Primary Regions
All Regions
```

---

### Task 7.3: Create Privacy Policy

**File:** `web/next-app/app/privacy/page.tsx` (or static HTML)

Host at: `https://lenquant.com/privacy`

```markdown
# Privacy Policy for LenQuant Chrome Extension

Last Updated: January 2026

## Introduction

LenQuant ("we", "our", or "us") operates the LenQuant Chrome Extension. This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Extension.

## Information We Collect

### Information You Provide
- **Email Address**: When you register for an account, we collect your email address for account management and communication.

### Information Collected Automatically
- **Device Identifier**: A randomly generated identifier to manage your license across sessions.
- **Usage Data**: We collect information on how you use the Extension, including:
  - Symbols analyzed
  - Features used (analysis, explanations, bookmarks)
  - Session duration
  - Error logs

### Information from Third Parties
- **Binance Public Data**: We fetch publicly available market data from Binance APIs. We do not access your Binance account or API keys for core analysis features.

## How We Use Your Information

- To provide and maintain our Extension
- To manage your account and subscription
- To provide customer support
- To improve our services
- To detect and prevent fraud

## Data Retention

- Account data is retained while your account is active
- Usage data is retained for 90 days
- You may request deletion of your data at any time

## Data Sharing

We do not sell your personal information. We may share data with:
- **Payment Processors**: Stripe processes payments; see their privacy policy.
- **Analytics Providers**: Anonymized usage data may be shared for analytics.
- **Legal Requirements**: When required by law.

## Your Rights

You have the right to:
- Access your personal data
- Correct inaccurate data
- Delete your data
- Export your data
- Opt out of marketing communications

## Security

We implement industry-standard security measures to protect your data. However, no method of transmission over the Internet is 100% secure.

## Children's Privacy

Our Extension is not intended for users under 18 years of age.

## Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page.

## Contact Us

If you have any questions about this Privacy Policy, please contact us at:
- Email: privacy@lenquant.com
- Website: https://lenquant.com/contact
```

---

### Task 7.4: Update Manifest for Production

**File:** `chrome-extension/manifest.json`

```json
{
  "manifest_version": 3,
  "name": "LenQuant - Trading Assistant for Binance Futures",
  "version": "1.0.0",
  "description": "Real-time market regime analysis, leverage recommendations, AI explanations, and behavioral guardrails for Binance Futures traders.",
  
  "permissions": [
    "activeTab",
    "scripting",
    "storage"
  ],
  
  "host_permissions": [
    "https://www.binance.com/*",
    "https://fapi.binance.com/*",
    "https://api.binance.com/*",
    "https://api.coingecko.com/*",
    "https://lenquant.com/*",
    "https://www.lenquant.com/*"
  ],
  
  "background": {
    "service_worker": "background.js"
  },
  
  "content_scripts": [
    {
      "matches": [
        "https://www.binance.com/*/futures/*",
        "https://www.binance.com/en/futures/*"
      ],
      "js": ["license-manager.js", "auth-ui.js", "feature-gate.js", "binance-api.js", "content.js"],
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

---

### Task 7.5: Configure Production Environment

**Server Configuration:**

```bash
# Production environment variables
export ENVIRONMENT=production

# API URLs
export API_BASE_URL=https://lenquant.com/api

# Stripe (Live mode)
export STRIPE_SECRET_KEY=sk_live_xxx
export STRIPE_PUBLISHABLE_KEY=pk_live_xxx
export STRIPE_WEBHOOK_SECRET=whsec_live_xxx

# Stripe Price IDs (Live)
export STRIPE_PRICE_PRO_MONTHLY=price_live_xxx
export STRIPE_PRICE_PRO_YEARLY=price_live_xxx
export STRIPE_PRICE_PREMIUM_MONTHLY=price_live_xxx
export STRIPE_PRICE_PREMIUM_YEARLY=price_live_xxx

# URLs
export STRIPE_SUCCESS_URL=https://lenquant.com/extension/payment-success
export STRIPE_CANCEL_URL=https://lenquant.com/extension/payment-canceled

# Trial
export EXT_TRIAL_DAYS=3
export EXT_LICENSE_SECRET=<generate-strong-secret>
```

**Update Extension Default URLs:**

```javascript
// In background.js, update DEFAULT_CONFIG
const DEFAULT_CONFIG = {
  API_BASE_URL: 'https://lenquant.com/api/extension',
  WS_URL: 'wss://lenquant.com/ws/extension',
  // ... rest of config
};
```

---

### Task 7.6: Chrome Web Store Submission

#### Step 1: Create Developer Account

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay $5 one-time registration fee
3. Complete developer profile

#### Step 2: Package Extension

```bash
cd chrome-extension

# Create zip file (exclude development files)
zip -r lenquant-extension.zip . \
  -x "*.md" \
  -x "tests/*" \
  -x "store-assets/*" \
  -x "implementation/*" \
  -x ".git/*" \
  -x "*.log"

# Verify zip contents
unzip -l lenquant-extension.zip
```

#### Step 3: Submit Extension

1. Go to Developer Dashboard
2. Click "Add new item"
3. Upload `lenquant-extension.zip`
4. Fill in listing information:
   - Name, description, category
   - Upload screenshots
   - Add privacy policy URL
   - Select regions/languages
5. Submit for review

#### Step 4: Review Process

- **Typical review time**: 1-7 days (usually 2-3)
- **Common rejection reasons**:
  - Missing privacy policy
  - Insufficient permissions justification
  - Trademark issues in name/description
  - Malicious code detection (false positives)

**If rejected:**
1. Read rejection reason carefully
2. Make required changes
3. Resubmit with explanation

---

### Task 7.7: Launch Checklist

**Pre-Launch (Day before):**

- [ ] Extension approved in Chrome Web Store
- [ ] Production backend deployed
- [ ] Stripe live mode activated
- [ ] Privacy policy live at lenquant.com/privacy
- [ ] All social accounts ready
- [ ] Demo video uploaded
- [ ] Landing page updated

**Launch Day:**

- [ ] Verify extension installable from store
- [ ] Test full flow: install → register → analyze → explain
- [ ] Test payment flow with real card (refund after)
- [ ] Announce on Twitter
- [ ] Post on Reddit (r/SideProject)
- [ ] Notify Discord communities
- [ ] Email beta testers for reviews

**Post-Launch (Day 1-3):**

- [ ] Monitor error logs
- [ ] Respond to all reviews
- [ ] Track conversion metrics
- [ ] Fix any critical bugs immediately
- [ ] Document common issues/questions

---

## 📊 Launch Metrics Dashboard

Track these metrics post-launch:

| Metric | Day 1 | Day 7 | Day 30 | Target |
|--------|-------|-------|--------|--------|
| Installs | - | - | - | 100 (wk1) |
| Trial signups | - | - | - | 60 (wk1) |
| Paid conversions | - | - | - | 6 (wk1) |
| Conversion rate | - | - | - | 10% |
| Avg rating | - | - | - | 4.5★ |
| DAU | - | - | - | 50 |

---

## 📁 Files Created/Modified

| File | Description |
|------|-------------|
| `chrome-extension/store-assets/listing.md` | Store listing copy |
| `chrome-extension/store-assets/screenshots/` | 5 screenshots |
| `web/next-app/app/privacy/page.tsx` | Privacy policy page |
| `chrome-extension/manifest.json` | Updated for production |
| `.env.production` | Production environment |

---

## 🚀 Post-Launch Roadmap (Next 2 Months)

### Week 1-2: Stabilization
- Fix bugs from user feedback
- Respond to all reviews
- Gather feature requests

### Week 3-4: Iteration
- Implement top-requested features
- Improve analysis accuracy based on feedback
- Add more symbols to ingestion

### Month 2: Growth
- Add referral program
- Create tutorial content
- Explore partnerships

### Future: LenQuant Platform
- Integrate extension insights into main platform
- Add portfolio tracking
- Expand to other exchanges

---

## ✅ Final Checklist

Before marking launch complete:

- [ ] Extension live in Chrome Web Store
- [ ] First paid subscriber confirmed
- [ ] No critical bugs open
- [ ] Support channels active
- [ ] Analytics tracking working
- [ ] Backup/recovery plan in place

---

*Congratulations on launching! Now focus on user feedback and iteration.*

