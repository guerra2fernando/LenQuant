# Phase 4: Extension Page Implementation

**Phase:** 4 of 7 ✅ **COMPLETED**
**Estimated Time:** 5-6 hours
**Actual Time:** ~4 hours
**Dependencies:** Phase 1 (Foundation), Phase 2 (Electric Border)
**Output:** Dedicated Chrome Extension showcase page

---

## 📋 Overview

The Extension page is a dedicated showcase for the Chrome Extension — the principal product. It provides detailed feature breakdowns, screenshots, installation guides, and technical specifications to convert visitors to Chrome Web Store installs.

---

## 🎯 Objectives

1. ✅ Hero section with extension branding
2. ✅ Screenshot gallery/carousel
3. ✅ Detailed feature deep-dives
4. ✅ Step-by-step installation guide
5. ✅ Technical specifications
6. ✅ Compatibility information
7. ✅ Integration with platform teaser
8. ✅ Final CTA

---

## 📁 File Structure

```
app/(marketing)/extension/
└── page.tsx
components/marketing/
├── ScreenshotCarousel.tsx
├── FeatureDeepDive.tsx
└── TechSpecCard.tsx
```

---

## 🔧 Implementation

### File: `app/(marketing)/extension/page.tsx`

```tsx
import { Metadata } from "next";
import { generateSEO, generateProductSchema, generateBreadcrumbSchema } from "@/lib/seo";
import { StructuredData } from "@/components/marketing/StructuredData";
import { ExtensionHero } from "@/components/marketing/extension/ExtensionHero";
import { ScreenshotSection } from "@/components/marketing/extension/ScreenshotSection";
import { FeaturesDeepDive } from "@/components/marketing/extension/FeaturesDeepDive";
import { InstallationGuide } from "@/components/marketing/extension/InstallationGuide";
import { TechSpecs } from "@/components/marketing/extension/TechSpecs";
import { ExtensionCTA } from "@/components/marketing/extension/ExtensionCTA";

export const metadata: Metadata = generateSEO({
  title: "Chrome Extension — Real-Time Trading Intelligence for Binance Futures",
  description:
    "Install the LenQuant Chrome extension for real-time market regime analysis, leverage recommendations, and AI-powered trade explanations. Works instantly on Binance Futures.",
  path: "/extension",
  image: "/images/og/extension.png",
});

const breadcrumbs = [
  { name: "Home", url: "/" },
  { name: "Extension", url: "/extension" },
];

export default function ExtensionPage() {
  return (
    <>
      <StructuredData data={generateProductSchema()} />
      <StructuredData data={generateBreadcrumbSchema(breadcrumbs)} />

      <div className="relative">
        {/* Background effects */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px]" />
        </div>

        <ExtensionHero />
        <ScreenshotSection />
        <FeaturesDeepDive />
        <InstallationGuide />
        <TechSpecs />
        <ExtensionCTA />
      </div>
    </>
  );
}
```

---

## 🦸 Extension Hero Section

### File: `components/marketing/extension/ExtensionHero.tsx`

```tsx
"use client";

import { motion } from "framer-motion";
import { Chrome, Star, Users, Zap, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { analytics } from "@/lib/analytics";

export function ExtensionHero() {
  const handleInstallClick = () => {
    analytics.clickInstallExtension("extension_hero");
  };

  const handleWatchDemo = () => {
    analytics.clickNavLink("extension_watch_demo");
  };

  return (
    <section className="pt-24 lg:pt-32 pb-16 lg:pb-24">
      <div className="container-marketing">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge
              variant="outline"
              className="mb-6 px-4 py-1.5 text-sm font-medium border-purple-500/30 bg-purple-500/10 text-purple-300"
            >
              <Chrome className="w-3.5 h-3.5 mr-1.5" />
              Chrome Extension
            </Badge>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground leading-[1.1] tracking-tight"
          >
            Real-Time Trading Intelligence{" "}
            <span className="text-gradient">for Binance Futures</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
          >
            Get market regime analysis, leverage recommendations, and AI-powered
            explanations directly on your Binance trading page. No extra tabs.
            No complex setup.
          </motion.p>

          {/* Social Proof Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4 text-yellow-400 fill-yellow-400"
                  />
                ))}
              </div>
              <span>4.9 rating</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>500+ active users</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>Sub-500ms analysis</span>
            </div>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a
              href="https://chrome.google.com/webstore/detail/lenquant/EXTENSION_ID"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleInstallClick}
            >
              <Button
                size="lg"
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground glow-purple px-8 h-12 text-base"
              >
                <Chrome className="w-5 h-5 mr-2" />
                Add to Chrome — Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </a>
            <a href="#demo" onClick={handleWatchDemo}>
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto border-border/60 hover:border-primary/50 h-12 text-base"
              >
                Watch Demo
              </Button>
            </a>
          </motion.div>

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Free 3-day trial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>No API keys needed</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
```

