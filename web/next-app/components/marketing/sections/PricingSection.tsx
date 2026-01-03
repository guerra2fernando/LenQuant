"use client";

import { motion } from "framer-motion";
import { PricingCard } from "@/components/marketing/PricingCard";
import { analytics } from "@/lib/analytics";

const pricingTiers = [
  {
    tier: "trial" as const,
    name: "Free Trial",
    description: "Experience the full power",
    price: { monthly: 0, yearly: 0 },
    features: [
      "Full access to all Pro features",
      "Backend regime analysis",
      "AI-powered explanations",
      "Behavioral guardrails",
      "Cloud journal (30 days)",
      "Works for any symbol",
    ],
    ctaText: "Start Free Trial",
    ctaLink: "/login?trial=true",
    badge: "3 Days Free",
  },
  {
    tier: "pro" as const,
    name: "Pro",
    description: "For active traders",
    price: { monthly: 19.99, yearly: 149 },
    features: [
      "Everything in trial",
      "Backend regime analysis",
      "AI trade explanations ( GPT-5/Gemini)",
      "Cloud journal (30 days)",
      "Behavioral analysis",
      "Ephemeral analysis for any symbol",
      "Email support",
    ],
    highlighted: true,
    ctaText: "Get Pro",
    ctaLink: "/login?plan=pro",
    badge: "Most Popular",
  },
  {
    tier: "premium" as const,
    name: "Premium",
    description: "For serious traders",
    price: { monthly: 39.99, yearly: 299 },
    features: [
      "Everything in Pro",
      "Extended journal (365 days)",
      "Trade sync from Binance",
      "Weekly & monthly reports",
      "Priority support (same-day)",
      "Private Discord community",
      "Early access to new features",
    ],
    ctaText: "Get Premium",
    ctaLink: "/login?plan=premium",
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="section-padding">
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
            Simple,{" "}
            <span className="text-gradient">Transparent Pricing</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start with a free trial. Upgrade when you're ready. Cancel anytime.
          </p>
        </motion.div>

         {/* Founder's Deal Banner */}
         <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-3 max-w-3xl mx-auto mb-12"
        >
          <div className="relative rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6 text-center overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-purple-500/10" />

            <div className="relative">
              <div className="text-sm font-medium text-purple-400 uppercase tracking-wider mb-2">
                🚀 Founding Member Deal
              </div>
              <div className="text-xl md:text-2xl font-display font-bold text-foreground">
                First 100 users lock in their price forever
              </div>
              <p className="mt-2 text-muted-foreground">
                Sign up now and never pay more, even when we raise prices.
                Plus, get direct access to the developer and input on the roadmap.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto"
        >
          {pricingTiers.map((tier) => (
            <PricingCard
              key={tier.tier}
              {...tier}
            />
          ))}
        </motion.div>

       
      </div>
    </section>
  );
}
