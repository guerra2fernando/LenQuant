# LenQuant Chrome Extension Implementation Plan

**Version:** 3.0  
**Duration:** 10-14 Days  
**Goal:** Launch monetized Chrome extension on Chrome Web Store

---

## 📋 Overview

This directory contains detailed implementation plans for completing and launching the LenQuant Chrome Extension. Each phase is a self-contained document with:

- Specific objectives
- Prerequisites
- Detailed implementation tasks with code
- Test cases (real data, no mocks)
- Validation criteria
- Files to create/modify

---

## 🗂️ Phase Documents

| Phase | Document | Duration | Priority | Status |
|-------|----------|----------|----------|--------|
| 1 | [PHASE_1_EPHEMERAL_ANALYSIS.md](./PHASE_1_EPHEMERAL_ANALYSIS.md) | Days 1-2 | CRITICAL | ✅ |
| 2 | [PHASE_2_SYMBOL_COVERAGE.md](./PHASE_2_SYMBOL_COVERAGE.md) | Days 2-4 | HIGH | ✅ |
| 3 | [PHASE_3_AUTHENTICATION.md](./PHASE_3_AUTHENTICATION.md) | Days 4-6 | HIGH | ✅ |
| 4 | [PHASE_4_STRIPE_INTEGRATION.md](./PHASE_4_STRIPE_INTEGRATION.md) | Days 5-7 | HIGH | ✅ |
| 5 | [PHASE_5_UI_POLISH.md](./PHASE_5_UI_POLISH.md) | Days 6-8 | MEDIUM | ⏳ |
| 6 | [PHASE_6_TESTING.md](./PHASE_6_TESTING.md) | Days 8-10 | CRITICAL | ⏳ |
| 7 | [PHASE_7_LAUNCH.md](./PHASE_7_LAUNCH.md) | Days 10-12 | CRITICAL | ⏳ |

---

## 🏗️ What Already Exists

### Backend (Python/FastAPI)

| Component | Location | Status |
|-----------|----------|--------|
| Extension Analyzer | `extension/analyzer.py` | ✅ Working |
| Regime Detection | `macro/regime.py` | ✅ Working |
| Risk Manager | `exec/risk_manager.py` | ✅ Working |
| API Routes | `api/routes/extension.py` | ✅ Working |
| LLM Integration | `assistant/llm_worker.py` | ✅ Working |
| Journal Repository | `extension/journal.py` | ✅ Working |
| Behavior Analyzer | `extension/behavior.py` | ✅ Working |
| Reports Generator | `extension/reports.py` | ✅ Working |
| Trade Sync | `extension/sync.py` | ✅ Working |

### Extension (JavaScript)

| Component | Location | Status |
|-----------|----------|--------|
| Background Worker | `chrome-extension/background.js` | ✅ Working |
| Content Script | `chrome-extension/content.js` | ✅ Working |
| Binance API Client | `chrome-extension/binance-api.js` | ✅ Working |
| Panel Styles | `chrome-extension/panel.css` | 🔧 Needs polish |
| Popup | `chrome-extension/popup.js` | ✅ Working |
| Options | `chrome-extension/options.js` | ✅ Working |
| Manifest | `chrome-extension/manifest.json` | 🔧 Needs update |

### What Needs to Be Built

| Component | Phase | Description |
|-----------|-------|-------------|
| Ephemeral flow in extension | 1 | Use /analyze-ephemeral for unknown symbols |
| Improved client-side analysis | 1 | Add ADX, BB width calculations |
| Symbol ingestion expansion | 2 | Add 50+ symbols |
| ML model training | 2 | Train for all symbols |
| MTF endpoint | 2 | Multi-timeframe confluence |
| Auth system | 3 | Registration, validation, trial |
| License manager | 3 | Client-side license handling |
| Stripe integration | 4 | Checkout, webhooks, portal |
| Feature gating | 4 | Block Pro features for free tier |
| UI polish | 5 | Modern styling, animations |
| Testing | 6 | API tests, functional tests |
| Store submission | 7 | Chrome Web Store listing |

---

## 🚀 Quick Start