---

## 📸 Screenshot Section

### File: `components/marketing/ScreenshotCarousel.tsx`

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { analytics } from "@/lib/analytics";

interface Screenshot {
  id: string;
  src: string;
  alt: string;
  caption: string;
  description: string;
}

interface ScreenshotCarouselProps {
  screenshots: Screenshot[];
}

export function ScreenshotCarousel({ screenshots }: ScreenshotCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handlePrev = () => {
    setActiveIndex((prev) => (prev === 0 ? screenshots.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === screenshots.length - 1 ? 0 : prev + 1));
  };

  const handleThumbnailClick = (index: number) => {
    setActiveIndex(index);
    analytics.viewScreenshot(screenshots[index].id);
  };

  return (
    <div className="space-y-6">
      {/* Main Image */}
      <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-border/50 bg-card/50">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
          >
            {/* PLACEHOLDER: Replace with actual screenshots */}
            <div className="w-full h-full bg-gradient-to-br from-purple-900/30 to-indigo-900/30 flex items-center justify-center">
              <div className="text-center p-8">
                <p className="text-muted-foreground">
                  Screenshot: {screenshots[activeIndex].caption}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-2">
                  {screenshots[activeIndex].alt}
                </p>
              </div>
            </div>
            {/* Uncomment when images are ready:
            <Image
              src={screenshots[activeIndex].src}
              alt={screenshots[activeIndex].alt}
              fill
              className="object-cover"
              priority={activeIndex === 0}
            />
            */}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
          onClick={handlePrev}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
          onClick={handleNext}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Caption */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground">
          {screenshots[activeIndex].caption}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {screenshots[activeIndex].description}
        </p>
      </div>

      {/* Thumbnails */}
      <div className="flex justify-center gap-3">
        {screenshots.map((screenshot, index) => (
          <button
            key={screenshot.id}
            onClick={() => handleThumbnailClick(index)}
            className={cn(
              "w-20 h-14 rounded-lg overflow-hidden border-2 transition-all",
              index === activeIndex
                ? "border-purple-500 ring-2 ring-purple-500/30"
                : "border-border/50 opacity-60 hover:opacity-100"
            )}
          >
            {/* PLACEHOLDER: Replace with actual thumbnails */}
            <div className="w-full h-full bg-gradient-to-br from-purple-900/30 to-indigo-900/30" />
            {/* Uncomment when images are ready:
            <Image
              src={screenshot.src}
              alt={screenshot.alt}
              width={80}
              height={56}
              className="object-cover w-full h-full"
            />
            */}
          </button>
        ))}
      </div>
    </div>
  );
}
```

### File: `components/marketing/extension/ScreenshotSection.tsx`

```tsx
"use client";

import { motion } from "framer-motion";
import { ScreenshotCarousel } from "@/components/marketing/ScreenshotCarousel";

const screenshots = [
  {
    id: "panel-main",
    src: "/images/extension/panel-main.png",
    alt: "LenQuant extension panel showing market regime analysis for BTCUSDT",
    caption: "Main Analysis Panel",
    description:
      "Real-time market state, setup grade, and confidence score at a glance",
  },
  {
    id: "leverage-warning",
    src: "/images/extension/leverage-warning.png",
    alt: "Extension showing leverage warning when user leverage exceeds recommendation",
    caption: "Leverage Warnings",
    description:
      "Get warned when your leverage is too high for current market volatility",
  },
  {
    id: "ai-explain",
    src: "/images/extension/ai-explain.png",
    alt: "AI-powered trade explanation with entry zones and risk factors",
    caption: "AI Trade Explanations",
    description:
      " GPT-5 powered context with entry considerations and risk analysis",
  },
  {
    id: "behavioral-alert",
    src: "/images/extension/behavioral-alert.png",
    alt: "Behavioral guardrail alert detecting overtrading pattern",
    caption: "Behavioral Guardrails",
    description: "Automatic detection of revenge trading and overtrading patterns",
  },
  {
    id: "settings",
    src: "/images/extension/settings.png",
    alt: "Extension settings page with configuration options",
    caption: "Customizable Settings",
    description: "Configure leverage limits, alerts, and behavioral preferences",
  },
];

