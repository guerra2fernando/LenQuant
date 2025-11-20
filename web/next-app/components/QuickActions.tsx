import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TooltipExplainer } from "@/components/TooltipExplainer";

const QUICK_PROMPTS: Array<{ label: string; prompt: string }> = [
  {
    label: "Explain today's top drawdown",
    prompt: "What caused the largest drawdown in the virtual portfolio today?",
  },
  {
    label: "Confidence on BTC scalpers",
    prompt: "How confident are we in BTC/USD scalper strategies for the next 4 hours?",
  },
  {
    label: "Feature drift overview",
    prompt: "Summarize any feature drift or data quality issues detected this week.",
  },
  {
    label: "What changed this week?",
    prompt:
      "What changed this week across strategy evolution and promotions? Summarize winners, losers, and promotions.",
  },
];

type QuickActionsProps = {
  onSelect: (prompt: string) => void;
  onLaunchIntraday?: (params: { bankroll: number }) => Promise<void> | void;
  onReviewPromotion?: () => void;
  isLaunching?: boolean;
};

export function QuickActions({
  onSelect,
  onLaunchIntraday,
  onReviewPromotion,
  isLaunching,
}: QuickActionsProps) {
  const [bankroll, setBankroll] = useState<string>("1000");

  const handleLaunch = async () => {
    if (!onLaunchIntraday) {
      return;
    }
    const bankrollValue = Number(bankroll);
    if (!Number.isFinite(bankrollValue) || bankrollValue <= 0) {
      return;
    }
    await onLaunchIntraday({ bankroll: bankrollValue });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-background/60 p-3">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Quick prompts
          <TooltipExplainer 
            term="Quick prompts" 
            explanation="Pre-written questions you can use to quickly ask the AI assistant common queries about system performance, confidence levels, and recent changes. Click any prompt to instantly ask that question without typing it yourself. These are starting points - you can still ask anything you want in your own words."
            size="sm"
          />
        </h4>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((item) => (
            <button
              key={item.label}
              type="button"
              className="rounded-md border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
              onClick={() => onSelect(item.prompt)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Intraday automation
          <TooltipExplainer 
            term="Intraday automation" 
            explanation="Quick actions to launch and manage intraday strategy cohorts. 'Launch cohort' starts a group of strategies trading on minute/hour timeframes with the specified bankroll. 'Review Day-3 promotion' opens the approval workflow for strategies that have completed their 3-day testing period and passed guard rails. These shortcuts streamline common workflow operations."
            size="sm"
          />
        </h4>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={50}
            step={50}
            value={bankroll}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setBankroll(event.target.value)}
            className="h-9 w-32 text-xs"
            placeholder="Bankroll"
          />
          <Button
            size="sm"
            onClick={handleLaunch}
            disabled={!onLaunchIntraday || isLaunching}
          >
            {isLaunching ? "Launching…" : "Launch cohort"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReviewPromotion}
            disabled={!onReviewPromotion}
          >
            Review Day-3 promotion
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Launch a 30-agent intraday cohort with the selected bankroll and monitor it for Day-3 guard rails.
        </p>
      </div>
    </div>
  );
}

