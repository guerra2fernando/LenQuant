# Phase 6 Testing Setup Guide

**Status:** Complete ✅
**Last Updated:** January 3, 2026

---

## 🎯 Overview

This guide walks you through setting up everything needed to test the LenQuant Chrome Extension end-to-end. You'll configure Stripe, set up your environment, load test data, and run comprehensive tests.

**Time Estimate:** 2-3 hours
**Prerequisites:** Phases 1-5 completed

---

## 📋 Checklist

### [ ] Step 1: Stripe Configuration
### [ ] Step 2: Environment Setup
### [ ] Step 3: Database Setup
### [ ] Step 4: Test Data Ingestion
### [ ] Step 5: Extension Loading
### [ ] Step 6: Backend Validation
### [ ] Step 7: Run Tests

---

## 🛠️ Step 1: Stripe Configuration

### 1.1 Create Stripe Account

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Create account (use test mode)
3. Complete onboarding process

### 1.2 Configure Products

Navigate to **Products** → **Create Product**

#### Product 1: LenQuant Pro
```
Name: LenQuant Pro
Description: Professional trading analysis with AI explanations and multi-timeframe analysis

Pricing:
- Monthly: $19.99/month
- Yearly: $149.00/year
```

#### Product 2: LenQuant Premium
```
Name: LenQuant Premium
Description: Everything in Pro plus trade sync and extended journal

Pricing:
- Monthly: $39.99/month
- Yearly: $299.00/year
```

### 1.3 Get API Keys

Go to **Developers** → **API Keys**

```
Publishable Key: pk_test_... (starts with pk_test_)
Secret Key: sk_test_... (starts with sk_test_)
```

### 1.4 Setup Webhooks

Go to **Developers** → **Webhooks**

**Add Endpoint:**
- URL: `https://your-domain.com/api/extension/stripe/webhook` (or `http://localhost:8000/api/extension/stripe/webhook` for local)
- Events to select:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

**Get Webhook Secret:**
- After creating webhook, click to reveal the **Signing Secret** (starts with `whsec_`)

### 1.5 Note Price IDs

Go to **Products** → Select each product → **Pricing**

**Copy the Price IDs** (format: `price_xxx`)

---

## 🔧 Step 2: Environment Setup

### 2.1 Generate Required Secrets

```bash
# Generate encryption key for API credentials
python -c 'import secrets; print(secrets.token_hex(32))'
# Output: something like "a1b2c3d4e5f6..."

# Generate JWT secret
python -c 'import secrets; print(secrets.token_hex(32))'
# Output: another hex string

# Generate license secret for extension
python -c 'import secrets; print(secrets.token_hex(16))'
# Output: shorter hex string
```

### 2.2 Create .env File

```bash
cp env.example .env
```

Edit `.env` with your values:

```bash
# MongoDB Configuration
MONGO_URI=mongodb://admin:CHANGE_THIS_PASSWORD@localhost:27017/lenquant?authSource=admin
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=YOUR_STRONG_PASSWORD_HERE

# Exchange API Keys (leave empty for extension testing)
BINANCE_API_KEY=
BINANCE_API_SECRET=

# Encryption key (CRITICAL - use generated value)
EXCHANGE_API_ENCRYPTION_KEY=YOUR_GENERATED_32_CHAR_HEX

# Default symbols (will be ingested)
DEFAULT_SYMBOLS=BTC/USDT,ETH/USDT,SOL/USDT,BNB/USDT

# Redis (if using)
REDIS_PASSWORD=YOUR_REDIS_PASSWORD

# LLM Configuration (required for AI explanations)
ASSISTANT_LLM_PROVIDER=openai
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_MODEL= GPT-5o-mini

# Google OAuth (for extension auth)
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET

# JWT Configuration
JWT_SECRET_KEY=YOUR_GENERATED_JWT_SECRET
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=60

# Admin token
SYSTEM_ADMIN_TOKEN=YOUR_STRONG_ADMIN_TOKEN

# Stripe Configuration (from Step 1)
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# Stripe Price IDs (from Step 1.5)
STRIPE_PRICE_PRO_MONTHLY=price_YOUR_PRO_MONTHLY_ID
STRIPE_PRICE_PRO_YEARLY=price_YOUR_PRO_YEARLY_ID
STRIPE_PRICE_PREMIUM_MONTHLY=price_YOUR_PREMIUM_MONTHLY_ID
STRIPE_PRICE_PREMIUM_YEARLY=price_YOUR_PREMIUM_YEARLY_ID

# Stripe URLs (update for your domain)
STRIPE_SUCCESS_URL=https://yourdomain.com/extension/payment-success
STRIPE_CANCEL_URL=https://yourdomain.com/extension/payment-canceled

# Extension Configuration
EXT_LICENSE_SECRET=YOUR_GENERATED_LICENSE_SECRET
EXT_TRIAL_DAYS=3
```

