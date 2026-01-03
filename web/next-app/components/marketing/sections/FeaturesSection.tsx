"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  Gauge,
  Brain,
  Shield,
  BookOpen,
  Zap,
} from "lucide-react";
import { FeatureCard } from "@/components/marketing/FeatureCard";

const features = [
  {
    icon: BarChart3,
    title: "Real-Time Regime Analysis",
    description:
      "Know if the market is trending, ranging, or choppy before you trade. Uses ADX, MA slope analysis, Bollinger Band width, and volatility z-scores with hysteresis to prevent flip-flopping.",
  },
  {
    icon: Gauge,
    title: "Leverage Discipline",
    description:
      "Get regime-aware leverage recommendations. See when your leverage is too high for current market volatility. Prevent account-killing over-leveraging in volatile conditions.",
  },
  {
    icon: Brain,
    title: "AI-Powered Explanations",
    description:
      "Click 'Explain' for detailed trade context powered by  GPT-5 or Gemini. Get entry considerations, invalidation levels, targets, and risk factors — all backed by technical evidence.",
  },
  {
    icon: Shield,
    title: "Behavioral Guardrails",
    description:
      "Detects revenge trading patterns and overtrading. Tracks your trade frequency and warns when you're tilted. Self-imposed or automatic cooldowns to reset your emotional state.",
  },
  {
    icon: BookOpen,
    title: "Cloud Trade Journal",
    description:
      "Automatic event logging captures every analysis and context change. Review your sessions, export data, and track performance over time. Pro gets 30 days; Premium gets 365 days.",
  },
  {
    icon: Zap,
    title: "Works for Any Symbol",
    description:
      "Don't see your symbol pre-loaded? No problem. Ephemeral analysis handles any Binance Futures symbol on-the-fly. The extension fetches data directly and provides instant regime detection.",
  },
];

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
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

export function FeaturesSection() {
  return (
    <section id="features" className="section-padding">
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
            Why Traders Choose{" "}
            <span className="text-gradient">LenQuant</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            More than just indicators. A complete trading discipline system
            that helps you avoid costly mistakes and trade with confidence.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature) => (
            <motion.div key={feature.title} variants={itemVariants}>
              <FeatureCard
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