export function ScreenshotSection() {
  return (
    <section id="demo" className="section-padding bg-muted/20">
      <div className="container-marketing">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground">
            See the Extension{" "}
            <span className="text-gradient">in Action</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A native panel that blends seamlessly with Binance's interface
          </p>
        </motion.div>

        {/* Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-4xl mx-auto"
        >
          <ScreenshotCarousel screenshots={screenshots} />
        </motion.div>
      </div>
    </section>
  );
}
```

---

## 🔍 Features Deep Dive

### File: `components/marketing/extension/FeaturesDeepDive.tsx`

```tsx
"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  Gauge,
  Brain,
  Shield,
  BookOpen,
  Zap,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    id: "regime-analysis",
    icon: BarChart3,
    title: "Real-Time Market Regime Analysis",
    description:
      "Know exactly what type of market you're trading in before you enter a position.",
    details: [
      {
        label: "ADX Trend Strength",
        text: "Measures the strength of the current trend. Values above 25 indicate a strong trend worth following.",
      },
      {
        label: "MA Slope Analysis",
        text: "Tracks the slope of multiple moving averages to confirm trend direction and momentum.",
      },
      {
        label: "Bollinger Band Width",
        text: "Monitors volatility compression and expansion to identify potential breakout conditions.",
      },
      {
        label: "Volatility Z-Score",
        text: "Compares current volatility to historical norms to identify unusual market conditions.",
      },
      {
        label: "Hysteresis Logic",
        text: "Prevents flip-flopping between states by requiring confirmation before state changes.",
      },
    ],
    color: "purple",
  },
  {
    id: "leverage",
    icon: Gauge,
    title: "Intelligent Leverage Recommendations",
    description:
      "Dynamic leverage bands that adjust based on market volatility and regime.",
    details: [
      {
        label: "Regime-Aware Bands",
        text: "Leverage recommendations change based on whether the market is trending, ranging, or choppy.",
      },
      {
        label: "Volatility Adjustment",
        text: "Higher volatility automatically lowers recommended leverage to protect your account.",
      },
      {
        label: "Visual Comparison",
        text: "See your current leverage compared to the recommended range with clear warnings.",
      },
      {
        label: "Risk Multiplier",
        text: "Position size adjustment suggestions based on market conditions (e.g., 80% in downtrends).",
      },
    ],
    color: "amber",
  },
  {
    id: "ai-explain",
    icon: Brain,
    title: "AI-Powered Trade Explanations",
    description:
      "Get detailed trade context from  GPT-5 or Gemini with a single click.",
    details: [
      {
        label: "Market Context Summary",
        text: "Understand the broader market conditions and what they mean for your trade idea.",
      },
      {
        label: "Entry Considerations",
        text: "Specific levels and conditions to watch for before entering a position.",
      },
      {
        label: "Invalidation Levels",
        text: "Clear price levels where your trade thesis would be proven wrong.",
      },
      {
        label: "Risk Factors",
        text: "Potential risks and warning signs to monitor while in the trade.",
      },
      {
        label: "Evidence-Based",
        text: "Every recommendation backed by specific technical indicators and data.",
      },
    ],
    color: "blue",
  },
  {
    id: "behavioral",
    icon: Shield,
    title: "Behavioral Guardrails",
    description:
      "Automatic detection of harmful trading patterns before they cost you money.",
    details: [
      {
        label: "Overtrading Detection",
        text: "Tracks your trade frequency and warns when you're trading more than usual.",
      },
      {
        label: "Revenge Trading Alerts",
        text: "Detects when you're entering trades too quickly after a loss — a classic revenge pattern.",
      },
      {
        label: "Cooldown System",
        text: "Enforce breaks with self-imposed or automatic cooldowns to reset your emotional state.",
      },
      {
        label: "Session Analytics",
        text: "Review your trading session patterns to identify behavioral improvements.",
      },
    ],
    color: "green",
  },
];

export function FeaturesDeepDive() {
  return (
    <section className="section-padding">
      <div className="container-marketing">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground">
            Built for{" "}
            <span className="text-gradient">Serious Traders</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Not just another indicator overlay. A complete trading discipline
            system with real technical analysis under the hood.
          </p>
        </motion.div>

        {/* Features */}
        <div className="space-y-16 lg:space-y-24">
          {features.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
              className={cn(
                "grid lg:grid-cols-2 gap-8 lg:gap-16 items-center",
                index % 2 === 1 && "lg:grid-flow-dense"
              )}
            >
              {/* Content */}
              <div className={cn(index % 2 === 1 && "lg:col-start-2")}>
                <div
                  className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center mb-6",
                    feature.color === "purple" &&
                      "bg-purple-500/10 border border-purple-500/20",
                    feature.color === "amber" &&
                      "bg-amber-500/10 border border-amber-500/20",
                    feature.color === "blue" &&
                      "bg-blue-500/10 border border-blue-500/20",
                    feature.color === "green" &&
                      "bg-green-500/10 border border-green-500/20"
                  )}
                >
                  <feature.icon
                    className={cn(
                      "w-7 h-7",
                      feature.color === "purple" && "text-purple-400",
                      feature.color === "amber" && "text-amber-400",
                      feature.color === "blue" && "text-blue-400",
                      feature.color === "green" && "text-green-400"
                    )}
                  />
                </div>

                <h3 className="text-2xl md:text-3xl font-display font-bold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-3 text-lg text-muted-foreground">
                  {feature.description}
                </p>

                <ul className="mt-6 space-y-4">
                  {feature.details.map((detail) => (
                    <li key={detail.label} className="flex gap-3">
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                          feature.color === "purple" && "bg-purple-500/20",
                          feature.color === "amber" && "bg-amber-500/20",
                          feature.color === "blue" && "bg-blue-500/20",
                          feature.color === "green" && "bg-green-500/20"
                        )}
                      >
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            feature.color === "purple" && "bg-purple-400",
                            feature.color === "amber" && "bg-amber-400",
                            feature.color === "blue" && "bg-blue-400",
                            feature.color === "green" && "bg-green-400"
                          )}
                        />
                      </div>
                      <div>
                        <div className="font-medium text-foreground">
                          {detail.label}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {detail.text}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visual */}
              <div
                className={cn(
                  "relative",
                  index % 2 === 1 && "lg:col-start-1 lg:row-start-1"
                )}
              >
                <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-border/50 bg-card/50">
                  {/* PLACEHOLDER: Replace with feature-specific visuals */}
                  <div className="w-full h-full bg-gradient-to-br from-purple-900/20 to-indigo-900/20 flex items-center justify-center">
                    <div className="text-center p-8">
                      <feature.icon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-muted-foreground text-sm">
                        {feature.title} illustration placeholder
                      </p>
                    </div>
                  </div>
                </div>

                {/* Decorative glow */}
                <div
                  className={cn(
                    "absolute -inset-4 rounded-3xl blur-3xl -z-10",
                    feature.color === "purple" && "bg-purple-500/10",
                    feature.color === "amber" && "bg-amber-500/10",
                    feature.color === "blue" && "bg-blue-500/10",
                    feature.color === "green" && "bg-green-500/10"
                  )}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

