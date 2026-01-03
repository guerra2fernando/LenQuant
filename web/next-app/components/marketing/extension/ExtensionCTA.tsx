"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Chrome, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analytics } from "@/lib/analytics";

export function ExtensionCTA() {
  const handleInstallClick = () => {
    analytics.clickInstallExtension("extension_footer_cta");
  };

  return (
    <section className="section-padding bg-muted/20">
      <div className="container-marketing">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground">
            Start Trading with{" "}
            <span className="text-gradient">Discipline Today</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
          Join LenQuant to make more objective and informed<br/>
            trading decisions on Binance Futures today.

          </p>

          {/* Trust badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Free 3-day trial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>No credit card</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Cancel anytime</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://chrome.google.com/webstore/detail/lenquant/EXTENSION_ID"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleInstallClick}
            >
              <Button
                size="lg"
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground glow-purple px-8 h-12 text-base"
              >
                <Chrome className="w-5 h-5 mr-2" />
                Add to Chrome — Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </a>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full sm:w-auto border-border/60 hover:border-primary/50 h-12 text-base"
            >
              <Link href="/pricing">
                View Pricing
              </Link>
            </Button>
          </div>

          {/* Platform integration note */}
          <p className="mt-8 text-sm text-muted-foreground">
            Want the full experience?{" "}
            <Link href="/platform" className="text-purple-400 hover:underline">
              Explore the LenQuant Platform
            </Link>{" "}
            for advanced analytics and AI-powered insights.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
