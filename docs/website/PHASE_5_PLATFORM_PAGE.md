# Phase 5: Platform Page Implementation

**Phase:** 5 of 7  
**Estimated Time:** 4-5 hours  
**Dependencies:** Phase 1 (Foundation)  
**Output:** Web platform showcase page

---

## 📋 Overview

The Platform page showcases the full LenQuant web application — the advanced trading dashboard that complements the Chrome Extension. It positions the platform as the "full experience" for serious traders.

---

## 🎯 Objectives

1. ✅ Hero section highlighting platform capabilities
2. ✅ Feature showcase with screenshots
3. ✅ Integration explanation (Extension + Platform)
4. ✅ Dashboard preview/demo
5. ✅ Pricing reference
6. ✅ CTA to login/signup

---

## 📁 File Structure

```
app/(marketing)/platform/
└── page.tsx
components/marketing/platform/
├── PlatformHero.tsx
├── PlatformFeatures.tsx
├── IntegrationSection.tsx
├── DashboardPreview.tsx
└── PlatformCTA.tsx
```

---

## 🔧 Implementation

### File: `app/(marketing)/platform/page.tsx`

```tsx
import { Metadata } from "next";
import { generateSEO, generateBreadcrumbSchema } from "@/lib/seo";
import { StructuredData } from "@/components/marketing/StructuredData";
import { PlatformHero } from "@/components/marketing/platform/PlatformHero";
import { PlatformFeatures } from "@/components/marketing/platform/PlatformFeatures";
import { IntegrationSection } from "@/components/marketing/platform/IntegrationSection";
import { DashboardPreview } from "@/components/marketing/platform/DashboardPreview";
import { PlatformCTA } from "@/components/marketing/platform/PlatformCTA";

export const metadata: Metadata = generateSEO({
  title: "Trading Platform — Advanced AI-Powered Dashboard",
  description:
    "Advanced AI-powered trading dashboard with analytics, portfolio tracking, AI assistant, and comprehensive performance insights. The complete LenQuant experience.",
  path: "/platform",
  image: "/images/og/platform.png",
});

const breadcrumbs = [
  { name: "Home", url: "/" },
  { name: "Platform", url: "/platform" },
];

export default function PlatformPage() {
  return (
    <>
      <StructuredData data={generateBreadcrumbSchema(breadcrumbs)} />

      <div className="relative">
        {/* Background effects */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-indigo-500/15 rounded-full blur-[130px]" />
          <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
        </div>

        <PlatformHero />
        <PlatformFeatures />
        <DashboardPreview />
        <IntegrationSection />
        <PlatformCTA />
      </div>
    </>
  );
}
```

---

## 🦸 Platform Hero Section

### File: `components/marketing/platform/PlatformHero.tsx`

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  ArrowRight,
  TrendingUp,
  Bot,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { analytics } from "@/lib/analytics";

