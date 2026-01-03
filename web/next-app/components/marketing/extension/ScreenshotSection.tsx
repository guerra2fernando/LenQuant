"use client";

import { motion } from "framer-motion";
import { ScreenshotCarousel } from "@/components/marketing/extension/ScreenshotCarousel";

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