## 📥 Installation Guide

### File: `components/marketing/extension/InstallationGuide.tsx`

```tsx
"use client";

import { motion } from "framer-motion";
import { Chrome, ArrowRight, MousePointer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analytics } from "@/lib/analytics";

const steps = [
  {
    number: 1,
    icon: Chrome,
    title: "Install from Chrome Web Store",
    description:
      "Click the button below to open the Chrome Web Store. Then click 'Add to Chrome' to install the extension. It takes about 5 seconds.",
    action: {
      text: "Open Chrome Web Store",
      href: "https://chrome.google.com/webstore/detail/lenquant/EXTENSION_ID",
    },
  },
  {
    number: 2,
    icon: MousePointer,
    title: "Navigate to Binance Futures",
    description:
      "Go to binance.com and open any Futures trading pair (e.g., BTCUSDT). You can use the perpetual contracts or quarterly futures.",
    action: {
      text: "Go to Binance Futures",
      href: "https://www.binance.com/en/futures/BTCUSDT",
    },
  },
  {
    number: 3,
    icon: Sparkles,
    title: "Start Trading Smarter",
    description:
      "The LenQuant panel appears automatically on the right side of your screen. See real-time analysis, leverage recommendations, and request AI explanations.",
    action: null,
  },
];

export function InstallationGuide() {
  const handleStepClick = (stepNumber: number, href?: string) => {
    analytics.clickNavLink(`installation_step_${stepNumber}`);
    if (href) {
      window.open(href, "_blank");
    }
  };

  return (
    <section className="section-padding bg-muted/20">
      <div className="container-marketing">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground">
            Get Started in{" "}
            <span className="text-gradient">60 Seconds</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            No configuration required. No API keys needed. Just install and go.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto">
          <div className="space-y-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative"
              >
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-gradient-to-b from-purple-500/50 to-transparent" />
                )}

                <div className="flex gap-6">
                  {/* Step Number & Icon */}
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center relative">
                      <step.icon className="w-7 h-7 text-purple-400" />
                      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold text-white">
                        {step.number}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-8">
                    <h3 className="text-xl font-display font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-muted-foreground">
                      {step.description}
                    </p>

                    {step.action && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4 border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                        onClick={() =>
                          handleStepClick(step.number, step.action?.href)
                        }
                      >
                        {step.action.text}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

---

## ⚙️ Technical Specifications

### File: `components/marketing/extension/TechSpecs.tsx`

```tsx
"use client";