### 2.3 Validate Environment

```bash
# Test environment loading
python -c "
import os
from dotenv import load_dotenv
load_dotenv()

# Check critical variables
required = [
    'MONGO_URI', 'JWT_SECRET_KEY', 'STRIPE_SECRET_KEY',
    'STRIPE_PRICE_PRO_MONTHLY', 'EXT_LICENSE_SECRET',
    'OPENAI_API_KEY', 'EXCHANGE_API_ENCRYPTION_KEY'
]

missing = [k for k in required if not os.getenv(k)]
if missing:
    print('❌ Missing required env vars:', missing)
    exit(1)
else:
    print('✅ All required environment variables set')
"
```

---

## 🗄️ Step 3: Database Setup

### 3.1 Start MongoDB

```bash
# Using Docker (recommended)
docker run -d \
  --name lenquant-mongo \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=YOUR_STRONG_PASSWORD \
  -v lenquant_data:/data/db \
  mongo:6.0

# Or using Docker Compose
docker-compose up -d mongo
```

### 3.2 Verify MongoDB Connection

```bash
# Test connection
python -c "
from db.client import mongo_client
try:
    with mongo_client() as client:
        db = client.server_info()
        print('✅ MongoDB connected')
except Exception as e:
    print('❌ MongoDB connection failed:', e)
    exit(1)
"
```

### 3.3 Clean Database (Optional)

If you have old test data:

```bash
python scripts/clean_database_for_fresh_start.py
# Type "DELETE" when prompted
```

---

## 📊 Step 4: Test Data Ingestion

### 4.1 Ingest Test Symbols

```bash
# Run data ingestion for test symbols
python -m data_ingest.tasks ingest_symbol --symbol BTC/USDT --timeframe 1h --days 30
python -m data_ingest.tasks ingest_symbol --symbol ETH/USDT --timeframe 1h --days 30
python -m data_ingest.tasks ingest_symbol --symbol SOL/USDT --timeframe 1h --days 30
python -m data_ingest.tasks ingest_symbol --symbol BNB/USDT --timeframe 1h --days 30
```

### 4.2 Verify Data Ingestion

```bash
# Check ingested data
python -c "
from db.client import get_database_name, mongo_client

with mongo_client() as client:
    db = client[get_database_name()]
    
    # Check symbols
    symbols = list(db['symbols'].find({}, {'symbol': 1}))
    print(f'✅ Symbols in DB: {[s[\"symbol\"] for s in symbols]}')
    
    # Check OHLCV data
    for symbol in ['BTC/USDT', 'ETH/USDT']:
        count = db['ohlcv'].count_documents({'symbol': symbol})
        print(f'✅ {symbol}: {count:,} candles')
"
```

### 4.3 Train Test Models

```bash
# Train models for test symbols (this takes time)
python -m models.train_horizon --symbol BTC/USDT --horizon 1h --algorithm lgbm --promote
python -m models.train_horizon --symbol ETH/USDT --horizon 1h --algorithm lgbm --promote
python -m models.train_horizon --symbol SOL/USDT --horizon 1h --algorithm lgbm --promote
```

---

## 🌐 Step 5: Extension Loading

### 5.1 Load Extension in Chrome

1. Open Chrome
2. Go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `chrome-extension/` folder

### 5.2 Verify Extension Loaded

1. Check extension appears in list
2. Click extension icon in toolbar
3. Verify popup opens
4. Check for console errors: Right-click extension → **Inspect** → Console tab

### 5.3 Update Manifest (if needed)

Check `chrome-extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "LenQuant",
  "version": "3.0",
  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "identity"
  ],
  "host_permissions": [
    "https://lenquant.com/*",
    "https://fapi.binance.com/*",
    "https://accounts.google.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["https://www.binance.com/*", "https://www.binance.us/*"],
    "js": ["content.js"],
    "css": ["panel.css"]
  }],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "48": "icons/icon48.png"
    }
  },
  "oauth2": {
    "client_id": "YOUR_GOOGLE_CLIENT_ID",
    "scopes": ["email", "profile", "openid"]
  }
}
```

### 5.4 Test Extension Popup

1. Click extension icon
2. Verify popup shows
3. Check "Open Panel" button works
4. Panel should appear on Binance Futures page

---

## 🚀 Step 6: Backend Validation

### 6.1 Start Backend Server

```bash
# Install dependencies
pip install -r requirements.txt

# Start server
uvicorn api.main:app --reload --port 8000
```

### 6.2 Test Backend Health

```bash
# Test basic connectivity
curl http://localhost:8000/health
# Expected: {"status": "healthy"}

# Test extension context endpoint
curl "http://localhost:8000/api/extension/context?symbol=BTCUSDT&timeframe=1m"
# Should return analysis data
```

