/* eslint-disable */
// @ts-nocheck
const QUICK_PROMPTS = [
  {
    label: "Explain today's top drawdown",
    prompt: "What caused the largest drawdown in the virtual portfolio today?",
  },
  {
    label: "Confidence on BTC scalpers",
    prompt: "How confident are we in BTC/USDT scalper strategies for the next 4 hours?",
  },
  {
    label: "Feature drift overview",
    prompt: "Summarize any feature drift or data quality issues detected this week.",
  },
  {
    label: "What changed this week?",
    prompt: "What changed this week across strategy evolution and promotions? Summarize winners, losers, and promotions.",
  },
];

type QuickActionsProps = {
  onSelect: (prompt: string) => void;
};

export function QuickActions({ onSelect }: QuickActionsProps) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick prompts</h4>
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
  );
}