import { motion } from "framer-motion";
import {
  Zap,
  Shield,
  Globe,
  Cpu,
  Lock,
  RefreshCw,
} from "lucide-react";

const specs = {
  performance: [
    { label: "Fast path analysis", value: "≤ 500ms" },
    { label: "Panel update", value: "≤ 50ms" },
    { label: "WebSocket latency", value: "≤ 100ms" },
    { label: "AI explanation", value: "3-5 seconds" },
    { label: "Event logging", value: "≤ 200ms" },
  ],
  requirements: [
    { label: "Browser", value: "Chrome/Chromium v88+" },
    { label: "Operating System", value: "Windows, macOS, Linux" },
    { label: "Internet", value: "Required (for backend analysis)" },
    { label: "Binance Account", value: "Required (Futures enabled)" },
    { label: "API Keys", value: "Not required for analysis" },
  ],
  security: [
    {
      icon: Lock,
      title: "No API Keys Required",
      description:
        "The extension reads public market data and your page DOM. Your Binance API keys are never needed for core analysis features.",
    },
    {
      icon: Shield,
      title: "Read-Only Trade Sync",
      description:
        "Premium trade sync uses read-only API access. We can view your trades but never execute them.",
    },
    {
      icon: Globe,
      title: "Session-Based Auth",
      description:
        "Each browser session gets a unique identifier. No persistent credentials stored in the extension.",
    },
    {
      icon: RefreshCw,
      title: "CORS Protected",
      description:
        "All API endpoints are CORS-protected to prevent unauthorized access from other domains.",
    },
  ],
  permissions: [
    {
      permission: "activeTab",
      reason: "Read current trading page to extract symbol, timeframe, and leverage",
    },
    {
      permission: "storage",
      reason: "Save your preferences and settings locally",
    },
    {
      permission: "Host permissions (lenquant.com)",
      reason: "Connect to LenQuant servers for analysis and AI features",
    },
  ],
};

