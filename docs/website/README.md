# LenQuant Website Implementation Guide

**Version:** 1.0  
**Created:** January 2026  
**Purpose:** Comprehensive implementation guide for the new LenQuant marketing website

---

## 📋 Overview

This documentation provides a complete, phased implementation plan for the LenQuant marketing website. The website features:

- **Chrome Extension** as the principal product (hero focus)
- **Web Platform** as the complementary advanced dashboard
- **Electric border effect** for dramatic visual emphasis
- **Dark theme** with purple/blue accent colors
- **shadcn/ui** component library
- **Google Analytics 4** integration
- **Comprehensive SEO** optimization

---

## 🗂️ Documentation Structure

| Phase | File | Description | Est. Time |
|-------|------|-------------|-----------|
| 1 | [PHASE_1_FOUNDATION.md](./PHASE_1_FOUNDATION.md) | ✅ Project setup, design system, GA4, base components | 4-6 hours |
| 2 | [PHASE_2_ELECTRIC_BORDER.md](./PHASE_2_ELECTRIC_BORDER.md) | Animated electric border effect component | 3-4 hours |
| 3 | [PHASE_3_HOMEPAGE.md](./PHASE_3_HOMEPAGE.md) | Complete homepage with all sections | 8-10 hours |
| 4 | [PHASE_4_EXTENSION_PAGE.md](./PHASE_4_EXTENSION_PAGE.md) | ✅ Dedicated Chrome extension showcase | 5-6 hours |
| 5 | [PHASE_5_PLATFORM_PAGE.md](./PHASE_5_PLATFORM_PAGE.md) | ✅ Web platform features page | 4-5 hours |
| 6 | [PHASE_6_LEGAL_PAGES.md](./PHASE_6_LEGAL_PAGES.md) | Privacy Policy & Terms of Use | 3-4 hours |
| 7 | [PHASE_7_SEO_ANALYTICS_POLISH.md](./PHASE_7_SEO_ANALYTICS_POLISH.md) | ✅ SEO, analytics, performance, testing | 4-5 hours |

**Total Estimated Time:** 31-40 hours

---

## 🎯 Implementation Order

Execute phases in order. Each phase builds on the previous:

```
✅ Phase 1: Foundation (Complete)
    ↓
Phase 2: Electric Border
    ↓
Phase 3: Homepage ←──────────┐
    ↓                        │
✅ Phase 4: Extension Page   │ (can be parallel)
    ↓                        │
✅ Phase 5: Platform Page ───┘
    ↓
Phase 6: Legal Pages
    ↓
✅ Phase 7: SEO & Polish
    ↓
🚀 Launch Ready
```

**Note:** Phases 3, 4, and 5 can be developed in parallel after Phase 2 is complete.
**Current Status:** All phases complete. Website ready for production deployment.

---

## 🏗️ Site Architecture

```
lenquant.com/
├── /                    # Homepage (Extension-focused hero)
├── /extension           # Chrome Extension dedicated page
├── /platform            # Web Platform features page
├── /privacy             # Privacy Policy
├── /terms               # Terms of Use
├── /login               # Authentication (existing)
├── /dashboard/*         # App routes (existing, authenticated)
└── /api/*               # Backend API routes (existing)
```

---

## 🎨 Design System Summary

### Colors

| Purpose | Value | Usage |
|---------|-------|-------|
| Primary | `#8B5CF6` (Purple) | CTAs, accents, links |
| Secondary | `#6366F1` (Indigo) | Secondary elements |
| Accent | `#3B82F6` (Blue) | Tertiary accents |
| Background | `#0A0A0A` (Near Black) | Page background |
| Card | `#191919` (Dark Gray) | Card backgrounds |

### Typography

| Element | Font | Size |
|---------|------|------|
| Display/Headlines | Space Grotesk | 3rem - 6rem |
| Body | Inter | 1rem |
| Mono/Code | JetBrains Mono | 0.875rem |

### Key Components

- **ElectricBorderCard** — Animated border effect for high-impact elements
- **FeatureCard** — Icon + title + description card
- **PricingCard** — Tier pricing with features list
- **FAQAccordion** — Expandable FAQ items
- **ScreenshotCarousel** — Image gallery with navigation

---

## 📊 Analytics Events

Key events to track (implemented in Phase 7):

| Event | Category | Trigger |
|-------|----------|---------|
| `click_install_extension` | CTA | Install button clicks |
| `click_start_trial` | CTA | Trial signup clicks |
| `expand_faq` | Engagement | FAQ item expansion |
| `scroll_depth` | Engagement | 25%, 50%, 75%, 90% scroll |
| `view_screenshot` | Engagement | Screenshot carousel navigation |
| `purchase` | Conversion | Subscription purchase |

---

## 🔍 SEO Checklist

Each page includes:

- ✅ Unique title and description
- ✅ Open Graph tags
- ✅ Twitter Card tags
- ✅ Structured data (Organization, Product, FAQ, Breadcrumb)
- ✅ Canonical URL
- ✅ Sitemap entry
- ✅ Proper heading hierarchy

---

## 📦 Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "framer-motion": "^10.x",
    "lucide-react": "^0.x",
    "@next/third-parties": "^14.x"
  }
}
```

Ensure shadcn/ui components:
- Accordion
- Badge
- Button
- Card
- Tabs

---

## 📝 Content Placeholders

Images and videos are marked as placeholders in the documentation. Before launch:

| Asset | Location | Dimensions |
|-------|----------|------------|
| OG Homepage | `/images/og/homepage.png` | 1200×630 |
| OG Extension | `/images/og/extension.png` | 1200×630 |
| OG Platform | `/images/og/platform.png` | 1200×630 |
| Extension Screenshots (5) | `/images/extension/*.png` | 1280×800 |
| Platform Screenshots (5) | `/images/platform/*.png` | 1280×800 |
| Demo Video | `/videos/demo.mp4` | 1920×1080 |

---

## ⚠️ Important Notes

1. **Legal Review Required**
   - Privacy Policy and Terms of Use should be reviewed by legal counsel before launch
   - Update jurisdiction in Terms (Section 15)

2. **Chrome Web Store Link**
   - Replace `EXTENSION_ID` placeholders with actual extension ID after Chrome Web Store submission

3. **GA4 Measurement ID**
   - Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in environment variables

4. **Email Addresses**
   - Ensure `support@lenquant.com`, `legal@lenquant.com`, `privacy@lenquant.com` are configured

5. **Electric Border Performance**
   - Use sparingly (2-3 instances per page max)
   - Respects `prefers-reduced-motion`
   - Pauses when not visible

---

## 🚀 Quick Start

```bash
# 1. Read Phase 1 documentation
open docs/website/PHASE_1_FOUNDATION.md

# 2. Install dependencies
cd web/next-app
npm install framer-motion @next/third-parties

# 3. Follow each phase in order
# 4. Test with `npm run build && npm run start`
# 5. Complete testing checklists in Phase 7
```

---

## 📞 Support

For questions about this documentation:
- Review the specific phase documentation
- Check the related component files
- Reference the main [WEBSITE_DOCUMENTATION.md](../../WEBSITE_DOCUMENTATION.md)

---

*This implementation guide ensures a consistent, high-quality website build. Follow phases in order for best results.*