### Development Setup

```bash
# Clone and setup backend
cd LenQuant
pip install -r requirements.txt
cp env.example .env
# Edit .env with your values

# Start MongoDB
docker-compose up -d mongo

# Start backend
uvicorn api.main:app --reload --port 8000

# Load extension in Chrome
# 1. Go to chrome://extensions
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select chrome-extension/ directory
```

### Running Tests

```bash
# Backend tests
pytest tests/test_extension_api.py -v

# Stripe tests (requires Stripe CLI)
stripe listen --forward-to localhost:8000/api/extension/stripe/webhook
pytest tests/test_stripe_integration.py -v
```

---

## 📊 Success Metrics

### Phase Completion Criteria

| Phase | Must Have |
|-------|-----------|
| 1 | ✅ Ephemeral analysis works for any symbol |
| 2 | ✅ 50+ symbols ingested, MTF endpoint working |
| 3 | Registration creates trial, validation works |
| 4 | ✅ Checkout creates Stripe session, webhooks process |
| 5 | Panel looks professional, no visual bugs |
| 6 | All tests passing, <500ms avg latency |
| 7 | Extension approved in Chrome Web Store |

### Launch Targets

| Metric | Week 1 | Month 1 |
|--------|--------|---------|
| Installs | 100 | 500 |
| Trial signups | 60 | 300 |
| Paid conversions | 6 | 30 |
| Conversion rate | 10% | 10% |
| MRR | $120 | $600 |

---

## 🔑 Key Dependencies

### Environment Variables Required

```bash
# MongoDB
MONGO_URI=mongodb://localhost:27017/cryptotrader

# LLM (for AI explanations)
OPENAI_API_KEY=sk-xxx
# or
GOOGLE_API_KEY=xxx

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_xxx
STRIPE_PUBLISHABLE_KEY=pk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Extension
EXT_LICENSE_SECRET=your-secret
EXT_TRIAL_DAYS=3
```

### External Services

| Service | Purpose | Required |
|---------|---------|----------|
| MongoDB | Data storage | Yes |
| Redis | Caching (optional) | No |
| OpenAI/Gemini | AI explanations | Yes (Pro tier) |
| Stripe | Payments | Yes (monetization) |
| Binance API | Market data | Yes (public) |

---

## 📝 Workflow

1. ✅ **Phase 1 Complete** - Ephemeral analysis and client-side improvements implemented
2. ✅ **Phase 2 Complete** - Multi-timeframe analysis implemented, symbol ingestion handled server-side
3. ✅ **Phase 3 Complete** - Unified authentication system with Google OAuth and email registration implemented
4. ✅ **Phase 4 Complete** - Stripe integration and feature gating implemented
5. **Run tests** - Validate with test cases
6. **Check prerequisites for next phase** - Listed at bottom of each doc
7. **Proceed to next phase** - Only when current phase complete

### Phase Dependencies

```
Phase 1 (Ephemeral) ─┬─> Phase 2 (Symbols) ─┬─> Phase 3 (Auth) ──> Phase 4 (Stripe)
                     │                       │
                     └───────────────────────┴─> Phase 5 (UI) ──> Phase 6 (Test) ──> Phase 7 (Launch)
```

---

## ❓ FAQ

### Can I skip phases?

No. Each phase builds on the previous. Skipping will cause issues.

### How long will each phase take?

Estimates assume full-time work. Adjust based on your availability:
- Part-time: 2x estimated time
- Weekends only: 3-4 weeks total

### What if I get stuck?

1. Check the test cases for expected behavior
2. Look at existing code in `extension/` and `api/routes/extension.py`
3. The backend is mostly complete - focus on extension integration

### Can I do phases in parallel?

Phases 3 & 4 (Auth + Stripe) can run parallel.
Phases 5 (UI) can run parallel with 3 & 4.
Phase 6 (Testing) must wait for 1-5.

---

## 📞 Support

If you need help:
1. Review existing code in the codebase
2. Check test files for expected behavior
3. Reference the marketing plan for positioning guidance

---

*Let's build and ship this extension! 🚀*

