import React, { useState } from "react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { useMode } from "@/lib/mode-context";
import { fetcher } from "@/lib/api";

// Types for API response
type PromptItem = {
  label: string;
  prompt: string;
  context_relevant?: boolean;
};

type QuickPromptsResponse = {
  prompts: PromptItem[];
};

// Fallback prompts if API fails
const BEGINNER_PROMPTS: Array<{ label: string; prompt: string }> = [
  {
    label: "What should I trade?",
    prompt: "What are the best trading opportunities right now based on AI forecasts?",
  },
  {
    label: "Explain my portfolio",
    prompt: "Explain my current portfolio performance and what each position means.",
  },
  {
    label: "How does this work?",
    prompt: "How does the LenQuant trading system work? Explain in simple terms.",
  },
  {
    label: "Is now a good time to trade?",
    prompt: "Based on current market conditions, is now a good time to open new positions?",
  },
  {
    label: "Should I take profits?",
    prompt: "Should I take profits on any of my current positions? What do you recommend?",
  },
  {
    label: "How accurate are the forecasts?",
    prompt: "How accurate have the AI forecasts been recently? Show me the track record.",
  },
];

const ADVANCED_PROMPTS: Array<{ label: string; prompt: string }> = [
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
  {
    label: "Why did strategy X perform well?",
    prompt: "Analyze the top-performing strategy from last week. What factors contributed to its success?",
  },
  {
    label: "Model performance metrics",
    prompt: "Show me detailed model performance metrics including accuracy, precision, and recent drift indicators.",
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
  const { isEasyMode } = useMode();
  const [bankroll, setBankroll] = useState<string>("1000");
  
  // Fetch dynamic prompts from API (Phase 2 UX Conciliation)
  const userMode = isEasyMode ? "easy" : "advanced";
  const { data: promptsData } = useSWR<QuickPromptsResponse>(`/api/assistant/quick-prompts?user_mode=${userMode}`, fetcher);
  
  // Use API prompts if available, otherwise fallback to static
  const apiPrompts = promptsData?.prompts || [];
  const dynamicPrompts = apiPrompts
    .filter((p: any) => p.context_relevant) // Prioritize context-relevant
    .slice(0, 6)
    .map((p: any) => ({
      label: p.label,
      prompt: p.prompt,
    }));
  
  const QUICK_PROMPTS = dynamicPrompts.length > 0 
    ? dynamicPrompts 
    : (isEasyMode ? BEGINNER_PROMPTS : ADVANCED_PROMPTS);

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
          {isEasyMode ? "Ask the Assistant" : "Quick prompts"}
          <TooltipExplainer 
            term={isEasyMode ? "Ask the Assistant" : "Quick prompts"}
            explanation={isEasyMode 
              ? "Start with these common questions to learn how to use LenQuant and get trading advice. The AI assistant can answer in plain English and guide you through every step."
              : "Pre-written technical queries for power users to quickly analyze system performance, model accuracy, and strategy evolution. Click any to instantly ask that question."
            }
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

      {!isEasyMode && (
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
      )}
    </div>
  );
}

