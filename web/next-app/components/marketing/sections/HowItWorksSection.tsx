"use client";

import { motion } from "framer-motion";
import { StepCard } from "@/components/marketing/StepCard";

const steps = [
  {
    number: 1,
    title: "Install the Extension",
    description:
      "One-click install from the Chrome Web Store. No configuration needed — works immediately with Binance Futures.",
  },
  {
    number: 2,
    title: "Navigate to Binance Futures",
    description:
      "Go to any trading pair on Binance Futures. The LenQuant panel appears automatically on the right side of your screen.",
  },
  {
    number: 3,
    title: "Get Instant Analysis",
    description:
      "See real-time market state, setup grade, leverage recommendations, and risk flags. Click 'Explain' for AI-powered trade context.",
  },
];

export function HowItWorksSection() {
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
            Get Started in{" "}
            <span className="text-gradient">60 Seconds</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            No complex setup. No API keys required. Just install and trade smarter.
          </p>
        </motion.div>

        {/* Steps */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid md:grid-cols-3 gap-8 lg:gap-12"
        >
          {steps.map((step, index) => (
            <StepCard
              key={step.number}
              number={step.number}
              title={step.title}
              description={step.description}
              isLast={index === steps.length - 1}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