export function PlatformHero() {
  const handleAccessClick = () => {
    analytics.clickNavLink("platform_access");
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
              className="mb-6 px-4 py-1.5 text-sm font-medium border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
            >
              <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />
              Web Platform
            </Badge>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground leading-[1.1] tracking-tight"
          >
            The Complete{" "}
            <span className="text-gradient">AI-Powered Trading</span> Dashboard
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
          >
            Advanced analytics, AI-powered insights, portfolio tracking, and
            comprehensive performance reports. Everything you need to trade
            smarter in one place.
          </motion.p>

          {/* Quick Feature Pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            {[
              { icon: BarChart3, text: "Advanced Analytics" },
              { icon: Bot, text: "AI Assistant" },
              { icon: TrendingUp, text: "Performance Tracking" },
            ].map((item) => (
              <div
                key={item.text}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border/50 text-sm"
              >
                <item.icon className="w-4 h-4 text-purple-400" />
                <span className="text-muted-foreground">{item.text}</span>
              </div>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/login" onClick={handleAccessClick}>
              <Button
                size="lg"
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground glow-purple px-8 h-12 text-base"
              >
                Access Platform
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <a href="#features">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto border-border/60 hover:border-primary/50 h-12 text-base"
              >
                Explore Features
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
              <span>Free with Pro subscription</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Syncs with Extension</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Real-time data</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
```

---

## ✨ Platform Features

### File: `components/marketing/platform/PlatformFeatures.tsx`

```tsx
"use client";

import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Bot,
  BarChart3,
  Wallet,
  LineChart,
  TrendingUp,
  BookOpen,
  Bell,
} from "lucide-react";

const features = [
  {
    icon: LayoutDashboard,
    title: "Trading Dashboard",
    description:
      "Real-time market data, quick order panel, and position management all in one unified interface. See everything you need at a glance.",
    color: "purple",
  },
  {
    icon: Bot,
    title: "AI Trading Assistant",
    description:
      "Ask questions in natural language and get intelligent answers. 'What's the current market regime?' 'Should I reduce my position?' The AI understands context.",
    color: "indigo",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description:
      "Win rate, profit factor, average R-multiple, and more. Understand your trading performance with professional-grade metrics.",
    color: "blue",
  },
  {
    icon: Wallet,
    title: "Portfolio Tracking",
    description:
      "Monitor your positions across multiple symbols. See unrealized P&L, margin usage, and portfolio allocation in real-time.",
    color: "green",
  },
  {
    icon: LineChart,
    title: "Equity Curves",
    description:
      "Visualize your account growth over time. Identify winning streaks, drawdowns, and overall performance trends.",
    color: "amber",
  },
  {
    icon: TrendingUp,
    title: "Market Regime Analysis",
    description:
      "The same powerful regime detection from the extension, now with historical context and multi-timeframe views.",
    color: "purple",
  },
  {
    icon: BookOpen,
    title: "Trade Journal",
    description:
      "Automatic logging of all your trades with notes, tags, and screenshots. Review your decisions and learn from them.",
    color: "indigo",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description:
      "Get alerted when market conditions change, when your positions hit targets, or when behavioral patterns are detected.",
    color: "blue",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

export function PlatformFeatures() {
  return (
    <section id="features" className="section-padding bg-muted/20">
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
            Everything You Need to{" "}
            <span className="text-gradient">Trade Smarter</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A complete trading ecosystem designed to help you make better
            decisions and track your progress.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={itemVariants}
              className="p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-purple-500/30 transition-colors glow-card"
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  feature.color === "purple"
                    ? "bg-purple-500/10 border border-purple-500/20"
                    : feature.color === "indigo"
                    ? "bg-indigo-500/10 border border-indigo-500/20"
                    : feature.color === "blue"
                    ? "bg-blue-500/10 border border-blue-500/20"
                    : feature.color === "green"
                    ? "bg-green-500/10 border border-green-500/20"
                    : "bg-amber-500/10 border border-amber-500/20"
                }`}
              >
                <feature.icon
                  className={`w-6 h-6 ${
                    feature.color === "purple"
                      ? "text-purple-400"
                      : feature.color === "indigo"
                      ? "text-indigo-400"
                      : feature.color === "blue"
                      ? "text-blue-400"
                      : feature.color === "green"
                      ? "text-green-400"
                      : "text-amber-400"
                  }`}
                />
              </div>
              <h3 className="text-lg font-display font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
```

---

## 📊 Dashboard Preview

### File: `components/marketing/platform/DashboardPreview.tsx`

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  LineChart,
  Bot,
  BookOpen,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Overview of your trading activity and market conditions",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: LineChart,
    description: "Performance metrics, equity curves, and trade statistics",
  },
  {
    id: "assistant",
    label: "AI Assistant",
    icon: Bot,
    description: "Natural language interface for trading insights",
  },
  {
    id: "journal",
    label: "Journal",
    icon: BookOpen,
    description: "Trade history with notes and performance analysis",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    description: "Configure preferences, API keys, and notifications",
  },
];

export function DashboardPreview() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const activeTabData = tabs.find((t) => t.id === activeTab);

  return (
    <section className="section-padding">
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
            Explore the{" "}
            <span className="text-gradient">Dashboard</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A powerful interface designed for serious traders.
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap justify-center gap-2 mb-8"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground border border-transparent"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Preview Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative max-w-5xl mx-auto"
        >
          {/* Browser Chrome */}
          <div className="rounded-2xl overflow-hidden border border-border/50 bg-card/50 shadow-2xl">
            {/* Browser Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border/50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-lg bg-muted/80 text-xs text-muted-foreground">
                  app.lenquant.com/{activeTab}
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="aspect-[16/10] bg-gradient-to-br from-background to-muted/50">
              {/* PLACEHOLDER: Replace with actual screenshots */}
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center p-8">
                  {activeTabData && (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
                        <activeTabData.icon className="w-8 h-8 text-purple-400" />
                      </div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">
                        {activeTabData.label}
                      </h3>
                      <p className="text-muted-foreground max-w-md">
                        {activeTabData.description}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-4">
                        Screenshot placeholder — 1280 x 800 recommended
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Decorative glow */}
          <div className="absolute -inset-4 bg-purple-500/10 rounded-3xl blur-3xl -z-10" />
        </motion.div>
      </div>
    </section>
  );
}
```

---

## 🔗 Integration Section

### File: `components/marketing/platform/IntegrationSection.tsx`

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Chrome, LayoutDashboard, ArrowRight, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function IntegrationSection() {
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
            Better{" "}
            <span className="text-gradient">Together</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            The Chrome Extension and Web Platform work seamlessly together
            for the complete trading experience.
          </p>
        </motion.div>

        {/* Integration Diagram */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-4xl mx-auto"
        >
          <div className="grid md:grid-cols-3 gap-6 items-center">
            {/* Extension Card */}
            <div className="p-6 rounded-2xl border border-purple-500/30 bg-purple-500/5 text-center">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
                <Chrome className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-lg font-display font-semibold text-foreground mb-2">
                Chrome Extension
              </h3>
              <p className="text-sm text-muted-foreground">
                Quick analysis while trading on Binance
              </p>
              <ul className="mt-4 text-sm text-left space-y-2">
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span className="text-muted-foreground">Real-time regime</span>
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span className="text-muted-foreground">Leverage warnings</span>
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span className="text-muted-foreground">AI explanations</span>
                </li>
              </ul>
            </div>

            {/* Sync Arrow */}
            <div className="hidden md:flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-muted border border-border flex items-center justify-center mb-2">
                <RefreshCw className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowRight className="w-4 h-4" />
                <span>Synced</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </div>
            </div>

            {/* Platform Card */}
            <div className="p-6 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
                <LayoutDashboard className="w-8 h-8 text-indigo-400" />
              </div>
              <h3 className="text-lg font-display font-semibold text-foreground mb-2">
                Web Platform
              </h3>
              <p className="text-sm text-muted-foreground">
                Deep analytics and review sessions
              </p>
              <ul className="mt-4 text-sm text-left space-y-2">
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-400" />
                  <span className="text-muted-foreground">Full analytics</span>
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-400" />
                  <span className="text-muted-foreground">Trade journal</span>
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-400" />
                  <span className="text-muted-foreground">AI assistant</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Workflow Description */}
          <div className="mt-12 p-6 rounded-2xl border border-border/50 bg-card/50">
            <h3 className="text-lg font-display font-semibold text-foreground mb-4 text-center">
              The Complete Workflow
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400 mb-2">1</div>
                <h4 className="font-medium text-foreground mb-1">Trade</h4>
                <p className="text-sm text-muted-foreground">
                  Use the extension on Binance for real-time analysis and
                  disciplined entry decisions.
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-400 mb-2">2</div>
                <h4 className="font-medium text-foreground mb-1">Sync</h4>
                <p className="text-sm text-muted-foreground">
                  Your journal entries, analyses, and trades automatically sync
                  to the platform.
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400 mb-2">3</div>
                <h4 className="font-medium text-foreground mb-1">Review</h4>
                <p className="text-sm text-muted-foreground">
                  Analyze your performance, identify patterns, and improve your
                  trading with AI insights.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
```

---

## 🚀 Platform CTA

### File: `components/marketing/platform/PlatformCTA.tsx`

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Chrome, LayoutDashboard, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analytics } from "@/lib/analytics";

