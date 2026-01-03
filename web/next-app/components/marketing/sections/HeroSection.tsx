"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { ArrowRight, Chrome, CheckCircle2, Zap, Shield, Brain, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ElectricBorderCard } from "@/components/marketing/ElectricBorderCard";
import { useIsMobile, usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { analytics } from "@/lib/analytics";

// Coin data configurations for rotation
const coinConfigs = [
  {
    symbol: "BTCUSDT",
    timeframe: "1H",
    grade: "A",
    gradeColor: "text-green-400",
    marketState: "Trending Up",
    marketStateIcon: "↗",
    marketStateColor: "text-green-400",
    confidence: 72,
    action: "Strong Buy",
    actionColor: "bg-green-500/20 text-green-400 border-green-500/30",
    gradientColors: "from-green-500/5 via-green-400/3 to-transparent",
    leverage: { current: "20x", recommended: "5-10x", warning: "high for current volatility" },
    setup: "Pullback Continuation",
    showLeverageWarning: true,
  },
  {
    symbol: "ETHUSDT",
    timeframe: "4H",
    grade: "B+",
    gradeColor: "text-blue-400",
    marketState: "Sideways",
    marketStateIcon: "→",
    marketStateColor: "text-yellow-400",
    confidence: 58,
    action: "Wait",
    actionColor: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    gradientColors: "from-yellow-500/5 via-yellow-400/3 to-transparent",
    leverage: { current: "10x", recommended: "3-8x", warning: "moderate volatility" },
    setup: "Range Breakout",
    showLeverageWarning: false,
  },
  {
    symbol: "SOLUSDT",
    timeframe: "30m",
    grade: "A-",
    gradeColor: "text-emerald-400",
    marketState: "Strong Uptrend",
    marketStateIcon: "↗↗",
    marketStateColor: "text-green-400",
    confidence: 85,
    action: "Buy",
    actionColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    gradientColors: "from-emerald-500/5 via-emerald-400/3 to-transparent",
    leverage: { current: "5x", recommended: "2-5x", warning: "optimal for momentum" },
    setup: "Momentum Continuation",
    showLeverageWarning: false,
  },
  {
    symbol: "ADAUSDT",
    timeframe: "1H",
    grade: "C",
    gradeColor: "text-orange-400",
    marketState: "Trending Down",
    marketStateIcon: "↘",
    marketStateColor: "text-red-400",
    confidence: 34,
    action: "Cautious",
    actionColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    gradientColors: "from-orange-500/5 via-orange-400/3 to-transparent",
    leverage: { current: "15x", recommended: "1-3x", warning: "very high risk" },
    setup: "Reversal Pattern",
    showLeverageWarning: true,
  },
  {
    symbol: "DOTUSDT",
    timeframe: "2H",
    grade: "D",
    gradeColor: "text-red-400",
    marketState: "Bearish",
    marketStateIcon: "↘↘",
    marketStateColor: "text-red-400",
    confidence: 22,
    action: "Don't Buy",
    actionColor: "bg-red-500/20 text-red-400 border-red-500/30",
    gradientColors: "from-red-500/5 via-red-400/3 to-transparent",
    leverage: { current: "25x", recommended: "1x", warning: "extremely risky" },
    setup: "Distribution Phase",
    showLeverageWarning: true,
  },
];

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [currentCoinIndex, setCurrentCoinIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  // Rotate through coins every 5 seconds
  useEffect(() => {
    if (prefersReducedMotion) return;

    const interval = setInterval(() => {
      setCurrentCoinIndex((prev) => (prev + 1) % coinConfigs.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  const currentCoin = coinConfigs[currentCoinIndex];

  const handleInstallClick = () => {
    analytics.clickInstallExtension("hero");
  };

  const handleLearnMoreClick = () => {
    analytics.clickNavLink("hero_learn_more");
  };

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen pt-32 lg:pt-56 pb-16 lg:pb-24 overflow-hidden"
    >
      <div className="container-marketing">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center lg:text-left"
          >
            {/* Badge */}
            <Badge
              variant="outline"
              className="mb-6 px-4 py-1.5 text-sm font-medium border-purple-500/30 bg-purple-500/10 text-purple-300"
            >
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              Now available for Chrome
            </Badge>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground leading-[1.1] tracking-tight">
              Your Objective{" "}
              <span className="text-gradient">Trading Second Opinion</span>
            </h1>

            {/* Subheadline */}
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0">
              Real-time market regime analysis, leverage recommendations, and
              AI-powered insight, right on Binance Futures. Stop trading on
              emotion. Start trading with discipline.
            </p>

            {/* Trust badges */}
            <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-sm text-muted-foreground">
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
                <span>Works instantly</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
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
                  Install Extension
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </a>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full sm:w-auto border-border/60 hover:border-primary/50 h-12 text-base"
                onClick={handleLearnMoreClick}
              >
                <Link href="#features">
                  See How It Works
                </Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-12 grid grid-cols-3 gap-8 max-w-md mx-auto lg:mx-0">
              <div className="text-center lg:text-left">
                <div className="text-2xl md:text-3xl font-bold text-foreground">
                  500ms
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Analysis latency
                </div>
              </div>
              <div className="text-center lg:text-left">
                <div className="text-2xl md:text-3xl font-bold text-foreground">
                  24/7
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Market monitoring
                </div>
              </div>
              <div className="text-center lg:text-left">
                <div className="text-2xl md:text-3xl font-bold text-foreground">
                  GPT-5+
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  AI explanations
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column - Electric Border Card with Extension Preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            style={!prefersReducedMotion ? { y, opacity } : {}}
            className="relative flex justify-center lg:justify-end"
          >
            <ElectricBorderCard
              width={isMobile ? 320 : 420}
              height={isMobile ? 480 : 580}
              color="#8B5CF6"
              borderColor="#3B82F6"
              speed={1.5}
              borderRadius={24}
              showEffect={!prefersReducedMotion}
              contentClassName="bg-background/95 backdrop-blur-none"
            >
              {/* Card Header */}
              <div className="p-6 pb-4 border-b border-border/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                      <span className="text-white font-bold text-xs">L</span>
                    </div>
                    <span className="font-display font-semibold text-foreground">
                      LenQuant
                    </span>
                  </div>
                  <Badge className={currentCoin.actionColor}>
                    {currentCoin.action}
                  </Badge>
                </div>
              </div>

              {/* Extension Preview Content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentCoin.symbol}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  className={`flex-1 p-6 space-y-5 bg-gradient-to-b ${currentCoin.gradientColors}`}
                >
                {/* Symbol & Timeframe */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-foreground">
                      {currentCoin.symbol}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {currentCoin.timeframe}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Grade</div>
                    <div className={`text-2xl font-bold ${currentCoin.gradeColor}`}>{currentCoin.grade}</div>
                  </div>
                </div>

                {/* Market State */}
                <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">
                        Market State
                      </div>
                      <div className="text-lg font-semibold text-foreground mt-1 flex items-center gap-2">
                        {currentCoin.marketState}
                        <span className={currentCoin.marketStateColor}>{currentCoin.marketStateIcon}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">
                        Confidence
                      </div>
                      <div className="text-lg font-bold text-purple-400">{currentCoin.confidence}%</div>
                    </div>
                  </div>
                </div>

                {/* Leverage Warning - Conditional */}
                {currentCoin.showLeverageWarning && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-amber-200">
                          Leverage Warning
                        </div>
                        <div className="text-xs text-amber-200/70 mt-1">
                          Your {currentCoin.leverage.current} is {currentCoin.leverage.warning}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Recommended: <span className="text-foreground">{currentCoin.leverage.recommended}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Setup */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                  <span className="text-sm text-muted-foreground">Setup</span>
                  <span className="text-sm font-medium text-foreground">
                    {currentCoin.setup}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <div className="flex-1 border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 rounded-md px-3 py-2 text-sm flex items-center justify-center gap-2">
                    <Brain className="w-4 h-4" />
                    Explain
                  </div>
                  <div className="flex-1 border border-border/50 rounded-md px-3 py-2 text-sm flex items-center justify-center">
                    Bookmark
                  </div>
                </div>
                </motion.div>
              </AnimatePresence>

              {/* Card Footer */}
              <div className="p-4 border-t border-border/30 bg-muted/20">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Updated 2 seconds ago</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Connected
                  </span>
                </div>
              </div>
            </ElectricBorderCard>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:block"
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-1.5">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-3 rounded-full bg-muted-foreground/50"
            />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
