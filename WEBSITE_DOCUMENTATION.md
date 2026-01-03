# LenQuant Website Documentation

**Version:** 1.0  
**Last Updated:** January 2026  
**Purpose:** Complete specification for the new LenQuant marketing & product website

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Site Architecture](#site-architecture)
3. [Design System](#design-system)
4. [Page Specifications](#page-specifications)
5. [Components Library](#components-library)
6. [Electric Border Effect](#electric-border-effect)
7. [Technical Implementation](#technical-implementation)
8. [SEO & Meta Tags](#seo--meta-tags)
9. [Responsive Design](#responsive-design)
10. [Animations & Interactions](#animations--interactions)

---

## 🎯 Executive Summary

### Product Positioning

LenQuant is an **AI-powered trading assistant ecosystem** consisting of:

| Product | Priority | Status |
|---------|----------|--------|
| **Chrome Extension** | 🥇 Primary | Principal product - featured prominently |
| **Web Platform** | 🥈 Secondary | Full trading dashboard & analytics |

### Website Goals

1. **Showcase the Chrome Extension** as the flagship product
2. **Drive Chrome Web Store installs** with clear CTAs
3. **Present the Web Platform** as complementary to the extension
4. **Build trust** through professional design and clear value proposition
5. **Convert visitors** to trial users → paid subscribers

### Target Audience

| Audience | Needs |
|----------|-------|
| Crypto Futures Traders (Binance) | Quick market assessment, leverage discipline |
| Emotional/New Traders | Behavioral guardrails, objective second opinion |
| Part-time Traders | Fast analysis without watching charts |

---

## 🗺️ Site Architecture

### Sitemap

```
lenquant.com/
├── / (Homepage)                     # Combined hero: Extension-first + Platform
├── /extension                       # Chrome Extension dedicated page
├── /platform                        # Web Platform features page
├── /pricing                         # Pricing tiers (optional, can be section on homepage)
├── /privacy                         # Privacy Policy
├── /terms                           # Terms of Use
├── /login                           # Authentication (existing)
├── /dashboard/*                     # App routes (authenticated)
└── /api/*                           # Backend API routes
```

### Navigation Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Logo: LenQuant]     Extension    Platform    Pricing    [Login] [CTA] │
└─────────────────────────────────────────────────────────────────────────┘
```

**Primary Navigation:**
- Logo (links to /)
- Extension (links to /extension)
- Platform (links to /platform)
- Pricing (anchor link to pricing section or separate page)
- Login (links to /login)
- **CTA Button:** "Install Extension" (links to Chrome Web Store)

**Footer Navigation:**
- Product: Extension, Platform, Pricing
- Company: About, Contact
- Legal: Privacy Policy, Terms of Use
- Social: Twitter/X, Discord

---

## 🎨 Design System

### Brand Colors

The website uses a **dark theme with purple/blue accent colors**.

```css
:root {
  /* Core Brand Colors */
  --color-primary: hsl(291, 83%, 59%);        /* Vibrant Purple (#D946EF) */
  --color-primary-hover: hsl(291, 83%, 65%);  /* Lighter Purple */
  --color-accent: hsl(265, 89%, 67%);         /* Electric Violet (#A855F7) */
  --color-accent-blue: hsl(217, 91%, 60%);    /* Electric Blue (#3B82F6) */
  
  /* Electric Border Effect */
  --color-electric-primary: #8B5CF6;          /* Vivid Purple */
  --color-electric-secondary: #6366F1;        /* Indigo */
  --color-electric-glow: rgba(139, 92, 246, 0.6);
  
  /* Background Gradient */
  --bg-dark-primary: hsl(0, 0%, 4%);          /* Near Black (#0A0A0A) */
  --bg-dark-secondary: hsl(0, 0%, 9.8%);      /* Dark Gray (#191919) */
  --bg-dark-tertiary: hsl(0, 0%, 15%);        /* Lighter Dark (#262626) */
  
  /* Text Colors */
  --text-primary: hsl(0, 0%, 98%);            /* Off-White */
  --text-secondary: hsl(0, 0%, 70%);          /* Muted Gray */
  --text-muted: hsl(0, 0%, 50%);              /* Subtle Gray */
  
  /* Semantic Colors */
  --color-success: hsl(142, 71%, 45%);        /* Green */
  --color-warning: hsl(38, 92%, 50%);         /* Amber */
  --color-error: hsl(0, 84%, 60%);            /* Red */
}
```

### Typography

```css
/* Font Stack - Distinctive, not generic */
--font-display: 'Clash Display', 'Satoshi', sans-serif;  /* Headlines */
--font-body: 'Satoshi', 'Inter', sans-serif;              /* Body text */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;   /* Code/Data */

/* Type Scale */
--text-hero: clamp(3rem, 8vw, 6rem);      /* Hero headline */
--text-h1: clamp(2.5rem, 5vw, 4rem);      /* Page titles */
--text-h2: clamp(1.75rem, 3vw, 2.5rem);   /* Section titles */
--text-h3: clamp(1.25rem, 2vw, 1.5rem);   /* Subsection titles */
--text-body: 1rem;                         /* Body text */
--text-small: 0.875rem;                    /* Supporting text */
--text-tiny: 0.75rem;                      /* Labels, captions */
```

### Spacing System

```css
--space-xs: 0.25rem;   /* 4px */
--space-sm: 0.5rem;    /* 8px */
--space-md: 1rem;      /* 16px */
--space-lg: 1.5rem;    /* 24px */
--space-xl: 2rem;      /* 32px */
--space-2xl: 3rem;     /* 48px */
--space-3xl: 4rem;     /* 64px */
--space-4xl: 6rem;     /* 96px */
--space-section: 8rem; /* 128px - between major sections */
```

### Border Radius

```css
--radius-sm: 0.375rem;  /* 6px - buttons, badges */
--radius-md: 0.75rem;   /* 12px - cards, inputs */
--radius-lg: 1rem;      /* 16px - modals */
--radius-xl: 1.5rem;    /* 24px - large cards */
--radius-full: 9999px;  /* Pills, circles */
```

### Shadows & Glows

```css
/* Card Shadow */
--shadow-card: 0 4px 24px rgba(0, 0, 0, 0.4);

/* Purple Glow (for CTAs, featured elements) */
--glow-purple: 0 0 20px rgba(139, 92, 246, 0.4),
               0 0 40px rgba(139, 92, 246, 0.2),
               0 0 60px rgba(139, 92, 246, 0.1);

/* Electric Border Glow */
--glow-electric: 0 0 8px var(--color-electric-glow),
                 0 0 16px var(--color-electric-glow);
```

---

## 📄 Page Specifications

### Page 1: Homepage (`/`)

The homepage is the **primary landing page** combining the Chrome Extension (hero focus) with the Web Platform (secondary).

#### Hero Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                         ⚡ ELECTRIC BORDER EFFECT ⚡                         │
│         ┌───────────────────────────────────────────────────────┐           │
│         │                                                       │           │
│         │   🧠 Your Objective Trading                           │           │
│         │      Second Opinion                                   │           │
│         │                                                       │           │
│         │   Real-time market analysis, leverage discipline,     │           │
│         │   and AI-powered insights — right on Binance Futures  │           │
│         │                                                       │           │
│         │   [⬇️ Install Extension]  [Learn More]                │           │
│         │                                                       │           │
│         │   ✓ Free 3-day trial  ✓ No credit card required      │           │
│         │                                                       │           │
│         └───────────────────────────────────────────────────────┘           │
│                                                                             │
│                    [Chrome Extension Preview Image/Video]                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Content:**
- **Headline:** "Your Objective Trading Second Opinion"
- **Subheadline:** "Real-time market analysis, leverage discipline, and AI-powered insights — right on Binance Futures"
- **Primary CTA:** "Install Extension" → Chrome Web Store
- **Secondary CTA:** "Learn More" → scrolls to features
- **Trust Badges:** "Free 3-day trial", "No credit card required"
- **Visual:** Animated extension panel mockup or video showing the extension in action

#### Feature Grid Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                        Why Traders Choose LenQuant                          │
│                                                                             │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│   │ 📊 Real-Time    │  │ ⚡ Leverage      │  │ 🧠 AI           │            │
│   │    Regime       │  │    Discipline   │  │    Explanations │            │
│   │    Analysis     │  │                 │  │                 │            │
│   │                 │  │ Know when your  │  │ Click "Explain" │            │
│   │ Trending,       │  │ leverage is too │  │ for detailed    │            │
│   │ ranging, or     │  │ high for market │  │ trade context   │            │
│   │ choppy — know   │  │ conditions      │  │ powered by  GPT-5│            │
│   │ before you      │  │                 │  │                 │            │
│   │ trade           │  │                 │  │                 │            │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                             │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│   │ 🛡️ Behavioral   │  │ 📓 Trade        │  │ 🔄 Seamless     │            │
│   │    Guardrails   │  │    Journal      │  │    Integration  │            │
│   │                 │  │                 │  │                 │            │
│   │ Detects revenge │  │ Automatic       │  │ Works natively  │            │
│   │ trading and     │  │ logging with    │  │ on Binance      │            │
│   │ overtrading     │  │ performance     │  │ Futures —       │            │
│   │ patterns        │  │ analytics       │  │ no extra tabs   │            │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features to highlight:**
1. **Real-Time Regime Analysis** - ADX, MA slopes, volatility z-scores
2. **Leverage Discipline** - Regime-aware recommendations
3. **AI Explanations** -  GPT-5/Gemini powered trade context
4. **Behavioral Guardrails** - Overtrading & revenge trading detection
5. **Trade Journal** - Cloud-based with analytics
6. **Seamless Integration** - Native Binance UI

#### How It Works Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                            How It Works                                     │
│                                                                             │
│     ①                        ②                        ③                    │
│   Install                Navigate to              Get Instant               │
│   Extension              Binance Futures          Analysis                  │
│                                                                             │
│   [Icon: Chrome]         [Icon: Chart]           [Icon: Panel]             │
│                                                                             │
│   One-click install      Panel appears           Market state,             │
│   from Chrome            automatically           leverage, and             │
│   Web Store              on trading pages        setup grade               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Live Demo Section (Optional Video)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                         See LenQuant in Action                              │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                     │   │
│   │                    [Video Player Embed]                             │   │
│   │                                                                     │   │
│   │         3-4 minute demo showing actual extension usage              │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Platform Teaser Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                    More Than Just an Extension                              │
│                                                                             │
│   The LenQuant Web Platform gives you the full trading experience:         │
│                                                                             │
│   ┌───────────────────────────────┐    ┌───────────────────────────────┐   │
│   │                               │    │  • Advanced analytics         │   │
│   │   [Platform Dashboard         │    │  • Portfolio tracking         │   │
│   │    Screenshot/Mockup]         │    │  • AI trading assistant       │   │
│   │                               │    │  • Historical insights        │   │
│   │                               │    │  • Strategy backtesting       │   │
│   └───────────────────────────────┘    │                               │   │
│                                        │  [Explore Platform →]         │   │
│                                        └───────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Pricing Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                          Simple, Transparent Pricing                        │
│                                                                             │
│        ┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐       │
│        │   FREE      │    │  ⭐ PRO         │    │   PREMIUM       │       │
│        │   TRIAL     │    │                 │    │                 │       │
│        │             │    │  $19.99/mo      │    │  $39.99/mo      │       │
│        │   3 days    │    │  $149/year      │    │  $299/year      │       │
│        │             │    │                 │    │                 │       │
│        │ Full access │    │ ✓ Backend       │    │ Everything in   │       │
│        │ to all Pro  │    │   regime        │    │ Pro, plus:      │       │
│        │ features    │    │   analysis      │    │                 │       │
│        │             │    │ ✓ AI trade      │    │ ✓ Extended      │       │
│        │             │    │   explanations  │    │   journal (1yr) │       │
│        │             │    │ ✓ Cloud journal │    │ ✓ Trade sync    │       │
│        │             │    │   (30 days)     │    │ ✓ Weekly/monthly│       │
│        │             │    │ ✓ Behavioral    │    │   reports       │       │
│        │             │    │   analysis      │    │ ✓ Priority      │       │
│        │             │    │ ✓ Any symbol    │    │   support       │       │
│        │             │    │                 │    │ ✓ Discord       │       │
│        │             │    │                 │    │   community     │       │
│        │             │    │                 │    │                 │       │
│        │ [Start      │    │ [Get Pro]       │    │ [Get Premium]   │       │
│        │  Trial]     │    │                 │    │                 │       │
│        └─────────────┘    └─────────────────┘    └─────────────────┘       │
│                                                                             │
│                   🚀 FOUNDING MEMBER: Lock in price forever!               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Social Proof / Testimonials Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                       What Traders Are Saying                               │
│                                                                             │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│   │ "Finally, an    │  │ "The leverage   │  │ "Saved me from │            │
│   │  objective      │  │  warnings       │  │  revenge        │            │
│   │  voice when     │  │  alone have     │  │  trading more   │            │
│   │  I'm tempted    │  │  saved me       │  │  times than I   │            │
│   │  to overtrade"  │  │  hundreds"      │  │  can count"     │            │
│   │                 │  │                 │  │                 │            │
│   │  — @trader_anon │  │  — Beta Tester  │  │  — Early User   │            │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### FAQ Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                        Frequently Asked Questions                           │
│                                                                             │
│   ▼ Is this a signal service?                                              │
│     No. LenQuant is a decision support tool that shows you market          │
│     conditions objectively. It does not tell you what to trade.            │
│                                                                             │
│   ▼ Does this guarantee profits?                                           │
│     No tool guarantees profits. LenQuant helps you avoid bad trades        │
│     by providing objective market analysis and behavioral guardrails.      │
│                                                                             │
│   ▼ Does it work with all symbols?                                         │
│     Yes! The extension works with ANY Binance Futures symbol. Full ML      │
│     predictions are available for ingested symbols; others get regime      │
│     detection via ephemeral analysis.                                       │
│                                                                             │
│   ▼ Do I need to share my Binance API keys?                                │
│     No. The extension reads public market data and your page's DOM.        │
│     No API keys required for analysis.                                      │
│                                                                             │
│   ▼ Can I cancel anytime?                                                  │
│     Yes. Cancel anytime from your account settings. No long-term           │
│     commitments.                                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Final CTA Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│        ⚡ ELECTRIC BORDER EFFECT ⚡                                          │
│                                                                             │
│                 Ready to Trade with Discipline?                             │
│                                                                             │
│              Start your free 3-day trial today.                            │
│                    No credit card required.                                 │
│                                                                             │
│                    [🚀 Install Extension]                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Footer

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   [Logo]                                                                    │
│   LenQuant                                                                  │
│   Your objective trading second opinion                                     │
│                                                                             │
│   Product           Company           Legal              Connect            │
│   ─────────         ─────────         ─────────          ─────────          │
│   Extension         About             Privacy Policy     Twitter/X          │
│   Platform          Contact           Terms of Use       Discord            │
│   Pricing           Support                              GitHub             │
│                                                                             │
│   © 2026 LenQuant. All rights reserved.                                    │
│                                                                             │
│   ⚠️ Disclaimer: This is a decision support tool, not a signal service.    │
│   Trading involves risk. Past performance does not guarantee future         │
│   results.                                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Page 2: Chrome Extension (`/extension`)

Dedicated page for the Chrome Extension with detailed features, screenshots, and installation guide.

#### Hero Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   🧩 LenQuant Chrome Extension                                             │
│                                                                             │
│   Real-Time Trading Intelligence for Binance Futures                       │
│                                                                             │
│   Get market regime analysis, leverage recommendations, and AI-powered     │
│   explanations — directly on your Binance trading page.                    │
│                                                                             │
│   [Install for Chrome]   [Watch Demo]                                      │
│                                                                             │
│   ★★★★★ 4.9 rating • 500+ active users • Free 3-day trial                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Screenshot Gallery

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                         Extension in Action                                 │
│                                                                             │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│   │Screenshot│  │Screenshot│  │Screenshot│  │Screenshot│  │Screenshot│         │
│   │    1    │  │    2    │  │    3    │  │    4    │  │    5    │         │
│   │ Main    │  │ Leverage│  │ AI      │  │Behavioral│  │ Settings│         │
│   │ Panel   │  │ Warning │  │Explain  │  │ Alert   │  │ Page    │         │
│   └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │
│                                                                             │
│   [Interactive carousel with large preview]                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Feature Deep Dive

Each feature gets expanded explanation:

1. **Real-Time Market Regime Analysis**
   - How it works: ADX, MA slope analysis, BB width, volatility z-scores
   - What you see: Market state badge, confidence %, trend direction
   - Why it matters: Know if conditions favor your trade style

2. **Leverage Discipline**
   - Dynamic leverage bands based on volatility regime
   - Your leverage vs recommended comparison
   - Warning when you're over-leveraged

3. **AI-Powered Explanations**
   - Powered by  GPT-5/Gemini
   - Entry considerations, invalidation levels, targets
   - Evidence-based analysis with technical indicators

4. **Behavioral Guardrails**
   - Overtrading detection
   - Revenge trading alerts
   - Cooldown system
   - Session analytics

5. **Trade Journal**
   - Automatic event logging
   - Performance reports
   - Cloud sync (Pro/Premium)

6. **Works for ANY Symbol**
   - Ephemeral analysis for unlisted symbols
   - Client-side fallback if backend unavailable
   - DOM data extraction for real-time context

#### Installation Guide

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                        Get Started in 60 Seconds                            │
│                                                                             │
│   Step 1: Install                                                          │
│   ─────────────────                                                        │
│   Click "Add to Chrome" on the Chrome Web Store                            │
│   [Screenshot: Chrome Web Store page]                                       │
│                                                                             │
│   Step 2: Navigate to Binance Futures                                      │
│   ──────────────────────────────────────                                   │
│   Go to binance.com/en/futures/BTCUSDT                                     │
│   [Screenshot: Binance Futures page]                                       │
│                                                                             │
│   Step 3: Start Trading Smarter                                            │
│   ─────────────────────────────────                                        │
│   The LenQuant panel appears automatically on the right                    │
│   [Screenshot: Panel active]                                               │
│                                                                             │
│   [🚀 Install Extension]                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Technical Specifications

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                         Technical Details                                   │
│                                                                             │
│   Performance                                                               │
│   ───────────                                                              │
│   • Fast path analysis: ≤500ms                                             │
│   • Panel update: ≤50ms                                                    │
│   • AI explanation: ≤5s                                                    │
│                                                                             │
│   Requirements                                                              │
│   ────────────                                                             │
│   • Chrome/Chromium browser (v88+)                                         │
│   • Binance Futures account                                                │
│   • Internet connection                                                     │
│                                                                             │
│   Privacy & Security                                                        │
│   ──────────────────                                                       │
│   • No Binance API keys required for analysis                              │
│   • Read-only access to page data                                          │
│   • Session-based authentication                                           │
│   • CORS protected endpoints                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Page 3: Platform (`/platform`)

Page showcasing the full LenQuant web platform.

#### Hero Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   🌐 LenQuant Platform                                                      │
│                                                                             │
│   The Complete AI-Powered Trading Dashboard                                 │
│                                                                             │
│   Advanced analytics, portfolio tracking, and intelligent insights —       │
│   all in one powerful platform.                                            │
│                                                                             │
│   [Access Platform]   [View Features]                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Platform Features Grid

1. **Trading Dashboard**
   - Real-time market data
   - Quick order panel
   - Position management

2. **AI Assistant**
   - Natural language trading queries
   - Context-aware recommendations
   - Proactive suggestions

3. **Analytics & Insights**
   - Performance metrics
   - Equity curves
   - Win rate analysis

4. **Portfolio Management**
   - Multi-exchange support (future)
   - Position tracking
   - Risk monitoring

5. **Strategy Backtesting**
   - Historical simulation
   - Performance reports
   - Optimization tools

6. **Market Regime Analysis**
   - Macro market state
   - Symbol-specific regimes
   - Volatility tracking

#### Platform Screenshots

Large, high-quality screenshots showing:
- Dashboard overview
- Trading interface
- AI assistant chat
- Analytics charts
- Settings page

#### Integration with Extension

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                    Better Together                                          │
│                                                                             │
│   ┌─────────────────┐         ┌─────────────────┐                          │
│   │  Chrome         │  ──▶    │  Web            │                          │
│   │  Extension      │  Sync   │  Platform       │                          │
│   │                 │  ◀──    │                 │                          │
│   │  Quick analysis │         │  Deep analytics │                          │
│   │  on Binance     │         │  & journaling   │                          │
│   └─────────────────┘         └─────────────────┘                          │
│                                                                             │
│   Trade on Binance with the extension, then review your                    │
│   performance and get deeper insights on the platform.                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Page 4: Privacy Policy (`/privacy`)

#### Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Privacy Policy                                                           │
│   Last updated: January 2026                                               │
│                                                                             │
│   ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│   1. Introduction                                                          │
│      Brief overview of LenQuant and commitment to privacy                  │
│                                                                             │
│   2. Information We Collect                                                │
│      2.1 Account Information                                               │
│          - Email address (via Google OAuth)                                │
│          - Profile name                                                    │
│      2.2 Trading Data                                                      │
│          - Journal entries (user-created)                                  │
│          - Analysis history                                                │
│          - Behavioral patterns (session-based)                             │
│      2.3 Technical Data                                                    │
│          - Browser type, version                                           │
│          - Session identifiers                                             │
│          - Extension usage patterns                                        │
│      2.4 Data NOT Collected                                                │
│          - Binance API keys                                                │
│          - Account balances                                                │
│          - Trade execution data (unless synced by user)                    │
│                                                                             │
│   3. How We Use Your Information                                           │
│      - Provide analysis services                                           │
│      - Improve product features                                            │
│      - Send service notifications                                          │
│                                                                             │
│   4. Data Storage & Security                                               │
│      - Encrypted storage                                                   │
│      - Secure API communications (HTTPS)                                   │
│      - Session-based authentication                                        │
│                                                                             │
│   5. Third-Party Services                                                  │
│      - Google OAuth (authentication)                                       │
│      - Stripe (payment processing)                                         │
│      - OpenAI/Google (AI explanations)                                     │
│                                                                             │
│   6. Chrome Extension Permissions                                          │
│      - activeTab: Read current trading page                                │
│      - storage: Save preferences                                           │
│      - host permissions: Connect to LenQuant servers                       │
│                                                                             │
│   7. Your Rights                                                           │
│      - Access your data                                                    │
│      - Delete your account                                                 │
│      - Export your journal                                                 │
│                                                                             │
│   8. Data Retention                                                        │
│      - Active accounts: Data retained while subscribed                     │
│      - Deleted accounts: Data removed within 30 days                       │
│                                                                             │
│   9. Changes to This Policy                                                │
│      - Notification via email for material changes                         │
│                                                                             │
│   10. Contact                                                              │
│       - Email: privacy@lenquant.com                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Page 5: Terms of Use (`/terms`)

#### Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Terms of Use                                                             │
│   Last updated: January 2026                                               │
│                                                                             │
│   ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│   1. Acceptance of Terms                                                   │
│      By using LenQuant, you agree to these terms.                          │
│                                                                             │
│   2. Service Description                                                   │
│      LenQuant provides trading analysis tools including:                   │
│      - Chrome Extension for Binance Futures                                │
│      - Web platform for analytics and journaling                           │
│      - AI-powered trade explanations                                       │
│                                                                             │
│   3. Important Disclaimers                                                 │
│      ⚠️ NOT FINANCIAL ADVICE                                               │
│      - LenQuant is a decision support tool, NOT a signal service           │
│      - Does not provide financial, investment, or trading advice           │
│      - Does not guarantee profits or trading success                       │
│      - Users are solely responsible for their trading decisions            │
│                                                                             │
│   4. User Responsibilities                                                 │
│      - Maintain account security                                           │
│      - Provide accurate information                                        │
│      - Comply with Binance terms of service                                │
│      - Use service legally in your jurisdiction                            │
│                                                                             │
│   5. Subscription & Billing                                                │
│      - Free trial: 3 days, full access                                     │
│      - Paid tiers: Monthly or annual billing                               │
│      - Cancellation: Anytime, access until period end                      │
│      - Refunds: Pro-rated for annual plans within 14 days                  │
│                                                                             │
│   6. Intellectual Property                                                 │
│      - LenQuant owns all platform content and code                         │
│      - Users retain ownership of their journal entries                     │
│                                                                             │
│   7. Limitation of Liability                                               │
│      - Service provided "as is"                                            │
│      - Not liable for trading losses                                       │
│      - Not liable for service interruptions                                │
│      - Maximum liability: Amount paid in last 12 months                    │
│                                                                             │
│   8. Termination                                                           │
│      - User may cancel anytime                                             │
│      - LenQuant may terminate for violations                               │
│                                                                             │
│   9. Modifications                                                         │
│      - Terms may be updated with notice                                    │
│      - Continued use implies acceptance                                    │
│                                                                             │
│   10. Governing Law                                                        │
│       - [Specify jurisdiction]                                             │
│                                                                             │
│   11. Contact                                                              │
│       - Email: legal@lenquant.com                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Components Library

### Core Components (shadcn/ui based)

The website uses **shadcn/ui** components with custom styling:

| Component | Usage |
|-----------|-------|
| `Button` | CTAs, navigation actions |
| `Card` | Feature cards, pricing cards |
| `Badge` | Labels, status indicators |
| `Accordion` | FAQ section |
| `Dialog` | Modals, overlays |
| `Tabs` | Feature navigation |
| `Carousel` | Screenshot galleries |
| `Input` | Contact forms |
| `Toast` | Notifications |

### Custom Components

#### 1. ElectricBorderCard

Wrapper component that applies the electric border effect to any content.

```tsx
interface ElectricBorderCardProps {
  children: React.ReactNode;
  color?: string; // Default: "#8B5CF6" (purple)
  width?: number;
  height?: number;
  borderRadius?: number;
  className?: string;
}
```

Usage:
- Hero sections
- Featured pricing cards
- Final CTA sections
- Important callouts

#### 2. FeatureCard

```tsx
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  link?: string;
}
```

#### 3. PricingCard

```tsx
interface PricingCardProps {
  tier: "free" | "pro" | "premium";
  price: { monthly: number; yearly: number };
  features: string[];
  highlighted?: boolean;
  ctaText: string;
  ctaLink: string;
}
```

#### 4. ScreenshotCarousel

```tsx
interface ScreenshotCarouselProps {
  screenshots: {
    src: string;
    alt: string;
    caption: string;
  }[];
}
```

#### 5. FAQAccordion

```tsx
interface FAQItem {
  question: string;
  answer: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
}
```

#### 6. TestimonialCard

```tsx
interface TestimonialCardProps {
  quote: string;
  author: string;
  role?: string;
  avatar?: string;
}
```

#### 7. StepIndicator

For "How It Works" sections:

```tsx
interface Step {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface StepIndicatorProps {
  steps: Step[];
}
```

---

## ⚡ Electric Border Effect

### Implementation

The electric border effect creates an animated, glowing border with noise-based displacement.

#### React Component

```tsx
// components/ElectricBorder.tsx

"use client";

import { useEffect, useRef } from "react";

interface ElectricBorderProps {
  width?: number;
  height?: number;
  color?: string;
  speed?: number;
  borderRadius?: number;
  className?: string;
}

export function ElectricBorder({
  width = 354,
  height = 504,
  color = "#8B5CF6", // Purple
  speed = 1.5,
  borderRadius = 24,
  className = "",
}: ElectricBorderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Configuration
    const config = {
      octaves: 10,
      lacunarity: 1.6,
      gain: 0.7,
      amplitude: 0.075,
      frequency: 10,
      baseFlatness: 0,
      displacement: 60,
      speed,
      borderOffset: 60,
      borderRadius,
      lineWidth: 1,
      color,
    };
    
    let time = 0;
    let animationId: number;
    let lastFrameTime = 0;
    
    // Canvas dimensions include offset for effect
    canvas.width = width + config.borderOffset * 2;
    canvas.height = height + config.borderOffset * 2;
    
    // Noise functions
    const random = (x: number) => (Math.sin(x * 12.9898) * 43758.5453) % 1;
    
    const noise2D = (x: number, y: number) => {
      const i = Math.floor(x);
      const j = Math.floor(y);
      const fx = x - i;
      const fy = y - j;
      
      const a = random(i + j * 57);
      const b = random(i + 1 + j * 57);
      const c = random(i + (j + 1) * 57);
      const d = random(i + 1 + (j + 1) * 57);
      
      const ux = fx * fx * (3.0 - 2.0 * fx);
      const uy = fy * fy * (3.0 - 2.0 * fy);
      
      return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
    };
    
    const octavedNoise = (
      x: number,
      octaves: number,
      lacunarity: number,
      gain: number,
      baseAmplitude: number,
      baseFrequency: number,
      time: number,
      seed: number,
      baseFlatness: number
    ) => {
      let y = 0;
      let amplitude = baseAmplitude;
      let frequency = baseFrequency;
      
      for (let i = 0; i < octaves; i++) {
        let octaveAmplitude = amplitude;
        if (i === 0) octaveAmplitude *= baseFlatness;
        y += octaveAmplitude * noise2D(frequency * x + seed * 100, time * frequency * 0.3);
        frequency *= lacunarity;
        amplitude *= gain;
      }
      
      return y;
    };
    
    // Rounded rect point calculation
    const getRoundedRectPoint = (
      t: number,
      left: number,
      top: number,
      width: number,
      height: number,
      radius: number
    ) => {
      const straightWidth = width - 2 * radius;
      const straightHeight = height - 2 * radius;
      const cornerArc = (Math.PI * radius) / 2;
      const totalPerimeter = 2 * straightWidth + 2 * straightHeight + 4 * cornerArc;
      const distance = t * totalPerimeter;
      
      let accumulated = 0;
      
      // Top edge
      if (distance <= accumulated + straightWidth) {
        const progress = (distance - accumulated) / straightWidth;
        return { x: left + radius + progress * straightWidth, y: top };
      }
      accumulated += straightWidth;
      
      // Top-right corner
      if (distance <= accumulated + cornerArc) {
        const progress = (distance - accumulated) / cornerArc;
        const angle = -Math.PI / 2 + progress * (Math.PI / 2);
        return {
          x: left + width - radius + radius * Math.cos(angle),
          y: top + radius + radius * Math.sin(angle),
        };
      }
      accumulated += cornerArc;
      
      // Right edge
      if (distance <= accumulated + straightHeight) {
        const progress = (distance - accumulated) / straightHeight;
        return { x: left + width, y: top + radius + progress * straightHeight };
      }
      accumulated += straightHeight;
      
      // Bottom-right corner
      if (distance <= accumulated + cornerArc) {
        const progress = (distance - accumulated) / cornerArc;
        const angle = progress * (Math.PI / 2);
        return {
          x: left + width - radius + radius * Math.cos(angle),
          y: top + height - radius + radius * Math.sin(angle),
        };
      }
      accumulated += cornerArc;
      
      // Bottom edge
      if (distance <= accumulated + straightWidth) {
        const progress = (distance - accumulated) / straightWidth;
        return { x: left + width - radius - progress * straightWidth, y: top + height };
      }
      accumulated += straightWidth;
      
      // Bottom-left corner
      if (distance <= accumulated + cornerArc) {
        const progress = (distance - accumulated) / cornerArc;
        const angle = Math.PI / 2 + progress * (Math.PI / 2);
        return {
          x: left + radius + radius * Math.cos(angle),
          y: top + height - radius + radius * Math.sin(angle),
        };
      }
      accumulated += cornerArc;
      
      // Left edge
      if (distance <= accumulated + straightHeight) {
        const progress = (distance - accumulated) / straightHeight;
        return { x: left, y: top + height - radius - progress * straightHeight };
      }
      accumulated += straightHeight;
      
      // Top-left corner
      const progress = (distance - accumulated) / cornerArc;
      const angle = Math.PI + progress * (Math.PI / 2);
      return {
        x: left + radius + radius * Math.cos(angle),
        y: top + radius + radius * Math.sin(angle),
      };
    };
    
    const draw = (currentTime: number) => {
      const deltaTime = (currentTime - lastFrameTime) / 1000;
      time += deltaTime * config.speed;
      lastFrameTime = currentTime;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = config.color;
      ctx.lineWidth = config.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      const left = config.borderOffset;
      const top = config.borderOffset;
      const borderWidth = canvas.width - 2 * config.borderOffset;
      const borderHeight = canvas.height - 2 * config.borderOffset;
      const maxRadius = Math.min(borderWidth, borderHeight) / 2;
      const radius = Math.min(config.borderRadius, maxRadius);
      
      const approximatePerimeter = 2 * (borderWidth + borderHeight) + 2 * Math.PI * radius;
      const sampleCount = Math.floor(approximatePerimeter / 2);
      
      ctx.beginPath();
      
      for (let i = 0; i <= sampleCount; i++) {
        const progress = i / sampleCount;
        const point = getRoundedRectPoint(progress, left, top, borderWidth, borderHeight, radius);
        
        const xNoise = octavedNoise(
          progress * 8,
          config.octaves,
          config.lacunarity,
          config.gain,
          config.amplitude,
          config.frequency,
          time,
          0,
          config.baseFlatness
        );
        
        const yNoise = octavedNoise(
          progress * 8,
          config.octaves,
          config.lacunarity,
          config.gain,
          config.amplitude,
          config.frequency,
          time,
          1,
          config.baseFlatness
        );
        
        const displacedX = point.x + xNoise * config.displacement;
        const displacedY = point.y + yNoise * config.displacement;
        
        if (i === 0) {
          ctx.moveTo(displacedX, displacedY);
        } else {
          ctx.lineTo(displacedX, displacedY);
        }
      }
      
      ctx.closePath();
      ctx.stroke();
      
      animationId = requestAnimationFrame(draw);
    };
    
    animationId = requestAnimationFrame(draw);
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [width, height, color, speed, borderRadius]);
  
  return (
    <canvas
      ref={canvasRef}
      className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none ${className}`}
      style={{
        width: width + 120,
        height: height + 120,
      }}
    />
  );
}
```

#### CSS for Glow Layers

```css
/* Electric Border Container */
.electric-card-container {
  position: relative;
  padding: 2px;
  border-radius: 24px;
  background: linear-gradient(
    -30deg,
    oklch(from var(--color-electric-primary) 0.3 calc(c / 2) h / 0.4),
    transparent,
    oklch(from var(--color-electric-primary) 0.3 calc(c / 2) h / 0.4)
  ),
  linear-gradient(
    to bottom,
    hsl(0, 0%, 11%),
    hsl(0, 0%, 11%)
  );
}

/* Glow Layer 1 */
.glow-layer-1 {
  position: absolute;
  inset: 0;
  border: 2px solid rgba(139, 92, 246, 0.6);
  border-radius: 24px;
  filter: blur(1px);
  pointer-events: none;
}

/* Glow Layer 2 */
.glow-layer-2 {
  position: absolute;
  inset: 0;
  border: 2px solid var(--color-electric-primary);
  border-radius: 24px;
  filter: blur(4px);
  pointer-events: none;
}

/* Background Glow */
.background-glow {
  position: absolute;
  inset: 0;
  border-radius: 24px;
  filter: blur(32px);
  transform: scale(1.1);
  opacity: 0.3;
  z-index: -1;
  background: linear-gradient(
    -30deg,
    var(--color-electric-primary),
    transparent,
    var(--color-electric-secondary)
  );
}

/* Overlay Effects */
.overlay-effect {
  position: absolute;
  inset: 0;
  border-radius: 24px;
  opacity: 0.5;
  mix-blend-mode: overlay;
  transform: scale(1.1);
  filter: blur(16px);
  background: linear-gradient(
    -30deg,
    white,
    transparent 30%,
    transparent 70%,
    white
  );
  pointer-events: none;
}
```

### When to Use Electric Border

| Use Case | Priority |
|----------|----------|
| Homepage Hero | ✅ Primary |
| Highlighted Pricing Card | ✅ Important |
| Final CTA Section | ✅ Important |
| Feature Highlights | ⚠️ Sparingly |
| Regular Cards | ❌ Don't overuse |

**Rule:** Use the electric border effect for 2-3 maximum high-impact elements per page to maintain its visual impact.

---

## 🔧 Technical Implementation

### Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 14** | Framework (App Router) |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Styling |
| **shadcn/ui** | Component library |
| **Framer Motion** | Animations |
| **next-auth** | Authentication |
| **Stripe** | Payments |

### Project Structure

```
web/next-app/
├── app/                          # App Router pages
│   ├── (marketing)/              # Marketing pages (public)
│   │   ├── page.tsx              # Homepage
│   │   ├── extension/
│   │   │   └── page.tsx          # Extension page
│   │   ├── platform/
│   │   │   └── page.tsx          # Platform page
│   │   ├── privacy/
│   │   │   └── page.tsx          # Privacy Policy
│   │   ├── terms/
│   │   │   └── page.tsx          # Terms of Use
│   │   └── layout.tsx            # Marketing layout
│   ├── (dashboard)/              # App pages (authenticated)
│   │   ├── layout.tsx
│   │   └── ...existing pages
│   ├── login/
│   │   └── page.tsx
│   ├── api/
│   │   └── ...existing APIs
│   └── layout.tsx                # Root layout
├── components/
│   ├── marketing/                # Marketing-specific components
│   │   ├── ElectricBorder.tsx
│   │   ├── ElectricBorderCard.tsx
│   │   ├── FeatureCard.tsx
│   │   ├── PricingCard.tsx
│   │   ├── ScreenshotCarousel.tsx
│   │   ├── FAQAccordion.tsx
│   │   ├── TestimonialCard.tsx
│   │   ├── StepIndicator.tsx
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   ├── ui/                       # shadcn/ui components
│   └── ...existing components
├── styles/
│   ├── globals.css
│   └── marketing.css             # Marketing-specific styles
├── public/
│   ├── images/
│   │   ├── logo.png
│   │   ├── extension/            # Extension screenshots
│   │   │   ├── panel-main.png
│   │   │   ├── leverage-warning.png
│   │   │   ├── ai-explain.png
│   │   │   ├── behavioral-alert.png
│   │   │   └── settings.png
│   │   ├── platform/             # Platform screenshots
│   │   │   ├── dashboard.png
│   │   │   ├── trading.png
│   │   │   └── analytics.png
│   │   └── hero/
│   │       └── extension-mockup.png
│   └── videos/
│       └── demo.mp4
└── lib/
    └── ...existing utilities
```

### Font Configuration

```tsx
// app/layout.tsx
import { Clash_Display, Satoshi } from 'next/font/google';

// Note: These may need to be loaded from a custom source
// as they may not be on Google Fonts

const clashDisplay = localFont({
  src: '../fonts/ClashDisplay-Variable.woff2',
  variable: '--font-display',
});

const satoshi = localFont({
  src: '../fonts/Satoshi-Variable.woff2',
  variable: '--font-body',
});

// Fallback to Inter if custom fonts unavailable
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});
```

### Updated globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Existing variables... */
  
  /* Electric Border Effect */
  --color-electric-primary: #8B5CF6;
  --color-electric-secondary: #6366F1;
  --color-electric-glow: rgba(139, 92, 246, 0.6);
}

.dark {
  /* Existing dark mode variables... */
  
  /* Enhanced dark theme for marketing */
  --background: 0 0% 4%;  /* Darker background */
}

/* Marketing-specific utilities */
@layer utilities {
  .text-gradient {
    @apply bg-gradient-to-r from-purple-400 via-fuchsia-500 to-indigo-500;
    @apply bg-clip-text text-transparent;
  }
  
  .glow-purple {
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.4),
                0 0 40px rgba(139, 92, 246, 0.2),
                0 0 60px rgba(139, 92, 246, 0.1);
  }
}
```

---

## 🔍 SEO & Meta Tags

### Homepage

```tsx
export const metadata: Metadata = {
  title: "LenQuant — AI Trading Assistant for Binance Futures",
  description: "Real-time market regime analysis, leverage recommendations, and AI-powered insights. Chrome extension + web platform for disciplined crypto trading.",
  keywords: [
    "binance futures",
    "crypto trading",
    "trading assistant",
    "leverage calculator",
    "market analysis",
    "AI trading",
    "chrome extension",
  ],
  openGraph: {
    title: "LenQuant — AI Trading Assistant for Binance Futures",
    description: "Real-time market analysis and behavioral guardrails for disciplined trading.",
    url: "https://lenquant.com",
    siteName: "LenQuant",
    images: [
      {
        url: "/og/homepage.png",
        width: 1200,
        height: 630,
        alt: "LenQuant Trading Assistant",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LenQuant — AI Trading Assistant",
    description: "Your objective trading second opinion.",
    images: ["/og/homepage.png"],
  },
};
```

### Extension Page

```tsx
export const metadata: Metadata = {
  title: "Chrome Extension — LenQuant",
  description: "Install the LenQuant Chrome extension for real-time trading intelligence on Binance Futures. Market regime analysis, leverage warnings, and AI explanations.",
  // ... similar structure
};
```

### Platform Page

```tsx
export const metadata: Metadata = {
  title: "Trading Platform — LenQuant",
  description: "Advanced AI-powered trading dashboard with analytics, portfolio tracking, and intelligent insights for cryptocurrency traders.",
  // ... similar structure
};
```

---

## 📱 Responsive Design

### Breakpoints

```css
/* Tailwind defaults */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

### Mobile Considerations

1. **Hero Section:**
   - Stack content vertically
   - Reduce electric border size
   - Smaller hero text (clamp values handle this)

2. **Feature Grid:**
   - 1 column on mobile
   - 2 columns on tablet
   - 3 columns on desktop

3. **Pricing Cards:**
   - Stack vertically on mobile
   - Horizontal scroll option
   - Featured card at top

4. **Navigation:**
   - Hamburger menu on mobile
   - Slide-out drawer
   - Sticky CTA button

5. **Electric Border Effect:**
   - Reduce displacement on mobile
   - Consider static border on very small screens
   - Performance optimization

---

## 🎬 Animations & Interactions

### Page Load Animations

Using Framer Motion for staggered reveals:

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};
```

### Micro-Interactions

| Element | Interaction |
|---------|-------------|
| Buttons | Scale on hover (1.02), press effect (0.98) |
| Cards | Subtle lift on hover (translateY -4px) |
| Links | Underline animation, color transition |
| Icons | Rotation or bounce on hover |
| Electric Border | Continuous animation, speed increase on hover |

### Scroll Animations

```tsx
// Using Framer Motion's useInView
const ref = useRef(null);
const isInView = useInView(ref, { once: true, margin: "-100px" });

return (
  <motion.div
    ref={ref}
    initial={{ opacity: 0, y: 50 }}
    animate={isInView ? { opacity: 1, y: 0 } : {}}
    transition={{ duration: 0.6, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);
```

---

## ✅ Implementation Checklist

### Phase 1: Foundation
- [ ] Set up marketing route group `(marketing)`
- [ ] Create marketing layout with header/footer
- [ ] Implement design tokens in CSS
- [ ] Set up custom fonts
- [ ] Create base components (Button, Card variants)

### Phase 2: Electric Border
- [ ] Implement ElectricBorder React component
- [ ] Create ElectricBorderCard wrapper
- [ ] Add glow layer CSS
- [ ] Test performance
- [ ] Add responsive adjustments

### Phase 3: Homepage
- [ ] Hero section with electric border
- [ ] Feature grid
- [ ] How it works section
- [ ] Platform teaser
- [ ] Pricing section
- [ ] Testimonials/social proof
- [ ] FAQ accordion
- [ ] Final CTA
- [ ] Footer

### Phase 4: Secondary Pages
- [ ] Extension page
- [ ] Platform page
- [ ] Privacy policy
- [ ] Terms of use

### Phase 5: Polish
- [ ] Add page load animations
- [ ] Implement scroll animations
- [ ] Add micro-interactions
- [ ] Mobile responsiveness
- [ ] Performance optimization
- [ ] SEO meta tags
- [ ] OG images

### Phase 6: Content
- [ ] Write all copy
- [ ] Create/capture screenshots
- [ ] Record demo video
- [ ] Design OG images

---

## 📝 Content Tone & Voice

### Brand Voice

| Attribute | Description |
|-----------|-------------|
| **Professional** | We're serious about trading discipline |
| **Approachable** | Not intimidating, welcoming to new traders |
| **Honest** | Clear about what we are and aren't |
| **Empowering** | Help traders make better decisions |

### Key Messages

1. **Not a signal service** — Always clarify this
2. **Decision support tool** — Objective market conditions
3. **Discipline enforcer** — Behavioral guardrails
4. **Works for anyone** — Beginners to experienced traders

### Writing Guidelines

- Use "you/your" to address the reader
- Be specific about features, not vague
- Include disclaimers where appropriate
- Avoid hype words ("revolutionary", "game-changing")
- Focus on benefits, not just features

---

## 🚀 Implementation Status

### ✅ Completed Phases

| Phase | Component | Status | Details |
|-------|-----------|--------|---------|
| 1 | Foundation | ✅ Complete | Design system, components, GA4 setup |
| 2 | Electric Border | ✅ Complete | Animated border effect component |
| 3 | Homepage | ✅ Complete | All sections with electric border |
| 4 | Extension Page | ✅ Complete | Dedicated Chrome extension showcase |
| 5 | Platform Page | ✅ Complete | Web platform features page |
| 6 | Legal Pages | ✅ Complete | Privacy Policy & Terms of Use |
| 7 | SEO & Analytics | ✅ Complete | SEO optimization, GA4 tracking, performance |

### 🎯 Website Ready for Launch

The LenQuant website is now **production-ready** with:

- **Complete marketing pages** (Homepage, Extension, Platform, Legal)
- **Full SEO optimization** (meta tags, structured data, sitemap)
- **Analytics tracking** (GA4 with 15+ custom events)
- **Performance optimizations** (compression, caching, image optimization)
- **Accessibility features** (skip links, focus management, reduced motion)
- **Error handling** (loading states, 404 page, error boundaries)
- **Successful build** (TypeScript validation, no errors)

### 📋 Pre-Launch Checklist

- [ ] Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` environment variable
- [ ] Replace `EXTENSION_ID` with actual Chrome Web Store ID
- [ ] Upload OG images to `/images/og/` directory
- [ ] Upload screenshots to `/images/extension/` and `/images/platform/`
- [ ] Review legal content with counsel
- [ ] Test on multiple browsers and devices
- [ ] Run Lighthouse audit (aim for 90+ scores)
- [ ] Configure production domain and SSL

## 🚀 Next Steps

1. **Review this documentation** with stakeholders
2. **Finalize design mockups** based on these specs
3. **Create asset list** (screenshots, videos, icons)
4. **Begin implementation** following the checklist
5. **Content writing** in parallel with development
6. **Testing & QA** on multiple devices
7. **Launch preparation** (SEO, analytics, monitoring)

---

*This documentation serves as the source of truth for the LenQuant website redesign. Update as needed during implementation.*

