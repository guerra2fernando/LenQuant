"use client";

import { motion } from "framer-motion";
import { Chrome, Star, Users, Zap, CheckCircle2, ArrowRight, RefreshCw } from "lucide-react";
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
          {/* Badges */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-3 mb-6"
          >
            <Badge
              variant="outline"
              className="px-4 py-1.5 text-sm font-medium border-purple-500/30 bg-purple-500/10 text-purple-300"
            >
              <Chrome className="w-3.5 h-3.5 mr-1.5" />
              Chrome Extension
            </Badge>
            <Badge
              variant="outline"
              className="px-4 py-1.5 text-sm font-medium border-blue-500/30 bg-blue-500/10 text-blue-300"
            >
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              ML-Powered Intelligence
            </Badge>
            <Badge
              variant="outline"
              className="px-4 py-1.5 text-sm font-medium border-green-500/30 bg-green-500/10 text-green-300"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Live Updates
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
            Get market regime analysis, ML predictions for major coins, leverage
            recommendations, and AI-powered explanations directly on your Binance
            trading page. No extra tabs. No complex setup.

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
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full sm:w-auto border-border/60 hover:border-primary/50 h-12 text-base"
              onClick={handleWatchDemo}
            >
              <a href="#demo">
                Watch Demo
              </a>
            </Button>
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