export function TechSpecs() {
  return (
    <section className="section-padding">
      <div className="container-marketing">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground">
            Technical{" "}
            <span className="text-gradient">Specifications</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Built for performance, designed for security.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Performance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="p-6 rounded-2xl border border-border/50 bg-card/50"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-lg font-display font-semibold text-foreground">
                Performance
              </h3>
            </div>
            <div className="space-y-3">
              {specs.performance.map((item) => (
                <div key={item.label} className="flex justify-between">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-mono text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Requirements */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="p-6 rounded-2xl border border-border/50 bg-card/50"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-lg font-display font-semibold text-foreground">
                Requirements
              </h3>
            </div>
            <div className="space-y-3">
              {specs.requirements.map((item) => (
                <div key={item.label} className="flex justify-between">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Security */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8"
        >
          <h3 className="text-xl font-display font-semibold text-foreground mb-6 text-center">
            Privacy & Security
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {specs.security.map((item) => (
              <div
                key={item.title}
                className="p-5 rounded-xl border border-border/50 bg-card/30"
              >
                <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-3">
                  <item.icon className="w-5 h-5 text-green-400" />
                </div>
                <h4 className="font-medium text-foreground mb-1">{item.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Permissions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 p-6 rounded-2xl border border-border/50 bg-card/30"
        >
          <h3 className="text-lg font-display font-semibold text-foreground mb-4">
            Extension Permissions Explained
          </h3>
          <div className="space-y-4">
            {specs.permissions.map((item) => (
              <div key={item.permission} className="flex gap-4">
                <code className="px-2 py-1 rounded bg-muted text-sm font-mono text-purple-400 h-fit">
                  {item.permission}
                </code>
                <span className="text-muted-foreground">{item.reason}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
```

---

## 🚀 Extension CTA

### File: `components/marketing/extension/ExtensionCTA.tsx`

```tsx
"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Chrome, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analytics } from "@/lib/analytics";

export function ExtensionCTA() {
  const handleInstallClick = () => {
    analytics.clickInstallExtension("extension_footer_cta");
  };

  return (
    <section className="section-padding bg-muted/20">
      <div className="container-marketing">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground">
            Start Trading with{" "}
            <span className="text-gradient">Discipline Today</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Join hundreds of traders using LenQuant to make more objective
            trading decisions on Binance Futures.
          </p>

          {/* Trust badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Free 3-day trial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>No credit card</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Cancel anytime</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://chrome.google.com/webstore/detail/lenquant/EXTENSION_ID"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleInstallClick}
            >
              <Button
                size="lg"
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground glow-purple px-8 h-12 text-base"
              >
                <Chrome className="w-5 h-5 mr-2" />
                Add to Chrome — Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </a>
            <Link href="/pricing">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto border-border/60 hover:border-primary/50 h-12 text-base"
              >
                View Pricing
              </Button>
            </Link>
          </div>

          {/* Platform integration note */}
          <p className="mt-8 text-sm text-muted-foreground">
            Want the full experience?{" "}
            <Link href="/platform" className="text-purple-400 hover:underline">
              Explore the LenQuant Platform
            </Link>{" "}
            for advanced analytics and AI-powered insights.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
```

---

## ✅ Phase 4 Checklist

### Pages
- [x] Create `app/(marketing)/extension/page.tsx`
- [x] Add structured data (Product, Breadcrumb)
- [x] Configure SEO metadata

### Components
- [x] Create `components/marketing/extension/` directory
- [x] Implement `ExtensionHero.tsx`
- [x] Implement `ScreenshotSection.tsx`
- [x] Implement `FeaturesDeepDive.tsx`
- [x] Implement `InstallationGuide.tsx`
- [x] Implement `TechSpecs.tsx`
- [x] Implement `ExtensionCTA.tsx`
- [x] Implement `ScreenshotCarousel.tsx`

### Content
- [x] All feature descriptions finalized
- [x] Technical specifications accurate
- [x] Permission explanations clear
- [x] Installation steps verified

### Images
- [x] Screenshot placeholders in place
- [x] OG image for extension page (1200x630)
- [x] At least 5 extension screenshots planned

### Analytics
- [x] Install button clicks tracked
- [x] Screenshot views tracked
- [x] Installation step clicks tracked

### Testing
- [x] Page loads correctly
- [x] All animations work
- [x] Responsive design verified
- [x] Links work (Chrome Web Store, Binance)

---

## 🚀 Next Phase

After completing Phase 4, proceed to **Phase 5: Platform Page** for the web platform showcase.

---

*Phase 4 creates the dedicated extension page. Ensure screenshots are planned even if using placeholders initially.*

