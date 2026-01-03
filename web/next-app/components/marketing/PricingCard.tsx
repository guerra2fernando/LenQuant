"use client";

import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { analytics } from "@/lib/analytics";

interface PricingCardProps {
  tier: "trial" | "pro" | "premium";
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  features: string[];
  highlighted?: boolean;
  ctaText: string;
  ctaLink: string;
  badge?: string;
}

export function PricingCard({
  tier,
  name,
  description,
  price,
  features,
  highlighted = false,
  ctaText,
  ctaLink,
  badge,
}: PricingCardProps) {
  const isFree = tier === "trial";

  const handleCTAClick = () => {
    analytics.clickStartTrial(tier);
  };

  return (
    <div
      className={cn(
        "relative rounded-2xl border p-6 lg:p-8 flex flex-col",
        highlighted
          ? "border-purple-500/50 bg-purple-500/5 shadow-xl shadow-purple-500/10"
          : "border-border/50 bg-card/50"
      )}
    >
      {/* Badge */}
      {badge && (
        <Badge
          className={cn(
            "absolute -top-3 left-1/2 -translate-x-1/2 px-4",
            highlighted
              ? "bg-purple-500 text-white"
              : "bg-muted text-muted-foreground"
          )}
        >
          {highlighted && <Sparkles className="w-3 h-3 mr-1" />}
          {badge}
        </Badge>
      )}

      {/* Header */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-display font-semibold text-foreground">
          {name}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      {/* Price */}
      <div className="text-center mb-6">
        {isFree ? (
          <>
            <div className="text-4xl font-bold text-foreground">Free</div>
            <div className="text-sm text-muted-foreground mt-1">3 days</div>
          </>
        ) : (
          <>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold text-foreground">
                ${price.monthly}
              </span>
              <span className="text-muted-foreground">/mo</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              or ${price.yearly}/year (save{" "}
              {Math.round((1 - price.yearly / (price.monthly * 12)) * 100)}%)
            </div>
          </>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Button
        asChild
        className={cn(
          "w-full",
          highlighted
            ? "bg-primary hover:bg-primary/90 glow-purple"
            : "bg-muted hover:bg-muted/80 text-foreground"
        )}
        size="lg"
      >
        <a href={ctaLink} onClick={handleCTAClick}>
          {ctaText}
        </a>
      </Button>
    </div>
  );
}
