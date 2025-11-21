// @ts-nocheck
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  HelpCircle,
  X,
  MessageSquare,
  BookOpen,
  TrendingUp,
  ShieldCheck,
  Zap,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/router";
import { useMode } from "@/lib/mode-context";

interface FAQ {
  question: string;
  answer: string;
  category: "trading" | "signals" | "risk" | "general";
}

const FAQS: FAQ[] = [
  {
    question: "How do I place my first trade?",
    answer:
      "Select a cryptocurrency, choose Buy or Sell, enter the amount (in USD or crypto), and click Execute Trade. Paper trading mode is active by default for safe practice.",
    category: "trading",
  },
  {
    question: "What do the confidence scores mean?",
    answer:
      "Confidence scores (0-100%) indicate how certain the AI model is about a prediction. Scores above 80% are considered high confidence and worth paying attention to.",
    category: "signals",
  },
  {
    question: "How are AI predictions generated?",
    answer:
      "Our AI models analyze historical price patterns, market indicators, and multiple technical factors to forecast price movements. Predictions are updated in real-time as new data arrives.",
    category: "signals",
  },
  {
    question: "What's the difference between Paper and Live trading?",
    answer:
      "Paper trading uses virtual money for risk-free practice. Live trading uses real funds connected to your exchange. Always test strategies in Paper mode first.",
    category: "trading",
  },
  {
    question: "How do I set a stop-loss?",
    answer:
      "In the Order Panel, enable 'Advanced Options' and set a stop-loss percentage. This automatically closes your position if it drops below the specified threshold.",
    category: "risk",
  },
  {
    question: "Can I trade automatically?",
    answer:
      "Yes! Activate high-performing strategies from the Analytics > Strategies tab. Autonomous trading will execute trades based on AI signals without manual intervention.",
    category: "trading",
  },
  {
    question: "Why did my prediction change?",
    answer:
      "Predictions update as new market data arrives. Significant changes (>3% or direction flips) trigger alerts. This is normal and reflects real-time market conditions.",
    category: "signals",
  },
  {
    question: "How accurate are the forecasts?",
    answer:
      "Forecast accuracy varies by market conditions and timeframe. Check Analytics > Forecasts to see historical accuracy metrics. No prediction is guaranteed.",
    category: "signals",
  },
];

const CONTEXTUAL_HELP = {
  chart: {
    title: "Understanding the Chart",
    tips: [
      "Green/red bars show price increases/decreases",
      "Blue overlay shows AI price predictions",
      "Hover over any candle to see exact values",
      "Use timeframe selector to zoom in/out",
    ],
  },
  signals: {
    title: "Smart Signal Tips",
    tips: [
      "Signals above 80% confidence are most reliable",
      "Check 'Expected Move' to gauge potential profit",
      "Click 'Ask AI Why' for signal explanations",
      "Recent signals appear at the top",
    ],
  },
  order: {
    title: "Placing Orders",
    tips: [
      "Start small to test your strategy",
      "Review estimated outcome before executing",
      "Set stop-losses to limit downside risk",
      "Check your balance in the Portfolio page",
    ],
  },
  positions: {
    title: "Managing Positions",
    tips: [
      "Green means profit, red means loss",
      "Click 'Close Position' to exit a trade",
      "Consider taking profits at +5% gains",
      "Review position insights in Portfolio",
    ],
  },
};

interface TerminalHelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  context?: "chart" | "signals" | "order" | "positions" | null;
}

export function TerminalHelpDrawer({ isOpen, onClose, context }: TerminalHelpDrawerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const router = useRouter();
  const { isEasyMode } = useMode();

  const filteredFAQs = selectedCategory === "all"
    ? FAQS
    : FAQS.filter((faq) => faq.category === selectedCategory);

  const contextHelp = context ? CONTEXTUAL_HELP[context] : null;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm animate-in fade-in-0"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md animate-in slide-in-from-right-full duration-300">
        <Card className="h-full rounded-l-lg rounded-r-none border-l">
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="border-b p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Terminal Help</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-6">
                {/* Contextual Help (if available) */}
                {contextHelp && (
                  <Card className="border-primary/50 bg-primary/5 p-4">
                    <h3 className="mb-2 flex items-center gap-2 font-semibold text-primary">
                      <Zap className="h-4 w-4" />
                      {contextHelp.title}
                    </h3>
                    <ul className="space-y-2 text-sm">
                      {contextHelp.tips.map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {/* Quick Actions */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                    Need More Help?
                  </h3>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => router.push("/assistant")}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Ask the AI Assistant
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => window.open("https://docs.lenquant.com", "_blank")}
                    >
                      <BookOpen className="h-4 w-4" />
                      View Documentation
                    </Button>
                  </div>
                </div>

                {/* Category Filter */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                    Browse by Topic
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {["all", "trading", "signals", "risk", "general"].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          selectedCategory === cat
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* FAQs */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                    Frequently Asked Questions
                  </h3>
                  <div className="space-y-3">
                    {filteredFAQs.map((faq, idx) => (
                      <Card key={idx} className="p-3">
                        <h4 className="mb-2 text-sm font-semibold">{faq.question}</h4>
                        <p className="text-xs text-muted-foreground">{faq.answer}</p>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Pro Tip */}
                <Card className="border-amber-500/50 bg-amber-500/5 p-4">
                  <h3 className="mb-2 flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
                    <TrendingUp className="h-4 w-4" />
                    Pro Tip
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isEasyMode
                      ? "Start with small paper trades to build confidence. Once comfortable, you can switch to Advanced Mode for more control."
                      : "Use the Strategy Selector to backtest different approaches. Activate only strategies with Sharpe Ratio > 1.5 for better risk-adjusted returns."}
                  </p>
                </Card>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t p-4">
              <p className="text-center text-xs text-muted-foreground">
                Still stuck?{" "}
                <button
                  onClick={() => router.push("/assistant?prompt=I need help with the Terminal")}
                  className="text-primary hover:underline"
                >
                  Chat with our AI Assistant
                </button>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

