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
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6"
          >
            <Badge
              variant="outline"
              className="px-4 py-1.5 text-sm font-medium border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
            >
              <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />
              Web Platform
            </Badge>
            <Badge
              variant="outline"
              className="px-4 py-1.5 text-sm font-medium border-orange-500/30 bg-orange-500/10 text-orange-300"
            >
              🚀 Coming Soon
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
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground glow-purple px-8 h-12 text-base"
              onClick={handleAccessClick}
            >
              <Link href="/extension">
                Start with Extension
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
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
              <span>Launching with Pro subscription</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Will sync with Extension</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Real-time data ready</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
