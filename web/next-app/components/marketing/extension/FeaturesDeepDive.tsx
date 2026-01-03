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
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    id: "regime-analysis",
    icon: BarChart3,
    title: "Real-Time Market Regime Analysis",
    description:
      "Know exactly what type of market you're trading in before you enter a position, with ML-powered predictions for major pairs.",
    details: [
      {
        label: "ADX Trend Strength",
        text: "Measures the strength of the current trend. Values above 25 indicate a strong trend worth following.",
      },
      {
        label: "ML Predictions for Top Coins",
        text: "Machine learning models trained on billions of data points for BTC, ETH, SOL and other major pairs.",
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
      {
        label: "Weekly Model Updates",
        text: "ML models continuously retrained and expanded to cover more trading pairs to recommend better trades.",
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
    id: "external-data",
    icon: Globe,
    title: "Real-Time Market Sentiment & Social Data",
    description:
      "Integrates live sentiment scores, community metrics, and social data from CoinGecko for comprehensive market context.",
    details: [
      {
        label: "Sentiment Analysis",
        text: "Real-time sentiment scores from CoinGecko community voting, normalized to -1 to +1 scale.",
      },
      {
        label: "Community Metrics",
        text: "Social sentiment, developer activity, and community engagement scores from CoinGecko.",
      },
      {
        label: "News Impact Scoring",
        text: "News sentiment analysis integrated into trade signal confidence calculations.",
      },
      {
        label: "Volume & Market Data",
        text: "Live volume spikes, market cap rankings, and price change data for enhanced context.",
      },
      {
        label: "Signal Boost",
        text: "External sentiment data can boost trade signals when positive and negative.",
      },
    ],
    color: "cyan",
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
                    feature.color === "cyan" &&
                      "bg-cyan-500/10 border border-cyan-500/20",
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
                      feature.color === "cyan" && "text-cyan-400",
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
                          feature.color === "cyan" && "bg-cyan-500/20",
                          feature.color === "green" && "bg-green-500/20"
                        )}
                      >
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            feature.color === "purple" && "bg-purple-400",
                            feature.color === "amber" && "bg-amber-400",
                            feature.color === "blue" && "bg-blue-400",
                            feature.color === "cyan" && "bg-cyan-400",
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
                    feature.color === "cyan" && "bg-cyan-500/10",
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
