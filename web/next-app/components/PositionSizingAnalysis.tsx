// @ts-nocheck
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, AlertTriangle } from "lucide-react";

interface Trade {
  pnl?: number;
  quantity?: number;
  entry_price?: number;
}

interface PositionSizingAnalysisProps {
  trades: Trade[];
}

export function PositionSizingAnalysis({ trades }: PositionSizingAnalysisProps) {
  if (!trades || trades.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground text-center">No trades to analyze</p>
      </Card>
    );
  }

  // Calculate position sizing metrics
  const positionSizes = trades.map((t) => {
    const quantity = t.quantity ?? 0;
    const entryPrice = t.entry_price ?? 0;
    return quantity * entryPrice;
  });

  const avgPositionSize = positionSizes.reduce((a, b) => a + b, 0) / positionSizes.length;
  const minPositionSize = Math.min(...positionSizes);
  const maxPositionSize = Math.max(...positionSizes);
  const positionSizeStdDev = Math.sqrt(
    positionSizes.reduce((sum, size) => sum + Math.pow(size - avgPositionSize, 2), 0) / positionSizes.length
  );

  // Analyze relationship between position size and PnL
  const largeTrades = trades.filter((t) => {
    const size = (t.quantity ?? 0) * (t.entry_price ?? 0);
    return size > avgPositionSize;
  });
  const smallTrades = trades.filter((t) => {
    const size = (t.quantity ?? 0) * (t.entry_price ?? 0);
    return size <= avgPositionSize;
  });

  const avgPnLLarge = largeTrades.length > 0
    ? largeTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0) / largeTrades.length
    : 0;
  const avgPnLSmall = smallTrades.length > 0
    ? smallTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0) / smallTrades.length
    : 0;

  const consistency = positionSizeStdDev / avgPositionSize;
  const isConsistent = consistency < 0.3; // Less than 30% variation

  const recommendation = avgPnLLarge > avgPnLSmall
    ? "Larger positions tend to be more profitable. Consider increasing position sizes on high-confidence signals."
    : avgPnLSmall > avgPnLLarge
    ? "Smaller positions are performing better. Consider reducing position sizes or improving signal quality before scaling up."
    : "Position size doesn't significantly impact outcomes. Focus on signal quality and risk management.";

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Avg Position</p>
              <p className="text-sm font-semibold">${avgPositionSize.toFixed(0)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Max Position</p>
              <p className="text-sm font-semibold">${maxPositionSize.toFixed(0)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <div>
              <p className="text-xs text-muted-foreground">Consistency</p>
              <Badge variant={isConsistent ? "success" : "secondary"} className="text-xs">
                {isConsistent ? "Good" : "Variable"}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Position Size Distribution */}
      <Card className="p-4">
        <h4 className="mb-3 text-sm font-semibold">Position Size Distribution</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Small Positions ({smallTrades.length})</span>
            <span className="font-medium">
              Avg PnL: <span className={avgPnLSmall > 0 ? "text-green-600" : "text-red-600"}>
                {avgPnLSmall > 0 ? "+" : ""}{avgPnLSmall.toFixed(2)}
              </span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-blue-500"
              style={{ width: `${(smallTrades.length / trades.length) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Large Positions ({largeTrades.length})</span>
            <span className="font-medium">
              Avg PnL: <span className={avgPnLLarge > 0 ? "text-green-600" : "text-red-600"}>
                {avgPnLLarge > 0 ? "+" : ""}{avgPnLLarge.toFixed(2)}
              </span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary"
              style={{ width: `${(largeTrades.length / trades.length) * 100}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Recommendation */}
      <Card className="border-amber-500/50 bg-amber-500/5 p-4">
        <div className="flex items-start gap-2">
          <DollarSign className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400">
              Position Sizing Insight
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">{recommendation}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

