"use client";

import { motion } from "framer-motion";
import { Chrome, ArrowRight, MousePointer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analytics } from "@/lib/analytics";

const steps = [
  {
    number: 1,
    icon: Chrome,
    title: "Install from Chrome Web Store",
    description:
      "Click the button below to open the Chrome Web Store. Then click 'Add to Chrome' to install the extension. It takes about 5 seconds.",
    action: {
      text: "Open Chrome Web Store",
      href: "https://chrome.google.com/webstore/detail/lenquant/EXTENSION_ID",
    },
  },
  {
    number: 2,
    icon: MousePointer,
    title: "Navigate to Binance Futures",
    description:
      "Go to binance.com and open any Futures trading pair (e.g., BTCUSDT). You can use the perpetual contracts or quarterly futures.",
    action: {
      text: "Go to Binance Futures",
      href: "https://www.binance.com/en/futures/BTCUSDT",
    },
  },
  {
    number: 3,
    icon: Sparkles,
    title: "Start Trading Smarter",
    description:
      "The LenQuant panel appears automatically on the right side of your screen. See real-time analysis, leverage recommendations, and request AI explanations.",
    action: null,
  },
];

export function InstallationGuide() {
  const handleStepClick = (stepNumber: number, href?: string) => {
    analytics.clickNavLink(`installation_step_${stepNumber}`);
    if (href) {
      window.open(href, "_blank");
    }
  };

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
            No configuration required. No API keys needed. Just install and go.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto">
          <div className="space-y-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative"
              >
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-gradient-to-b from-purple-500/50 to-transparent" />
                )}

                <div className="flex gap-6">
                  {/* Step Number & Icon */}
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center relative">
                      <step.icon className="w-7 h-7 text-purple-400" />
                      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold text-white">
                        {step.number}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-8">
                    <h3 className="text-xl font-display font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-muted-foreground">
                      {step.description}
                    </p>

                    {step.action && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4 border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                        onClick={() =>
                          handleStepClick(step.number, step.action?.href)
                        }
                      >
                        {step.action.text}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
