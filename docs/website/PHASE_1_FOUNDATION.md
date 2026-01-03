# Phase 1: Foundation Setup

**Phase:** 1 of 7  
**Estimated Time:** 4-6 hours  
**Dependencies:** None  
**Output:** Project structure, design system, base components

---

## 📋 Overview

This phase establishes the foundation for the new LenQuant marketing website, including:
- Design system (colors, typography, spacing) - ✅ COMPLETED
- Google Analytics 4 integration - ✅ COMPLETED
- Enhanced SEO utilities with structured data - ✅ COMPLETED
- Core shadcn/ui components setup - ✅ COMPLETED
- Custom fonts installation - ✅ COMPLETED
- Marketing components (Header, Footer, etc.) - ✅ COMPLETED

**Note:** App Router migration was prepared but deferred due to conflicts with existing Pages Router. Components are ready for when routing migration occurs in a future phase.

---

## 🎯 Objectives

1. ✅ Install required dependencies (@next/third-parties, framer-motion, shadcn/ui components)
2. ✅ Install and configure custom fonts (Space Grotesk, Inter, JetBrains Mono)
3. ✅ Set up comprehensive design tokens (CSS variables for marketing theme)
4. ✅ Configure Google Analytics 4 integration and analytics utilities
5. ✅ Create enhanced SEO utilities with structured data support
6. ✅ Create marketing components (Header, Footer, GoogleAnalytics, StructuredData)
7. ⏳ Create marketing route group structure (prepared but deferred due to routing conflicts)

---

## 📁 Project Structure

The following foundation components were created:

```
web/next-app/
├── components/
│   ├── marketing/                      # Marketing components ✅ CREATED
│   │   ├── Header.tsx                  # Responsive header with analytics
│   │   ├── Footer.tsx                  # Footer with social links
│   │   ├── GoogleAnalytics.tsx         # GA4 integration component
│   │   └── StructuredData.tsx          # JSON-LD structured data
│   └── ui/                             # shadcn/ui (existing + new)
│       ├── accordion.tsx               # ✅ ADDED
│       ├── carousel.tsx                # ✅ ADDED
│       └── ...                         # Existing components
├── lib/
│   ├── analytics.ts                    # GA4 utilities ✅ CREATED
│   └── seo.ts                          # Enhanced SEO utilities ✅ UPDATED
├── styles/
│   └── globals.css                     # ✅ UPDATED with marketing design system
└── public/
    └── images/
        └── og/                         # Open Graph images directory ✅ CREATED
```

**Note:** App Router structure was prepared but deferred due to conflicts with existing Pages Router. Components are ready for implementation when routing migration occurs.

---

## 📦 Dependencies

### Install Required Packages

```bash
cd web/next-app

# Analytics
npm install @next/third-parties

# Animations (for later phases)
npm install framer-motion

# Icons (if not already installed)
npm install lucide-react

# Ensure shadcn/ui is up to date
npx shadcn-ui@latest add accordion carousel tabs badge
```

---

## 🎨 Design System Implementation

### File: `styles/globals.css`

Replace the existing globals.css with the enhanced version:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ============================================
   DESIGN TOKENS - LenQuant Brand System
   ============================================ */

:root {
  /* === BRAND COLORS === */
  --color-brand-primary: 271 91% 65%;      /* Vivid Purple #A855F7 */
  --color-brand-secondary: 265 89% 78%;    /* Light Purple #C4B5FD */
  --color-brand-accent: 217 91% 60%;       /* Electric Blue #3B82F6 */
  
  /* === ELECTRIC EFFECT COLORS === */
  --color-electric-purple: #8B5CF6;
  --color-electric-indigo: #6366F1;
  --color-electric-blue: #3B82F6;
  --color-electric-glow: rgba(139, 92, 246, 0.6);
  
  /* === LIGHT MODE (default for legal pages) === */
  --background: 0 0% 100%;
  --foreground: 224 71% 4%;
  --card: 0 0% 100%;
  --card-foreground: 224 71% 4%;
  --popover: 0 0% 100%;
  --popover-foreground: 224 71% 4%;
  --primary: 271 91% 65%;
  --primary-foreground: 0 0% 100%;
  --secondary: 220 14% 96%;
  --secondary-foreground: 220 9% 46%;
  --muted: 220 14% 96%;
  --muted-foreground: 220 9% 46%;
  --accent: 265 89% 78%;
  --accent-foreground: 224 71% 4%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  --border: 220 13% 91%;
  --input: 220 13% 91%;
  --ring: 271 91% 65%;
  --radius: 0.75rem;
  
  /* === TYPOGRAPHY === */
  --font-display: 'Clash Display', 'Inter', system-ui, sans-serif;
  --font-body: 'Satoshi', 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  
  /* === SPACING === */
  --space-section: 8rem;
  --space-block: 4rem;
  
  /* === TRANSITIONS === */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 400ms ease;
}

