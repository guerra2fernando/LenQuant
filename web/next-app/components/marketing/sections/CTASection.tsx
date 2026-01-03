"use client";

import { motion } from "framer-motion";
import { Chrome, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ElectricBorderCard } from "@/components/marketing/ElectricBorderCard";
import { useIsMobile, usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { analytics } from "@/lib/analytics";

export function CTASection() {
  const isMobile = useIsMobile();
  const prefersReducedMotion = usePrefersReducedMotion();

  const handleInstallClick = () => {
    analytics.clickInstallExtension("footer_cta");
  };

  return (
    <section className="section-padding overflow-hidden">
      <div className="container-marketing">
        <div className="flex justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <ElectricBorderCard
              width={isMobile ? 340 : 600}
              height={isMobile ? 360 : 320}
              color="#8B5CF6"
              borderColor="#3B82F6"
              speed={1.2}
              borderRadius={28}
              showEffect={!prefersReducedMotion}
              contentClassName="bg-background/95 backdrop-blur-none flex flex-col items-center justify-center text-center p-8 lg:p-12"
            >
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-display font-bold text-foreground">
                Ready to Trade with{" "}
                <span className="text-gradient">Discipline?</span>
              </h2>

              <p className="mt-4 text-muted-foreground max-w-md">
                Join hundreds of traders using LenQuant to make more objective,
                disciplined trading decisions.
              </p>

              {/* Trust badges */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Free 3-day trial</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>No credit card</span>
                </div>
              </div>

              {/* CTA Button */}
              <a
                href="https://chrome.google.com/webstore/detail/lenquant/EXTENSION_ID"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleInstallClick}
                className="mt-8"
              >
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground glow-purple px-8 h-12 text-base"
                >
                  <Chrome className="w-5 h-5 mr-2" />
                  Install Extension
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </a>
            </ElectricBorderCard>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