export function PlatformCTA() {
  const handleAccessClick = () => {
    analytics.clickNavLink("platform_cta_access");
  };

  const handleExtensionClick = () => {
    analytics.clickInstallExtension("platform_cta");
  };

  return (
    <section className="section-padding">
      <div className="container-marketing">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground">
            Ready to{" "}
            <span className="text-gradient">Level Up</span> Your Trading?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Get started with the Chrome Extension for free, then unlock the
            full platform experience with a Pro or Premium subscription.
          </p>

          {/* Benefits */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Platform included with subscription</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Auto-sync from Extension</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Unlimited AI queries</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://chrome.google.com/webstore/detail/lenquant/EXTENSION_ID"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleExtensionClick}
            >
              <Button
                size="lg"
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground glow-purple px-8 h-12 text-base"
              >
                <Chrome className="w-5 h-5 mr-2" />
                Install Extension
              </Button>
            </a>
            <Link href="/login" onClick={handleAccessClick}>
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto border-border/60 hover:border-primary/50 h-12 text-base"
              >
                <LayoutDashboard className="w-5 h-5 mr-2" />
                Access Platform
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          {/* Pricing link */}
          <p className="mt-8 text-sm text-muted-foreground">
            Compare plans and pricing on our{" "}
            <Link href="/#pricing" className="text-purple-400 hover:underline">
              pricing page
            </Link>
            .
          </p>
        </motion.div>
      </div>
    </section>
  );
}
```

---

## ✅ Phase 5 Checklist

### Pages
- [x] Create `app/(marketing)/platform/page.tsx`
- [x] Add structured data (Breadcrumb)
- [x] Configure SEO metadata

### Components
- [x] Create `components/marketing/platform/` directory
- [x] Implement `PlatformHero.tsx`
- [x] Implement `PlatformFeatures.tsx`
- [x] Implement `DashboardPreview.tsx`
- [x] Implement `IntegrationSection.tsx`
- [x] Implement `PlatformCTA.tsx`

### Content
- [x] All feature descriptions finalized
- [x] Integration workflow clear
- [x] Dashboard tab descriptions accurate

### Images
- [x] Dashboard screenshot placeholders in place
- [ ] OG image for platform page (1200x630)
- [ ] At least 5 dashboard screenshots planned

### Analytics
- [x] Access Platform clicks tracked
- [ ] Tab navigation tracked
- [x] CTA clicks tracked

### Testing
- [x] Page loads correctly (no linting errors)
- [x] All animations work (framer-motion implemented)
- [x] Tab navigation works (interactive tabs implemented)
- [ ] Responsive design verified (needs live testing)

---

## 🚀 Next Phase

After completing Phase 5, proceed to **Phase 6: Legal Pages** for Privacy Policy and Terms of Use.

---

*Phase 5 positions the platform as the advanced companion to the extension.*