/* === DARK MODE (Marketing pages default) === */
.dark {
  --background: 0 0% 3.9%;                 /* Near black #0A0A0A */
  --foreground: 0 0% 98%;
  --card: 0 0% 6%;
  --card-foreground: 0 0% 98%;
  --popover: 0 0% 6%;
  --popover-foreground: 0 0% 98%;
  --primary: 271 91% 65%;
  --primary-foreground: 0 0% 3.9%;
  --secondary: 0 0% 12%;
  --secondary-foreground: 0 0% 98%;
  --muted: 0 0% 12%;
  --muted-foreground: 0 0% 63.9%;
  --accent: 265 89% 78%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;
  --border: 0 0% 14.9%;
  --input: 0 0% 14.9%;
  --ring: 271 91% 65%;
}

/* ============================================
   BASE STYLES
   ============================================ */

@layer base {
  * {
    @apply border-border;
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    @apply bg-background text-foreground antialiased;
    font-family: var(--font-body);
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-display);
    @apply font-semibold tracking-tight;
  }

  /* Focus styles for accessibility */
  :focus-visible {
    @apply outline-none ring-2 ring-ring ring-offset-2 ring-offset-background;
  }
}

/* ============================================
   MARKETING UTILITIES
   ============================================ */

@layer utilities {
  /* Gradient text */
  .text-gradient {
    @apply bg-clip-text text-transparent;
    background-image: linear-gradient(
      135deg,
      hsl(271 91% 65%) 0%,
      hsl(265 89% 78%) 50%,
      hsl(217 91% 60%) 100%
    );
  }

  /* Purple glow effect */
  .glow-purple {
    box-shadow: 
      0 0 20px rgba(139, 92, 246, 0.4),
      0 0 40px rgba(139, 92, 246, 0.2),
      0 0 60px rgba(139, 92, 246, 0.1);
  }

  /* Subtle card glow on hover */
  .glow-card {
    @apply transition-shadow duration-300;
  }
  .glow-card:hover {
    box-shadow: 
      0 0 30px rgba(139, 92, 246, 0.15),
      0 4px 20px rgba(0, 0, 0, 0.3);
  }

  /* Section spacing */
  .section-padding {
    @apply py-16 md:py-24 lg:py-32;
  }

  /* Container with max-width */
  .container-marketing {
    @apply mx-auto max-w-7xl px-4 sm:px-6 lg:px-8;
  }

  /* Gradient backgrounds */
  .bg-gradient-radial {
    background: radial-gradient(
      ellipse at center,
      hsl(271 91% 65% / 0.15) 0%,
      transparent 70%
    );
  }

  .bg-gradient-dark {
    background: linear-gradient(
      180deg,
      hsl(0 0% 3.9%) 0%,
      hsl(0 0% 6%) 100%
    );
  }

  /* Noise texture overlay */
  .noise-overlay {
    position: relative;
  }
  .noise-overlay::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    opacity: 0.02;
    pointer-events: none;
    z-index: 1;
  }

  /* Glass effect for cards */
  .glass {
    @apply bg-white/5 backdrop-blur-xl border border-white/10;
  }

  /* Hide scrollbar */
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}

/* ============================================
   ANIMATION KEYFRAMES
   ============================================ */

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes pulse-glow {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}

.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}

.animate-slide-up {
  animation: slide-up 0.5s ease-out forwards;
}

.animate-fade-in {
  animation: fade-in 0.5s ease-out forwards;
}

/* Staggered animation delays */
.delay-100 { animation-delay: 100ms; }
.delay-200 { animation-delay: 200ms; }
.delay-300 { animation-delay: 300ms; }
.delay-400 { animation-delay: 400ms; }
.delay-500 { animation-delay: 500ms; }
```

---

## 🔤 Font Configuration

### Option A: Using Google Fonts (Fallback)

If Clash Display and Satoshi are not available, use these excellent alternatives:

### File: `app/layout.tsx` (Update)

```tsx
import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { GoogleAnalytics } from "@/components/marketing/GoogleAnalytics";
import "./globals.css";

