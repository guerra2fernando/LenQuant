"use client";

import { motion } from "framer-motion";
import {
  Zap,
  Shield,
  Globe,
  Cpu,
  Lock,
  RefreshCw,
  Brain,
  TrendingUp,
} from "lucide-react";

const specs = {
  performance: [
    { label: "Fast path analysis", value: "≤ 500ms" },
    { label: "Panel update", value: "≤ 50ms" },
    { label: "WebSocket latency", value: "≤ 100ms" },
    { label: "AI explanation", value: "3-5 seconds" },
    { label: "Event logging", value: "≤ 200ms" },
  ],
  aiCapabilities: [
    { label: "ML models for top coins", value: "BTC, ETH, SOL, etc." },
    { label: "Model expansion", value: "Weekly updates" },
    { label: "Training data", value: "Billions of data points" },
    { label: "External data sources", value: "CoinGecko sentiment" },
    { label: "AI model updates", value: "Continuous retraining" },
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

          {/* AI Capabilities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="p-6 rounded-2xl border border-border/50 bg-card/50"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Brain className="w-5 h-5 text-cyan-400" />
              </div>
              <h3 className="text-lg font-display font-semibold text-foreground">
                AI & ML Capabilities
              </h3>
            </div>
            <div className="space-y-3">
              {specs.aiCapabilities.map((item) => (
                <div key={item.label} className="flex justify-between">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-mono text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <div className="flex items-center gap-2 text-sm text-cyan-300">
                <TrendingUp className="w-4 h-4" />
                <span className="font-medium">Growing Intelligence</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Models expand weekly to cover more trading pairs and improve accuracy.
              </p>
            </div>
          </motion.div>

          {/* Requirements */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
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
