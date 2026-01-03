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