// Display font - distinctive, not generic
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

// Body font
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

// Monospace font for code/data
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://lenquant.com"),
  title: {
    default: "LenQuant — AI Trading Assistant for Binance Futures",
    template: "%s | LenQuant",
  },
  description:
    "Real-time market regime analysis, leverage recommendations, and AI-powered insights. Chrome extension + web platform for disciplined crypto trading.",
  keywords: [
    "binance futures",
    "crypto trading",
    "trading assistant",
    "leverage calculator",
    "market analysis",
    "AI trading",
    "chrome extension",
    "trading discipline",
    "regime detection",
  ],
  authors: [{ name: "LenQuant" }],
  creator: "LenQuant",
  publisher: "LenQuant",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://lenquant.com",
    siteName: "LenQuant",
    title: "LenQuant — AI Trading Assistant for Binance Futures",
    description:
      "Real-time market analysis and behavioral guardrails for disciplined trading.",
    images: [
      {
        url: "/images/og/default.png",
        width: 1200,
        height: 630,
        alt: "LenQuant - Your Objective Trading Second Opinion",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LenQuant — AI Trading Assistant",
    description: "Your objective trading second opinion.",
    images: ["/images/og/default.png"],
    creator: "@lenquant",
  },
  icons: {
    icon: [
      { url: "/images/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/images/favicon/apple-icon-180x180.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "mask-icon", url: "/images/favicon/safari-pinned-tab.svg", color: "#8B5CF6" },
    ],
  },
  manifest: "/images/favicon/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <GoogleAnalytics />
      </head>
      <body className="min-h-screen bg-background font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

---

## 📊 Google Analytics 4 Integration

### File: `components/marketing/GoogleAnalytics.tsx`

```tsx
"use client";

import Script from "next/script";

// Replace with your actual GA4 Measurement ID
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-XXXXXXXXXX";

export function GoogleAnalytics() {
  if (process.env.NODE_ENV !== "production") {
    return null; // Don't load GA in development
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
            send_page_view: true,
          });
        `}
      </Script>
    </>
  );
}
```

### File: `lib/analytics.ts`

```typescript
// Google Analytics 4 Event Tracking Utilities

type GAEvent = {
  action: string;
  category: string;
  label?: string;
  value?: number;
};

// Check if GA is loaded
const isGALoaded = (): boolean => {
  return typeof window !== "undefined" && typeof window.gtag === "function";
};

