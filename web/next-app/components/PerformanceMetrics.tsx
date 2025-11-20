/* eslint-disable */
// @ts-nocheck
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { formatNumber, formatPercent } from "@/lib/utils";
import { TrendingUp, Activity, Target, Zap, BarChart3, Hash } from "lucide-react";

type PerformanceMetricsProps = {
  mode: string;
  data: {
    win_rate?: number;
    avg_win?: number;
    avg_loss?: number;
    profit_factor?: number;
    sharpe_ratio?: number;
    max_drawdown?: number;
    total_trades?: number;
    winning_trades?: number;
    losing_trades?: number;
  };
};

export function PerformanceMetrics({ mode, data }: PerformanceMetricsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Performance Metrics - {mode.toUpperCase()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {/* Win Rate */}
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3" />
              Win Rate
              <TooltipExplainer
                term="Win Rate"
                explanation="Percentage of trades that were profitable out of all completed trades"
                size="xs"
              />
            </div>
            <div className="text-2xl font-bold">
              {data.win_rate !== null && data.win_rate !== undefined
                ? formatPercent(data.win_rate)
                : "—"}
            </div>
            {data.winning_trades !== undefined && data.total_trades !== undefined && (
              <div className="text-xs text-muted-foreground">
                {data.winning_trades} / {data.total_trades} trades
              </div>
            )}
          </div>
          
          {/* Average Win */}
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Avg Win
            </div>
            <div className="text-2xl font-bold text-green-500">
              {data.avg_win ? `$${formatNumber(data.avg_win, 2)}` : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              Per winning trade
            </div>
          </div>
          
          {/* Average Loss */}
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Avg Loss
            </div>
            <div className="text-2xl font-bold text-red-500">
              {data.avg_loss ? `$${formatNumber(Math.abs(data.avg_loss), 2)}` : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              Per losing trade
            </div>
          </div>
          
          {/* Profit Factor */}
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Profit Factor
              <TooltipExplainer
                term="Profit Factor"
                explanation="Ratio of total wins to total losses. Above 1.0 is profitable, above 2.0 is excellent"
                size="xs"
              />
            </div>
            <div className={`text-2xl font-bold ${
              data.profit_factor && data.profit_factor > 1 ? "text-green-500" : ""
            }`}>
              {data.profit_factor ? data.profit_factor.toFixed(2) : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              {data.profit_factor && data.profit_factor > 2
                ? "Excellent"
                : data.profit_factor && data.profit_factor > 1
                ? "Profitable"
                : "Needs improvement"}
            </div>
          </div>
          
          {/* Sharpe Ratio */}
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Sharpe Ratio
              <TooltipExplainer
                term="Sharpe Ratio"
                explanation="Risk-adjusted return metric. Above 1.0 is good, above 2.0 is very good, above 3.0 is excellent"
                size="xs"
              />
            </div>
            <div className={`text-2xl font-bold ${
              data.sharpe_ratio && data.sharpe_ratio > 1 ? "text-green-500" : ""
            }`}>
              {data.sharpe_ratio ? data.sharpe_ratio.toFixed(2) : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              {data.sharpe_ratio && data.sharpe_ratio > 2
                ? "Very good"
                : data.sharpe_ratio && data.sharpe_ratio > 1
                ? "Good"
                : "Needs work"}
            </div>
          </div>
          
          {/* Total Trades */}
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Hash className="h-3 w-3" />
              Total Trades
            </div>
            <div className="text-2xl font-bold">
              {data.total_trades || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              {data.winning_trades || 0} wins, {data.losing_trades || 0} losses
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

