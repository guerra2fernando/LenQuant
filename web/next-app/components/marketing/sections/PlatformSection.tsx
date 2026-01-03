"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, Bot, TrendingUp, PieChart, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";

const platformFeatures = [
  {
    icon: BarChart3,
    text: "Advanced analytics dashboard",
  },
  {
    icon: PieChart,
    text: "Portfolio tracking & insights",
  },
  {
    icon: Bot,
    text: "AI trading assistant",
  },
  {
    icon: LineChart,
    text: "Historical performance reports",
  },
  {
    icon: TrendingUp,
    text: "Strategy backtesting",
  },
];

export function PlatformSection() {
  return (
    <section className="section-padding bg-muted/20">
      <div className="container-marketing">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Platform Preview */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            {/* Platform Screenshot */}
            <div className="relative rounded-2xl overflow-hidden border border-border/50 bg-card/50 shadow-2xl">
              {/* PLACEHOLDER: Replace with actual platform screenshot */}
              <div className="aspect-[4/3] bg-gradient-to-br from-purple-900/30 to-indigo-900/30 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="w-8 h-8 text-purple-400" />
                  </div>
                  <p className="text-muted-foreground">
                    Platform dashboard screenshot placeholder
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-2">
                    1200 x 900 recommended
                  </p>
                </div>
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute -top-4 -left-4 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl" />
            <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-indigo-500/15 rounded-full blur-2xl" />
          </motion.div>

          {/* Right Column - Content */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
              More Than Just an{" "}
              <span className="text-gradient">Extension</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              The LenQuant Web Platform gives you the complete trading
              experience with advanced analytics, AI-powered insights, and
              comprehensive performance tracking.
            </p>
            <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-300 text-sm font-medium">
              🚀 Platform Launching Soon
            </div>

            {/* Feature List */}
            <ul className="mt-8 space-y-4">
              {platformFeatures.map((feature) => (
                <li key={feature.text} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-foreground">{feature.text}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="mt-10">
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-500/50"
              >
                <Link href="/platform">
                  Learn More
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
