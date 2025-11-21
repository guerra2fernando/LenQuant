// @ts-nocheck
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, MinusCircle } from "lucide-react";

interface Trade {
  pnl?: number;
  entry_time?: string;
  exit_time?: string;
  symbol?: string;
  side?: string;
}

interface TradeTimelineProps {
  trades: Trade[];
}

export function TradeTimeline({ trades }: TradeTimelineProps) {
  if (!trades || trades.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground text-center">No trades to display</p>
      </Card>
    );
  }

  // Calculate streaks
  const streaks: { type: "win" | "loss"; count: number; startIdx: number }[] = [];
  let currentStreak: { type: "win" | "loss"; count: number; startIdx: number } | null = null;

  trades.forEach((trade, idx) => {
    const pnl = trade.pnl ?? 0;
    const isWin = pnl > 0;
    const type = isWin ? "win" : "loss";

    if (!currentStreak || currentStreak.type !== type) {
      if (currentStreak) {
        streaks.push(currentStreak);
      }
      currentStreak = { type, count: 1, startIdx: idx };
    } else {
      currentStreak.count++;
    }
  });

  if (currentStreak) {
    streaks.push(currentStreak);
  }

  const maxWinStreak = Math.max(...streaks.filter((s) => s.type === "win").map((s) => s.count), 0);
  const maxLossStreak = Math.max(...streaks.filter((s) => s.type === "loss").map((s) => s.count), 0);

  return (
    <div className="space-y-4">
      {/* Streak Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-green-500/30 bg-green-500/5 p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Max Win Streak</p>
              <p className="text-lg font-semibold text-green-600">{maxWinStreak}</p>
            </div>
          </div>
        </Card>
        <Card className="border-red-500/30 bg-red-500/5 p-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-600" />
            <div>
              <p className="text-xs text-muted-foreground">Max Loss Streak</p>
              <p className="text-lg font-semibold text-red-600">{maxLossStreak}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Trade Timeline Visualization */}
      <Card className="p-4">
        <h4 className="mb-3 text-sm font-semibold">Trade Sequence</h4>
        <div className="flex flex-wrap gap-1">
          {trades.map((trade, idx) => {
            const pnl = trade.pnl ?? 0;
            const isWin = pnl > 0;
            const isNeutral = pnl === 0;
            
            return (
              <div
                key={idx}
                className={`group relative h-6 w-6 rounded transition-all hover:scale-125 ${
                  isWin
                    ? "bg-green-500 hover:bg-green-600"
                    : isNeutral
                    ? "bg-gray-400 hover:bg-gray-500"
                    : "bg-red-500 hover:bg-red-600"
                }`}
                title={`Trade ${idx + 1}: ${pnl > 0 ? "+" : ""}${pnl.toFixed(2)} PnL`}
              >
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 group-hover:block">
                  <div className="whitespace-nowrap rounded bg-popover px-2 py-1 text-xs shadow-lg border">
                    <p className="font-semibold">Trade #{idx + 1}</p>
                    <p className={pnl > 0 ? "text-green-600" : pnl < 0 ? "text-red-600" : "text-gray-600"}>
                      {pnl > 0 ? "+" : ""}{pnl.toFixed(2)} PnL
                    </p>
                    {trade.symbol && <p className="text-muted-foreground">{trade.symbol}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-green-500" />
            <span>Win</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-gray-400" />
            <span>Neutral</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-red-500" />
            <span>Loss</span>
          </div>
        </div>
      </Card>

      {/* Notable Streaks */}
      {streaks.filter((s) => s.count >= 3).length > 0 && (
        <Card className="p-4">
          <h4 className="mb-2 text-sm font-semibold">Notable Streaks</h4>
          <div className="space-y-2">
            {streaks
              .filter((s) => s.count >= 3)
              .map((streak, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 rounded-md p-2 ${
                    streak.type === "win"
                      ? "bg-green-500/10 text-green-600"
                      : "bg-red-500/10 text-red-600"
                  }`}
                >
                  {streak.type === "win" ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  <span className="text-sm">
                    {streak.count} {streak.type === "win" ? "consecutive wins" : "consecutive losses"} starting at trade #{streak.startIdx + 1}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}