### 6.3 Test Extension Auth Endpoints

```bash
# Test email registration
curl -X POST http://localhost:8000/api/extension/auth/email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "device_fingerprint": "test"}'

# Should return success with device_id and license_token
```

### 6.4 Test Stripe Endpoints

```bash
# Test Stripe checkout (needs valid user first)
# Use device_id from previous step
curl -X POST http://localhost:8000/api/extension/stripe/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "device_id": "dev_xxx",
    "plan": "pro_monthly"
  }'
```

### 6.5 Setup Webhook Forwarding (Local Testing)

```bash
# Install Stripe CLI
# Download from https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:8000/api/extension/stripe/webhook
```

---

## 🧪 Step 7: Run Tests

### 7.1 Install Test Dependencies

```bash
pip install pytest pytest-asyncio requests stripe
```

### 7.2 Run Backend API Tests

```bash
# Test extension APIs
pytest tests/test_extension_api.py -v

# Test Stripe integration
pytest tests/test_stripe_integration.py -v
```

### 7.3 Manual Extension Testing

#### Test Authentication Flow
1. Open extension panel on Binance Futures
2. Click "Sign In" 
3. Try both Google OAuth and Email registration
4. Verify trial starts (3 days)
5. Check license validation works

#### Test Feature Gating
1. Try to use AI Explain feature
2. Should show paywall for free/trial users
3. Click upgrade → should redirect to Stripe checkout
4. Complete test payment → should upgrade account

#### Test Analysis Features
1. Navigate to BTC/USDT chart
2. Extension should show analysis panel
3. Test different timeframes (1m, 5m, 1h)
4. Verify ephemeral analysis works for unknown symbols

#### Test MTF Analysis
1. Click MTF button in panel
2. Should show confluence across timeframes
3. Test with different symbols

### 7.4 Performance Testing

```bash
# Test response times
python -c "
import time
import requests

url = 'http://localhost:8000/api/extension/context'
params = {'symbol': 'BTCUSDT', 'timeframe': '1m'}

times = []
for i in range(10):
    start = time.time()
    response = requests.get(url, params=params)
    end = time.time()
    times.append((end - start) * 1000)
    assert response.status_code == 200

avg_time = sum(times) / len(times)
print(f'Average response time: {avg_time:.1f}ms')
assert avg_time < 1000, f'Too slow: {avg_time}ms'
print('✅ Performance test passed')
"
```

### 7.5 Cross-Browser Testing

1. **Chrome**: Primary testing done
2. **Edge**: Load extension, test functionality  
3. **Brave**: Load extension, test functionality
4. **Firefox**: Would need WebExtension format (future)

---

## 🔍 Troubleshooting

### Common Issues

#### Extension Not Loading
```bash
# Check manifest syntax
python -c "import json; json.load(open('chrome-extension/manifest.json'))"
```

#### Stripe Webhooks Not Working
```bash
# Check webhook secret in .env
echo $STRIPE_WEBHOOK_SECRET

# Test webhook manually
stripe trigger checkout.session.completed
```

#### Database Connection Issues
```bash
# Test MongoDB connection
python -c "
from pymongo import MongoClient
client = MongoClient('mongodb://admin:password@localhost:27017/lenquant?authSource=admin')
print('Connected:', client.server_info()['version'])
"
```

#### Extension Auth Failing
```bash
# Check Google Client ID
curl "https://oauth2.googleapis.com/tokeninfo?id_token=YOUR_TEST_TOKEN"

# Check license secret
echo $EXT_LICENSE_SECRET
```

---

## 📊 Validation Checklist

### Backend
- [ ] MongoDB connected
- [ ] All environment variables set
- [ ] Server starts without errors
- [ ] Extension endpoints respond
- [ ] Stripe endpoints work

### Extension  
- [ ] Loads in Chrome without errors
- [ ] Panel appears on Binance
- [ ] Authentication works
- [ ] Feature gating blocks correctly
- [ ] Payment flow completes

### Data
- [ ] Test symbols ingested (BTC, ETH, SOL)
- [ ] Models trained and promoted
- [ ] Analysis returns valid data
- [ ] Ephemeral analysis works

### Testing
- [ ] API tests pass
- [ ] Manual testing complete
- [ ] Performance within limits
- [ ] Cross-browser compatible

---

## 🚀 Next Steps

Once all tests pass:

1. **Phase 7: Launch Preparation**
   - Update production URLs
   - Configure production Stripe
   - Submit to Chrome Web Store
   - Go live!

2. **Post-Launch Monitoring**
   - Monitor error rates
   - Track conversion funnels
   - Handle support tickets

---

**Need Help?** Check the troubleshooting section or refer to individual phase documentation for specific issues.

*Happy testing! 🧪*</contents>
</xai:function_call {