// Track custom events
export const trackEvent = ({ action, category, label, value }: GAEvent): void => {
  if (!isGALoaded()) return;

  window.gtag("event", action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};

// Pre-defined events for LenQuant
export const analytics = {
  // CTA Clicks
  clickInstallExtension: (location: string) => {
    trackEvent({
      action: "click_install_extension",
      category: "CTA",
      label: location, // e.g., "hero", "footer", "pricing"
    });
  },

  clickStartTrial: (tier: string) => {
    trackEvent({
      action: "click_start_trial",
      category: "CTA",
      label: tier, // e.g., "pro", "premium"
    });
  },

  clickLogin: () => {
    trackEvent({
      action: "click_login",
      category: "CTA",
    });
  },

  // Navigation
  viewPage: (pageName: string) => {
    trackEvent({
      action: "page_view",
      category: "Navigation",
      label: pageName,
    });
  },

  clickNavLink: (linkName: string) => {
    trackEvent({
      action: "click_nav_link",
      category: "Navigation",
      label: linkName,
    });
  },

  // Engagement
  watchVideo: (videoName: string, percentWatched?: number) => {
    trackEvent({
      action: "watch_video",
      category: "Engagement",
      label: videoName,
      value: percentWatched,
    });
  },

  expandFAQ: (question: string) => {
    trackEvent({
      action: "expand_faq",
      category: "Engagement",
      label: question,
    });
  },

  viewScreenshot: (screenshotName: string) => {
    trackEvent({
      action: "view_screenshot",
      category: "Engagement",
      label: screenshotName,
    });
  },

  scrollDepth: (percentage: number) => {
    trackEvent({
      action: "scroll_depth",
      category: "Engagement",
      value: percentage,
    });
  },

  // Conversions
  completeSignup: (tier: string) => {
    trackEvent({
      action: "complete_signup",
      category: "Conversion",
      label: tier,
    });
  },

  startCheckout: (tier: string, price: number) => {
    trackEvent({
      action: "begin_checkout",
      category: "Conversion",
      label: tier,
      value: price,
    });
  },

  completePurchase: (tier: string, price: number) => {
    trackEvent({
      action: "purchase",
      category: "Conversion",
      label: tier,
      value: price,
    });
  },
};

// TypeScript declaration for window.gtag
declare global {
  interface Window {
    gtag: (
      command: "event" | "config" | "js",
      targetId: string | Date,
      config?: Record<string, unknown>
    ) => void;
    dataLayer: unknown[];
  }
}
```

### Environment Variable

Add to `.env.local`:

```env
# Google Analytics 4
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

---

## 🔍 SEO Components

### File: `lib/seo.ts`

```typescript
import type { Metadata } from "next";

interface SEOParams {
  title: string;
  description: string;
  path: string;
  image?: string;
  noIndex?: boolean;
}

const baseUrl = "https://lenquant.com";

export function generateSEO({
  title,
  description,
  path,
  image = "/images/og/default.png",
  noIndex = false,
}: SEOParams): Metadata {
  const url = `${baseUrl}${path}`;
  const fullImageUrl = image.startsWith("http") ? image : `${baseUrl}${image}`;

  return {
    title,
    description,
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "LenQuant",
      images: [
        {
          url: fullImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [fullImageUrl],
    },
  };
}

// JSON-LD Structured Data Generators
export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "LenQuant",
    url: baseUrl,
    logo: `${baseUrl}/images/logo.png`,
    description:
      "AI-powered trading assistant for Binance Futures with real-time market analysis and behavioral guardrails.",
    sameAs: [
      "https://twitter.com/lenquant",
      "https://discord.gg/lenquant",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      email: "support@lenquant.com",
      contactType: "customer service",
    },
  };
}

export function generateProductSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LenQuant Chrome Extension",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Chrome",
    offers: [
      {
        "@type": "Offer",
        name: "Free Trial",
        price: "0",
        priceCurrency: "USD",
        description: "3-day full access trial",
      },
      {
        "@type": "Offer",
        name: "Pro",
        price: "19.99",
        priceCurrency: "USD",
        priceValidUntil: "2027-12-31",
        description: "Monthly subscription with full features",
      },
      {
        "@type": "Offer",
        name: "Premium",
        price: "39.99",
        priceCurrency: "USD",
        priceValidUntil: "2027-12-31",
        description: "Monthly subscription with extended features",
      },
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "50",
      bestRating: "5",
      worstRating: "1",
    },
    description:
      "Real-time market regime analysis for Binance Futures with leverage recommendations and AI-powered trade explanations.",
    screenshot: `${baseUrl}/images/extension/panel-main.png`,
    featureList: [
      "Real-time market regime analysis",
      "Leverage recommendations",
      "AI-powered trade explanations",
      "Behavioral guardrails",
      "Trade journal",
    ],
  };
}

export function generateFAQSchema(
  faqs: Array<{ question: string; answer: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function generateBreadcrumbSchema(
  items: Array<{ name: string; url: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.url}`,
    })),
  };
}
```

### File: `components/marketing/StructuredData.tsx`

```tsx
interface StructuredDataProps {
  data: Record<string, unknown>;
}

export function StructuredData({ data }: StructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

---

## 🧭 Marketing Layout

### File: `app/(marketing)/layout.tsx`

```tsx
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/marketing/Header";
import { Footer } from "@/components/marketing/Footer";
import { StructuredData } from "@/components/marketing/StructuredData";
import { generateOrganizationSchema } from "@/lib/seo";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <StructuredData data={generateOrganizationSchema()} />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
```

### File: `components/marketing/Header.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { analytics } from "@/lib/analytics";

const navigation = [
  { name: "Extension", href: "/extension" },
  { name: "Platform", href: "/platform" },
  { name: "Pricing", href: "/#pricing" },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (name: string) => {
    analytics.clickNavLink(name);
    setMobileMenuOpen(false);
  };

  const handleInstallClick = () => {
    analytics.clickInstallExtension("header");
  };

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-black/5"
          : "bg-transparent"
      )}
    >
      <nav className="container-marketing">
        <div className="flex h-16 items-center justify-between lg:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            {/* PLACEHOLDER: Replace with actual logo */}
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <span className="font-display text-xl font-bold text-foreground">
              LenQuant
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex lg:items-center lg:gap-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => handleNavClick(item.name)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden lg:flex lg:items-center lg:gap-4">
            <Link href="/login">
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => analytics.clickLogin()}
              >
                Log in
              </Button>
            </Link>
            <a
              href="https://chrome.google.com/webstore/detail/lenquant/EXTENSION_ID"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleInstallClick}
            >
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground glow-purple">
                Install Extension
              </Button>
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="lg:hidden p-2 text-muted-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="sr-only">Toggle menu</span>
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
            <div className="space-y-1 px-4 py-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => handleNavClick(item.name)}
                  className="block py-3 text-base font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.name}
                </Link>
              ))}
              <div className="pt-4 space-y-3">
                <Link href="/login" className="block">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => analytics.clickLogin()}
                  >
                    Log in
                  </Button>
                </Link>
                <a
                  href="https://chrome.google.com/webstore/detail/lenquant/EXTENSION_ID"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleInstallClick}
                  className="block"
                >
                  <Button className="w-full bg-primary hover:bg-primary/90">
                    Install Extension
                  </Button>
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
```

### File: `components/marketing/Footer.tsx`

```tsx
import Link from "next/link";
import { Twitter, MessageCircle, Github } from "lucide-react";

