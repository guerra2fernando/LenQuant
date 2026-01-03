"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Chrome, LayoutDashboard, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analytics } from "@/lib/analytics";

export function PlatformCTA() {
  const handleAccessClick = () => {
    analytics.clickNavLink("platform_cta_access");
  };

  const handleExtensionClick = () => {
    analytics.clickInstallExtension("platform_cta");
  };

  return (
    <section className="section-padding">
      <div className="container-marketing">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground">
            Ready to{" "}
            <span className="text-gradient">Level Up</span> Your Trading?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Get started with the Chrome Extension for free, then unlock the
            full platform experience with a Pro or Premium subscription.
          </p>
          <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-300 text-sm font-medium">
            🚀 Platform Launching Soon
          </div>

          {/* Benefits */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Platform included with subscription</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Will auto-sync from Extension</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Unlimited AI queries ready</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://chrome.google.com/webstore/detail/lenquant/EXTENSION_ID"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleExtensionClick}
            >
              <Button
                size="lg"
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground glow-purple px-8 h-12 text-base"
              >
                <Chrome className="w-5 h-5 mr-2" />
                Install Extension
              </Button>
            </a>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full sm:w-auto border-border/60 hover:border-primary/50 h-12 text-base"
              onClick={handleAccessClick}
            >
              <Link href="/#pricing">
                <LayoutDashboard className="w-5 h-5 mr-2" />
                View Pricing
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>

          {/* Pricing link */}
          <p className="mt-8 text-sm text-muted-foreground">
            Compare plans and pricing on our{" "}
            <Link href="/#pricing" className="text-purple-400 hover:underline">
              pricing page
            </Link>
            .
          </p>
        </motion.div>
      </div>
    </section>
  );
}