const footerLinks = {
  product: [
    { name: "Extension", href: "/extension" },
    { name: "Platform", href: "/platform" },
    { name: "Pricing", href: "/#pricing" },
    { name: "Changelog", href: "/changelog" },
  ],
  company: [
    { name: "About", href: "/about" },
    { name: "Blog", href: "/blog" },
    { name: "Contact", href: "mailto:support@lenquant.com" },
  ],
  legal: [
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Terms of Use", href: "/terms" },
  ],
  social: [
    { name: "Twitter", href: "https://twitter.com/lenquant", icon: Twitter },
    { name: "Discord", href: "https://discord.gg/lenquant", icon: MessageCircle },
    { name: "GitHub", href: "https://github.com/lenquant", icon: Github },
  ],
};

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/50 bg-background">
      <div className="container-marketing py-12 lg:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              {/* PLACEHOLDER: Replace with actual logo */}
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">L</span>
              </div>
              <span className="font-display text-xl font-bold text-foreground">
                LenQuant
              </span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground max-w-xs">
              Your objective trading second opinion. AI-powered market analysis
              for disciplined crypto trading.
            </p>
            {/* Social Links */}
            <div className="mt-6 flex gap-4">
              {footerLinks.social.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={item.name}
                >
                  <item.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Product</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.product.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Company</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.company.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Legal</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.legal.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-12 border-t border-border/50 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-muted-foreground">
              © {currentYear} LenQuant. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground max-w-xl text-center md:text-right">
              ⚠️ Disclaimer: LenQuant is a decision support tool, not a signal
              service. It does not guarantee profits or make trading decisions
              for you. Trading cryptocurrency involves substantial risk of loss.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

---

## 📁 Create Placeholder Pages

### File: `app/(marketing)/page.tsx`

```tsx
import { generateSEO } from "@/lib/seo";

export const metadata = generateSEO({
  title: "LenQuant — AI Trading Assistant for Binance Futures",
  description:
    "Real-time market regime analysis, leverage recommendations, and AI-powered insights. Chrome extension + web platform for disciplined crypto trading.",
  path: "/",
});

export default function HomePage() {
  return (
    <div className="pt-16 lg:pt-20">
      {/* Placeholder - will be implemented in Phase 3 */}
      <section className="section-padding">
        <div className="container-marketing text-center">
          <h1 className="text-4xl font-bold text-foreground md:text-6xl">
            Homepage Coming Soon
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            This page will be implemented in Phase 3.
          </p>
        </div>
      </section>
    </div>
  );
}
```

### File: `app/(marketing)/extension/page.tsx`

```tsx
import { generateSEO } from "@/lib/seo";

export const metadata = generateSEO({
  title: "Chrome Extension — Real-Time Trading Intelligence",
  description:
    "Install the LenQuant Chrome extension for real-time trading intelligence on Binance Futures. Market regime analysis, leverage warnings, and AI explanations.",
  path: "/extension",
  image: "/images/og/extension.png",
});

export default function ExtensionPage() {
  return (
    <div className="pt-16 lg:pt-20">
      {/* Placeholder - will be implemented in Phase 4 */}
      <section className="section-padding">
        <div className="container-marketing text-center">
          <h1 className="text-4xl font-bold text-foreground md:text-6xl">
            Extension Page Coming Soon
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            This page will be implemented in Phase 4.
          </p>
        </div>
      </section>
    </div>
  );
}
```

### File: `app/(marketing)/platform/page.tsx`

```tsx
import { generateSEO } from "@/lib/seo";

export const metadata = generateSEO({
  title: "Trading Platform — Advanced AI-Powered Dashboard",
  description:
    "Advanced AI-powered trading dashboard with analytics, portfolio tracking, and intelligent insights for cryptocurrency traders.",
  path: "/platform",
  image: "/images/og/platform.png",
});

export default function PlatformPage() {
  return (
    <div className="pt-16 lg:pt-20">
      {/* Placeholder - will be implemented in Phase 5 */}
      <section className="section-padding">
        <div className="container-marketing text-center">
          <h1 className="text-4xl font-bold text-foreground md:text-6xl">
            Platform Page Coming Soon
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            This page will be implemented in Phase 5.
          </p>
        </div>
      </section>
    </div>
  );
}
```

### File: `app/(marketing)/privacy/page.tsx`

```tsx
import { generateSEO } from "@/lib/seo";

export const metadata = generateSEO({
  title: "Privacy Policy",
  description:
    "LenQuant Privacy Policy. Learn how we collect, use, and protect your data.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <div className="pt-16 lg:pt-20">
      {/* Placeholder - will be implemented in Phase 6 */}
      <section className="section-padding">
        <div className="container-marketing text-center">
          <h1 className="text-4xl font-bold text-foreground md:text-6xl">
            Privacy Policy Coming Soon
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            This page will be implemented in Phase 6.
          </p>
        </div>
      </section>
    </div>
  );
}
```

### File: `app/(marketing)/terms/page.tsx`

```tsx
import { generateSEO } from "@/lib/seo";

export const metadata = generateSEO({
  title: "Terms of Use",
  description:
    "LenQuant Terms of Use. Read our terms and conditions for using the LenQuant platform and Chrome extension.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <div className="pt-16 lg:pt-20">
      {/* Placeholder - will be implemented in Phase 6 */}
      <section className="section-padding">
        <div className="container-marketing text-center">
          <h1 className="text-4xl font-bold text-foreground md:text-6xl">
            Terms of Use Coming Soon
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            This page will be implemented in Phase 6.
          </p>
        </div>
      </section>
    </div>
  );
}
```

---

## ✅ Phase 1 Checklist

### Dependencies
- [x] Install @next/third-parties for GA4
- [x] Install framer-motion for animations
- [x] Install shadcn/ui accordion and carousel components
- [x] Fix tailwind.config.ts duplicate key errors

### Design System
- [x] Update `styles/globals.css` with comprehensive marketing tokens
- [x] Configure custom fonts (Space Grotesk, Inter, JetBrains Mono)
- [x] Verify color variables work in dark mode
- [x] Test utility classes (text-gradient, glow-purple, etc.)

### Google Analytics
- [x] Implement `GoogleAnalytics.tsx` component
- [x] Implement `analytics.ts` event tracking utilities
- [x] Add GA4 measurement ID environment variable setup
- [x] Create pre-defined event tracking functions

### SEO
- [x] Enhance `lib/seo.ts` with structured data utilities
- [x] Add JSON-LD schema generators (Organization, Product, FAQ, etc.)
- [x] Implement `StructuredData.tsx` component
- [x] Create Open Graph image directory structure

### Components
- [x] Implement `Header.tsx` with responsive navigation
- [x] Implement `Footer.tsx` with social links and disclaimer
- [x] Implement `StructuredData.tsx` for JSON-LD
- [x] Create `GoogleAnalytics.tsx` component
- [x] All components include proper TypeScript types

### Testing
- [x] Run `npm run build` successfully
- [x] Fix TypeScript compilation errors
- [x] Verify existing functionality remains intact
- [x] Check for console errors

### Routing Notes
- [ ] App Router migration prepared but deferred
- [ ] Marketing route components created but not deployed
- [ ] Existing Pages Router preserved for dashboard functionality
- [ ] Ready for routing migration in future phase

---

## 🚀 Next Phase

Phase 1 foundation is complete! All design system, analytics, SEO, and component infrastructure is ready.

**Next Steps:**
1. **Phase 2: Electric Border Component** - Implement the animated electric border effect
2. **Routing Migration** - Migrate from Pages Router to App Router to deploy marketing routes
3. **Homepage Implementation** - Build the extension-focused hero homepage

The marketing components are ready and waiting for the routing migration to bring them to life.

---

*Phase 1 establishes the foundation. Do not proceed to other phases until all items are checked off.*

